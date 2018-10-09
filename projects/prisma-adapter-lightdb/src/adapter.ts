/**
 * LightDB Prisma 适配器
 * 实现 Prisma 的 SqlDriverAdapter 接口，将 SQL 查询转换为 LightDB 的 NoSQL 操作
 */

import type {
    SqlDriverAdapter,
    SqlDriverAdapterFactory,
    Transaction,
    TransactionOptions,
    SqlQuery,
    SqlResultSet,
    Provider,
    IsolationLevel,
    ColumnType,
} from "@prisma/driver-adapter-utils";
import { LightDB } from "@yydb/light-db";
import type { Collection } from "@yydb/light-db";
import { SqlConverter } from "./sql-converter.js";
import type { LightDBAdapterOptions } from "./types.js";

/**
 * LightDB Prisma 适配器错误类
 */
export class LightDBAdapterError extends Error {
    public readonly code: string;

    constructor(message: string, code: string) {
        super(message);
        this.name = "LightDBAdapterError";
        this.code = code;
        Object.setPrototypeOf(this, LightDBAdapterError.prototype);
    }
}

/**
 * LightDB 事务包装器
 * 实现 Prisma 的 Transaction 接口
 */
class LightDBTransaction implements Transaction {
    private readonly db: LightDB;
    private readonly collections: Map<string, Collection<Record<string, unknown>>>;
    private committed: boolean;
    private rolledBack: boolean;
    public readonly provider: Provider = "sqlite";
    public readonly adapterName = "lightdb";
    public readonly options: TransactionOptions;

    constructor(db: LightDB, options?: TransactionOptions) {
        this.db = db;
        this.collections = new Map();
        this.committed = false;
        this.rolledBack = false;
        this.options = options ?? { usePhantomQuery: false };
    }

    /**
     * 执行查询
     */
    public async queryRaw(params: SqlQuery): Promise<SqlResultSet> {
        try {
            const converter = new SqlConverter();
            const result = converter.convertSelect(params.sql, params.args);

            if (!result.success || !result.data) {
                throw new LightDBAdapterError(result.error ?? "SQL 解析失败", "PARSE_ERROR");
            }

            const collection = this.getOrCreateCollection(result.data.tableName);
            const docs = collection.find({
                where: result.data.where as Record<string, unknown>,
                sort: result.data.orderBy?.reduce(
                    (acc, item) => {
                        acc[item.field as keyof Record<string, unknown>] = item.direction === "desc" ? -1 : 1;
                        return acc;
                    },
                    {} as Record<string, 1 | -1>,
                ),
                offset: result.data.offset,
                limit: result.data.limit,
            }).docs;

            const columnNames = result.data.fields?.length ? result.data.fields : docs.length > 0 ? Object.keys(docs[0]!) : [];

            return {
                columnTypes: this.inferColumnTypes(docs, columnNames),
                columnNames: columnNames,
                rows: docs.map((doc) => this.convertDocToRow(doc, columnNames)),
            };
        } catch (error) {
            throw new LightDBAdapterError(error instanceof Error ? error.message : "查询执行失败", "EXECUTION_ERROR");
        }
    }

