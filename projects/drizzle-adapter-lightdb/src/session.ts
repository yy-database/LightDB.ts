/**
 * Drizzle Session 实现
 * 实现 Drizzle ORM 的 SQLite Session 接口
 */

import { NoopLogger } from "drizzle-orm";
import type { RelationalSchemaConfig, TablesRelationalConfig } from "drizzle-orm";
import type { Query } from "drizzle-orm";
import { SQLiteSession, SQLiteTransaction, SQLitePreparedQuery } from "drizzle-orm/sqlite-core";
import type {
    PreparedQueryConfig as PreparedQueryConfigBase,
    SQLiteExecuteMethod,
    SQLiteTransactionConfig,
    SelectedFieldsOrdered,
} from "drizzle-orm/sqlite-core";
import type { LightDB } from "@yydb/light-db";
import { SQLExecutor } from "./sql-executor.js";
import type { SchemaRegistry, DrizzleSessionConfig, LightDBResult } from "./types.js";

/**
 * LightDB Drizzle Session
 * 实现 Drizzle ORM 的 SQLite Session 接口
 */
export class LightDBSession<TFullSchema extends Record<string, unknown>, TSchema extends TablesRelationalConfig> extends SQLiteSession<
    "async",
    LightDBResult,
    TFullSchema,
    TSchema
> {
    static override readonly [Symbol.for("drizzle:entityKind")]: string = "LightDBSession";

    private readonly lightDb: LightDB;
    private readonly executor: SQLExecutor;
    private readonly registry: SchemaRegistry;
    private readonly sessionLogger: NoopLogger;

    /**
     * 创建 LightDB Session 实例
     * @param db LightDB 实例
     * @param dialect SQLite 方言
     * @param schema 关系 Schema 配置
     * @param options Session 配置选项
     * @param schemaRegistry Schema 注册表
     */
    constructor(
        db: LightDB,
        dialect: unknown,
        schema: RelationalSchemaConfig<TSchema> | undefined,
        options: DrizzleSessionConfig,
        schemaRegistry: SchemaRegistry,
    ) {
        super(dialect as never, schema);
        this.lightDb = db;
        this.registry = schemaRegistry;
        this.executor = new SQLExecutor(db, schemaRegistry);
        this.sessionLogger = new NoopLogger();
    }

    /**
     * 准备查询
     * @param query 查询对象
     * @param fields 字段列表
     * @param executeMethod 执行方法
     * @param isResponseInArrayMode 是否为数组响应模式
     * @param customResultMapper 自定义结果映射器
     * @returns 预处理查询对象
     */
    override prepareQuery(
        query: Query,
        fields: SelectedFieldsOrdered | undefined,
        executeMethod: SQLiteExecuteMethod,
        isResponseInArrayMode: boolean,
        customResultMapper?: (rows: unknown[][], mapColumnValue?: (value: unknown) => unknown) => unknown,
    ): SQLitePreparedQuery<{
        type: "async";
        run: LightDBResult;
        all: unknown;
        get: unknown;
        values: unknown;
        execute: unknown;
    }> {
        return new LightDBPreparedQuery(
            this.executor,
            query,
            this.sessionLogger,
            fields,
            executeMethod,
            isResponseInArrayMode,
            customResultMapper,
        ) as SQLitePreparedQuery<{
            type: "async";
            run: LightDBResult;
            all: unknown;
            get: unknown;
            values: unknown;
            execute: unknown;
        }>;
    }

    /**
     * 执行事务
     * @param transaction 事务回调
     * @param config 事务配置
     * @returns 事务结果
     */
    override async transaction<T>(
        transaction: (tx: LightDBTransaction<TFullSchema, TSchema>) => Promise<T>,
        _config?: SQLiteTransactionConfig,
    ): Promise<T> {
        const result = await this.lightDb.transaction(async (_txContext) => {
            const tx = new LightDBTransaction("async", this.dialect, this as LightDBSession<TFullSchema, TSchema>, this.schema, 0);
            return transaction(tx as LightDBTransaction<TFullSchema, TSchema>);
        });

        return result as T;
    }
}

/**
 * LightDB 事务
 * 实现 Drizzle ORM 的 SQLite Transaction 接口
 */
export class LightDBTransaction<TFullSchema extends Record<string, unknown>, TSchema extends TablesRelationalConfig> extends SQLiteTransaction<
    "async",
    LightDBResult,
    TFullSchema,
    TSchema
> {
    static override readonly [Symbol.for("drizzle:entityKind")]: string = "LightDBTransaction";

    /**
     * 执行嵌套事务
     * @param transaction 事务回调
     * @returns 事务结果
     */
    override async transaction<T>(transaction: (tx: LightDBTransaction<TFullSchema, TSchema>) => Promise<T>): Promise<T> {
        const savepointName = `sp${this.nestedIndex}`;
        const tx = new LightDBTransaction("async", this.dialect, this.session, this.schema, this.nestedIndex + 1);

        await this.session.run({ sql: `SAVEPOINT ${savepointName}`, params: [] });

        try {
            const result = await transaction(tx as LightDBTransaction<TFullSchema, TSchema>);
            await this.session.run({
                sql: `RELEASE SAVEPOINT ${savepointName}`,
                params: [],
            });
            return result;
        } catch (err) {
            await this.session.run({
                sql: `ROLLBACK TO SAVEPOINT ${savepointName}`,
                params: [],
            });
            throw err;
        }
    }
}

