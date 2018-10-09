# LightDB 文档

## 项目概述

LightDB 是一个纯 TypeScript 编写的高性能数据库存储引擎，旨在提供光速读写、极致轻量的数据库解决方案，同时对 TypeScript 提供一等公民支持。

## 核心特性

- **高性能**：优化的批处理写入和列式存储
- **事务支持**：ACID 兼容操作
- **高级索引**：B+ 树索引用于快速查询和排序
- **预写日志 (WAL)**：确保数据持久性和崩溃恢复
- **自动恢复**：通过 WAL 回放无缝恢复
- **内存映射文件**：高效的 I/O 操作
- **TypeScript 友好**：完整的 TypeScript 类型支持
- **面向文档的 API**：直观的集合式接口

## 文档目录

- [架构设计](architecture.md) - 整体架构和文件格式设计
- [性能优化](performance.md) - 性能优化策略和技术
- [市场分析](market.md) - 市场定位和 ORM 集成
- [使用指南](guide/index.md) - 使用教程和最佳实践
- [维护指南](maintenance/index.md) - 维护和故障排除

## 快速开始

```typescript
import { LightDB } from '@yydb/light-db';

// 初始化数据库
const db = await LightDB.open('./mydb');

// 创建集合
const users = db.collection('users');

// 插入文档
await users.insert({ id: 1, name: 'John Doe', email: 'john@example.com' });

// 查询文档
const user = await users.findOne({ id: 1 });
console.log(user); // { id: 1, name: 'John Doe', email: 'john@example.com' }

// 关闭数据库
await db.close();
```
