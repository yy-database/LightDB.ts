# Prisma Adapter for LightDB 🚀

A high-performance Prisma driver adapter for LightDB, providing seamless integration between Prisma ORM and the LightDB storage engine.

## Features ✨

- **Seamless Integration**: Full compatibility with Prisma ORM
- **High Performance**: Leverages LightDB's fast storage engine
- **Type Safety**: Full TypeScript support
- **Transaction Support**: ACID-compliant operations
- **Easy Setup**: Simple configuration and usage

## Installation 📦

```bash
pnpm add @prisma/adapter-lightdb @prisma/client @yydb/light-db
```

## Quick Start 🚀

### 1. Add the adapter to your Prisma schema

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "lightdb"
  url      = "file:./dev.db"
}

model User {
  id    Int     @id @default(autoincrement())
  name  String
  email String  @unique
  age   Int?
}
```

### 2. Generate the Prisma client

```bash
prisma generate
```

### 3. Use the adapter in your code

```typescript
import { PrismaClient } from '@prisma/client';
import { LightDB } from '@yydb/light-db';
import { lightDbAdapter } from '@prisma/adapter-lightdb';

// Initialize LightDB
const db = await LightDB.open('./dev.db');

// Create Prisma client with LightDB adapter
const adapter = lightDbAdapter(db);
const prisma = new PrismaClient({ adapter });

// Create a user
const user = await prisma.user.create({
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
  },
});

console.log(user);

// Query users
const allUsers = await prisma.user.findMany();
console.log(allUsers);

// Update a user
const updatedUser = await prisma.user.update({
  where: { id: 1 },
  data: { name: 'John Smith' },
});

// Delete a user
await prisma.user.delete({ where: { id: 1 } });

// Close the database when done
await db.close();
```

## Configuration ⚙️

### Connection Options

The `lightDbAdapter` function accepts a LightDB instance as its only parameter. You can configure LightDB according to your needs:

```typescript
import { LightDB } from '@yydb/light-db';

// Initialize LightDB with custom options
const db = await LightDB.open('./dev.db', {
  // Optional configuration options
  wal: {
    maxSize: 1024 * 1024 * 100, // 100MB
  },
  checkpoint: {
    interval: 60000, // 1 minute
  },
});

const adapter = lightDbAdapter(db);
const prisma = new PrismaClient({ adapter });
```

## Supported Prisma Features 📋

- ✅ CRUD operations
- ✅ Transactions
- ✅ Relations
- ✅ Aggregations
- ✅ Filtering
- ✅ Sorting
- ✅ Pagination

## Performance Considerations ⚡

- **Batch Operations**: For bulk operations, use Prisma's batch methods
- **Indexing**: Create indexes on frequently queried fields
- **Transaction Scope**: Keep transactions short to avoid locking

## Troubleshooting 🔧

### Common Issues

1. **Connection Errors**: Ensure the LightDB instance is properly initialized and not closed
2. **Schema Errors**: Check your Prisma schema definitions
3. **Performance Issues**: Consider adding indexes or optimizing your queries

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

## License 📄

This adapter is licensed under the MPL-2.0 License. See the [LICENSE](LICENSE) file for details.
