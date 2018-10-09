/**
 * SQL 执行器
 * 将 SQL 语句转换为 LightDB 操作
 */

import { Lexer } from "@yydb/sql-parser";
import { Parser } from "@yydb/sql-parser";
import {
    NodeKind,
    ConstraintKind,
    type SqlStatement,
    type SelectStatement,
    type InsertStatement,
    type UpdateStatement,
    type DeleteStatement,
    type CreateTableStatement,
    type DropTableStatement,
    type Expr,
    type BinaryExpr,
    type LiteralExpr,
    type ColumnRef,
    BinaryOp,
} from "@yydb/sql-ast";
import type { LightDB } from "@yydb/light-db";
import type { Collection, QueryFilter, IndexConfig } from "@yydb/light-db";
import type { SQLExecutionResult, TableSchema, SchemaRegistry } from "./types.js";

/**
 * SQL 执行器
 * 负责解析 SQL 并执行对应的 LightDB 操作
 */
export class SQLExecutor {
    private readonly db: LightDB;
    private readonly schemaRegistry: SchemaRegistry;

    /**
     * 创建 SQL 执行器实例
     * @param db LightDB 实例
     * @param schemaRegistry Schema 注册表
     */
    constructor(db: LightDB, schemaRegistry: SchemaRegistry) {
        this.db = db;
        this.schemaRegistry = schemaRegistry;
    }

    /**
     * 执行 SQL 语句
     * @param sql SQL 语句
     * @param params 参数值
     * @returns 执行结果
     */
    public execute(sql: string, params: unknown[] = []): SQLExecutionResult {
        const statements = this.parseSQL(sql);

        if (statements.length === 0) {
            return {
                changes: 0,
                lastInsertRowid: 0,
                rows: [],
            };
        }

        const results: SQLExecutionResult[] = [];

        for (const statement of statements) {
            const result = this.executeStatement(statement, params);
            results.push(result);
        }

        return results[results.length - 1]!;
    }

    /**
     * 解析 SQL 语句
     * @param sql SQL 字符串
     * @returns AST 语句列表
     */
    private parseSQL(sql: string): SqlStatement[] {
        const lexer = new Lexer(sql);
        const parser = new Parser(lexer);
        const document = parser.parseDocument();

        if (parser.getErrors().length > 0) {
            const error = parser.getErrors()[0]!;
            throw new Error(`SQL Parse Error: ${error.message} at line ${error.line}, column ${error.column}`);
        }

        return document.statements;
    }

    /**
     * 执行单个语句
     * @param statement AST 语句
     * @param params 参数
     * @returns 执行结果
     */
    private executeStatement(statement: SqlStatement, params: unknown[]): SQLExecutionResult {
        switch (statement.kind) {
            case NodeKind.SelectStatement:
                return this.executeSelect(statement, params);
            case NodeKind.InsertStatement:
                return this.executeInsert(statement, params);
            case NodeKind.UpdateStatement:
                return this.executeUpdate(statement, params);
            case NodeKind.DeleteStatement:
                return this.executeDelete(statement, params);
            case NodeKind.CreateTableStatement:
                return this.executeCreateTable(statement);
            case NodeKind.DropTableStatement:
                return this.executeDropTable(statement);
            default:
                throw new Error(`Unsupported statement type: ${statement.kind}`);
        }
    }

    /**
     * 执行 SELECT 语句
     * @param statement SELECT 语句 AST
     * @param params 参数
     * @returns 查询结果
     */
    private executeSelect(statement: SelectStatement, params: unknown[]): SQLExecutionResult {
        if (!statement.from) {
            throw new Error("SELECT statement must have FROM clause");
        }

        const tableName = statement.from.table.table;
        const collection = this.getCollection(tableName);

        const filter = this.buildFilter(statement.where?.condition, params);
        const result = collection.find({ where: filter });

        let rows = result.docs;

        if (statement.orderBy) {
            rows = this.applyOrderBy(rows, statement);
        }

        if (statement.limit) {
            const limitValue = this.evaluateExpr(statement.limit.count, params);
            const limit = typeof limitValue === "number" ? limitValue : 0;
            rows = rows.slice(0, limit);
        }

        if (statement.offset) {
            const offsetValue = this.evaluateExpr(statement.offset.count, params);
            const offset = typeof offsetValue === "number" ? offsetValue : 0;
            rows = rows.slice(offset);
        }

        if (statement.select) {
            rows = this.applyProjection(rows, statement);
        }

        return {
            changes: rows.length,
            lastInsertRowid: 0,
            rows,
        };
    }

