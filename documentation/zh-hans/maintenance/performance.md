# 性能优化

在不引入任何 C/C++ 依赖（包括 WebAssembly）的前提下，纯 TypeScript/Node.js 环境仍然有大量优化空间。LightDB 的设计可以从以下几个维度深度挖掘性能：

## 🧠 1. 内存数据结构优化

### 使用 `Map` + 自定义哈希策略
- 原生 `Map` 在大量键值对场景下比普通对象快 2~3 倍。
- 对于数值主键，直接使用 `Map<number, T>`；对于字符串，使用 `Map<string, T>`。
- 避免使用 `delete` 频繁删除属性（会破坏 V8 隐藏类），改用 `Map.prototype.delete`。

### 紧凑对象存储（降低 GC 压力）
- 将数据行存储为**平行数组**（Columnar Storage）而非行对象数组。
  ```typescript
  // 行式（默认）
  class Row { id: number; name: string; age: number; }
  
  // 列式（内存友好，GC 友好）
  class ColumnStore {
    ids: Int32Array;
    names: string[];
    ages: Int8Array;
  }
  ```
- 列式存储对聚合、范围扫描性能极高，且减少了对象头开销。

### 使用 `TypedArray` 存储定长数值
- 主键、时间戳、计数器等用 `Uint32Array` 或 `Int32Array`。
- 字符串单独存于 `string[]`，通过索引关联。

## 📝 2. 索引与查询优化

### 二级索引采用 `Map<索引值, Set<主键>>`
- `Set` 去重且查找 O(1)，适合等值查询。
- 对于范围查询，可改用 **`@tylerbu/sorted-btree-es6`**（纯 TS B+树实现）。

### 位图索引（适合低基数列）
- 例如 `status` 只有 'active', 'inactive'，为每个值维护一个 `Uint8Array` 位图。
- 位运算 `AND`/`OR` 极快，且内存紧凑。

### 查询短路与提前过滤
- 实现 `Iterable` 风格的惰性求值，不一次性加载所有结果。
- 利用 `for...of` 和 `yield` 返回迭代器，配合 `limit` 提前终止。

## 💾 3. 持久化与 I/O 优化

### 自定义二进制序列化（零 JSON 开销）
- 使用 `Buffer` 直接读写，避免 `JSON.stringify`/`parse` 的 CPU 和内存开销。
- 格式示例：
  ```typescript
  // 写入一条记录
  const buf = Buffer.allocUnsafe(4 + keyLen + 4 + valueLen);
  buf.writeUInt32LE(keyLen, 0);
  buf.write(key, 4, keyLen, 'utf8');
  buf.writeUInt32LE(valueLen, 4 + keyLen);
  buf.write(value, 4 + keyLen + 4, valueLen, 'utf8');
  ```
- 使用 `Buffer.pool` 减少频繁分配。

### 异步批量写入 + 合并小 I/O
- 将多个写操作的 WAL 记录暂存于内存队列，定时或队列满时一次性 `fs.writev` 写入。
- 配置 `fsync` 策略：每 N 条记录或每 N 毫秒调用一次 `fsync`（牺牲部分持久化换取吞吐）。

### 文件级优化
- 使用 `fs.open` 的 `'rs'` 标志（同步读取，跳过系统缓存）可能适得其反，改为 `'r+'` 让 OS 管理页缓存。
- 对于 `.shm` 文件，使用 `Buffer` 和 `fs.read`/`write` 模拟共享内存（Node.js 无原生 `mmap`，但可自行维护内存副本，定期同步）。

## 🔄 4. 检查点与 WAL 优化

### 增量检查点（而非全量快照）
- 只将 **脏页**（自上次检查点后修改的页面）写入 `.light` 文件。
- 维护一个 `Set<pageId>` 记录哪些页面被修改。

### WAL 记录压缩
- 对于 `Update` 操作，只存储变更字段（Partial Update），而非整行。
- 使用字典编码或 Run-Length Encoding (RLE) 压缩连续相同值。

### 并行回放 WAL
- 启动时，将 WAL 文件分块，使用 `worker_threads` 并行解析校验和，再按 LSN 顺序应用（注意事务依赖）。

## ⚙️ 5. 运行时与 V8 优化

### 避免动态属性与 `delete`
- 始终使用相同的对象形状（Shape），避免在热路径上添加/删除属性。
- 使用 `class` 定义固定属性，或使用 `Map`。

### 函数内联与单态调用
- 确保查询条件函数（如 `predicate`）被编译为单态（每次调用传入相同类型的参数）。
- 避免在循环中使用 `try...catch`。

### 利用 `--max-old-space-size` 扩大内存
- 纯 JS 数据库可以将数据全部驻留内存，给 Node 分配足够内存（如 4GB）。

## 🧵 6. 并发与多线程

### 读写锁 + 多读单写
- 使用 `async-mutex` 或自己实现 `RWLock`，允许多个读查询并发，写操作独占。
- 将索引查询和内存读取放在读锁内，修改操作放在写锁内。

### `worker_threads` 分流任务
- 将检查点、WAL 压缩、索引重建等耗时任务放到 Worker 线程，不阻塞主线程的读写。
- 主线程和 Worker 之间通过 `SharedArrayBuffer` 传递数据（需谨慎处理原子操作）。

### 事务的并行优化
- 冲突检测：不同事务若操作无交集的主键，可并行提交（乐观并发控制）。

## 📦 7. 批量操作与 API 设计

### 批量写入使用 WAL 多记录合并
- `insertMany(rows)` 生成一条 WAL 记录，包含所有行的二进制块。
- 检查点时一次性写入所有行。

### 链式查询返回 `Iterable` 而非数组
- 避免中间数组分配，例如 `find().filter().map()` 每一步都生成新数组，改用惰性求值生成器。

## 🔬 8. 利用现代 Node.js 特性

### `fs.createWriteStream` 的高水位线
- 对于 `.wal` 的追加写入，使用 `WriteStream` 并设置 `highWaterMark` 为 64KB，自动合并小写。

### `stream.pipeline` 流式处理检查点
- 将内存数据通过 `Readable` 流直接 pipe 到文件流，避免完整序列化到内存再写入。

### `Buffer.allocUnsafe` + 手动 `fill`
- 比 `Buffer.alloc` 快 2 倍以上，但需要手动管理未初始化内存（不影响安全性，只要写入全部字节）。

## 🧪 9. 冷热数据分离

### 内存热数据 + 磁盘冷数据
- 将近期修改或高频访问的数据保留在内存 B+树中，低频数据（根据访问时间戳）换出到磁盘文件。
- 实现类似操作系统的 LRU 页缓存。

### 分区表（Sharding）
- 按主键范围将集合拆分为多个独立文件（如 `users_0.light`, `users_1.light`），查询时只操作相关分区。

## 🛠 10. 性能分析工具

- **`--prof` 和 `--trace-ic`**：分析 V8 内联缓存命中率。
- **`clinic.js`**：定位 I/O 瓶颈和 GC 停顿。
- **`0x`**：生成火焰图，查看函数调用热点。

---

这些优化策略绝大多数都可以在纯 TypeScript 中实现，且不依赖任何原生模块。你可以根据 LightDB 的实际瓶颈，选择性地引入。例如：
- **初期**：实现列式存储 + 二进制 WAL + 异步批量写入。
- **进阶**：增量检查点 + Worker 线程并行回放。
- **极致**：SharedArrayBuffer 无锁索引 + 位图索引。
