# 架构设计

## 整体架构

LightDB 采用**分层解耦**设计，从底向上分为：

1. **存储引擎层**：管理 `.light`、`.wal`、`.shm` 文件，负责数据持久化与恢复。
2. **索引引擎层**：实现主键索引（B+树）及可选的二级索引。
3. **集合（Collection）层**：类似表的概念，提供 CRUD 操作。
4. **API 层**：暴露给用户的强类型接口。

整个数据库运行在 Node.js 环境中，数据完全驻留内存以追求极致速度，同时通过 WAL 机制保证持久化安全。

## 文件格式设计

三个文件的职责分工参考了 SQLite 的设计，但更简化：

| 文件后缀 | 名称 | 作用 |
|---------|------|------|
| `.light` | 主数据文件 | 存储数据库的完整快照（Snapshot），采用自定义二进制格式 |
| `.wal` | 预写日志文件 | 记录每一次写操作的增量日志，用于崩溃恢复与异步持久化 |
| `.shm` | 共享内存文件 | 存储 WAL 索引（页面映射），用于加速 WAL 回放，避免重复解析 |

### `.light` 文件结构（二进制）
```
[Header]        (固定长度，含魔数、版本、页面大小、上次快照LSN)
[Page 1]        (数据页，默认4KB)
[Page 2]
...
[Page N]
```
- 采用**页面（Page）** 存储，每个页面可容纳多条记录。
- 记录格式：`[Key长度][Key][Value长度][Value][校验和]`
- 所有整数使用 Little-Endian 编码。

### `.wal` 文件结构（追加写入）
```
[Record 1] → [LSN] [事务ID] [操作类型(Insert/Update/Delete)] [Key] [Value] [校验和]
[Record 2]
...
```
- LSN（Log Sequence Number）单调递增，用于恢复时确定回放顺序。
- 每个记录独立校验，避免损坏扩散。

### `.shm` 文件结构（固定大小，内存映射）
```
[WAL-Index Header]   (存储当前WAL文件的大小、最后一个完整页的LSN等)
[Page Hash Array]    (哈希表，快速定位WAL中每个页面最新记录)
```
- 通过 `mmap` 或普通文件读写实现，用于加速恢复时构建脏页表。

## 核心工作流程

### 1. 启动与恢复
- 读取 `.shm` 文件（若存在），快速获取上次未回放的 WAL 范围。
- 如果 `.shm` 丢失或损坏，扫描 `.wal` 文件重建索引。
- 按 LSN 顺序将 WAL 记录回放到内存中的 B+ 树。
- 最后加载 `.light` 文件（如果 WAL 回放后仍有未覆盖的页面）。

### 2. 写操作流程（Insert/Update/Delete）
- 在内存 B+ 树上直接修改数据（保证读取零延迟）。
- 生成一条 WAL 记录，**同步追加**到 `.wal` 文件（可配置 `fsync` 策略）。
- 更新 `.shm` 中的 WAL 索引（若启用内存映射则直接更新）。
- **不立即写入 `.light` 文件**，以实现“写前日志 + 异步检查点”。

### 3. 检查点（Checkpoint）
- 当 WAL 文件超过阈值（如 16MB）或用户主动调用 `db.checkpoint()` 时触发。
- 将内存中的完整数据**原子性**写入新的 `.light` 文件（先写临时文件，再 rename）。
- 清空 `.wal` 文件，重置 `.shm`。
- 此操作不影响正在进行的读写（双文件技术）。

## TypeScript 友好的 API 设计

### 基础用法
```typescript
import { LightDB, defineCollection } from 'lightdb';

// 定义强类型 Schema
interface User {
  id: number;
  name: string;
  age: number;
}

const db = await LightDB.open('./data', { autoCheckpoint: true });

// 获取一个类型安全的 Collection
const users = db.collection<User>('users', {
  primaryKey: 'id',           // 主键字段
  indexes: ['name']           // 二级索引
});

// 插入数据（自动推断类型）
await users.insert({ id: 1, name: 'Alice', age: 30 });

// 查询（链式调用，完全类型安全）
const result = await users
  .findOne({ where: { name: 'Alice' } });
// result 的类型为 User | null

// 更新
await users.update({ id: 1 }, { $set: { age: 31 } });

// 删除
await users.delete({ id: 1 });
```

