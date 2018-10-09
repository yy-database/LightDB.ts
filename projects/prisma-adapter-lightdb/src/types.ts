/**
 * Prisma 适配器类型定义
 * 定义 Prisma 驱动适配器所需的类型和接口
 */

/**
 * LightDB 适配器配置选项
 */
export interface LightDBAdapterOptions {
    /** 数据库文件路径 */
    dbPath: string;
    /** 数据库名称 */
    dbName?: string;
    /** 页面大小（字节） */
    pageSize?: number;
    /** WAL 阈值（字节） */
    walThreshold?: number;
    /** 是否启用自动检查点 */
    autoCheckpoint?: boolean;
}

/**
 * SQL 执行结果
 */
export interface SqlExecutionResult {
    /** 查询结果行 */
    rows: Record<string, unknown>[];
    /** 受影响的行数 */
    rowCount?: number;
    /** 最后插入的 ID */
    lastInsertRowid?: number | string;
}

/**
 * 查询构建器选项
 */
export interface QueryBuilderOptions {
    /** 表名 */
    tableName: string;
    /** 查询字段 */
    fields?: string[];
    /** 过滤条件 */
    where?: Record<string, unknown>;
    /** 排序条件 */
    orderBy?: Array<{ field: string; direction: "asc" | "desc" }>;
    /** 跳过记录数 */
    offset?: number;
    /** 返回记录数限制 */
    limit?: number;
}

/**
 * 插入构建器选项
 */
export interface InsertBuilderOptions {
    /** 表名 */
    tableName: string;
    /** 列名列表 */
    columns?: string[];
    /** 值列表 */
    values: Record<string, unknown>[];
}

/**
 * 更新构建器选项
 */
export interface UpdateBuilderOptions {
    /** 表名 */
    tableName: string;
    /** 更新值 */
    values: Record<string, unknown>;
    /** 过滤条件 */
    where?: Record<string, unknown>;
}

/**
 * 删除构建器选项
 */
export interface DeleteBuilderOptions {
    /** 表名 */
    tableName: string;
    /** 过滤条件 */
    where?: Record<string, unknown>;
}

/**
 * 集合 Schema 定义
 */
export interface CollectionSchemaDefinition {
    /** 集合名称 */
    name: string;
    /** 主键字段 */
    primaryKey: string;
    /** 字段定义 */
    fields: Record<string, FieldTypeDefinition>;
    /** 索引定义 */
    indexes?: Array<{
        name: string;
        fieldName: string;
        unique?: boolean;
    }>;
}

/**
 * 字段类型定义
 */
export interface FieldTypeDefinition {
    /** 字段类型 */
    type: "string" | "number" | "boolean" | "date" | "json" | "bytes";
    /** 是否可为空 */
    nullable?: boolean;
    /** 默认值 */
    default?: unknown;
}

/**
 * 事务隔离级别
 */
export type TransactionIsolationLevel = "read_committed" | "repeatable_read" | "serializable";

/**
 * 事务选项
 */
export interface TransactionOptions {
    /** 事务超时时间（毫秒） */
    timeout?: number;
    /** 隔离级别 */
    isolationLevel?: TransactionIsolationLevel;
}