    /**
     * 执行 INSERT 语句
     * @param statement INSERT 语句 AST
     * @param params 参数
     * @returns 执行结果
     */
    private executeInsert(statement: InsertStatement, params: unknown[]): SQLExecutionResult {
        const tableName = statement.table.table;
        const collection = this.getCollection(tableName);
        const schema = this.getSchema(tableName);

        const rows: Record<string, unknown>[] = [];

        if (statement.values && statement.values.length > 0) {
            for (const valueRow of statement.values) {
                const doc: Record<string, unknown> = {};

                for (let i = 0; i < statement.columns.length; i++) {
                    const columnName = statement.columns[i]!;
                    const value = this.evaluateExpr(valueRow[i]!, params);
                    doc[columnName] = value;
                }

                rows.push(doc);
            }
        }

        let lastInsertRowid: number | bigint = 0;

        for (const doc of rows) {
            const result = collection.insert(doc as Record<string, unknown>);
            if (result.success && result.insertedDocs.length > 0) {
                const insertedDoc = result.insertedDocs[0]!;
                const pkValue = insertedDoc[schema.primaryKey];
                lastInsertRowid = typeof pkValue === "number" ? pkValue : typeof pkValue === "string" ? Number.parseInt(pkValue, 10) : 0;
            }
        }

        return {
            changes: rows.length,
            lastInsertRowid,
            rows: statement.returning ? rows : [],
        };
    }

    /**
     * 执行 UPDATE 语句
     * @param statement UPDATE 语句 AST
     * @param params 参数
     * @returns 执行结果
     */
    private executeUpdate(statement: UpdateStatement, params: unknown[]): SQLExecutionResult {
        const tableName = statement.table.table;
        const collection = this.getCollection(tableName);

        const filter = this.buildFilter(statement.where?.condition, params);

        const updateData: Record<string, unknown> = {};
        for (const assignment of statement.assignments) {
            updateData[assignment.column] = this.evaluateExpr(assignment.value, params);
        }

        const result = collection.updateMany(filter, { $set: updateData });

        return {
            changes: result.modifiedCount,
            lastInsertRowid: 0,
            rows: [],
        };
    }

    /**
     * 执行 DELETE 语句
     * @param statement DELETE 语句 AST
     * @param params 参数
     * @returns 执行结果
     */
    private executeDelete(statement: DeleteStatement, params: unknown[]): SQLExecutionResult {
        const tableName = statement.table.table;
        const collection = this.getCollection(tableName);

        const filter = this.buildFilter(statement.where?.condition, params);
        const result = collection.deleteMany(filter);

        return {
            changes: result.deletedCount,
            lastInsertRowid: 0,
            rows: [],
        };
    }

    /**
     * 执行 CREATE TABLE 语句
     * @param statement CREATE TABLE 语句 AST
     * @returns 执行结果
     */
    private executeCreateTable(statement: CreateTableStatement): SQLExecutionResult {
        const tableName = statement.table.table;

        const primaryKey = this.findPrimaryKey(statement);
        const columns = statement.columns.map((col) => ({
            name: col.name,
            dataType: this.dataTypeToString(col.dataType.dataTypeKind),
            nullable: !col.constraints.some(
                (c) => c.constraintKind === ConstraintKind.PrimaryKey || c.constraintKind === ConstraintKind.NotNull,
            ),
            hasDefault: col.constraints.some((c) => c.constraintKind === ConstraintKind.Default),
            autoIncrement: col.constraints.some((c) => c.constraintKind === ConstraintKind.AutoIncrement),
        }));

        const indexes = this.extractIndexes(statement);

        const schema: TableSchema = {
            tableName,
            primaryKey,
            columns,
            indexes,
        };

        this.schemaRegistry.schemas.set(tableName, schema);

        this.db.collection(tableName, {
            name: tableName,
            primaryKey,
            indexes: indexes ?? [],
        });

        return {
            changes: 0,
            lastInsertRowid: 0,
            rows: [],
        };
    }

    /**
     * 执行 DROP TABLE 语句
     * @param statement DROP TABLE 语句 AST
     * @returns 执行结果
     */
    private executeDropTable(statement: DropTableStatement): SQLExecutionResult {
        const tableName = statement.table.table;

        this.db.dropCollection(tableName);
        this.schemaRegistry.tables.delete(tableName);
        this.schemaRegistry.schemas.delete(tableName);

        return {
            changes: 0,
            lastInsertRowid: 0,
            rows: [],
        };
    }

    /**
     * 构建查询过滤器
     * @param expr 表达式 AST
     * @param params 参数
     * @returns 查询过滤器
     */
    private buildFilter(expr: Expr | undefined, params: unknown[]): QueryFilter<Record<string, unknown>> {
        if (!expr) {
            return {};
        }

        return this.exprToFilter(expr, params);
    }

