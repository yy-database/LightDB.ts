/**
 * SQL 到 LightDB 查询转换器
 * 将 Prisma 生成的 SQL 语句转换为 LightDB 的 NoSQL 查询
 */

import { Lexer } from "@yydb/sql-parser";
import { Parser } from "@yydb/sql-parser";
import {
    NodeKind,
    BinaryOp,
    type SelectStatement,
    type InsertStatement,
    type UpdateStatement,
    type DeleteStatement,
    type Expr,
    type BinaryExpr,
    type LiteralExpr,
    type ColumnRef,
    type TableRef,
    type SqlStatement,
    type InExpr,
    type BetweenExpr,
    type IsNullExpr,
    type LikeExpr,
    type UnaryExpr,
} from "@yydb/sql-ast";
import type { QueryBuilderOptions, InsertBuilderOptions, UpdateBuilderOptions, DeleteBuilderOptions } from "./types.js";

/**
 * SQL 转换结果
 */
export interface ConversionResult<T> {
    /** 转换是否成功 */
    success: boolean;
    /** 转换后的查询选项 */
    data?: T;
    /** 错误信息 */
    error?: string;
}

/**
 * SQL 到 LightDB 查询转换器
 * 负责将 SQL 语句解析并转换为 LightDB 的 NoSQL 查询格式
 */
export class SqlConverter {
    /**
     * 解析 SQL 语句
     * @param sql SQL 语句字符串
     * @returns 解析后的 AST
     */
    private parseSQL(sql: string): SqlStatement | null {
        try {
            const lexer = new Lexer(sql);
            const parser = new Parser(lexer);
            const document = parser.parseDocument();

            if (document.statements.length === 0) {
                return null;
            }

            return document.statements[0] ?? null;
        } catch (error) {
            throw new Error(`SQL 解析失败: ${error instanceof Error ? error.message : "未知错误"}`);
        }
    }

