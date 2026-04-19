# Redis Cache Manager — 总结文档

对用户提供的 `<content>`（Redis 缓存管理模块）的简明总结。

## 结构
- Python 模块：docstring 描述特性（价格存储、币种属性、虚拟持仓、TTL、批量）→ 可选 import redis、InMemoryRedisClient（内存实现，兼容 Redis 常用 API）→ RedisManager（连接 Redis，失败则回退到 InMemoryRedisClient）→ 价格/币种属性/虚拟持仓三组方法、工具方法、get_redis_manager 单例。
- InMemoryRedisClient：_strings、_hashes、_sorted_sets、_expire_at；setex/get、zadd/zcard/zremrangebyrank/zrangebyscore/zrevrange、hset/hgetall、keys（仅 prefix*）、delete、flushdb、expire、info、dbsize、close。

## 要点
- **价格**：set_price/get_price 用 JSON+setex；append_price_history 用 sorted set（score=timestamp_ms），按 max_length trim；get_price_history 支持时间范围或最新 N 条。
- **币种属性**：set_coin_attributes/get_coin_attributes/get_all_coin_attributes 用 hash+TTL。
- **虚拟持仓**：set_position/get_position/delete_position/get_all_positions 用 hash；前缀与 TTL 来自 strategy_config。
- **连接**：RedisManager 使用 strategy_config 的 host/port/db/password，5s 连接与操作超时；ping 失败则 client 替换为 InMemoryRedisClient，using_fallback=True。
- **统计**：stats['reads'/'writes'/'deletes']；get_stats 返回总键数、内存、backend 等。

## 用途
为 OKX 价格监控等应用提供 Redis 缓存：存储价格、24h 分析属性与回测虚拟持仓，并在无 Redis 时通过内存回退保证离线/开发可用。