    /**
     * 将表达式转换为过滤器
     * @param expr 表达式
     * @param params 参数
     * @returns 过滤器
     */
    private exprToFilter(expr: Expr, params: unknown[]): QueryFilter<Record<string, unknown>> {
        if (expr.kind === NodeKind.BinaryExpr) {
            const binary = expr as BinaryExpr;

            if (binary.op === BinaryOp.And) {
                const left = this.exprToFilter(binary.left, params);
                const right = this.exprToFilter(binary.right, params);
                return { $and: [left, right] } as QueryFilter<Record<string, unknown>>;
            }

            if (binary.op === BinaryOp.Or) {
                const left = this.exprToFilter(binary.left, params);
                const right = this.exprToFilter(binary.right, params);
                return { $or: [left, right] } as QueryFilter<Record<string, unknown>>;
            }

            if (binary.left.kind === NodeKind.ColumnRef) {
                const columnRef = binary.left as ColumnRef;
                const columnName = columnRef.column;
                const value = this.evaluateExpr(binary.right, params);

                switch (binary.op) {
                    case BinaryOp.Eq:
                        return { [columnName]: value } as QueryFilter<Record<string, unknown>>;
                    case BinaryOp.Neq:
                        return {
                            [columnName]: { $ne: value },
                        } as QueryFilter<Record<string, unknown>>;
                    case BinaryOp.Gt:
                        return {
                            [columnName]: { $gt: value },
                        } as QueryFilter<Record<string, unknown>>;
                    case BinaryOp.Gte:
                        return {
                            [columnName]: { $gte: value },
                        } as QueryFilter<Record<string, unknown>>;
                    case BinaryOp.Lt:
                        return {
                            [columnName]: { $lt: value },
                        } as QueryFilter<Record<string, unknown>>;
                    case BinaryOp.Lte:
                        return {
                            [columnName]: { $lte: value },
                        } as QueryFilter<Record<string, unknown>>;
                    default:
                        break;
                }
            }
        }

        return {};
    }

    /**
     * 计算表达式值
     * @param expr 表达式 AST
     * @param params 参数
     * @returns 计算结果
     */
    private evaluateExpr(expr: Expr, params: unknown[]): unknown {
        switch (expr.kind) {
            case NodeKind.LiteralExpr: {
                const literal = expr as LiteralExpr;
                return literal.value;
            }
            case NodeKind.ColumnRef: {
                return undefined;
            }
            case NodeKind.ParameterExpr: {
                if (expr.index !== undefined) {
                    return params[expr.index];
                }
                if (expr.name !== undefined) {
                    const name = expr.name.replace(/^[$:?]/, "");
                    if (name.match(/^\d+$/)) {
                        return params[Number.parseInt(name, 10) - 1];
                    }
                    return params[0];
                }
                return params[0];
            }
            case NodeKind.BinaryExpr: {
                const binary = expr as BinaryExpr;
                const left = this.evaluateExpr(binary.left, params);
                const right = this.evaluateExpr(binary.right, params);

                if (typeof left === "number" && typeof right === "number") {
                    switch (binary.op) {
                        case BinaryOp.Add:
                            return left + right;
                        case BinaryOp.Sub:
                            return left - right;
                        case BinaryOp.Mul:
                            return left * right;
                        case BinaryOp.Div:
                            return left / right;
                        case BinaryOp.Mod:
                            return left % right;
                        default:
                            break;
                    }
                }

                if (typeof left === "string" && typeof right === "string") {
                    if (binary.op === BinaryOp.Concat) {
                        return left + right;
                    }
                }

                return undefined;
            }
            default:
                return undefined;
        }
    }

    /**
     * 应用排序
     * @param rows 数据行
     * @param statement SELECT 语句
     * @returns 排序后的数据
     */
    private applyOrderBy(rows: Record<string, unknown>[], statement: SelectStatement): Record<string, unknown>[] {
        if (!statement.orderBy) {
            return rows;
        }

        return rows.sort((a, b) => {
            for (const item of statement.orderBy!.items) {
                if (item.expr.kind === NodeKind.ColumnRef) {
                    const columnName = (item.expr as ColumnRef).column;
                    const aVal = a[columnName];
                    const bVal = b[columnName];

                    let cmp = 0;
                    if (typeof aVal === "number" && typeof bVal === "number") {
                        cmp = aVal - bVal;
                    } else if (typeof aVal === "string" && typeof bVal === "string") {
                        cmp = aVal.localeCompare(bVal);
                    } else if (aVal === null && bVal !== null) {
                        cmp = -1;
                    } else if (aVal !== null && bVal === null) {
                        cmp = 1;
                    }

                    if (cmp !== 0) {
                        return item.descending ? -cmp : cmp;
                    }
                }
            }
            return 0;
        });
    }

