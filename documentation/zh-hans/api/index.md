# LightDB 核心 API 文档

## 概述

LightDB 提供了完整的类型安全 API，包括数据库管理、集合操作、查询构建和事务支持。

## 安装

```bash
pnpm add @yydb/light-db
```

## 核心类

### LightDB

LightDB 是数据库的主类，提供数据库的打开、关闭、集合管理和事务操作。

#### 静态方法

##### `LightDB.open(path: string, options?: LightDBOptions): Promise<LightDB>`

打开或创建数据库实例。

**参数：**
- `path` - 数据库文件存储路径
- `options` - 配置选项

**配置选项：**
```typescript
interface LightDBOptions {
  /** 数据库名称，默认为 'default' */
  dbName?: string;
  /** 页面大小，默认 4096 */
  pageSize?: number;
  /** WAL 阈值，默认 16MB */
  walThreshold?: number;
  /** 是否启用自动检查点，默认 true */
  autoCheckpoint?: boolean;
  /** fsync 策略 */
  fsyncStrategy?: 'full' | 'normal' | 'none';
}
```

**示例：**
```typescript
import { LightDB } from '@yydb/light-db';

const db = await LightDB.open('./data/mydb', {
  dbName: 'mydb',
  pageSize: 4096,
  autoCheckpoint: true
});
```

#### 实例属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `dbName` | `string` | 数据库名称 |
| `path` | `string` | 数据库路径 |
| `isOpen` | `boolean` | 数据库是否已打开 |

#### 实例方法

##### `collection<T>(name: string, options: CollectionCreateOptions<T>): Collection<T>`

获取或创建集合。

**参数：**
- `name` - 集合名称
- `options` - 集合配置

**集合配置：**
```typescript
interface CollectionCreateOptions<T> {
  /** 集合名称（必填） */
  name: string;
  /** 主键字段名（必填） */
  primaryKey: keyof T & string;
  /** 二级索引配置 */
  indexes?: IndexConfig<T>[];
}

interface IndexConfig<T> {
  /** 索引名称 */
  name: string;
  /** 索引字段名 */
  fieldName: keyof T & string;
  /** 是否唯一索引 */
  unique?: boolean;
  /** 是否稀疏索引 */
  sparse?: boolean;
}
```

**示例：**
```typescript
interface User {
  id: number;
  name: string;
  email: string;
  age: number;
}

const users = db.collection<User>('users', {
  name: 'users',
  primaryKey: 'id',
  indexes: [
    { name: 'email_idx', fieldName: 'email', unique: true },
    { name: 'age_idx', fieldName: 'age' }
  ]
});
```

##### `hasCollection(name: string): boolean`

检查集合是否存在。

##### `dropCollection(name: string): boolean`

删除集合。

##### `getCollectionNames(): string[]`

获取所有集合名称。

##### `transaction(callback: TransactionCallback, options?: TransactionOptions): Promise<TransactionResult>`

执行事务。

**示例：**
```typescript
await db.transaction(async (tx) => {
  const users = tx.collection<User>('users');
  const user = await users.findOne({ id: 1 });
  await users.update({ id: 1 }, { $set: { balance: user.balance - 100 } });
});
```

##### `checkpoint(): Promise<CheckpointResult>`

执行检查点，将内存数据持久化到磁盘。

##### `getStats(): Promise<DatabaseStats>`

获取数据库统计信息。

##### `getConfig(): DatabaseConfig`

获取数据库配置信息。

##### `sync(): Promise<void>`

同步数据到磁盘。

##### `close(): Promise<void>`

关闭数据库。

---

### Collection<T>

Collection 是文档集合类，提供类型安全的 CRUD 操作。

#### 实例属性

| 属性 | 类型 | 描述 |
|------|------|------|
| `Name` | `string` | 集合名称 |
| `PrimaryKeyField` | `string` | 主键字段名 |
| `Size` | `number` | 文档数量 |

#### 插入操作

##### `insert(doc: T, options?: InsertOptions): InsertResult<T>`

插入单条文档。

```typescript
const result = users.insert({
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

console.log(result.success);      // true
console.log(result.insertedCount); // 1
```

##### `insertMany(docs: T[], options?: InsertOptions): InsertManyResult<T>`

批量插入文档。

```typescript
const result = users.insertMany([
  { id: 1, name: 'Alice', email: 'alice@example.com', age: 25 },
  { id: 2, name: 'Bob', email: 'bob@example.com', age: 30 }
]);
```

#### 查询操作

##### `find(options?: QueryOptions<T>): FindResult<T>`

查找文档。

**查询选项：**
```typescript
interface QueryOptions<T> {
  /** 查询过滤器 */
  where?: QueryFilter<T>;
  /** 排序条件 */
  sort?: SortCondition<T>;
  /** 跳过记录数 */
  offset?: number;
  /** 返回记录数限制 */
  limit?: number;
  /** 返回的字段（投影） */
  fields?: Array<keyof T>;
}
```