### 高级查询（无需 SQL）
```typescript
// 支持丰富条件
await users.find({
  where: {
    age: { $gt: 18, $lt: 65 },
    name: { $in: ['Alice', 'Bob'] }
  },
  sort: { age: 'desc' },
  limit: 10,
  offset: 20
});
```

### 事务支持（ACID）
```typescript
await db.transaction(async (tx) => {
  const user = await tx.users.findOne({ where: { id: 1 } });
  await tx.users.update({ id: 1 }, { balance: user.balance - 100 });
  await tx.orders.insert({ userId: 1, amount: 100 });
});
```

## 性能优化策略

1. **零拷贝读取**：数据页在内存中以 `Buffer` 形式缓存，读取时直接返回引用（不可变，写时复制）。
2. **异步 WAL 写入**：默认 `fsync` 每 N 条记录一次，可在性能与持久化之间权衡。
3. **内存 B+ 树**：所有索引与数据均驻留内存，查询 O(log n)。
4. **惰性检查点**：仅在 WAL 过大或空闲时触发，减少 I/O 干扰。
5. **二级索引**：使用 `Map<索引值, Set<主键>>` 实现，更新时自动维护。
6. **批量操作**：`insertMany` 只生成一条 WAL 记录，大幅提升吞吐。

## 部署与依赖

- **零原生依赖**：纯 TypeScript 编写，编译为 CommonJS/ESM。
- **运行时要求**：Node.js 14+（支持 `fs.promises`、`Buffer`）。
- **可选依赖**：`fs-extra`（用于原子 rename），`zlib`（支持数据页压缩）。

## 与 `petitedb` 的对比

| 特性 | LightDB | petitedb |
|------|---------|----------|
| 持久化格式 | `.light` + `.wal` + `.shm` | 单个 JSON 文件 |
| 写性能 | 极高（WAL + 内存修改） | 中等（全量写 JSON） |
| 崩溃恢复 | 自动回放 WAL | 可能丢最后几次写入 |
| 并发读写 | 多读单写（通过读写锁） | 单线程 |
| 类型安全 | 泛型 + 查询构造器 | 简单泛型 |
| 索引 | 主键 B+树 + 二级哈希 | 无索引 |

## 快速开始（自研路径）

你可以按照以下步骤逐步实现 LightDB：

1. **实现内存存储**：`Map<主键, 对象>`  + 基础的 CRUD。
2. **实现 WAL 写入**：每次写操作追加到 `.wal` 文件（同步 `fs.appendFileSync`）。
3. **实现启动恢复**：启动时读取 `.wal` 回放至内存 Map。
4. **引入 B+树**：替换 Map 作为主索引（可先用 `@tylerbu/sorted-btree-es6`）。
5. **实现检查点**：将内存 Map 序列化为自定义二进制格式写入 `.light`。
6. **实现 `.shm` 索引**：加速 WAL 回放。
7. **添加二级索引**：维护额外的 `Map`。
8. **封装 TypeScript 泛型 API**：提供链式查询构造器。

## 开发路线图 (Roadmap)

### ✅ 已完成

| 阶段 | 模块 | 状态 | 完成日期 | 说明 |
|------|------|------|----------|------|
| 1 | 存储引擎层 | ✅ 完成 | 2024-04 | WAL、检查点、崩溃恢复、.light/.wal/.shm 文件格式 |
| 2 | 索引引擎层 | ✅ 完成 | 2026-04-17 | B+ 树主键索引、二级索引、索引管理器 |
| 3 | 集合层 (Collection) | ✅ 完成 | 2026-04-17 | CRUD 操作、链式查询、查询条件解析、更新操作符 |
| 4 | API 层 | ✅ 完成 | 2026-04-17 | LightDB 主类、类型安全集合、事务 API、链式查询构建器 |

### 🔄 进行中

| 阶段 | 模块 | 状态 | 说明 |
|------|------|------|------|
| - | - | - | - |

### 📅 待开发

| 阶段 | 模块 | 优先级 | 说明 |
|------|------|--------|------|
| 5 | 查询引擎 | 高 | 聚合操作、游标支持、查询优化器 |
| 6 | 事务增强 | 中 | 乐观并发控制、事务隔离级别增强 |
| 7 | ORM 适配器 | 低 | Prisma/Drizzle 适配器 |

### 下一步计划

1. **完善查询引擎**
   - 聚合管道实现
   - 游标支持
   - 查询优化器

2. **增强事务支持**
   - 乐观并发控制
   - 事务隔离级别增强
   - 死锁检测
