# 维护指南

## 故障排除

### 数据库无法启动

**症状**：数据库启动时抛出错误或无法正常打开。

**可能原因**：
1. **文件损坏**：WAL 文件或数据文件损坏
2. **权限问题**：数据库文件没有读写权限
3. **端口冲突**：如果使用网络模式，端口可能被占用
4. **内存不足**：系统内存不足以加载数据库

**解决方案**：
1. **文件检查**：检查数据库文件是否存在且完整
2. **权限修复**：确保数据库文件和目录有正确的读写权限
3. **内存检查**：增加系统内存或减少数据库大小
4. **恢复模式**：使用 `LightDB.open('./mydb', { recoveryMode: true })` 启动

### 性能下降

**症状**：查询速度变慢，写入操作延迟增加。

**可能原因**：
1. **WAL 文件过大**：WAL 文件未及时清理
2. **索引缺失**：频繁查询的字段没有索引
3. **内存不足**：数据量超过内存容量
4. **磁盘 I/O 瓶颈**：磁盘读写速度限制

**解决方案**：
1. **手动检查点**：执行 `db.checkpoint()` 清理 WAL 文件
2. **添加索引**：为频繁查询的字段创建索引
3. **内存优化**：增加 Node.js 内存限制 (`--max-old-space-size`)
4. **磁盘优化**：使用 SSD 或优化磁盘 I/O 设置

### 数据丢失

**症状**：数据在重启后丢失或不完整。

**可能原因**：
1. **未提交的事务**：事务未正确提交
2. **异常关闭**：应用程序异常终止
3. **WAL 损坏**：WAL 文件损坏导致恢复失败
4. **磁盘故障**：物理磁盘损坏

**解决方案**：
1. **事务管理**：确保所有事务正确提交
2. **优雅关闭**：在应用退出前调用 `db.close()`
3. **备份策略**：定期备份数据库文件
4. **恢复操作**：使用 `recoveryMode` 启动尝试恢复

## 备份与恢复

### 手动备份

```typescript
// 方法一：复制文件
import { copyFileSync, mkdirSync, existsSync } from 'fs';

// 确保数据库已关闭或处于只读状态
function backupDatabase(sourcePath, backupPath) {
  if (!existsSync(backupPath)) {
    mkdirSync(backupPath, { recursive: true });
  }
  
  // 复制所有数据库文件
  copyFileSync(`${sourcePath}.light`, `${backupPath}/backup.light`);
  copyFileSync(`${sourcePath}.wal`, `${backupPath}/backup.wal`);
  copyFileSync(`${sourcePath}.shm`, `${backupPath}/backup.shm`);
  
  console.log('Backup completed successfully');
}

// 方法二：使用检查点创建一致性快照
async function createConsistentBackup(db, backupPath) {
  // 执行检查点确保所有数据写入 .light 文件
  await db.checkpoint();
  
  // 现在可以安全复制 .light 文件
  copyFileSync('./mydb.light', `${backupPath}/backup.light`);
  
  console.log('Consistent backup created');
}
```

### 自动备份

```typescript
// 定期自动备份
function scheduleBackup(db, backupPath, intervalHours = 24) {
  setInterval(async () => {
    try {
      await createConsistentBackup(db, backupPath);
      console.log(`Backup completed at ${new Date().toISOString()}`);
    } catch (error) {
      console.error('Backup failed:', error);
    }
  }, intervalHours * 60 * 60 * 1000);
  
  console.log(`Backup scheduled every ${intervalHours} hours`);
}
```

### 恢复操作

```typescript
// 从备份恢复
import { copyFileSync } from 'fs';

function restoreFromBackup(backupPath, targetPath) {
  // 确保目标路径不存在或已关闭
  copyFileSync(`${backupPath}/backup.light`, `${targetPath}.light`);
  copyFileSync(`${backupPath}/backup.wal`, `${targetPath}.wal`);
  copyFileSync(`${backupPath}/backup.shm`, `${targetPath}.shm`);
  
  console.log('Database restored from backup');
}

// 启动时恢复
const db = await LightDB.open('./mydb', {
  recoveryMode: true, // 启用恢复模式
  forceRecovery: true // 强制恢复，即使有轻微损坏
});
```

## 监控与日志

### 性能监控

```typescript
// 监控查询性能
function monitorQueryPerformance(db) {
  const originalFind = db.collection('users').find;
  
  db.collection('users').find = async function(query) {
    const startTime = Date.now();
    const result = await originalFind.call(this, query);
    const endTime = Date.now();
    console.log(`Query took ${endTime - startTime}ms`);
    return result;
  };
}

// 监控 WAL 大小
function monitorWALSize(dbPath, thresholdMB = 100) {
  setInterval(() => {
    const fs = require('fs');
    const stats = fs.statSync(`${dbPath}.wal`);
    const sizeMB = stats.size / (1024 * 1024);
    
    if (sizeMB > thresholdMB) {
      console.warn(`WAL file size (${sizeMB.toFixed(2)}MB) exceeds threshold (${thresholdMB}MB)`);
      // 可以自动触发检查点
    }
  }, 60000); // 每分钟检查一次
}
```