**示例：**
```typescript
const result = users.find({
  where: { age: { $gt: 20 } },
  sort: { age: 'desc' },
  limit: 10,
  offset: 0
});

console.log(result.docs);
```

##### `findOne(filter: QueryFilter<T>): T | null`

查找单条文档。

```typescript
const user = users.findOne({ id: 1 });
```

##### `findByPrimaryKey(primaryKey: PrimaryKeyType): T | undefined`

通过主键查找文档。

```typescript
const user = users.findByPrimaryKey(1);
```

##### `findBySecondaryIndex(indexName: string, value: unknown): T[]`

通过二级索引查找文档。

```typescript
const usersWithEmail = users.findBySecondaryIndex('email_idx', 'john@example.com');
```

#### 更新操作

##### `update(filter: QueryFilter<T>, update: UpdateOperation<T>, options?: UpdateOptions): UpdateResult`

更新文档。

```typescript
const result = users.update(
  { id: 1 },
  { $set: { name: 'John Smith', age: 31 } }
);
```

##### `updateOne(filter: QueryFilter<T>, update: UpdateOperation<T>, options?: UpdateOptions): UpdateResult`

更新单条文档。

##### `updateMany(filter: QueryFilter<T>, update: UpdateOperation<T>, options?: UpdateOptions): UpdateResult`

更新多条文档。

#### 删除操作

##### `delete(filter: QueryFilter<T>, options?: DeleteOptions): DeleteResult`

删除文档。

```typescript
const result = users.delete({ id: 1 });
```

##### `deleteOne(filter: QueryFilter<T>, options?: DeleteOptions): DeleteResult`

删除单条文档。

##### `deleteMany(filter: QueryFilter<T>, options?: DeleteOptions): DeleteResult`

删除多条文档。

##### `deleteByPrimaryKey(primaryKey: PrimaryKeyType): boolean`

通过主键删除文档。

#### 其他操作

##### `count(filter?: QueryFilter<T>): number`

统计文档数量。

```typescript
const total = users.count();
const youngUsers = users.count({ age: { $lt: 30 } });
```

##### `exists(filter: QueryFilter<T>): boolean`

检查文档是否存在。

##### `query(): QueryBuilder<T>`

创建查询构建器。

##### `clear(): void`

清空集合。

##### `getStats(): CollectionStats`

获取集合统计信息。

##### `createIndex(config: IndexConfig<T>): void`

创建二级索引。

##### `dropIndex(name: string): boolean`

删除二级索引。

##### `getIndexNames(): string[]`

获取所有索引名称。

##### `getAll(): T[]`

获取所有文档。

##### `validate(): { valid: boolean; errors: string[] }`

验证集合一致性。

##### `rebuildIndexes(): void`

重建所有索引。

---

## 查询过滤器

### 比较操作符

| 操作符 | 描述 | 示例 |
|--------|------|------|
| `$eq` | 等于 | `{ age: { $eq: 30 } }` |
| `$ne` | 不等于 | `{ status: { $ne: 'inactive' } }` |
| `$gt` | 大于 | `{ age: { $gt: 18 } }` |
| `$gte` | 大于等于 | `{ age: { $gte: 18 } }` |
| `$lt` | 小于 | `{ age: { $lt: 65 } }` |
| `$lte` | 小于等于 | `{ age: { $lte: 65 } }` |

### 数组操作符

| 操作符 | 描述 | 示例 |
|--------|------|------|
| `$in` | 包含于数组 | `{ status: { $in: ['active', 'pending'] } }` |
| `$nin` | 不包含于数组 | `{ status: { $nin: ['deleted', 'banned'] } }` |

### 存在性操作符

| 操作符 | 描述 | 示例 |
|--------|------|------|
| `$exists` | 字段是否存在 | `{ email: { $exists: true } }` |

### 正则表达式操作符

| 操作符 | 描述 | 示例 |
|--------|------|------|
| `$regex` | 正则表达式匹配 | `{ name: { $regex: /^John/ } }` |

### 逻辑操作符

| 操作符 | 描述 | 示例 |
|--------|------|------|
| `$and` | 逻辑与 | `{ $and: [{ age: { $gt: 18 } }, { status: 'active' }] }` |
| `$or` | 逻辑或 | `{ $or: [{ role: 'admin' }, { role: 'moderator' }] }` |
| `$not` | 逻辑非 | `{ age: { $not: { $lt: 18 } } }` |
| `$nor` | 逻辑非或 | `{ $nor: [{ status: 'deleted' }, { status: 'banned' }] }` |

---

## 更新操作符

### 字段操作

