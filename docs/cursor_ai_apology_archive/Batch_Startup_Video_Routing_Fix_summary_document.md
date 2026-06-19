# Batch Startup Video Frame Routing Fix summary document 

this WenDang to use HuTiGong <Fixed: Batch Startup Video Frame Routing Issue> ZuoJianMing summary . 

## structure GaiLan 
- WenDang for Markdown, HanWenTi abstract ( LiangZe ) , JieJueFangAn ( LiangChuXiuFu ) , She and WenJian and DaiMaBianGeng , YuQiRiZhi , QianDuanXuGai item , test step , HouXu and HuiGun , summary . 

## key points 
- ** WenTiYi **: batch LiangQiDong when ShiPinZhen by Fa to RPC WebSocket (/rpc/ws) , QianDuanJiang Blob Dang JSON JieXiDaoZhi SyntaxError. Gen because : batch_start Ba RPC WebSocket DingYue for ShiPinJieShouDuan . 
- ** XiuFuYi **: RPC and ShiPin WebSocket FenLi . `batch_start_streams(serials, websocket=None)` not ZaiChuanRu WebSocket; DeviceStreamThread websocket Gai for Optional, Jin in ChuanRu when CaiJiaRu stream_clients; QianDuan in batch LiangQiDongWanChengHouDanDuLianJie `ws://.../video/{device_id}` JieShouShiPinZhen . 
- ** WenTiEr **: JAR TuiSongShiBai when Jin use stderr, Chang for Kong , DaoZhi "Jar push failed:" no XiangQing . 
- ** XiuFuEr **: CuoWuXinXiGai for `stderr.strip() or stdout.strip() or f"returncode={returncode}"`, Bian at PaiCha ADB/ QuanXian etc. WenTi . 
- ** She and WenJian **: pyapps/matrix/services/video_stream_service.py (DeviceStreamThread, batch_start_streams, JAR CuoWu ) , pyapps/matrix/api/main.py (batch_start Diao use ChuChuan None) . 

## purpose 
GongKaiFa and test KuaiSu Jie batch LiangQiDongShiPinLu by XiuFu and JAR CuoWuGaiJin , to and QianDuanXuZuo ShiPin WebSocket LianJie and test YanZheng step . 
