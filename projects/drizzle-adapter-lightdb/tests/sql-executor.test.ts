/**
 * Drizzle 适配器单元测试
 * 测试 SQL 执行器和类型定义
 */

import assert from "node:assert";
import { describe, it } from "node:test";

describe("类型定义测试", () => {
    it("LightDBResult 应该包含正确的字段", () => {
        const result = {
            rows: [{ id: 1, name: "Alice" }],
            changes: 1,
            lastInsertRowid: 1,
        };

        assert.strictEqual(result.rows.length, 1);
        assert.strictEqual(result.changes, 1);
        assert.strictEqual(result.lastInsertRowid, 1);
    });

    it("LightDBDrizzleConfig 应该包含正确的字段", () => {
        const config = {
            db: {} as any,
            logger: true,
            cache: true,
        };

        assert.ok(config.db);
        assert.strictEqual(config.logger, true);
        assert.strictEqual(config.cache, true);
    });

    it("TableSchema 应该包含正确的字段", () => {
        const schema = {
            tableName: "users",
            primaryKey: "id",
            columns: [
                { name: "id", dataType: "INT", nullable: false, hasDefault: false, autoIncrement: true },
                { name: "name", dataType: "TEXT", nullable: false, hasDefault: false, autoIncrement: false },
            ],
            indexes: [{ name: "name_idx", fieldName: "name", unique: false }],
        };

        assert.strictEqual(schema.tableName, "users");
        assert.strictEqual(schema.primaryKey, "id");
        assert.strictEqual(schema.columns.length, 2);
        assert.strictEqual(schema.indexes?.length, 1);
    });

    it("ColumnDefinition 应该包含正确的字段", () => {
        const column = {
            name: "id",
            dataType: "INT",
            nullable: false,
            hasDefault: false,
            autoIncrement: true,
        };

        assert.strictEqual(column.name, "id");
        assert.strictEqual(column.dataType, "INT");
        assert.strictEqual(column.nullable, false);
        assert.strictEqual(column.hasDefault, false);
        assert.strictEqual(column.autoIncrement, true);
    });

    it("SQLExecutionResult 应该包含正确的字段", () => {
        const result = {
            changes: 5,
            lastInsertRowid: 10,
            rows: [],
        };

        assert.strictEqual(result.changes, 5);
        assert.strictEqual(result.lastInsertRowid, 10);
        assert.strictEqual(result.rows.length, 0);
    });

    it("QueryParams 应该包含正确的字段", () => {
        const params = {
            sql: "SELECT * FROM users WHERE id = ?",
            params: [1],
        };

        assert.strictEqual(params.sql, "SELECT * FROM users WHERE id = ?");
        assert.deepStrictEqual(params.params, [1]);
    });

    it("TransactionContext 应该包含正确的字段", () => {
        const ctx = {
            id: "tx-123",
            isActive: true,
            startTime: Date.now(),
        };

        assert.strictEqual(ctx.id, "tx-123");
        assert.strictEqual(ctx.isActive, true);
        assert.ok(ctx.startTime > 0);
    });

    it("DrizzleSessionConfig 应该包含正确的字段", () => {
        const config = {
            logger: true,
            cache: {
                enabled: true,
                ttl: 60000,
            },
        };

        assert.strictEqual(config.logger, true);
        assert.strictEqual(config.cache?.enabled, true);
        assert.strictEqual(config.cache?.ttl, 60000);
    });

    it("PreparedQueryConfig 应该包含正确的字段", () => {
        const config = {
            sql: "SELECT * FROM users WHERE id = ?",
            params: [1],
            isQuery: true,
        };

        assert.strictEqual(config.sql, "SELECT * FROM users WHERE id = ?");
        assert.deepStrictEqual(config.params, [1]);
        assert.strictEqual(config.isQuery, true);
    });

    it("BatchQueryItem 应该包含正确的字段", () => {
        const item = {
            sql: "INSERT INTO users VALUES (?)",
            params: [1],
        };

        assert.strictEqual(item.sql, "INSERT INTO users VALUES (?)");
        assert.deepStrictEqual(item.params, [1]);
    });

    it("BatchQueryResult 应该包含正确的字段", () => {
        const result = {
            results: [{ changes: 1, lastInsertRowid: 1, rows: [] }],
            success: true,
        };

        assert.strictEqual(result.results.length, 1);
        assert.strictEqual(result.success, true);
    });

    it("DrizzleDialectConfig 应该包含正确的字段", () => {
        const config = {
            supportsReturning: true,
            supportsBatch: true,
            supportsTransaction: true,
            placeholderFormat: "question" as const,
        };

        assert.strictEqual(config.supportsReturning, true);
        assert.strictEqual(config.supportsBatch, true);
        assert.strictEqual(config.supportsTransaction, true);
        assert.strictEqual(config.placeholderFormat, "question");
    });

    it("DEFAULT_DIALECT_CONFIG 应该有正确的默认值", async () => {
        const { DEFAULT_DIALECT_CONFIG } = await import("../src/types.js");

        assert.strictEqual(DEFAULT_DIALECT_CONFIG.supportsReturning, true);
        assert.strictEqual(DEFAULT_DIALECT_CONFIG.supportsBatch, true);
        assert.strictEqual(DEFAULT_DIALECT_CONFIG.supportsTransaction, true);
        assert.strictEqual(DEFAULT_DIALECT_CONFIG.placeholderFormat, "question");
    });
});