| 操作符 | 描述 | 示例 |
|--------|------|------|
| `$set` | 设置字段值 | `{ $set: { name: 'John', age: 30 } }` |
| `$unset` | 删除字段 | `{ $unset: { tempField: true } }` |
| `$rename` | 重命名字段 | `{ $rename: { oldName: 'newName' } }` |
| `$currentDate` | 设置当前日期 | `{ $currentDate: { updatedAt: true } }` |

### 数值操作

| 操作符 | 描述 | 示例 |
|--------|------|------|
| `$inc` | 增加数值 | `{ $inc: { count: 1, score: -5 } }` |
| `$mul` | 乘以数值 | `{ $mul: { price: 1.1 } }` |

### 数组操作

| 操作符 | 描述 | 示例 |
|--------|------|------|
| `$push` | 添加数组元素 | `{ $push: { tags: 'new-tag' } }` |
| `$pull` | 删除数组元素 | `{ $pull: { tags: 'old-tag' } }` |
| `$addToSet` | 添加唯一元素 | `{ $addToSet: { tags: 'unique-tag' } }` |
| `$pop` | 弹出数组元素 | `{ $pop: { items: 1 } }` |

---

## 事务

### 事务选项

```typescript
interface TransactionOptions {
  /** 事务超时时间（毫秒），默认 5000 */
  timeout?: number;
  /** 事务隔离级别 */
  isolationLevel?: 'read_committed' | 'repeatable_read' | 'serializable';
}
```

### 事务结果

```typescript
interface TransactionResult {
  /** 事务是否成功 */
  success: boolean;
  /** 事务状态 */
  state: 'active' | 'committed' | 'rolled_back' | 'failed';
  /** 事务持续时间（毫秒） */
  durationMs: number;
  /** 错误信息（如果失败） */
  error?: string;
}
```

### 事务示例

```typescript
await db.transaction(async (tx) => {
  const accounts = tx.collection<Account>('accounts');
  
  const from = await accounts.findOne({ id: 1 });
  const to = await accounts.findOne({ id: 2 });
  
  if (!from || !to) {
    throw new Error('Account not found');
  }
  
  await accounts.update({ id: 1 }, { $inc: { balance: -100 } });
  await accounts.update({ id: 2 }, { $inc: { balance: 100 } });
});
```

---

## 错误处理

### 错误类型

```typescript
class CollectionError extends Error {
  readonly code: string;
}

class StorageError extends Error {
  readonly code: string;
}
```

### 错误代码

| 代码 | 描述 |
|------|------|
| `DUPLICATE_KEY` | 主键重复 |
| `MISSING_PRIMARY_KEY` | 缺少主键 |
| `INVALID_PRIMARY_KEY_TYPE` | 主键类型无效 |
| `DOCUMENT_NOT_FOUND` | 文档未找到 |
| `DATABASE_CLOSED` | 数据库已关闭 |
| `DATABASE_NOT_INITIALIZED` | 数据库未初始化 |

### 错误处理示例

```typescript
import { CollectionError, StorageError } from '@yydb/light-db';

try {
  users.insert({ id: 1, name: 'John' }, { throwOnDuplicate: true });
} catch (error) {
  if (error instanceof CollectionError) {
    console.error(`Collection error [${error.code}]: ${error.message}`);
  }
}
```

---

## 类型定义

### 主键类型

```typescript
type PrimaryKeyType = string | number;
```

### 文档类型

```typescript
type Document<T> = T & Record<string, unknown>;
```

### 排序方向

```typescript
type SortDirection = 1 | -1 | 'asc' | 'desc';
```

### 排序条件

```typescript
type SortCondition<T> = Partial<Record<keyof T, SortDirection>>;
```

---

## 完整示例

```typescript
import { LightDB, defineCollectionSchema } from '@yydb/light-db';

interface User {
  id: number;
  name: string;
  email: string;
  age: number;
  createdAt: Date;
  tags: string[];
}

async function main() {
  const db = await LightDB.open('./data/mydb');
  
  const users = db.collection<User>('users', {
    name: 'users',
    primaryKey: 'id',
    indexes: [
      { name: 'email_idx', fieldName: 'email', unique: true },
      { name: 'age_idx', fieldName: 'age' }
    ]
  });
  
  users.insert({
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    createdAt: new Date(),
    tags: ['developer', 'typescript']
  });
  
  const result = users.find({
    where: {
      $and: [
        { age: { $gte: 25 } },
        { tags: { $in: ['developer'] } }
      ]
    },
    sort: { age: 'desc' },
    limit: 10
  });
  
  console.log(result.docs);
  
  users.update(
    { id: 1 },
    {
      $set: { name: 'John Smith' },
      $push: { tags: 'nodejs' }
    }
  );
  
  await db.close();
}

main();
```