    /**
     * 应用投影
     * @param rows 数据行
     * @param statement SELECT 语句
     * @returns 投影后的数据
     */
    private applyProjection(rows: Record<string, unknown>[], statement: SelectStatement): Record<string, unknown>[] {
        if (!statement.select) {
            return rows;
        }

        const selectAll = statement.select.items.some(
            (item) => item.expr.kind === NodeKind.ColumnRef && (item.expr as ColumnRef).column === "*",
        );

        if (selectAll) {
            return rows;
        }

        return rows.map((row) => {
            const projected: Record<string, unknown> = {};

            for (const item of statement.select!.items) {
                if (item.expr.kind === NodeKind.ColumnRef) {
                    const columnName = (item.expr as ColumnRef).column;
                    const alias = item.alias ?? columnName;
                    projected[alias] = row[columnName];
                }
            }

            return projected;
        });
    }

    /**
     * 获取集合
     * @param tableName 表名
     * @returns 集合实例
     */
    private getCollection(tableName: string): Collection<Record<string, unknown>> {
        let collection = this.schemaRegistry.tables.get(tableName);

        if (!collection) {
            const schema = this.schemaRegistry.schemas.get(tableName);
            if (schema) {
                collection = this.db.collection(tableName, {
                    name: tableName,
                    primaryKey: schema.primaryKey,
                    indexes: schema.indexes ?? [],
                });
                this.schemaRegistry.tables.set(tableName, collection);
            } else {
                collection = this.db.collection(tableName, {
                    name: tableName,
                    primaryKey: "id",
                });
                this.schemaRegistry.tables.set(tableName, collection);
            }
        }

        return collection;
    }

    /**
     * 获取 Schema
     * @param tableName 表名
     * @returns Schema 定义
     */
    private getSchema(tableName: string): TableSchema {
        let schema = this.schemaRegistry.schemas.get(tableName);

        if (!schema) {
            schema = {
                tableName,
                primaryKey: "id",
                columns: [],
            };
            this.schemaRegistry.schemas.set(tableName, schema);
        }

        return schema;
    }

    /**
     * 查找主键
     * @param statement CREATE TABLE 语句
     * @returns 主键字段名
     */
    private findPrimaryKey(statement: CreateTableStatement): string {
        for (const col of statement.columns) {
            for (const constraint of col.constraints) {
                if (constraint.constraintKind === ConstraintKind.PrimaryKey) {
                    return col.name;
                }
            }
        }

        for (const constraint of statement.constraints) {
            if (constraint.constraintKind === ConstraintKind.PrimaryKey) {
                return constraint.columns[0] ?? "id";
            }
        }

        return "id";
    }

    /**
     * 提取索引配置
     * @param statement CREATE TABLE 语句
     * @returns 索引配置列表
     */
    private extractIndexes(statement: CreateTableStatement): IndexConfig<Record<string, unknown>>[] {
        const indexes: IndexConfig<Record<string, unknown>>[] = [];

        for (const col of statement.columns) {
            for (const constraint of col.constraints) {
                if (constraint.constraintKind === ConstraintKind.Unique) {
                    indexes.push({
                        name: `${col.name}_unique`,
                        fieldName: col.name,
                        unique: true,
                    });
                }
            }
        }

        for (const constraint of statement.constraints) {
            if (constraint.constraintKind === ConstraintKind.Unique) {
                for (const colName of constraint.columns) {
                    indexes.push({
                        name: `${colName}_unique`,
                        fieldName: colName,
                        unique: true,
                    });
                }
            }
        }

        return indexes;
    }

    /**
     * 数据类型转换为字符串
     * @param dataTypeKind 数据类型枚举
     * @returns 数据类型字符串
     */
    private dataTypeToString(dataTypeKind: number): string {
        const typeMap: Record<number, string> = {
            [0]: "INT",
            [1]: "BIGINT",
            [2]: "SMALLINT",
            [3]: "TINYINT",
            [4]: "DECIMAL",
            [5]: "FLOAT",
            [6]: "DOUBLE",
            [7]: "CHAR",
            [8]: "VARCHAR",
            [9]: "TEXT",
            [10]: "BOOLEAN",
            [11]: "DATE",
            [12]: "TIME",
            [13]: "DATETIME",
            [14]: "TIMESTAMP",
            [15]: "BLOB",
            [16]: "JSON",
            [17]: "UUID",
        };
        return typeMap[dataTypeKind] ?? "TEXT";
    }
}
