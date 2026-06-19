# module JiBieDanLiGaiZaoWanCheng - summary document 

to use HuTiGong `<content>` ( module JiBieDanLiGaiZao note ) JianMing summary . 

## structure 
- Markdown: GaiZao note ( Yuan instance() module JiDaoChu ) ZhengQue / CuoWu use Fa YiGaiZao 8 module and DaoRuShiLi YiGengXin use position Zhi (VideoStreamService, VideoStreamHealthService, ADBHeartbeatService/Thread) JiShuXiJie ( module JiDanLiYuanLi , YouShi , GongChangHanShu ) ChongQi and YanZheng . 

## key points 
- ** YuanWenTi **: use `Xxx.instance()` XuJiYiDiao use FangShi . ** XinFangAn **: module JiChuangJian unique ShiLi and DaoChu , `from module import xxx` ZhiJie use . 
- ** YiGaiZao **: DeviceManager, PortPool, ScrcpyServerManager ( GongChang ) , ConnectionManager ( GongChang ) , NetworkScanner, ADBExecutor, DeviceTable, USBMonitor; XuCanShu use `get_scrcpy_server_manager`, `get_connection_manager`. 
- ** YuanLi **: Python module ShouCiDaoRu when JiaZai and HuanCun , module JiBianLiangZhiChuangJianYiCi ; no EWaiSuo , conform to XiGuan , XianChengAnQuan . 
- ** YanZheng **: XiuGaiHouChongQi Matrix FuWu , ChaKanRiZhi confirm " QuanJuShiLiYiChuangJian " etc. output . 

## purpose 
JiLu and ZhiDaoCongLei method DanLi to module JiDanLi QianYi , TongYiSheBeiGuanLi , DuanKouChi , ADB etc. ZuJian use FangShi , BiMian in LeiKu in ChongFuChuangJianShiLi . 
