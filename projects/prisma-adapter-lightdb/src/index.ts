/**
 * @prisma/adapter-lightdb
 *
 * Prisma driver adapter for LightDB - A high-performance TypeScript database
 *
 * This adapter enables Prisma ORM to work with LightDB as a backend database.
 * It translates Prisma's SQL queries into LightDB's NoSQL operations.
 *
 * @packageDocumentation
 */

export {
    PrismaLightDBAdapter,
    PrismaLightDBAdapterFactory,
    LightDBAdapterError,
    createLightDBAdapter,
    createLightDBAdapterFactory,
} from "./adapter.js";

export { SqlConverter } from "./sql-converter.js";

export type {
    LightDBAdapterOptions,
    SqlExecutionResult,
    QueryBuilderOptions,
    InsertBuilderOptions,
    UpdateBuilderOptions,
    DeleteBuilderOptions,
    CollectionSchemaDefinition,
    FieldTypeDefinition,
    TransactionIsolationLevel,
    TransactionOptions,
} from "./types.js";

export type { ConversionResult } from "./sql-converter.js";