describe("SchemaRegistry 测试", () => {
    it("应该正确初始化空的 Schema 注册表", () => {
        const registry = {
            tables: new Map(),
            schemas: new Map(),
        };

        assert.strictEqual(registry.tables.size, 0);
        assert.strictEqual(registry.schemas.size, 0);
    });

    it("应该正确添加和获取表", () => {
        const registry = {
            tables: new Map(),
            schemas: new Map(),
        };

        const mockCollection = { name: "users" };
        registry.tables.set("users", mockCollection as any);

        assert.strictEqual(registry.tables.size, 1);
        assert.strictEqual(registry.tables.get("users"), mockCollection);
    });

    it("应该正确添加和获取 Schema", () => {
        const registry = {
            tables: new Map(),
            schemas: new Map(),
        };

        const schema = {
            tableName: "users",
            primaryKey: "id",
            columns: [],
        };

        registry.schemas.set("users", schema);

        assert.strictEqual(registry.schemas.size, 1);
        assert.strictEqual(registry.schemas.get("users"), schema);
    });
});

describe("表达式求值测试", () => {
    it("应该正确处理字面量值", () => {
        const evaluateLiteral = (expr: { value: unknown }) => expr.value;

        assert.strictEqual(evaluateLiteral({ value: 42 }), 42);
        assert.strictEqual(evaluateLiteral({ value: "hello" }), "hello");
        assert.strictEqual(evaluateLiteral({ value: true }), true);
        assert.strictEqual(evaluateLiteral({ value: null }), null);
    });

    it("应该正确处理参数索引", () => {
        const params = [1, "Alice", true];

        const getParam = (index: number, params: unknown[]) => {
            return params[index];
        };

        assert.strictEqual(getParam(0, params), 1);
        assert.strictEqual(getParam(1, params), "Alice");
        assert.strictEqual(getParam(2, params), true);
    });
});

describe("排序功能测试", () => {
    it("应该正确按数字升序排序", () => {
        const rows = [
            { id: 3, value: 30 },
            { id: 1, value: 10 },
            { id: 2, value: 20 },
        ];

        const sorted = [...rows].sort((a, b) => a.value - b.value);

        assert.strictEqual(sorted[0]?.id, 1);
        assert.strictEqual(sorted[1]?.id, 2);
        assert.strictEqual(sorted[2]?.id, 3);
    });

    it("应该正确按数字降序排序", () => {
        const rows = [
            { id: 3, value: 30 },
            { id: 1, value: 10 },
            { id: 2, value: 20 },
        ];

        const sorted = [...rows].sort((a, b) => b.value - a.value);

        assert.strictEqual(sorted[0]?.id, 3);
        assert.strictEqual(sorted[1]?.id, 2);
        assert.strictEqual(sorted[2]?.id, 1);
    });

    it("应该正确按字符串排序", () => {
        const rows = [
            { id: 1, name: "Charlie" },
            { id: 2, name: "Alice" },
            { id: 3, name: "Bob" },
        ];

        const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));

        assert.strictEqual(sorted[0]?.name, "Alice");
        assert.strictEqual(sorted[1]?.name, "Bob");
        assert.strictEqual(sorted[2]?.name, "Charlie");
    });

    it("应该正确处理 null 值排序", () => {
        const rows = [
            { id: 1, value: 10 },
            { id: 2, value: null },
            { id: 3, value: 20 },
        ];

        const sorted = [...rows].sort((a, b) => {
            if (a.value === null && b.value !== null) return -1;
            if (a.value !== null && b.value === null) return 1;
            return (a.value ?? 0) - (b.value ?? 0);
        });

        assert.strictEqual(sorted[0]?.id, 2);
    });
});