    /**
     * 执行命令
     */
    public async executeRaw(params: SqlQuery): Promise<number> {
        try {
            const converter = new SqlConverter();
            const upperQuery = params.sql.trim().toUpperCase();

            if (upperQuery.startsWith("INSERT")) {
                const result = converter.convertInsert(params.sql, params.args);
                if (!result.success || !result.data) {
                    throw new LightDBAdapterError(result.error ?? "SQL 解析失败", "PARSE_ERROR");
                }

                const collection = this.getOrCreateCollection(result.data.tableName);
                let insertedCount = 0;

                for (const value of result.data.values) {
                    collection.insert(value);
                    insertedCount++;
                }

                return insertedCount;
            }

            if (upperQuery.startsWith("UPDATE")) {
                const result = converter.convertUpdate(params.sql, params.args);
                if (!result.success || !result.data) {
                    throw new LightDBAdapterError(result.error ?? "SQL 解析失败", "PARSE_ERROR");
                }

                const collection = this.getOrCreateCollection(result.data.tableName);
                const updateResult = collection.updateMany(result.data.where as Record<string, unknown>, { $set: result.data.values });

                return updateResult.modifiedCount;
            }

            if (upperQuery.startsWith("DELETE")) {
                const result = converter.convertDelete(params.sql, params.args);
                if (!result.success || !result.data) {
                    throw new LightDBAdapterError(result.error ?? "SQL 解析失败", "PARSE_ERROR");
                }

                const collection = this.getOrCreateCollection(result.data.tableName);
                const deleteResult = collection.deleteMany(result.data.where as Record<string, unknown>);

                return deleteResult.deletedCount;
            }

            return 0;
        } catch (error) {
            throw new LightDBAdapterError(error instanceof Error ? error.message : "执行失败", "EXECUTION_ERROR");
        }
    }

    /**
     * 提交事务
     */
    public async commit(): Promise<void> {
        if (this.committed || this.rolledBack) {
            throw new LightDBAdapterError("事务已经结束", "INVALID_TRANSACTION_STATE");
        }
        this.committed = true;
    }

    /**
     * 回滚事务
     */
    public async rollback(): Promise<void> {
        if (this.committed || this.rolledBack) {
            throw new LightDBAdapterError("事务已经结束", "INVALID_TRANSACTION_STATE");
        }
        this.rolledBack = true;
    }

    /**
     * 获取或创建集合
     */
    private getOrCreateCollection(name: string): Collection<Record<string, unknown>> {
        let collection = this.collections.get(name);
        if (!collection) {
            collection = this.db.collection(name, {
                name,
                primaryKey: "id",
            });
            this.collections.set(name, collection);
        }
        return collection;
    }

    /**
     * 推断列类型
     */
    private inferColumnTypes(docs: Record<string, unknown>[], columnNames: string[]): Array<ColumnType> {
        if (docs.length === 0) {
            return columnNames.map(() => 7);
        }

        const firstDoc = docs[0]!;

        return columnNames.map((col) => {
            const value = firstDoc[col];
            if (value === null || value === undefined) {
                return 7;
            }

            if (typeof value === "number") {
                return Number.isInteger(value) ? 0 : 2;
            }
            if (typeof value === "boolean") {
                return 5;
            }
            if (typeof value === "string") {
                return 7;
            }
            if (value instanceof Date) {
                return 10;
            }
            if (value instanceof Uint8Array) {
                return 13;
            }
            return 7;
        });
    }

    /**
     * 将文档转换为行数据
     */
    private convertDocToRow(doc: Record<string, unknown>, columnNames: string[]): unknown[] {
        return columnNames.map((col) => {
            const value = doc[col];
            if (value instanceof Date) {
                return value.toISOString();
            }
            if (typeof value === "object" && value !== null) {
                return JSON.stringify(value);
            }
            return value;
        });
    }
}

/**
 * LightDB Prisma 适配器
 * 实现 Prisma 的 SqlDriverAdapter 接口
 */
export class PrismaLightDBAdapter implements SqlDriverAdapter {
    private readonly db: LightDB;
    public readonly provider: Provider = "sqlite";
    public readonly adapterName = "lightdb";

    constructor(db: LightDB) {
        this.db = db;
    }

