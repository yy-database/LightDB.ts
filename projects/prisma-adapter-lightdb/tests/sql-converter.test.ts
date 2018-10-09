/**
 * Prisma 适配器单元测试
 * 测试 SQL 转换逻辑
 */

import assert from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { SqlConverter } from "../src/sql-converter.js";

describe("SqlConverter", () => {
    let converter: SqlConverter;

    beforeEach(() => {
        converter = new SqlConverter();
    });

    describe("convertSelect", () => {
        it("应该正确转换简单的 SELECT 语句", () => {
            const result = converter.convertSelect("SELECT * FROM users");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data?.tableName, "users");
        });

        it("应该正确转换带 WHERE 条件的 SELECT 语句", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE id = 1");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data?.tableName, "users");
            assert.deepStrictEqual(result.data?.where, { id: 1 });
        });

        it("应该正确转换带参数的 SELECT 语句", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE id = ?", [42]);

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { id: 42 });
        });

        it("应该正确转换带多个参数的 SELECT 语句", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE id = ? AND name = ?", [1, "Alice"]);

            assert.strictEqual(result.success, true);
        });

        it("应该正确转换带 ORDER BY 的 SELECT 语句", () => {
            const result = converter.convertSelect("SELECT * FROM users ORDER BY name ASC");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data?.orderBy?.length, 1);
            assert.strictEqual(result.data?.orderBy?.[0]?.field, "name");
            assert.strictEqual(result.data?.orderBy?.[0]?.direction, "asc");
        });

        it("应该正确转换带 DESC 排序的 SELECT 语句", () => {
            const result = converter.convertSelect("SELECT * FROM users ORDER BY created_at DESC");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data?.orderBy?.[0]?.direction, "desc");
        });

        it("应该正确转换带 LIMIT 的 SELECT 语句", () => {
            const result = converter.convertSelect("SELECT * FROM users LIMIT 10");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data?.limit, 10);
        });

        it("应该正确转换带 OFFSET 的 SELECT 语句", () => {
            const result = converter.convertSelect("SELECT * FROM users LIMIT 10 OFFSET 20");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data?.limit, 10);
            assert.strictEqual(result.data?.offset, 20);
        });

        it("应该正确转换带指定字段的 SELECT 语句", () => {
            const result = converter.convertSelect("SELECT id, name, email FROM users");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.fields, ["id", "name", "email"]);
        });

        it("应该正确转换带比较运算符的 WHERE 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE age > 18");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { age: { $gt: 18 } });
        });

        it("应该正确转换带 >= 运算符的 WHERE 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE age >= 18");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { age: { $gte: 18 } });
        });

        it("应该正确转换带 < 运算符的 WHERE 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE age < 65");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { age: { $lt: 65 } });
        });

        it("应该正确转换带 <= 运算符的 WHERE 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE age <= 65");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { age: { $lte: 65 } });
        });

        it("应该正确转换带 != 运算符的 WHERE 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE status != 'deleted'");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { status: { $ne: "deleted" } });
        });

        it("应该正确转换带 AND 条件的 SELECT 语句", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE age > 18 AND status = 'active'");

            assert.strictEqual(result.success, true);
        });

        it("应该正确转换带 OR 条件的 SELECT 语句", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE status = 'active' OR status = 'pending'");

            assert.strictEqual(result.success, true);
        });

        it("应该对无效 SQL 返回错误", () => {
            const result = converter.convertSelect("INVALID SQL");

            assert.strictEqual(result.success, false);
            assert.ok(result.error);
        });

        it("应该对非 SELECT 语句返回错误", () => {
            const result = converter.convertSelect("INSERT INTO users VALUES (1)");

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, "不是有效的 SELECT 语句");
        });
    });

    describe("convertInsert", () => {
        it("应该正确转换简单的 INSERT 语句", () => {
            const result = converter.convertInsert("INSERT INTO users (id, name) VALUES (1, 'Alice')");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data?.tableName, "users");
            assert.strictEqual(result.data?.values.length, 1);
            assert.strictEqual(result.data?.values[0]?.id, 1);
            assert.strictEqual(result.data?.values[0]?.name, "Alice");
        });

        it("应该正确转换带参数的 INSERT 语句", () => {
            const result = converter.convertInsert("INSERT INTO users (id, name) VALUES (?, ?)", [1, "Bob"]);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data?.values[0]?.id, 1);
            assert.strictEqual(result.data?.values[0]?.name, "Bob");
        });

        it("应该正确转换多行 INSERT 语句", () => {
            const result = converter.convertInsert("INSERT INTO users (id, name) VALUES (1, 'Alice'), (2, 'Bob')");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data?.values.length, 2);
        });

        it("应该对非 INSERT 语句返回错误", () => {
            const result = converter.convertInsert("SELECT * FROM users");

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, "不是有效的 INSERT 语句");
        });
    });

    describe("convertUpdate", () => {
        it("应该正确转换简单的 UPDATE 语句", () => {
            const result = converter.convertUpdate("UPDATE users SET name = 'Alice' WHERE id = 1");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data?.tableName, "users");
            assert.deepStrictEqual(result.data?.values, { name: "Alice" });
            assert.deepStrictEqual(result.data?.where, { id: 1 });
        });

        it("应该正确转换带多个字段的 UPDATE 语句", () => {
            const result = converter.convertUpdate("UPDATE users SET name = 'Alice', email = 'alice@example.com' WHERE id = 1");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.values, {
                name: "Alice",
                email: "alice@example.com",
            });
        });

        it("应该正确转换带参数的 UPDATE 语句", () => {
            const result = converter.convertUpdate("UPDATE users SET name = ? WHERE id = ?", ["Charlie", 1]);

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.values, { name: "Charlie" });
            assert.deepStrictEqual(result.data?.where, { id: 1 });
        });

        it("应该对非 UPDATE 语句返回错误", () => {
            const result = converter.convertUpdate("SELECT * FROM users");

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, "不是有效的 UPDATE 语句");
        });
    });

    describe("convertDelete", () => {
        it("应该正确转换简单的 DELETE 语句", () => {
            const result = converter.convertDelete("DELETE FROM users WHERE id = 1");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data?.tableName, "users");
            assert.deepStrictEqual(result.data?.where, { id: 1 });
        });

        it("应该正确转换带参数的 DELETE 语句", () => {
            const result = converter.convertDelete("DELETE FROM users WHERE id = ?", [42]);

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { id: 42 });
        });

        it("应该正确转换不带 WHERE 的 DELETE 语句", () => {
            const result = converter.convertDelete("DELETE FROM users");

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data?.tableName, "users");
        });

        it("应该对非 DELETE 语句返回错误", () => {
            const result = converter.convertDelete("SELECT * FROM users");

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, "不是有效的 DELETE 语句");
        });
    });

    describe("复杂条件转换", () => {
        it("应该正确转换 IN 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE id IN (1, 2, 3)");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { id: { $in: [1, 2, 3] } });
        });

        it("应该正确转换 NOT IN 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE id NOT IN (1, 2, 3)");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { id: { $nin: [1, 2, 3] } });
        });

        it("应该正确转换 BETWEEN 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE age BETWEEN 18 AND 65");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { age: { $gte: 18, $lte: 65 } });
        });

        it("应该正确转换 IS NULL 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE deleted_at IS NULL");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { deleted_at: null });
        });

        it("应该正确转换 IS NOT NULL 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE email IS NOT NULL");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { email: { $ne: null } });
        });

        it("应该正确转换 LIKE 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE name LIKE 'A%'");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { name: { $regex: "^A.*$" } });
        });

        it("应该正确转换带 % 通配符的 LIKE 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE email LIKE '%@example.com'");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { email: { $regex: "^.*@example\\.com$" } });
        });

        it("应该正确转换带 _ 通配符的 LIKE 条件", () => {
            const result = converter.convertSelect("SELECT * FROM users WHERE code LIKE 'A___'");

            assert.strictEqual(result.success, true);
            assert.deepStrictEqual(result.data?.where, { code: { $regex: "^A...$" } });
        });
    });
});
