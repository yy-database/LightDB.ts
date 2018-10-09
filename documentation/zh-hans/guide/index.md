# 使用指南

## 安装

```bash
pnpm add @yydb/light-db
```

## 基本用法

### 初始化数据库

```typescript
import { LightDB } from '@yydb/light-db';

// 打开或创建数据库
const db = await LightDB.open('./mydb');
```

### 创建集合

```typescript
// 创建一个名为 'users' 的集合
const users = db.collection('users');

// 创建带索引的集合
const usersWithIndex = db.collection('users', {
  indexes: ['email', 'age']
});
```

### 插入数据

```typescript
// 插入单个文档
await users.insert({
  id: 1,
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

// 批量插入
await users.insertMany([
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35 }
]);
```

### 查询数据

```typescript
// 查找单个文档
const user = await users.findOne({ id: 1 });

// 查找多个文档
const allUsers = await users.find({});

// 带条件查询
const youngUsers = await users.find({
  where: { age: { $lt: 30 } }
});

// 排序和分页
const sortedUsers = await users.find({
  where: { age: { $gt: 18 } },
  sort: { age: 'desc' },
  limit: 10,
  offset: 0
});
```

### 更新数据

```typescript
// 更新单个文档
await users.update({ id: 1 }, {
  $set: { name: 'John Smith', age: 31 }
});

// 更新多个文档
await users.update({ age: { $lt: 18 } }, {
  $set: { status: 'minor' }
});
```

### 删除数据

```typescript
// 删除单个文档
await users.delete({ id: 1 });

// 删除多个文档
await users.delete({ age: { $gt: 65 } });
```

### 使用事务

```typescript
// 开始事务
const tx = await db.transaction();

try {
  // 在事务中操作
  const user = await tx.collection('users').findOne({ id: 1 });
  
  if (user) {
    // 扣减余额
    await tx.collection('users').update({ id: 1 }, {
      $set: { balance: user.balance - 100 }
    });
    
    // 记录交易
    await tx.collection('transactions').insert({
      userId: 1,
      amount: 100,
      type: 'debit',
      date: new Date()
    });
  }
  
  // 提交事务
  await tx.commit();
} catch (error) {
  // 回滚事务
  await tx.rollback();
  console.error('Transaction failed:', error);
}
```

### 关闭数据库

```typescript
// 关闭数据库连接
await db.close();
```

## 高级用法

### 索引管理

```typescript
// 创建索引
await users.createIndex('email');

// 删除索引
await users.dropIndex('email');

// 查看索引
const indexes = await users.getIndexes();
console.log(indexes);
```

### 检查点操作

```typescript
// 手动触发检查点
await db.checkpoint();

// 配置自动检查点
const db = await LightDB.open('./mydb', {
  autoCheckpoint: true,
  checkpointThreshold: 16 * 1024 * 1024 // 16MB
});
```

### 性能优化

```typescript
// 批量操作
await users.insertMany(largeDataSet);

// 惰性查询
const cursor = users.find({}).cursor();
for await (const user of cursor) {
  // 处理每个用户
  console.log(user);
}
```

## 最佳实践

1. **连接管理**：每个应用实例只创建一个数据库连接
2. **错误处理**：总是使用 try/catch 处理数据库操作
3. **事务使用**：对于相关操作，使用事务确保数据一致性
4. **索引设计**：为频繁查询的字段创建索引
5. **批量操作**：对于大量数据，使用批量操作提高性能
6. **资源释放**：在应用退出前关闭数据库连接
