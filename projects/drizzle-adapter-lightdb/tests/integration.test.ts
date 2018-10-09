/**
 * Drizzle 适配器集成测试
 * 测试与 Drizzle ORM 配合、完整 CRUD 操作和事务场景
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { LightDB } from "@yydb/light-db";
import { drizzle, LightDBDrizzleDatabase, LightDBSession, SQLExecutor } from "../src/index.js";
import type { SchemaRegistry, TableSchema, LightDBResult } from "../src/types.js";

describe("Drizzle Adapter Integration Tests", () => {
    let testDir: string;
    let db: LightDB;
    let drizzleDb: LightDBDrizzleDatabase;
    let session: LightDBSession<Record<string, unknown>, Record<string, unknown>>;
    let registry: SchemaRegistry;

    beforeEach(async () => {
        testDir = join(tmpdir(), `drizzle-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });
        db = await LightDB.open(testDir);
        drizzleDb = drizzle(db);
        session = drizzleDb.getSession();
        registry = drizzleDb.getSchemaRegistry();
    });

    afterEach(async () => {
        await drizzleDb.close();
        if (existsSync(testDir)) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe("SQLExecutor Integration", () => {
        let executor: SQLExecutor;

        beforeEach(() => {
            executor = new SQLExecutor(db, registry);
        });

        describe("CREATE TABLE", () => {
            it("should create table with primary key", () => {
                const result = executor.execute(`
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        email TEXT
                    )
                `);

                assert.strictEqual(result.changes, 0);
                assert.strictEqual(result.rows.length, 0);

                const schema = registry.schemas.get("users");
                assert.ok(schema);
                assert.strictEqual(schema!.tableName, "users");
                assert.strictEqual(schema!.primaryKey, "id");
            });

            it("should create table with auto increment", () => {
                const result = executor.execute(`
                    CREATE TABLE products (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        price REAL
                    )
                `);

                assert.strictEqual(result.changes, 0);

                const schema = registry.schemas.get("products");
                assert.ok(schema);
                const idColumn = schema!.columns.find((c) => c.name === "id");
                assert.ok(idColumn);
                assert.strictEqual(idColumn!.autoIncrement, true);
            });

            it("should create table with unique constraint", () => {
                const result = executor.execute(`
                    CREATE TABLE accounts (
                        id INTEGER PRIMARY KEY,
                        username TEXT UNIQUE,
                        password TEXT
                    )
                `);

                const schema = registry.schemas.get("accounts");
                assert.ok(schema);
                assert.ok(schema!.indexes);
                assert.strictEqual(schema!.indexes!.length, 1);
                assert.strictEqual(schema!.indexes![0]!.fieldName, "username");
                assert.strictEqual(schema!.indexes![0]!.unique, true);
            });
        });

        describe("INSERT Operations", () => {
            beforeEach(() => {
                executor.execute(`
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        email TEXT,
                        age INTEGER
                    )
                `);
            });

            it("should insert single row", () => {
                const result = executor.execute(`
                    INSERT INTO users (id, name, email, age)
                    VALUES (1, 'Alice', 'alice@example.com', 30)
                `);

                assert.strictEqual(result.changes, 1);
                assert.strictEqual(result.lastInsertRowid, 1);
            });

            it("should insert multiple rows", () => {
                const result = executor.execute(`
                    INSERT INTO users (id, name, email, age)
                    VALUES 
                        (1, 'Alice', 'alice@example.com', 30),
                        (2, 'Bob', 'bob@example.com', 25),
                        (3, 'Charlie', 'charlie@example.com', 35)
                `);

                assert.strictEqual(result.changes, 3);
            });

            it("should insert with parameters", () => {
                const result = executor.execute(
                    "INSERT INTO users (id, name, email, age) VALUES (?, ?, ?, ?)",
                    [4, "David", "david@example.com", 28],
                );

                assert.strictEqual(result.changes, 1);
            });
        });

        describe("SELECT Operations", () => {
            beforeEach(() => {
                executor.execute(`
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        email TEXT,
                        age INTEGER
                    )
                `);
                executor.execute(`
                    INSERT INTO users (id, name, email, age)
                    VALUES 
                        (1, 'Alice', 'alice@example.com', 30),
                        (2, 'Bob', 'bob@example.com', 25),
                        (3, 'Charlie', 'charlie@example.com', 35)
                `);
            });

            it("should select all rows", () => {
                const result = executor.execute("SELECT * FROM users");

                assert.strictEqual(result.rows.length, 3);
            });

            it("should select with WHERE clause", () => {
                const result = executor.execute("SELECT * FROM users WHERE age > 28");

                assert.strictEqual(result.rows.length, 2);
                const names = result.rows.map((r) => r.name);
                assert.ok(names.includes("Alice"));
                assert.ok(names.includes("Charlie"));
            });

            it("should select with equality condition", () => {
                const result = executor.execute("SELECT * FROM users WHERE name = 'Alice'");

                assert.strictEqual(result.rows.length, 1);
                assert.strictEqual(result.rows[0]!.name, "Alice");
            });

            it("should select with parameterized query", () => {
                const result = executor.execute("SELECT * FROM users WHERE age > ?", [28]);

                assert.strictEqual(result.rows.length, 2);
            });

            it("should select with ORDER BY", () => {
                const result = executor.execute("SELECT * FROM users ORDER BY age DESC");

                assert.strictEqual(result.rows[0]!.name, "Charlie");
                assert.strictEqual(result.rows[1]!.name, "Alice");
                assert.strictEqual(result.rows[2]!.name, "Bob");
            });

            it("should select with LIMIT", () => {
                const result = executor.execute("SELECT * FROM users LIMIT 2");

                assert.strictEqual(result.rows.length, 2);
            });

            it("should select with OFFSET", () => {
                const result = executor.execute("SELECT * FROM users ORDER BY id LIMIT 2 OFFSET 1");

                assert.strictEqual(result.rows.length, 2);
                assert.strictEqual(result.rows[0]!.name, "Bob");
            });

            it("should select specific columns", () => {
                const result = executor.execute("SELECT name, email FROM users WHERE id = 1");

                assert.strictEqual(result.rows.length, 1);
                assert.strictEqual(result.rows[0]!.name, "Alice");
                assert.strictEqual(result.rows[0]!.email, "alice@example.com");
                assert.strictEqual(result.rows[0]!.id, undefined);
            });

            it("should select with column alias", () => {
                const result = executor.execute("SELECT name AS username FROM users WHERE id = 1");

                assert.strictEqual(result.rows[0]!.username, "Alice");
            });
        });

        describe("UPDATE Operations", () => {
            beforeEach(() => {
                executor.execute(`
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        email TEXT,
                        age INTEGER
                    )
                `);
                executor.execute(`
                    INSERT INTO users (id, name, email, age)
                    VALUES (1, 'Alice', 'alice@example.com', 30)
                `);
            });

            it("should update single row", () => {
                const result = executor.execute("UPDATE users SET age = 31 WHERE id = 1");

                assert.strictEqual(result.changes, 1);

                const selectResult = executor.execute("SELECT age FROM users WHERE id = 1");
                assert.strictEqual(selectResult.rows[0]!.age, 31);
            });

            it("should update multiple columns", () => {
                const result = executor.execute(`
                    UPDATE users 
                    SET name = 'Alice Smith', email = 'alice.smith@example.com'
                    WHERE id = 1
                `);

                assert.strictEqual(result.changes, 1);

                const selectResult = executor.execute("SELECT * FROM users WHERE id = 1");
                assert.strictEqual(selectResult.rows[0]!.name, "Alice Smith");
                assert.strictEqual(selectResult.rows[0]!.email, "alice.smith@example.com");
            });

            it("should update with parameters", () => {
                const result = executor.execute("UPDATE users SET age = ? WHERE id = ?", [32, 1]);

                assert.strictEqual(result.changes, 1);
            });
        });

        describe("DELETE Operations", () => {
            beforeEach(() => {
                executor.execute(`
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL
                    )
                `);
                executor.execute(`
                    INSERT INTO users (id, name) VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie')
                `);
            });

            it("should delete single row", () => {
                const result = executor.execute("DELETE FROM users WHERE id = 1");

                assert.strictEqual(result.changes, 1);

                const selectResult = executor.execute("SELECT * FROM users");
                assert.strictEqual(selectResult.rows.length, 2);
            });

            it("should delete multiple rows", () => {
                const result = executor.execute("DELETE FROM users WHERE id > 1");

                assert.strictEqual(result.changes, 2);
            });

            it("should delete all rows", () => {
                const result = executor.execute("DELETE FROM users");

                assert.strictEqual(result.changes, 3);
            });
        });

        describe("DROP TABLE", () => {
            it("should drop table", () => {
                executor.execute("CREATE TABLE temp (id INTEGER PRIMARY KEY)");
                assert.ok(registry.schemas.has("temp"));

                const result = executor.execute("DROP TABLE temp");

                assert.strictEqual(result.changes, 0);
                assert.ok(!registry.schemas.has("temp"));
            });
        });
    });

    describe("LightDBSession Integration", () => {
        describe("prepareQuery", () => {
            beforeEach(() => {
                const executor = new SQLExecutor(db, registry);
                executor.execute(`
                    CREATE TABLE users (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        age INTEGER
                    )
                `);
                executor.execute(`
                    INSERT INTO users (id, name, age) VALUES (1, 'Alice', 30)
                `);
            });

            it("should prepare and execute query with run method", async () => {
                const preparedQuery = session.prepareQuery(
                    { sql: "SELECT * FROM users", params: [] },
                    undefined,
                    "run",
                    false,
                );

                const result = (await preparedQuery.run()) as LightDBResult;

                assert.strictEqual(result.rows.length, 1);
            });

            it("should prepare and execute query with all method", async () => {
                const preparedQuery = session.prepareQuery(
                    { sql: "SELECT * FROM users", params: [] },
                    undefined,
                    "all",
                    false,
                );

                const rows = (await preparedQuery.all()) as Record<string, unknown>[];

                assert.strictEqual(rows.length, 1);
                assert.strictEqual(rows[0]!.name, "Alice");
            });

            it("should prepare and execute query with get method", async () => {
                const preparedQuery = session.prepareQuery(
                    { sql: "SELECT * FROM users WHERE id = ?", params: [1] },
                    undefined,
                    "get",
                    false,
                );

                const row = (await preparedQuery.get()) as Record<string, unknown>;

                assert.ok(row);
                assert.strictEqual(row.name, "Alice");
            });

            it("should return undefined for no result with get method", async () => {
                const preparedQuery = session.prepareQuery(
                    { sql: "SELECT * FROM users WHERE id = ?", params: [999] },
                    undefined,
                    "get",
                    false,
                );

                const row = await preparedQuery.get();

                assert.strictEqual(row, undefined);
            });

            it("should execute query with values method", async () => {
                const preparedQuery = session.prepareQuery(
                    { sql: "SELECT name, age FROM users", params: [] },
                    undefined,
                    "values",
                    false,
                );

                const values = (await preparedQuery.values()) as unknown[][];

                assert.strictEqual(values.length, 1);
                assert.deepStrictEqual(values[0], ["Alice", 30]);
            });
        });

        describe("transaction", () => {
            beforeEach(() => {
                const executor = new SQLExecutor(db, registry);
                executor.execute(`
                    CREATE TABLE accounts (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        balance INTEGER
                    )
                `);
                executor.execute(`
                    INSERT INTO accounts (id, name, balance) VALUES (1, 'Alice', 100)
                `);
                executor.execute(`
                    INSERT INTO accounts (id, name, balance) VALUES (2, 'Bob', 50)
                `);
            });

            it("should commit transaction successfully", async () => {
                await session.transaction(async (tx) => {
                    await tx.run({ sql: "UPDATE accounts SET balance = balance - 10 WHERE id = 1", params: [] });
                    await tx.run({ sql: "UPDATE accounts SET balance = balance + 10 WHERE id = 2", params: [] });
                });

                const executor = new SQLExecutor(db, registry);
                const result = executor.execute("SELECT * FROM accounts ORDER BY id");

                assert.strictEqual(result.rows[0]!.balance, 90);
                assert.strictEqual(result.rows[1]!.balance, 60);
            });

            it("should rollback transaction on error", async () => {
                const executor = new SQLExecutor(db, registry);

                try {
                    await session.transaction(async (tx) => {
                        await tx.run({ sql: "UPDATE accounts SET balance = 200 WHERE id = 1", params: [] });
                        throw new Error("Simulated error");
                    });
                } catch (err) {
                    assert.strictEqual((err as Error).message, "Simulated error");
                }

                const result = executor.execute("SELECT balance FROM accounts WHERE id = 1");
                assert.strictEqual(result.rows[0]!.balance, 100);
            });
        });
    });

    describe("LightDBDrizzleDatabase", () => {
        it("should return LightDB instance", () => {
            const lightDb = drizzleDb.getLightDB();

            assert.strictEqual(lightDb, db);
        });

        it("should return schema registry", () => {
            const reg = drizzleDb.getSchemaRegistry();

            assert.ok(reg);
            assert.ok(reg.tables instanceof Map);
            assert.ok(reg.schemas instanceof Map);
        });

        it("should register schema", () => {
            const schema: TableSchema = {
                tableName: "custom_table",
                primaryKey: "id",
                columns: [
                    { name: "id", dataType: "INTEGER", nullable: false, hasDefault: false, autoIncrement: false },
                    { name: "data", dataType: "TEXT", nullable: true, hasDefault: false, autoIncrement: false },
                ],
            };

            drizzleDb.registerSchema("custom_table", schema);

            const reg = drizzleDb.getSchemaRegistry();
            const registered = reg.schemas.get("custom_table");

            assert.ok(registered);
            assert.strictEqual(registered!.tableName, "custom_table");
        });

        it("should close database", async () => {
            const newTestDir = join(tmpdir(), `drizzle-close-test-${Date.now()}`);
            mkdirSync(newTestDir, { recursive: true });
            const newDb = await LightDB.open(newTestDir);
            const newDrizzleDb = drizzle(newDb);

            await newDrizzleDb.close();

            rmSync(newTestDir, { recursive: true, force: true });
        });
    });

    describe("Complex Query Scenarios", () => {
        let executor: SQLExecutor;

        beforeEach(() => {
            executor = new SQLExecutor(db, registry);

            executor.execute(`
                CREATE TABLE orders (
                    id INTEGER PRIMARY KEY,
                    customer_id INTEGER,
                    product TEXT,
                    quantity INTEGER,
                    price REAL,
                    status TEXT
                )
            `);

            executor.execute(`
                INSERT INTO orders (id, customer_id, product, quantity, price, status)
                VALUES 
                    (1, 101, 'Laptop', 1, 999.99, 'completed'),
                    (2, 101, 'Mouse', 2, 25.50, 'completed'),
                    (3, 102, 'Keyboard', 1, 75.00, 'pending'),
                    (4, 103, 'Monitor', 2, 299.99, 'completed'),
                    (5, 102, 'Headphones', 1, 149.99, 'shipped')
            `);
        });

        it("should handle multiple conditions with AND", () => {
            const result = executor.execute(`
                SELECT * FROM orders 
                WHERE customer_id = 101 AND status = 'completed'
            `);

            assert.strictEqual(result.rows.length, 2);
        });

        it("should handle range conditions", () => {
            const result = executor.execute(`
                SELECT * FROM orders WHERE price >= 100
            `);

            assert.strictEqual(result.rows.length, 3);
        });

        it("should handle complex ordering", () => {
            const result = executor.execute(`
                SELECT * FROM orders ORDER BY customer_id ASC, price DESC
            `);

            assert.strictEqual(result.rows[0]!.customer_id, 101);
            assert.strictEqual(result.rows[0]!.price, 999.99);
            assert.strictEqual(result.rows[1]!.customer_id, 101);
            assert.strictEqual(result.rows[1]!.price, 25.50);
        });

        it("should handle pagination", () => {
            const page1 = executor.execute("SELECT * FROM orders ORDER BY id LIMIT 2 OFFSET 0");
            const page2 = executor.execute("SELECT * FROM orders ORDER BY id LIMIT 2 OFFSET 2");

            assert.strictEqual(page1.rows.length, 2);
            assert.strictEqual(page2.rows.length, 2);
            assert.strictEqual(page1.rows[0]!.id, 1);
            assert.strictEqual(page2.rows[0]!.id, 3);
        });
    });

    describe("Error Handling", () => {
        let executor: SQLExecutor;

        beforeEach(() => {
            executor = new SQLExecutor(db, registry);
        });

        it("should throw error for invalid SQL", () => {
            assert.throws(() => {
                executor.execute("INVALID SQL STATEMENT");
            }, /SQL Parse Error/);
        });

        it("should throw error for SELECT without FROM", () => {
            assert.throws(() => {
                executor.execute("SELECT *");
            }, /must have FROM clause/);
        });

        it("should throw error for unsupported statement", () => {
            assert.throws(() => {
                executor.execute("ALTER TABLE users ADD COLUMN test TEXT");
            }, /Unsupported statement type/);
        });

        it("should return empty result for empty SQL", () => {
            const result = executor.execute("");

            assert.strictEqual(result.changes, 0);
            assert.strictEqual(result.rows.length, 0);
        });
    });
});