/**
 * LightDB 预处理查询
 * 实现 Drizzle ORM 的 Prepared Query 接口
 */
export class LightDBPreparedQuery extends SQLitePreparedQuery<{
    type: "async";
    run: LightDBResult;
    all: unknown;
    get: unknown;
    values: unknown;
    execute: unknown;
}> {
    static override readonly [Symbol.for("drizzle:entityKind")]: string = "LightDBPreparedQuery";

    private readonly queryExecutor: SQLExecutor;
    private readonly queryObject: Query;
    private readonly queryLogger: NoopLogger;
    private readonly queryFields: SelectedFieldsOrdered | undefined;
    private readonly queryCustomResultMapper?: (rows: unknown[][], mapColumnValue?: (value: unknown) => unknown) => unknown;

    /**
     * 创建预处理查询实例
     * @param executor SQL 执行器
     * @param query 查询对象
     * @param logger 日志记录器
     * @param fields 字段列表
     * @param executeMethod 执行方法
     * @param isResponseInArrayMode 是否为数组响应模式
     * @param customResultMapper 自定义结果映射器
     */
    constructor(
        executor: SQLExecutor,
        query: Query,
        logger: NoopLogger,
        fields: SelectedFieldsOrdered | undefined,
        executeMethod: SQLiteExecuteMethod,
        _isResponseInArrayMode: boolean,
        customResultMapper?: (rows: unknown[][], mapColumnValue?: (value: unknown) => unknown) => unknown,
    ) {
        super("async", executeMethod, query);
        this.queryExecutor = executor;
        this.queryObject = query;
        this.queryLogger = logger;
        this.queryFields = fields;
        this.queryCustomResultMapper = customResultMapper;
    }

    /**
     * 执行查询（运行模式）
     * @param placeholderValues 占位符值
     * @returns 执行结果
     */
    override async run(placeholderValues?: Record<string, unknown>): Promise<LightDBResult> {
        const params = fillPlaceholders(this.queryObject.params, placeholderValues ?? {});
        this.queryLogger.logQuery(this.queryObject.sql, params as unknown[]);

        const result = this.queryExecutor.execute(this.queryObject.sql, params as unknown[]);

        return {
            rows: result.rows,
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid,
        };
    }

    /**
     * 执行查询（获取所有结果）
     * @param placeholderValues 占位符值
     * @returns 所有结果
     */
    override async all(placeholderValues?: Record<string, unknown>): Promise<unknown> {
        const params = fillPlaceholders(this.queryObject.params, placeholderValues ?? {});
        this.queryLogger.logQuery(this.queryObject.sql, params as unknown[]);

        const result = this.queryExecutor.execute(this.queryObject.sql, params as unknown[]);

        if (this.queryCustomResultMapper) {
            return this.queryCustomResultMapper(result.rows.map((row) => Object.values(row)));
        }

        return result.rows;
    }

    /**
     * 执行查询（获取单个结果）
     * @param placeholderValues 占位符值
     * @returns 单个结果
     */
    override async get(placeholderValues?: Record<string, unknown>): Promise<unknown> {
        const params = fillPlaceholders(this.queryObject.params, placeholderValues ?? {});
        this.queryLogger.logQuery(this.queryObject.sql, params as unknown[]);

        const result = this.queryExecutor.execute(this.queryObject.sql, params as unknown[]);

        if (result.rows.length === 0) {
            return undefined;
        }

        if (this.queryCustomResultMapper) {
            return this.queryCustomResultMapper([Object.values(result.rows[0]!)]);
        }

        return result.rows[0];
    }

    /**
     * 执行查询（获取值数组）
     * @param placeholderValues 占位符值
     * @returns 值数组
     */
    override async values(placeholderValues?: Record<string, unknown>): Promise<unknown> {
        const params = fillPlaceholders(this.queryObject.params, placeholderValues ?? {});
        this.queryLogger.logQuery(this.queryObject.sql, params as unknown[]);

        const result = this.queryExecutor.execute(this.queryObject.sql, params as unknown[]);

        return result.rows.map((row) => Object.values(row));
    }
}

/**
 * 填充占位符
 * @param params 参数数组
 * @param values 占位符值
 * @returns 填充后的参数数组
 */
function fillPlaceholders(params: readonly unknown[], values: Record<string, unknown>): unknown[] {
    return params.map((param) => {
        if (typeof param === "object" && param !== null && "value" in param) {
            const placeholder = param as { value: string };
            return values[placeholder.value] ?? param;
        }
        return param;
    });
}