    /**
     * 执行查询
     * 返回查询结果集
     *
     * @param params SQL 查询参数
     * @returns 查询结果
     */
    public async queryRaw(params: SqlQuery): Promise<SqlResultSet> {
        try {
            const converter = new SqlConverter();
            const result = converter.convertSelect(params.sql, params.args);

            if (!result.success || !result.data) {
                throw new LightDBAdapterError(result.error ?? "SQL 解析失败", "PARSE_ERROR");
            }

            const collection = this.getOrCreateCollection(result.data.tableName);
            const docs = collection.find({
                where: result.data.where as Record<string, unknown>,
                sort: result.data.orderBy?.reduce(
                    (acc, item) => {
                        acc[item.field as keyof Record<string, unknown>] = item.direction === "desc" ? -1 : 1;
                        return acc;
                    },
                    {} as Record<string, 1 | -1>,
                ),
                offset: result.data.offset,
                limit: result.data.limit,
            }).docs;

            const columnNames = result.data.fields?.length ? result.data.fields : docs.length > 0 ? Object.keys(docs[0]!) : [];

            return {
                columnTypes: this.inferColumnTypes(docs, columnNames),
                columnNames: columnNames,
                rows: docs.map((doc) => this.convertDocToRow(doc, columnNames)),
            };
        } catch (error) {
            throw new LightDBAdapterError(error instanceof Error ? error.message : "查询执行失败", "EXECUTION_ERROR");
        }
    }

    /**
     * 执行命令
     * 执行 INSERT、UPDATE、DELETE 等修改操作
     *
     * @param params SQL 命令参数
     * @returns 受影响的行数
     */
    public async executeRaw(params: SqlQuery): Promise<number> {
        try {
            const converter = new SqlConverter();
            const upperQuery = params.sql.trim().toUpperCase();

            if (upperQuery.startsWith("INSERT")) {
                const result = converter.convertInsert(params.sql, params.args);
                if (!result.success || !result.data) {
                    throw new LightDBAdapterError(result.error ?? "SQL 解析失败", "PARSE_ERROR");
                }

                const collection = this.getOrCreateCollection(result.data.tableName);
                let insertedCount = 0;

                for (const value of result.data.values) {
                    collection.insert(value);
                    insertedCount++;
                }

                return insertedCount;
            }

            if (upperQuery.startsWith("UPDATE")) {
                const result = converter.convertUpdate(params.sql, params.args);
                if (!result.success || !result.data) {
                    throw new LightDBAdapterError(result.error ?? "SQL 解析失败", "PARSE_ERROR");
                }

                const collection = this.getOrCreateCollection(result.data.tableName);
                const updateResult = collection.updateMany(result.data.where as Record<string, unknown>, { $set: result.data.values });

                return updateResult.modifiedCount;
            }

            if (upperQuery.startsWith("DELETE")) {
                const result = converter.convertDelete(params.sql, params.args);
                if (!result.success || !result.data) {
                    throw new LightDBAdapterError(result.error ?? "SQL 解析失败", "PARSE_ERROR");
                }

                const collection = this.getOrCreateCollection(result.data.tableName);
                const deleteResult = collection.deleteMany(result.data.where as Record<string, unknown>);

                return deleteResult.deletedCount;
            }

            if (upperQuery.startsWith("CREATE")) {
                return 0;
            }

            if (upperQuery.startsWith("DROP")) {
                return 0;
            }

            throw new LightDBAdapterError("不支持的操作类型", "UNSUPPORTED_OPERATION");
        } catch (error) {
            throw new LightDBAdapterError(error instanceof Error ? error.message : "执行失败", "EXECUTION_ERROR");
        }
    }

    /**
     * 执行多个 SQL 语句
     *
     * @param script SQL 脚本
     */
    public async executeScript(script: string): Promise<void> {
        const statements = script.split(";").filter((s) => s.trim());
        for (const statement of statements) {
            await this.executeRaw({ sql: statement, args: [], argTypes: [] });
        }
    }

    /**
     * 开始事务
     * 返回一个事务对象，用于执行事务内的操作
     *
     * @param isolationLevel 隔离级别
     * @returns 事务对象
     */
    public async startTransaction(_isolationLevel?: IsolationLevel): Promise<Transaction> {
        return new LightDBTransaction(this.db, { usePhantomQuery: false });
    }

    /**
     * 释放资源并关闭连接
     */
    public async dispose(): Promise<void> {
        await this.db.close();
    }

    /**
     * 获取或创建集合
     */
    private getOrCreateCollection(name: string): Collection<Record<string, unknown>> {
        return this.db.collection(name, {
            name,
            primaryKey: "id",
        });
    }

