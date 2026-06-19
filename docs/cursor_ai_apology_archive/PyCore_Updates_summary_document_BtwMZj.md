# PyCore Updates - summary document [BtwMZj]

to use HuTiGong `<content>` (PyCore GengXinJiLu , Duo item 2025-11-19 item Mu ) JianMing summary . 

## structure 
- WenDangBiaoTi for PyCore Updates, Xia have Duo item AnRiQiZuZhi GengXin item Mu . 
- every item Han : WanChengZhuangTai , BianGeng note , DaiMa / directory Pian segment , test MingLing or WenDangLuJing . 
- ZhuTiFuGai : pythreadpool TongYi and launcher ZhiZe , Connection Leak, DuanKou config , XiTongJiCheng , Web UI JianKong , ZhiNengDanLi , MCP module Hua and 19 GongJu , GongJuMingChangDu and RPC Tong step , Flutter SheJiWenDang , MCP RPC Hua , XianChengGuanLi , Proxy-Backend, Singleton GuanBiXiuFu etc. . 

## key points 
- **pythreadpool**: ShanChu thread_pool.py, TongYi use pythreadpool (registry, starters, pool) ; launcher JinFuZeDanLiJianCe and XianChengDiaoDu ; TongGuo get_service HuoQu RPC/heartbeat etc. ShiLi . 
- ** LianJie and DuanKou **: Uvicorn ZengJia timeout_keep_alive, limit_max_requests, limit_concurrency etc. Fang CLOSE_WAIT XieLou ; DanLiDuanKou 5800058099, RPC GuDing 58100. 
- **MCP**: HouDuanDanRuKou mcp_backend_main.py + backend/ (config, handlers, routes) ; 19 GongJuFen File/Database/Codebase; ZhiNengDanLiYi MCPGlobalState IDLE/BUSY JueDing is FouJieShou SHUTDOWN; GongJuMingSuoDuan to ManZuXieYiZhangDu ; RPC v2 ZhiChi sync Lu by and sync_response. 
- ** DanLiGuanBi **: SingletonDetector on_message in Shou to SHUTDOWN when Diao use THREAD_BUS.request_shutdown(), ZhuChengXuJianTingHouTuiChu . 

## purpose 
as PyCore in XianChengChi , launcher, MCP HouDuan , DanLi , RPC and LianJieGuanLi etc. FangMian BianGengJiLu , Bian at WeiHu and WenTiPaiCha . 
