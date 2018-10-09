# LightDB 🚀

A high-performance TypeScript database with WAL (Write-Ahead Logging), advanced indexing, and robust transaction support.

## 📋 Project Overview

LightDB is a modern, high-performance database storage engine written in TypeScript. It provides a robust foundation for building data-driven applications with enterprise-grade features while maintaining simplicity and ease of use.

## ✨ Key Features

### Core Features

- **High Performance**: Optimized for speed with batch writing and columnar storage
- **Transaction Support**: ACID-compliant operations for data integrity
- **Advanced Indexing**: B+ tree indexes for fast querying and sorting
- **Write-Ahead Logging (WAL)**: Ensures data durability and crash recovery
- **Automatic Recovery**: Seamlessly restores from crashes using WAL replay
- **Memory-Mapped Files**: Efficient I/O operations for improved performance
- **TypeScript Ready**: Full TypeScript support with comprehensive type definitions
- **Document-Oriented API**: Intuitive collection-based interface

### Performance Optimizations

- **Batch Writing**: Optimizes disk I/O for bulk operations
- **Columnar Storage**: Reduces disk space and improves query performance
- **Lazy Loading**: Loads data only when needed
- **Connection Pooling**: Manages database connections efficiently
- **Caching**: In-memory caching for frequently accessed data

## 📦 Installation

```bash
pnpm add @yydb/light-db
```

## 🚀 Quick Start

```typescript
import { LightDB } from '@yydb/light-db';

// Initialize the database
const db = await LightDB.open('./demo');

// Create a collection
const users = db.collection('users');

// Insert a document
await users.insert({ id: 1, name: 'John Doe', email: 'john@example.com' });

// Find a document
const user = await users.findOne({ id: 1 });
console.log(user); // { id: 1, name: 'John Doe', email: 'john@example.com' }

// Update a document
await users.update({ id: 1 }, { $set: { name: 'John Smith' } });

// Delete a document
await users.delete({ id: 1 });

// Close the database
await db.close();
```

## 🏗️ Architecture

LightDB consists of several key components:

1. **Storage Engine**: Manages the physical storage of data on disk
2. **WAL (Write-Ahead Log)**: Ensures data durability and supports recovery
3. **Index Manager**: Manages B+ tree indexes for fast querying
4. **Collection Layer**: Provides a document-oriented API
5. **Transaction Manager**: Handles ACID-compliant transactions
6. **Recovery System**: Restores database state after crashes

## 📚 Core API

### LightDB Class

- **LightDB.open(path)**: Opens or creates a database at the specified path
- **db.collection(name)**: Creates or returns a collection with the given name
- **db.transaction()**: Starts a new transaction
- **db.close()**: Closes the database connection

### Collection Class

- **collection.insert(document)**: Inserts a new document into the collection
- **collection.find(query)**: Finds all documents matching the query
- **collection.findOne(query)**: Finds the first document matching the query
- **collection.update(query, update)**: Updates documents matching the query
- **collection.delete(query)**: Deletes documents matching the query
- **collection.createIndex(field)**: Creates an index on the specified field

### Transaction Class

- **transaction.commit()**: Commits the transaction
- **transaction.rollback()**: Rolls back the transaction

## 🔄 Recovery System

LightDB automatically recovers from crashes using the Write-Ahead Log (WAL). When the database is opened after a crash, it replays the WAL to restore the database to a consistent state, ensuring no data loss.

## 🛠️ Advanced Usage

### Transactions

```typescript
const db = await LightDB.open('./mydb');

// Start a transaction
const tx = await db.transaction();

try {
  // Get collections within the transaction
  const users = tx.collection('users');
  const orders = tx.collection('orders');
  
  // Perform operations
  await users.insert({ id: 1, name: 'John' });
  await orders.insert({ userId: 1, amount: 100 });
  
  // Commit the transaction
  await tx.commit();
} catch (error) {
  // Rollback on error
  await tx.rollback();
  console.error('Transaction failed:', error);
}

await db.close();
```

### Indexes

```typescript
const db = await LightDB.open('./mydb');
const users = db.collection('users');

// Create an index on the 'email' field for faster queries
await users.createIndex('email');

// Now queries on email will be much faster
const user = await users.findOne({ email: 'john@example.com' });

await db.close();
```

## 🧩 ORM Integrations

LightDB provides seamless integrations with popular ORMs:

- **Drizzle ORM**: [Drizzle ORM Adapter](./projects/drizzle-adapter-lightdb/readme.md)
- **Prisma ORM**: [Prisma ORM Adapter](./projects/prisma-adapter-lightdb/readme.md)