    /**
     * 推断列类型
     */
    private inferColumnTypes(docs: Record<string, unknown>[], columnNames: string[]): Array<ColumnType> {
        if (docs.length === 0) {
            return columnNames.map(() => 7);
        }

        const firstDoc = docs[0]!;

        return columnNames.map((col) => {
            const value = firstDoc[col];
            if (value === null || value === undefined) {
                return 7;
            }

            if (typeof value === "number") {
                return Number.isInteger(value) ? 0 : 2;
            }
            if (typeof value === "boolean") {
                return 5;
            }
            if (typeof value === "string") {
                return 7;
            }
            if (value instanceof Date) {
                return 10;
            }
            if (value instanceof Uint8Array) {
                return 13;
            }
            return 7;
        });
    }

    /**
     * 将文档转换为行数据
     */
    private convertDocToRow(doc: Record<string, unknown>, columnNames: string[]): unknown[] {
        return columnNames.map((col) => {
            const value = doc[col];
            if (value instanceof Date) {
                return value.toISOString();
            }
            if (typeof value === "object" && value !== null) {
                return JSON.stringify(value);
            }
            return value;
        });
    }
}

/**
 * LightDB Prisma 适配器工厂
 * 实现 Prisma 的 SqlDriverAdapterFactory 接口
 */
export class PrismaLightDBAdapterFactory implements SqlDriverAdapterFactory {
    private readonly options: LightDBAdapterOptions;
    private db: LightDB | null = null;
    private adapter: PrismaLightDBAdapter | null = null;
    public readonly provider: Provider = "sqlite";
    public readonly adapterName = "lightdb";

    constructor(options: LightDBAdapterOptions) {
        this.options = options;
    }

    /**
     * 连接到数据库并返回适配器
     */
    public async connect(): Promise<SqlDriverAdapter> {
        if (!this.db) {
            this.db = await LightDB.open(this.options.dbPath, {
                dbName: this.options.dbName ?? "default",
                pageSize: this.options.pageSize,
                walThreshold: this.options.walThreshold,
                autoCheckpoint: this.options.autoCheckpoint,
            });
        }

        if (!this.adapter) {
            this.adapter = new PrismaLightDBAdapter(this.db);
        }

        return this.adapter;
    }

    /**
     * 断开数据库连接
     */
    public async disconnect(): Promise<void> {
        if (this.adapter) {
            await this.adapter.dispose();
            this.adapter = null;
        }
        this.db = null;
    }
}

/**
 * 创建 LightDB 适配器工厂
 * 便捷函数，用于创建 PrismaLightDBAdapterFactory 实例
 *
 * @param options 适配器配置选项
 * @returns 适配器工厂实例
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { createLightDBAdapterFactory } from '@prisma/adapter-lightdb';
 *
 * const adapterFactory = createLightDBAdapterFactory({
 *   dbPath: './data/mydb.light'
 * });
 *
 * const adapter = await adapterFactory.connect();
 *
 * const prisma = new PrismaClient({
 *   adapter
 * });
 * ```
 */
export function createLightDBAdapterFactory(options: LightDBAdapterOptions): PrismaLightDBAdapterFactory {
    return new PrismaLightDBAdapterFactory(options);
}

/**
 * 创建 LightDB 适配器
 * 便捷函数，用于直接创建 PrismaLightDBAdapter 实例
 *
 * @param db 已初始化的 LightDB 实例
 * @returns 适配器实例
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { LightDB } from '@yydb/light-db';
 * import { createLightDBAdapter } from '@prisma/adapter-lightdb';
 *
 * const db = await LightDB.open('./data/mydb.light');
 * const adapter = createLightDBAdapter(db);
 *
 * const prisma = new PrismaClient({
 *   adapter
 * });
 * ```
 */
export function createLightDBAdapter(db: LightDB): PrismaLightDBAdapter {
    return new PrismaLightDBAdapter(db);
}
