/**
 * Drizzle Driver 实现
 * 提供 Drizzle ORM 与 LightDB 的集成入口
 */

import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import type { DrizzleConfig } from "drizzle-orm";
import type { RelationalSchemaConfig, TablesRelationalConfig } from "drizzle-orm";
import type { LightDB } from "@yydb/light-db";
import { LightDBSession } from "./session.js";
import type { SchemaRegistry, LightDBDrizzleConfig, TableSchema } from "./types.js";

/**
 * LightDB Drizzle 数据库
 * 封装 LightDB 实例和 Drizzle Session
 */
export class LightDBDrizzleDatabase<TSchema extends TablesRelationalConfig = TablesRelationalConfig> {
    private readonly db: LightDB;
    private readonly session: LightDBSession<TSchema, TSchema>;
    private readonly schemaRegistry: SchemaRegistry;

    /**
     * 创建 LightDB Drizzle 数据库实例
     * @param db LightDB 实例
     * @param config Drizzle 配置
     */
    constructor(db: LightDB, config?: DrizzleConfig<TSchema>) {
        this.db = db;
        this.schemaRegistry = {
            tables: new Map(),
            schemas: new Map(),
        };

        const dialect = new SQLiteSyncDialect();

        const schema = config?.schema as RelationalSchemaConfig<TSchema> | undefined;

        this.session = new LightDBSession<TSchema, TSchema>(
            db,
            dialect,
            schema,
            {
                logger: false,
            },
            this.schemaRegistry,
        );
    }

    /**
     * 获取 Session
     * @returns Drizzle Session
     */
    getSession(): LightDBSession<TSchema, TSchema> {
        return this.session;
    }

    /**
     * 获取 LightDB 实例
     * @returns LightDB 实例
     */
    getLightDB(): LightDB {
        return this.db;
    }

    /**
     * 获取 Schema 注册表
     * @returns Schema 注册表
     */
    getSchemaRegistry(): SchemaRegistry {
        return this.schemaRegistry;
    }

    /**
     * 注册表 Schema
     * @param tableName 表名
     * @param schema 表 Schema
     */
    registerSchema(tableName: string, schema: TableSchema): void {
        this.schemaRegistry.schemas.set(tableName, schema);
    }

    /**
     * 关闭数据库连接
     */
    async close(): Promise<void> {
        await this.db.close();
    }
}

/**
 * 创建 LightDB Drizzle 数据库实例
 * @param db LightDB 实例
 * @param config Drizzle 配置
 * @returns Drizzle 数据库实例
 */
export function createDrizzleDatabase<TSchema extends TablesRelationalConfig = TablesRelationalConfig>(
    db: LightDB,
    config?: DrizzleConfig<TSchema>,
): LightDBDrizzleDatabase<TSchema> {
    return new LightDBDrizzleDatabase<TSchema>(db, config);
}

/**
 * Drizzle ORM 适配器工厂函数
 * 兼容 Drizzle ORM 的标准初始化方式
 * @param db LightDB 实例或配置
 * @param config Drizzle 配置
 * @returns Drizzle 数据库实例
 */
export function drizzle<TSchema extends TablesRelationalConfig = TablesRelationalConfig>(
    db: LightDB | LightDBDrizzleConfig,
    config?: DrizzleConfig<TSchema>,
): LightDBDrizzleDatabase<TSchema> {
    if ("db" in db) {
        return new LightDBDrizzleDatabase(db.db, config);
    }
    return new LightDBDrizzleDatabase(db as LightDB, config);
}
