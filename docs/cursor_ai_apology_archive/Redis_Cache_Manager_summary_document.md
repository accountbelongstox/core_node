# Redis Cache Manager - summary document 

to use HuTiGong `<content>` (Redis HuanCunGuanLi module ) JianMing summary . 

## structure 
- Python module : docstring MiaoShuTeXing ( JiaGeCunChu , BiZhongShuXing , XuNiChiCang , TTL, batch Liang ) KeXuan import redis, InMemoryRedisClient ( within CunShiXian , JianRong Redis Chang use API) RedisManager ( LianJie Redis, ShiBaiZeHuiTui to InMemoryRedisClient) JiaGe / BiZhongShuXing / XuNiChiCangSanZu method , GongJu method , get_redis_manager DanLi . 
- InMemoryRedisClient: _strings, _hashes, _sorted_sets, _expire_at; setex/get, zadd/zcard/zremrangebyrank/zrangebyscore/zrevrange, hset/hgetall, keys ( Jin prefix*) , delete, flushdb, expire, info, dbsize, close. 

## key points 
- ** JiaGe **: set_price/get_price use JSON+setex; append_price_history use sorted set (score=timestamp_ms) , An max_length trim; get_price_history ZhiChi when JianFanWei or ZuiXin N item . 
- ** BiZhongShuXing **: set_coin_attributes/get_coin_attributes/get_all_coin_attributes use hash+TTL. 
- ** XuNiChiCang **: set_position/get_position/delete_position/get_all_positions use hash; QianZhui and TTL LaiZi strategy_config. 
- ** LianJie **: RedisManager use strategy_config host/port/db/password, 5s LianJie and CaoZuoChao when ; ping ShiBaiZe client TiHuan for InMemoryRedisClient, using_fallback=True. 
- ** TongJi **: stats['reads'/'writes'/'deletes']; get_stats FanHuiZongJianShu , within Cun , backend etc. . 

## purpose 
for OKX JiaGeJianKong etc. Ying use TiGong Redis HuanCun : CunChuJiaGe , 24h FenXiShuXing and HuiCeXuNiChiCang , and in no Redis when TongGuo within CunHuiTuiBaoZhengLiXian / KaiFaKe use . 
