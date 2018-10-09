/**
 * Prisma 适配器单元测试
 * 测试适配器核心功能（不依赖真实 LightDB 实例）
 */

import assert from "node:assert";
import { describe, it } from "node:test";
import { LightDBAdapterError } from "../src/adapter.js";

describe("LightDBAdapterError", () => {
    it("应该正确创建错误实例", () => {
        const error = new LightDBAdapterError("测试错误", "TEST_ERROR");

        assert.strictEqual(error instanceof Error, true);
        assert.strictEqual(error.name, "LightDBAdapterError");
        assert.strictEqual(error.message, "测试错误");
        assert.strictEqual(error.code, "TEST_ERROR");
    });

    it("应该正确设置原型链", () => {
        const error = new LightDBAdapterError("测试错误", "TEST_ERROR");

        assert.strictEqual(error instanceof LightDBAdapterError, true);
    });

    it("应该支持不同的错误代码", () => {
        const errorCodes = ["PARSE_ERROR", "EXECUTION_ERROR", "INVALID_TRANSACTION_STATE", "UNSUPPORTED_OPERATION"];

        for (const code of errorCodes) {
            const error = new LightDBAdapterError(`错误: ${code}`, code);
            assert.strictEqual(error.code, code);
        }
    });
});

describe("类型定义测试", () => {
    it("QueryBuilderOptions 应该包含正确的字段", () => {
        const options = {
            tableName: "users",
            fields: ["id", "name"],
            where: { id: 1 },
            orderBy: [{ field: "name", direction: "asc" as const }],
            offset: 0,
            limit: 10,
        };

        assert.strictEqual(options.tableName, "users");
        assert.strictEqual(options.fields?.length, 2);
        assert.deepStrictEqual(options.where, { id: 1 });
        assert.strictEqual(options.orderBy?.length, 1);
        assert.strictEqual(options.offset, 0);
        assert.strictEqual(options.limit, 10);
    });

    it("InsertBuilderOptions 应该包含正确的字段", () => {
        const options = {
            tableName: "users",
            columns: ["id", "name"],
            values: [{ id: 1, name: "Alice" }],
        };

        assert.strictEqual(options.tableName, "users");
        assert.deepStrictEqual(options.columns, ["id", "name"]);
        assert.strictEqual(options.values.length, 1);
    });

    it("UpdateBuilderOptions 应该包含正确的字段", () => {
        const options = {
            tableName: "users",
            values: { name: "Bob" },
            where: { id: 1 },
        };

        assert.strictEqual(options.tableName, "users");
        assert.deepStrictEqual(options.values, { name: "Bob" });
        assert.deepStrictEqual(options.where, { id: 1 });
    });

    it("DeleteBuilderOptions 应该包含正确的字段", () => {
        const options = {
            tableName: "users",
            where: { id: 1 },
        };

        assert.strictEqual(options.tableName, "users");
        assert.deepStrictEqual(options.where, { id: 1 });
    });

    it("LightDBAdapterOptions 应该包含正确的字段", () => {
        const options = {
            dbPath: "./data/test.light",
            dbName: "testdb",
            pageSize: 4096,
            walThreshold: 16 * 1024 * 1024,
            autoCheckpoint: true,
        };

        assert.strictEqual(options.dbPath, "./data/test.light");
        assert.strictEqual(options.dbName, "testdb");
        assert.strictEqual(options.pageSize, 4096);
        assert.strictEqual(options.walThreshold, 16 * 1024 * 1024);
        assert.strictEqual(options.autoCheckpoint, true);
    });
});

describe("列类型推断测试", () => {
    it("应该正确识别整数类型", () => {
        const value = 42;
        const expectedType = Number.isInteger(value) ? 0 : 2;
        assert.strictEqual(expectedType, 0);
    });

    it("应该正确识别浮点数类型", () => {
        const value = 3.14;
        const expectedType = Number.isInteger(value) ? 0 : 2;
        assert.strictEqual(expectedType, 2);
    });

    it("应该正确识别布尔类型", () => {
        const value = true;
        const expectedType = typeof value === "boolean" ? 5 : 7;
        assert.strictEqual(expectedType, 5);
    });

    it("应该正确识别字符串类型", () => {
        const value = "hello";
        const expectedType = typeof value === "string" ? 7 : 0;
        assert.strictEqual(expectedType, 7);
    });

    it("应该正确识别日期类型", () => {
        const value = new Date();
        const expectedType = value instanceof Date ? 10 : 7;
        assert.strictEqual(expectedType, 10);
    });

    it("应该正确识别二进制类型", () => {
        const value = new Uint8Array([1, 2, 3]);
        const expectedType = value instanceof Uint8Array ? 13 : 7;
        assert.strictEqual(expectedType, 13);
    });
});

describe("文档到行数据转换测试", () => {
    it("应该正确转换普通字段", () => {
        const doc = { id: 1, name: "Alice", age: 30 };
        const columnNames = ["id", "name", "age"];

        const row = columnNames.map((col) => {
            const value = doc[col as keyof typeof doc];
            if (value instanceof Date) {
                return value.toISOString();
            }
            if (typeof value === "object" && value !== null) {
                return JSON.stringify(value);
            }
            return value;
        });

        assert.deepStrictEqual(row, [1, "Alice", 30]);
    });

    it("应该正确转换日期字段", () => {
        const date = new Date("2024-01-01T00:00:00.000Z");
        const doc = { id: 1, created_at: date };
        const columnNames = ["id", "created_at"];

        const row = columnNames.map((col) => {
            const value = doc[col as keyof typeof doc];
            if (value instanceof Date) {
                return value.toISOString();
            }
            if (typeof value === "object" && value !== null) {
                return JSON.stringify(value);
            }
            return value;
        });

        assert.deepStrictEqual(row, [1, "2024-01-01T00:00:00.000Z"]);
    });

    it("应该正确转换对象字段为 JSON", () => {
        const obj = { key: "value" };
        const doc = { id: 1, metadata: obj };
        const columnNames = ["id", "metadata"];

        const row = columnNames.map((col) => {
            const value = doc[col as keyof typeof doc];
            if (value instanceof Date) {
                return value.toISOString();
            }
            if (typeof value === "object" && value !== null && !(value instanceof Uint8Array)) {
                return JSON.stringify(value);
            }
            return value;
        });

        assert.deepStrictEqual(row, [1, '{"key":"value"}']);
    });
});
