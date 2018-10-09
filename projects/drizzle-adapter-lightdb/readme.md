# Drizzle ORM Adapter for LightDB 🚀

A high-performance Drizzle ORM adapter for LightDB, providing seamless integration between Drizzle ORM and the LightDB storage engine.

## Features ✨

- **Seamless Integration**: Full compatibility with Drizzle ORM
- **High Performance**: Leverages LightDB's fast storage engine
- **Type Safety**: Full TypeScript support
- **Transaction Support**: ACID-compliant operations
- **Easy Setup**: Simple configuration and usage

## Installation 📦

```bash
pnpm add @lightdb/drizzle-adapter drizzle-orm @yydb/light-db
```

## Quick Start 🚀

```typescript
import { drizzle } from 'drizzle-orm';
import { LightDB } from '@yydb/light-db';
import { lightDbAdapter } from '@lightdb/drizzle-adapter';

// Initialize LightDB
const db = await LightDB.open('./mydb');

// Create Drizzle ORM instance
const adapter = lightDbAdapter(db);
const orm = drizzle(adapter);

// Define your schema
import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core';

const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  age: integer('age'),
});

// Insert a user
await orm.insert(users).values({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
});

// Query users
const allUsers = await orm.select().from(users);
console.log(allUsers);

// Update a user
await orm.update(users)
  .set({ name: 'John Smith' })
  .where(eq(users.id, 1));

// Delete a user
await orm.delete(users).where(eq(users.id, 1));

// Close the database when done
await db.close();
```

## Configuration ⚙️

### Connection Options

The `lightDbAdapter` function accepts a LightDB instance as its only parameter. You can configure LightDB according to your needs:

```typescript
import { LightDB } from '@yydb/light-db';

// Initialize LightDB with custom options
const db = await LightDB.open('./mydb', {
  // Optional configuration options
  wal: {
    maxSize: 1024 * 1024 * 100, // 100MB
  },
  checkpoint: {
    interval: 60000, // 1 minute
  },
});

const adapter = lightDbAdapter(db);
```

## Supported Drizzle Features 📋

- ✅ Select queries
- ✅ Insert operations
- ✅ Update operations
- ✅ Delete operations
- ✅ Transactions
- ✅ Joins
- ✅ Aggregations
- ✅ Indexes

## Performance Considerations ⚡

- **Batch Operations**: For bulk inserts/updates, use Drizzle's batch operations for better performance
- **Indexing**: Create indexes on frequently queried columns
- **Transaction Scope**: Keep transactions short to avoid locking

## Troubleshooting 🔧

### Common Issues

1. **Connection Errors**: Ensure the LightDB instance is properly initialized and not closed
2. **Query Errors**: Check your Drizzle schema definitions
3. **Performance Issues**: Consider adding indexes or optimizing your queries

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

## License 📄

This adapter is licensed under the MPL-2.0 License. See the [LICENSE](LICENSE) file for details.
