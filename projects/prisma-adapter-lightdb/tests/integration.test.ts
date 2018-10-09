/**
 * Prisma 适配器集成测试
 * 测试与 LightDB 实例配合的完整功能
 */

import assert from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { LightDB } from "@yydb/light-db";
import {
    PrismaLightDBAdapter,
    PrismaLightDBAdapterFactory,
    createLightDBAdapter,
    createLightDBAdapterFactory,
} from "../src/index.js";

describe("PrismaLightDBAdapter 集成测试", () => {
    let db: LightDB;
    let adapter: PrismaLightDBAdapter;
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `lightdb-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });

        db = await LightDB.open(join(testDir, "test.light"), {
            dbName: "testdb",
        });

        adapter = createLightDBAdapter(db);
    });

    afterEach(async () => {
        await adapter.dispose();
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe("queryRaw", () => {
        it("应该正确执行 SELECT 查询", async () => {
            const collection = db.collection("users", {
                name: "users",
                primaryKey: "id",
            });

            collection.insert({ id: 1, name: "Alice", email: "alice@example.com" });
            collection.insert({ id: 2, name: "Bob", email: "bob@example.com" });

            const result = await adapter.queryRaw({
                sql: "SELECT * FROM users",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(result.rows.length, 2);
            assert.ok(result.columnNames.includes("id"));
            assert.ok(result.columnNames.includes("name"));
        });

        it("应该正确执行带 WHERE 条件的 SELECT 查询", async () => {
            const collection = db.collection("users", {
                name: "users",
                primaryKey: "id",
            });

            collection.insert({ id: 1, name: "Alice" });
            collection.insert({ id: 2, name: "Bob" });

            const result = await adapter.queryRaw({
                sql: "SELECT * FROM users WHERE id = ?",
                args: [1],
                argTypes: [],
            });

            assert.strictEqual(result.rows.length, 1);
        });

        it("应该正确执行带 ORDER BY 的 SELECT 查询", async () => {
            const collection = db.collection("users", {
                name: "users",
                primaryKey: "id",
            });

            collection.insert({ id: 1, name: "Charlie" });
            collection.insert({ id: 2, name: "Alice" });
            collection.insert({ id: 3, name: "Bob" });

            const result = await adapter.queryRaw({
                sql: "SELECT * FROM users ORDER BY name ASC",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(result.rows.length, 3);
        });

        it("应该正确执行带 LIMIT 的 SELECT 查询", async () => {
            const collection = db.collection("users", {
                name: "users",
                primaryKey: "id",
            });

            for (let i = 1; i <= 10; i++) {
                collection.insert({ id: i, name: `User${i}` });
            }

            const result = await adapter.queryRaw({
                sql: "SELECT * FROM users LIMIT 5",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(result.rows.length, 5);
        });

        it("应该正确执行带 OFFSET 的 SELECT 查询", async () => {
            const collection = db.collection("users", {
                name: "users",
                primaryKey: "id",
            });

            for (let i = 1; i <= 10; i++) {
                collection.insert({ id: i, name: `User${i}` });
            }

            const result = await adapter.queryRaw({
                sql: "SELECT * FROM users LIMIT 3 OFFSET 2",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(result.rows.length, 3);
        });

        it("应该正确处理空结果集", async () => {
            const result = await adapter.queryRaw({
                sql: "SELECT * FROM nonexistent",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(result.rows.length, 0);
        });
    });

    describe("executeRaw", () => {
        it("应该正确执行 INSERT 语句", async () => {
            const result = await adapter.executeRaw({
                sql: "INSERT INTO users (id, name, email) VALUES (?, ?, ?)",
                args: [1, "Alice", "alice@example.com"],
                argTypes: [],
            });

            assert.strictEqual(result, 1);

            const queryResult = await adapter.queryRaw({
                sql: "SELECT * FROM users WHERE id = ?",
                args: [1],
                argTypes: [],
            });

            assert.strictEqual(queryResult.rows.length, 1);
        });

        it("应该正确执行多行 INSERT 语句", async () => {
            const result = await adapter.executeRaw({
                sql: "INSERT INTO users (id, name) VALUES (1, 'Alice'), (2, 'Bob')",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(result, 2);
        });

        it("应该正确执行 UPDATE 语句", async () => {
            const collection = db.collection("users", {
                name: "users",
                primaryKey: "id",
            });

            collection.insert({ id: 1, name: "Alice", email: "old@example.com" });

            const result = await adapter.executeRaw({
                sql: "UPDATE users SET email = ? WHERE id = ?",
                args: ["new@example.com", 1],
                argTypes: [],
            });

            assert.strictEqual(result, 1);

            const queryResult = await adapter.queryRaw({
                sql: "SELECT * FROM users WHERE id = ?",
                args: [1],
                argTypes: [],
            });

            assert.strictEqual(queryResult.rows.length, 1);
        });

        it("应该正确执行 DELETE 语句", async () => {
            const collection = db.collection("users", {
                name: "users",
                primaryKey: "id",
            });

            collection.insert({ id: 1, name: "Alice" });
            collection.insert({ id: 2, name: "Bob" });

            const result = await adapter.executeRaw({
                sql: "DELETE FROM users WHERE id = ?",
                args: [1],
                argTypes: [],
            });

            assert.strictEqual(result, 1);

            const queryResult = await adapter.queryRaw({
                sql: "SELECT * FROM users",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(queryResult.rows.length, 1);
        });

        it("应该正确处理 CREATE TABLE 语句", async () => {
            const result = await adapter.executeRaw({
                sql: "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT)",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(result, 0);
        });

        it("应该正确处理 DROP TABLE 语句", async () => {
            db.collection("temp_table", {
                name: "temp_table",
                primaryKey: "id",
            });

            const result = await adapter.executeRaw({
                sql: "DROP TABLE temp_table",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(result, 0);
        });
    });

    describe("executeScript", () => {
        it("应该正确执行多个 SQL 语句", async () => {
            await adapter.executeScript(`
                INSERT INTO users (id, name) VALUES (1, 'Alice');
                INSERT INTO users (id, name) VALUES (2, 'Bob');
            `);

            const result = await adapter.queryRaw({
                sql: "SELECT * FROM users",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(result.rows.length, 2);
        });
    });

    describe("事务支持", () => {
        it("应该正确开始事务", async () => {
            const tx = await adapter.startTransaction();

            assert.ok(tx);
            assert.strictEqual(tx.provider, "sqlite");
            assert.strictEqual(tx.adapterName, "lightdb");
        });

        it("应该正确提交事务", async () => {
            const tx = await adapter.startTransaction();

            await tx.executeRaw({
                sql: "INSERT INTO users (id, name) VALUES (1, 'Alice')",
                args: [],
                argTypes: [],
            });

            await tx.commit();

            const result = await adapter.queryRaw({
                sql: "SELECT * FROM users",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(result.rows.length, 1);
        });

        it("应该正确回滚事务", async () => {
            const collection = db.collection("users", {
                name: "users",
                primaryKey: "id",
            });

            collection.insert({ id: 1, name: "Original" });

            const tx = await adapter.startTransaction();

            await tx.executeRaw({
                sql: "DELETE FROM users",
                args: [],
                argTypes: [],
            });

            await tx.rollback();

            const result = await adapter.queryRaw({
                sql: "SELECT * FROM users",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(result.rows.length, 1);
        });

        it("应该阻止重复提交事务", async () => {
            const tx = await adapter.startTransaction();
            await tx.commit();

            await assert.rejects(async () => {
                await tx.commit();
            }, /事务已经结束/);
        });

        it("应该阻止已提交事务的回滚", async () => {
            const tx = await adapter.startTransaction();
            await tx.commit();

            await assert.rejects(async () => {
                await tx.rollback();
            }, /事务已经结束/);
        });

        it("事务内应该能执行查询", async () => {
            const collection = db.collection("users", {
                name: "users",
                primaryKey: "id",
            });

            collection.insert({ id: 1, name: "Alice" });

            const tx = await adapter.startTransaction();

            const result = await tx.queryRaw({
                sql: "SELECT * FROM users",
                args: [],
                argTypes: [],
            });

            assert.strictEqual(result.rows.length, 1);

            await tx.commit();
        });
    });

    describe("dispose", () => {
        it("应该正确释放资源", async () => {
            const localDb = await LightDB.open(join(testDir, "dispose-test.light"), {
                dbName: "disposeTest",
            });

            const localAdapter = createLightDBAdapter(localDb);

            await localAdapter.dispose();

            assert.strictEqual(localDb.isOpen, false);
        });
    });
});

describe("PrismaLightDBAdapterFactory 集成测试", () => {
    let testDir: string;

    beforeEach(() => {
        testDir = join(tmpdir(), `lightdb-factory-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("应该正确创建适配器工厂", () => {
        const factory = createLightDBAdapterFactory({
            dbPath: join(testDir, "test.light"),
        });

        assert.ok(factory);
        assert.strictEqual(factory.provider, "sqlite");
        assert.strictEqual(factory.adapterName, "lightdb");
    });

    it("应该正确连接数据库", async () => {
        const factory = createLightDBAdapterFactory({
            dbPath: join(testDir, "test.light"),
            dbName: "testdb",
        });

        const adapter = await factory.connect();

        assert.ok(adapter);
        assert.strictEqual(adapter.provider, "sqlite");
        assert.strictEqual(adapter.adapterName, "lightdb");

        await factory.disconnect();
    });

    it("应该正确断开连接", async () => {
        const factory = createLightDBAdapterFactory({
            dbPath: join(testDir, "test.light"),
        });

        await factory.connect();
        await factory.disconnect();
    });

    it("重复调用 connect 应该返回相同实例", async () => {
        const factory = createLightDBAdapterFactory({
            dbPath: join(testDir, "test.light"),
        });

        const adapter1 = await factory.connect();
        const adapter2 = await factory.connect();

        assert.strictEqual(adapter1, adapter2);

        await factory.disconnect();
    });

    it("应该支持自定义配置选项", async () => {
        const factory = createLightDBAdapterFactory({
            dbPath: join(testDir, "test.light"),
            dbName: "customdb",
            pageSize: 8192,
            walThreshold: 32 * 1024 * 1024,
            autoCheckpoint: false,
        });

        const adapter = await factory.connect();
        assert.ok(adapter);

        await factory.disconnect();
    });
});

