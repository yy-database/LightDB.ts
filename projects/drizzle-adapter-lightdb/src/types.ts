/**
 * LightDB Drizzle 适配器类型定义
 * 定义适配器相关的接口和类型
 */

import type { LightDB } from "@yydb/light-db";
import type { IndexConfig } from "@yydb/light-db";

/**
 * LightDB 查询结果
 */
export interface LightDBResult {
    /** 结果行 */
    rows: Record<string, unknown>[];
    /** 影响的行数 */
    changes: number;
    /** 最后插入的 ID */
    lastInsertRowid: number | bigint;
}

/**
 * LightDB Drizzle 适配器配置选项
 */
export interface LightDBDrizzleConfig {
    /** LightDB 实例 */
    db: LightDB;
    /** 是否启用日志 */
    logger?: boolean;
    /** 是否启用缓存 */
    cache?: boolean;
}

/**
 * 表 Schema 定义
 * 用于将 Drizzle 表定义映射到 LightDB 集合
 */
export interface TableSchema {
    /** 表名 */
    tableName: string;
    /** 主键字段 */
    primaryKey: string;
    /** 列定义 */
    columns: ColumnDefinition[];
    /** 索引配置 */
    indexes?: IndexConfig<Record<string, unknown>>[];
}

/**
 * 列定义
 */
export interface ColumnDefinition {
    /** 列名 */
    name: string;
    /** 数据类型 */
    dataType: string;
    /** 是否可为空 */
    nullable: boolean;
    /** 是否有默认值 */
    hasDefault: boolean;
    /** 是否自增 */
    autoIncrement: boolean;
}

/**
 * SQL 执行结果
 */
export interface SQLExecutionResult {
    /** 影响的行数 */
    changes: number;
    /** 最后插入的 ID */
    lastInsertRowid: number | bigint;
    /** 查询结果 */
    rows: Record<string, unknown>[];
}

/**
 * 查询参数
 */
export interface QueryParams {
    /** SQL 语句 */
    sql: string;
    /** 参数值 */
    params: unknown[];
}

/**
 * 事务上下文
 */
export interface TransactionContext {
    /** 事务 ID */
    id: string;
    /** 是否活动 */
    isActive: boolean;
    /** 开始时间 */
    startTime: number;
}

/**
 * Drizzle Session 配置
 */
export interface DrizzleSessionConfig {
    /** 是否启用日志 */
    logger?: boolean;
    /** 缓存配置 */
    cache?: {
        enabled: boolean;
        ttl?: number;
    };
}

/**
 * 预处理查询配置
 */
export interface PreparedQueryConfig {
    /** SQL 语句 */
    sql: string;
    /** 参数占位符 */
    params: unknown[];
    /** 是否为查询语句 */
    isQuery: boolean;
}

/**
 * 批量查询项
 */
export interface BatchQueryItem {
    /** SQL 语句 */
    sql: string;
    /** 参数 */
    params: unknown[];
}

/**
 * 批量查询结果
 */
export interface BatchQueryResult {
    /** 结果 */
    results: SQLExecutionResult[];
    /** 是否成功 */
    success: boolean;
    /** 错误信息 */
    error?: string;
}

/**
 * Schema 注册信息
 */
export interface SchemaRegistry {
    /** 表名到集合的映射 */
    tables: Map<string, import("@yydb/light-db").Collection<Record<string, unknown>>>;
    /** 表名到 Schema 的映射 */
    schemas: Map<string, TableSchema>;
}

/**
 * Drizzle 方言配置
 */
export interface DrizzleDialectConfig {
    /** 是否支持 RETURNING */
    supportsReturning: boolean;
    /** 是否支持批量操作 */
    supportsBatch: boolean;
    /** 是否支持事务 */
    supportsTransaction: boolean;
    /** 占位符格式 */
    placeholderFormat: "question" | "dollar" | "named";
}

/**
 * 默认方言配置
 */
export const DEFAULT_DIALECT_CONFIG: DrizzleDialectConfig = {
    supportsReturning: true,
    supportsBatch: true,
    supportsTransaction: true,
    placeholderFormat: "question",
};