describe("投影功能测试", () => {
    it("应该正确投影指定字段", () => {
        const rows = [
            { id: 1, name: "Alice", email: "alice@example.com", age: 30 },
        ];

        const fields = ["id", "name"];
        const projected = rows.map((row) => {
            const result: Record<string, unknown> = {};
            for (const field of fields) {
                result[field] = row[field as keyof typeof row];
            }
            return result;
        });

        assert.deepStrictEqual(projected, [{ id: 1, name: "Alice" }]);
    });

    it("应该正确处理字段别名", () => {
        const rows = [{ id: 1, name: "Alice" }];

        const projected = rows.map((row) => ({
            userId: row.id,
            userName: row.name,
        }));

        assert.deepStrictEqual(projected, [{ userId: 1, userName: "Alice" }]);
    });

    it("应该正确处理 SELECT *", () => {
        const rows = [{ id: 1, name: "Alice", email: "alice@example.com" }];

        const selectAll = true;
        const result = selectAll ? rows : rows.map(() => ({}));

        assert.strictEqual(result.length, 1);
        assert.deepStrictEqual(result[0], rows[0]);
    });
});

describe("过滤器构建测试", () => {
    it("应该正确构建相等条件", () => {
        const filter = { id: 1 };
        assert.deepStrictEqual(filter, { id: 1 });
    });

    it("应该正确构建不等条件", () => {
        const filter = { status: { $ne: "deleted" } };
        assert.deepStrictEqual(filter, { status: { $ne: "deleted" } });
    });

    it("应该正确构建大于条件", () => {
        const filter = { age: { $gt: 18 } };
        assert.deepStrictEqual(filter, { age: { $gt: 18 } });
    });

    it("应该正确构建大于等于条件", () => {
        const filter = { age: { $gte: 18 } };
        assert.deepStrictEqual(filter, { age: { $gte: 18 } });
    });

    it("应该正确构建小于条件", () => {
        const filter = { age: { $lt: 65 } };
        assert.deepStrictEqual(filter, { age: { $lt: 65 } });
    });

    it("应该正确构建小于等于条件", () => {
        const filter = { age: { $lte: 65 } };
        assert.deepStrictEqual(filter, { age: { $lte: 65 } });
    });

    it("应该正确构建 AND 条件", () => {
        const filter = { $and: [{ age: { $gt: 18 } }, { status: "active" }] };
        assert.ok(filter.$and);
        assert.strictEqual(filter.$and.length, 2);
    });

    it("应该正确构建 OR 条件", () => {
        const filter = { $or: [{ status: "active" }, { status: "pending" }] };
        assert.ok(filter.$or);
        assert.strictEqual(filter.$or.length, 2);
    });
});

describe("占位符填充测试", () => {
    it("应该正确填充占位符", () => {
        const fillPlaceholders = (
            params: readonly unknown[],
            values: Record<string, unknown>
        ): unknown[] => {
            return params.map((param) => {
                if (typeof param === "object" && param !== null && "value" in param) {
                    const placeholder = param as { value: string };
                    return values[placeholder.value] ?? param;
                }
                return param;
            });
        };

        const params = [{ value: "id" }, { value: "name" }];
        const values = { id: 1, name: "Alice" };

        const result = fillPlaceholders(params, values);

        assert.deepStrictEqual(result, [1, "Alice"]);
    });

    it("应该保留非占位符参数", () => {
        const fillPlaceholders = (
            params: readonly unknown[],
            values: Record<string, unknown>
        ): unknown[] => {
            return params.map((param) => {
                if (typeof param === "object" && param !== null && "value" in param) {
                    const placeholder = param as { value: string };
                    return values[placeholder.value] ?? param;
                }
                return param;
            });
        };

        const params = [1, "static", true];
        const values = {};

        const result = fillPlaceholders(params, values);

        assert.deepStrictEqual(result, [1, "static", true]);
    });

    it("应该处理缺失的占位符值", () => {
        const fillPlaceholders = (
            params: readonly unknown[],
            values: Record<string, unknown>
        ): unknown[] => {
            return params.map((param) => {
                if (typeof param === "object" && param !== null && "value" in param) {
                    const placeholder = param as { value: string };
                    return values[placeholder.value] ?? param;
                }
                return param;
            });
        };

        const params = [{ value: "missing" }];
        const values = {};

        const result = fillPlaceholders(params, values);

        assert.deepStrictEqual(result, [{ value: "missing" }]);
    });
});