describe("完整 CRUD 操作测试", () => {
    let db: LightDB;
    let adapter: PrismaLightDBAdapter;
    let testDir: string;

    beforeEach(async () => {
        testDir = join(tmpdir(), `lightdb-crud-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });

        db = await LightDB.open(join(testDir, "test.light"), {
            dbName: "crudtest",
        });

        adapter = createLightDBAdapter(db);
    });

    afterEach(async () => {
        await adapter.dispose();
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    it("应该完成完整的 CRUD 循环", async () => {
        await adapter.executeRaw({
            sql: "INSERT INTO products (id, name, price) VALUES (?, ?, ?)",
            args: [1, "Widget", 29.99],
            argTypes: [],
        });

        let result = await adapter.queryRaw({
            sql: "SELECT * FROM products WHERE id = ?",
            args: [1],
            argTypes: [],
        });

        assert.strictEqual(result.rows.length, 1);

        await adapter.executeRaw({
            sql: "UPDATE products SET price = ? WHERE id = ?",
            args: [39.99, 1],
            argTypes: [],
        });

        result = await adapter.queryRaw({
            sql: "SELECT * FROM products WHERE id = ?",
            args: [1],
            argTypes: [],
        });

        assert.strictEqual(result.rows.length, 1);

        await adapter.executeRaw({
            sql: "DELETE FROM products WHERE id = ?",
            args: [1],
            argTypes: [],
        });

        result = await adapter.queryRaw({
            sql: "SELECT * FROM products",
            args: [],
            argTypes: [],
        });

        assert.strictEqual(result.rows.length, 0);
    });

    it("应该正确处理批量插入", async () => {
        for (let i = 1; i <= 100; i++) {
            await adapter.executeRaw({
                sql: "INSERT INTO items (id, value) VALUES (?, ?)",
                args: [i, `Item ${i}`],
                argTypes: [],
            });
        }

        const result = await adapter.queryRaw({
            sql: "SELECT * FROM items",
            args: [],
            argTypes: [],
        });

        assert.strictEqual(result.rows.length, 100);
    });

    it("应该正确处理复杂查询条件", async () => {
        const collection = db.collection("orders", {
            name: "orders",
            primaryKey: "id",
        });

        for (let i = 1; i <= 50; i++) {
            collection.insert({
                id: i,
                userId: Math.floor(i / 10) + 1,
                amount: i * 10,
                status: i % 2 === 0 ? "completed" : "pending",
            });
        }

        const result = await adapter.queryRaw({
            sql: "SELECT * FROM orders WHERE userId = ? AND status = ?",
            args: [1, "pending"],
            argTypes: [],
        });

        assert.ok(result.rows.length > 0);
    });
});