### 日志配置

```typescript
// 配置详细日志
const db = await LightDB.open('./mydb', {
  logging: {
    level: 'info', // error, warn, info, debug
    file: './lightdb.log', // 可选：输出到文件
    console: true // 可选：输出到控制台
  }
});

// 自定义日志处理
const db = await LightDB.open('./mydb', {
  logging: {
    level: 'debug',
    handler: (level, message) => {
      // 自定义日志处理，例如发送到日志服务
      if (level === 'error') {
        // 发送错误到监控服务
        sendToMonitoringService(message);
      }
      console[level](`[LightDB] ${message}`);
    }
  }
});
```

## 数据库维护

### 优化数据库

```typescript
// 执行完整优化
async function optimizeDatabase(db) {
  // 1. 执行检查点
  await db.checkpoint();
  
  // 2. 重建索引（如果有必要）
  const collections = await db.getCollections();
  for (const collectionName of collections) {
    const collection = db.collection(collectionName);
    await collection.rebuildIndexes();
  }
  
  console.log('Database optimized successfully');
}

// 压缩数据库
async function compactDatabase(db) {
  // 执行检查点并压缩
  await db.checkpoint({ compact: true });
  console.log('Database compacted successfully');
}
```

### 数据库升级

```typescript
// 检查版本
const db = await LightDB.open('./mydb');
const version = await db.getVersion();
console.log(`Current database version: ${version}`);

// 升级数据库格式
async function upgradeDatabase(db, targetVersion) {
  const currentVersion = await db.getVersion();
  if (currentVersion < targetVersion) {
    await db.upgrade(targetVersion);
    console.log(`Database upgraded from version ${currentVersion} to ${targetVersion}`);
  } else {
    console.log('Database is already at the latest version');
  }
}
```

### 安全维护

```typescript
// 设置密码保护（如果支持）
const db = await LightDB.open('./mydb', {
  encryption: {
    enabled: true,
    password: 'your-secure-password'
  }
});

// 访问控制
function setupAccessControl(db) {
  // 实现基于角色的访问控制
  const roles = {
    admin: ['read', 'write', 'delete', 'admin'],
    user: ['read', 'write'],
    guest: ['read']
  };
  
  // 验证权限
  function checkPermission(userRole, requiredPermission) {
    return roles[userRole]?.includes(requiredPermission) || false;
  }
  
  return { checkPermission };
}
```

## 常见问题

### Q: 数据库文件变得很大，如何减小？

**A**: 执行 `db.checkpoint({ compact: true })` 可以压缩数据库文件，移除未使用的空间。

### Q: 如何处理并发访问？

**A**: LightDB 内置支持并发访问，使用读写锁允许多个读操作同时进行，写操作独占。对于高并发场景，建议使用连接池。

### Q: 如何迁移数据到新服务器？

**A**: 1. 在源服务器执行 `db.checkpoint()` 确保所有数据写入 .light 文件
       2. 复制 .light、.wal 和 .shm 文件到新服务器
       3. 在新服务器启动数据库

### Q: 如何处理大量数据？

**A**: 对于大量数据：
1. 使用批量操作（如 `insertMany`）
2. 创建适当的索引
3. 考虑使用分区表
4. 增加 Node.js 内存限制
5. 定期执行检查点

### Q: 如何监控数据库健康状态？

**A**: 实现定期健康检查：
```typescript
async function healthCheck(db) {
  try {
    // 执行简单查询测试连接
    await db.collection('system').findOne({ id: 'health' });
    return { status: 'healthy', timestamp: new Date() };
  } catch (error) {
    return { status: 'unhealthy', error: error.message, timestamp: new Date() };
  }
}
```

## 支持与社区

### 获取帮助

- **GitHub Issues**：在 [GitHub 仓库](https://github.com/yy-database/LightDB.ts) 提交问题
- **Discord 社区**：加入 Discord 服务器获取实时帮助
- **文档**：参考本文档和 API 文档
- **示例项目**：查看 GitHub 上的示例项目

### 贡献代码

1. **Fork 仓库**：在 GitHub 上 fork LightDB 仓库
2. **创建分支**：创建功能分支
3. **提交更改**：提交代码更改
4. **创建 PR**：创建 Pull Request
5. **代码审查**：通过代码审查后合并

### 报告问题

在报告问题时，请提供：
1. **LightDB 版本**：使用 `db.getVersion()` 获取
2. **Node.js 版本**：使用 `node -v` 获取
3. **操作系统**：Windows、macOS 或 Linux
4. **问题描述**：详细描述问题
5. **复现步骤**：如何复现问题
6. **错误日志**：完整的错误信息
7. **预期行为**：期望的行为

## 总结

定期维护是确保 LightDB 稳定运行的关键。通过实施备份策略、监控性能、优化数据库和及时处理问题，可以确保数据库系统的可靠性和性能。

如果遇到无法解决的问题，请不要 hesitate向社区寻求帮助。