    /**
     * 转换 SELECT 语句
     * @param sql SELECT SQL 语句
     * @param params 参数值数组
     * @returns 查询构建器选项
     */
    public convertSelect(sql: string, params: unknown[] = []): ConversionResult<QueryBuilderOptions> {
        try {
            const statement = this.parseSQL(sql);
            if (!statement || statement.kind !== NodeKind.SelectStatement) {
                return {
                    success: false,
                    error: "不是有效的 SELECT 语句",
                };
            }

            const selectStmt = statement as SelectStatement;
            const result = this.processSelectStatement(selectStmt, params);

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "转换失败",
            };
        }
    }

    /**
     * 转换 INSERT 语句
     * @param sql INSERT SQL 语句
     * @param params 参数值数组
     * @returns 插入构建器选项
     */
    public convertInsert(sql: string, params: unknown[] = []): ConversionResult<InsertBuilderOptions> {
        try {
            const statement = this.parseSQL(sql);
            if (!statement || statement.kind !== NodeKind.InsertStatement) {
                return {
                    success: false,
                    error: "不是有效的 INSERT 语句",
                };
            }

            const insertStmt = statement as InsertStatement;
            const result = this.processInsertStatement(insertStmt, params);

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "转换失败",
            };
        }
    }

    /**
     * 转换 UPDATE 语句
     * @param sql UPDATE SQL 语句
     * @param params 参数值数组
     * @returns 更新构建器选项
     */
    public convertUpdate(sql: string, params: unknown[] = []): ConversionResult<UpdateBuilderOptions> {
        try {
            const statement = this.parseSQL(sql);
            if (!statement || statement.kind !== NodeKind.UpdateStatement) {
                return {
                    success: false,
                    error: "不是有效的 UPDATE 语句",
                };
            }

            const updateStmt = statement as UpdateStatement;
            const result = this.processUpdateStatement(updateStmt, params);

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "转换失败",
            };
        }
    }

    /**
     * 转换 DELETE 语句
     * @param sql DELETE SQL 语句
     * @param params 参数值数组
     * @returns 删除构建器选项
     */
    public convertDelete(sql: string, params: unknown[] = []): ConversionResult<DeleteBuilderOptions> {
        try {
            const statement = this.parseSQL(sql);
            if (!statement || statement.kind !== NodeKind.DeleteStatement) {
                return {
                    success: false,
                    error: "不是有效的 DELETE 语句",
                };
            }

            const deleteStmt = statement as DeleteStatement;
            const result = this.processDeleteStatement(deleteStmt, params);

            return {
                success: true,
                data: result,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "转换失败",
            };
        }
    }

    /**
     * 处理 SELECT 语句
     */
    private processSelectStatement(stmt: SelectStatement, params: unknown[]): QueryBuilderOptions {
        const result: QueryBuilderOptions = {
            tableName: this.getTableName(stmt.from?.table),
            fields: [],
            where: {},
            orderBy: [],
        };

        if (stmt.select) {
            result.fields = this.extractSelectFields(stmt.select.items);
        }

        if (stmt.where) {
            result.where = this.convertWhereClause(stmt.where.condition, params);
        }

        if (stmt.orderBy) {
            result.orderBy = this.extractOrderBy(stmt.orderBy.items);
        }

        if (stmt.limit) {
            result.limit = this.evaluateExpr(stmt.limit.count, params) as number;
        }

        if (stmt.offset) {
            result.offset = this.evaluateExpr(stmt.offset.count, params) as number;
        }

        return result;
    }

    /**
     * 处理 INSERT 语句
     */
    private processInsertStatement(stmt: InsertStatement, params: unknown[]): InsertBuilderOptions {
        const result: InsertBuilderOptions = {
            tableName: this.getTableName(stmt.table),
            columns: stmt.columns,
            values: [],
        };

        if (stmt.values && stmt.values.length > 0) {
            for (const valueRow of stmt.values) {
                const row: Record<string, unknown> = {};
                for (let i = 0; i < valueRow.length; i++) {
                    const column = stmt.columns[i];
                    if (column) {
                        row[column] = this.evaluateExpr(valueRow[i]!, params);
                    }
                }
                result.values.push(row);
            }
        }

        return result;
    }

    /**
     * 处理 UPDATE 语句
     */
    private processUpdateStatement(stmt: UpdateStatement, params: unknown[]): UpdateBuilderOptions {
        const result: UpdateBuilderOptions = {
            tableName: this.getTableName(stmt.table),
            values: {},
            where: {},
        };

        for (const assignment of stmt.assignments) {
            result.values[assignment.column] = this.evaluateExpr(assignment.value, params);
        }

        if (stmt.where) {
            result.where = this.convertWhereClause(stmt.where.condition, params);
        }

        return result;
    }

    /**
     * 处理 DELETE 语句
     */
    private processDeleteStatement(stmt: DeleteStatement, params: unknown[]): DeleteBuilderOptions {
        const result: DeleteBuilderOptions = {
            tableName: this.getTableName(stmt.table),
            where: {},
        };

        if (stmt.where) {
            result.where = this.convertWhereClause(stmt.where.condition, params);
        }

        return result;
    }

    /**
     * 获取表名
     */
    private getTableName(tableRef?: TableRef): string {
        if (!tableRef) {
            return "";
        }
        return tableRef.alias ?? tableRef.table;
    }

    /**
     * 提取 SELECT 字段列表
     */
    private extractSelectFields(items: Array<{ expr: Expr; alias?: string }>): string[] {
        const fields: string[] = [];

        for (const item of items) {
            if (item.expr.kind === NodeKind.ColumnRef) {
                const colRef = item.expr as ColumnRef;
                if (colRef.column === "*") {
                    continue;
                }
                fields.push(colRef.column);
            }
        }

        return fields;
    }

    /**
     * 提取 ORDER BY 条件
     */
    private extractOrderBy(items: Array<{ expr: Expr; descending: boolean }>): Array<{ field: string; direction: "asc" | "desc" }> {
        return items.map((item) => ({
            field: item.expr.kind === NodeKind.ColumnRef ? (item.expr as ColumnRef).column : "",
            direction: item.descending ? "desc" : "asc",
        }));
    }

    /**
     * 转换 WHERE 子句
     */
    private convertWhereClause(condition: Expr, params: unknown[]): Record<string, unknown> {
        return this.convertExpression(condition, params);
    }

    /**
     * 转换表达式为 LightDB 查询条件
     */
    private convertExpression(expr: Expr, params: unknown[]): Record<string, unknown> {
        switch (expr.kind) {
            case NodeKind.BinaryExpr:
                return this.convertBinaryExpr(expr as BinaryExpr, params);
            case NodeKind.ColumnRef:
                return this.convertColumnRef(expr as ColumnRef);
            case NodeKind.LiteralExpr:
                return { _value: this.evaluateLiteral(expr as LiteralExpr) };
            case NodeKind.InExpr:
                return this.convertInExpr(expr as InExpr, params);
            case NodeKind.BetweenExpr:
                return this.convertBetweenExpr(expr as BetweenExpr, params);
            case NodeKind.IsNullExpr:
                return this.convertIsNullExpr(expr as IsNullExpr);
            case NodeKind.LikeExpr:
                return this.convertLikeExpr(expr as LikeExpr, params);
            case NodeKind.UnaryExpr:
                return this.convertUnaryExpr(expr as UnaryExpr, params);
            default:
                return {};
        }
    }

    /**
     * 转换二元表达式
     */
    private convertBinaryExpr(expr: BinaryExpr, params: unknown[]): Record<string, unknown> {
        const { left, right, op } = expr;

        if (op === BinaryOp.And) {
            const leftResult = this.convertExpression(left, params);
            const rightResult = this.convertExpression(right, params);
            return { $and: [leftResult, rightResult] };
        }

        if (op === BinaryOp.Or) {
            const leftResult = this.convertExpression(left, params);
            const rightResult = this.convertExpression(right, params);
            return { $or: [leftResult, rightResult] };
        }

        if (left.kind === NodeKind.ColumnRef) {
            const columnRef = left as ColumnRef;
            const fieldName = columnRef.column;
            const value = this.evaluateExpr(right, params);

            switch (op) {
                case BinaryOp.Eq:
                    return { [fieldName]: value };
                case BinaryOp.Neq:
                    return { [fieldName]: { $ne: value } };
                case BinaryOp.Gt:
                    return { [fieldName]: { $gt: value } };
                case BinaryOp.Gte:
                    return { [fieldName]: { $gte: value } };
                case BinaryOp.Lt:
                    return { [fieldName]: { $lt: value } };
                case BinaryOp.Lte:
                    return { [fieldName]: { $lte: value } };
                default:
                    return {};
            }
        }

        return {};
    }

    /**
     * 转换列引用
     */
    private convertColumnRef(expr: ColumnRef): Record<string, unknown> {
        return { [expr.column]: { $exists: true } };
    }

    /**
     * 转换 IN 表达式
     */
    private convertInExpr(expr: InExpr, params: unknown[]): Record<string, unknown> {
        if (expr.expr.kind === NodeKind.ColumnRef) {
            const columnRef = expr.expr as ColumnRef;
            const values = expr.values.map((v) => this.evaluateExpr(v, params));

            if (expr.negated) {
                return { [columnRef.column]: { $nin: values } };
            }
            return { [columnRef.column]: { $in: values } };
        }
        return {};
    }

    /**
     * 转换 BETWEEN 表达式
     */
    private convertBetweenExpr(expr: BetweenExpr, params: unknown[]): Record<string, unknown> {
        if (expr.expr.kind === NodeKind.ColumnRef) {
            const columnRef = expr.expr as ColumnRef;
            const low = this.evaluateExpr(expr.low, params);
            const high = this.evaluateExpr(expr.high, params);

            if (expr.negated) {
                return {
                    $or: [{ [columnRef.column]: { $lt: low } }, { [columnRef.column]: { $gt: high } }],
                };
            }
            return {
                [columnRef.column]: { $gte: low, $lte: high },
            };
        }
        return {};
    }

    /**
     * 转换 IS NULL 表达式
     */
    private convertIsNullExpr(expr: IsNullExpr): Record<string, unknown> {
        if (expr.expr.kind === NodeKind.ColumnRef) {
            const columnRef = expr.expr as ColumnRef;
            if (expr.negated) {
                return { [columnRef.column]: { $ne: null } };
            }
            return { [columnRef.column]: null };
        }
        return {};
    }

    /**
     * 转换 LIKE 表达式
     */
    private convertLikeExpr(expr: LikeExpr, params: unknown[]): Record<string, unknown> {
        if (expr.expr.kind === NodeKind.ColumnRef) {
            const columnRef = expr.expr as ColumnRef;
            const pattern = this.evaluateExpr(expr.pattern, params);

            if (typeof pattern === "string") {
                const regexPattern = this.convertLikePatternToRegex(pattern);
                if (expr.negated) {
                    return { [columnRef.column]: { $not: { $regex: regexPattern } } };
                }
                return { [columnRef.column]: { $regex: regexPattern } };
            }
        }
        return {};
    }

    /**
     * 转换一元表达式
     */
    private convertUnaryExpr(expr: UnaryExpr, params: unknown[]): Record<string, unknown> {
        const operand = this.convertExpression(expr.operand, params);
        return operand;
    }

    /**
     * 将 LIKE 模式转换为正则表达式
     */
    private convertLikePatternToRegex(pattern: string): string {
        let regex = pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/%/g, ".*")
            .replace(/_/g, ".");
        return `^${regex}$`;
    }

    /**
     * 计算表达式值
     */
    private evaluateExpr(expr: Expr, params: unknown[]): unknown {
        switch (expr.kind) {
            case NodeKind.LiteralExpr:
                return this.evaluateLiteral(expr as LiteralExpr);
            case NodeKind.ParameterExpr:
                return this.getParameterValue(expr.name ?? "", params);
            case NodeKind.ColumnRef:
                return (expr as ColumnRef).column;
            default:
                return null;
        }
    }

    /**
     * 计算字面量值
     */
    private evaluateLiteral(expr: LiteralExpr): unknown {
        return expr.value;
    }

    /**
     * 获取参数值
     */
    private getParameterValue(name: string, params: unknown[]): unknown {
        if (name.startsWith("?") || name.startsWith("$")) {
            const index = parseInt(name.slice(1), 10);
            if (!Number.isNaN(index) && index >= 0 && index < params.length) {
                return params[index];
            }
        }

        if (name.startsWith(":")) {
            const key = name.slice(1);
            if (key && /^\d+$/.test(key)) {
                const index = parseInt(key, 10);
                if (!Number.isNaN(index) && index >= 0 && index < params.length) {
                    return params[index];
                }
            }
        }

        return null;
    }
}
