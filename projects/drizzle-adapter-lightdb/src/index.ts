/**
 * @lightdb/drizzle-adapter
 * Drizzle ORM adapter for LightDB
 *
 * This adapter provides seamless integration between Drizzle ORM and LightDB,
 * allowing you to use Drizzle's type-safe query builder with LightDB's
 * high-performance embedded database.
 *
 * @example
 * ```typescript
 * import { LightDB } from '@yydb/light-db';
 * import { drizzle } from '@lightdb/drizzle-adapter';
 * import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
 *
 * // Define your schema
 * const users = sqliteTable('users', {
 *   id: integer('id').primaryKey(),
 *   name: text('name').notNull(),
 *   email: text('email').notNull().unique(),
 * });
 *
 * // Create LightDB instance
 * const db = await LightDB.open('./data');
 *
 * // Create Drizzle instance
 * const drizzleDb = drizzle(db, { schema: { users } });
 *
 * // Use Drizzle's query builder
 * const allUsers = await drizzleDb.select().from(users);
 * ```
 */

export {
    LightDBSession,
    LightDBTransaction,
    LightDBPreparedQuery,
} from "./session.js";
export {
    LightDBDrizzleDatabase,
    drizzle,
    createDrizzleDatabase,
} from "./driver.js";
export { SQLExecutor } from "./sql-executor.js";

export type {
    LightDBResult,
    LightDBDrizzleConfig,
    TableSchema,
    ColumnDefinition,
    SQLExecutionResult,
    QueryParams,
    TransactionContext,
    DrizzleSessionConfig,
    PreparedQueryConfig,
    BatchQueryItem,
    BatchQueryResult,
    SchemaRegistry,
    DrizzleDialectConfig,
} from "./types.js";

export { DEFAULT_DIALECT_CONFIG } from "./types.js";
