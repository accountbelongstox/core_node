# Service Starters Registry - summary document [OFTCf3]

to use HuTiGong `<content>` (AI GuiZeZhuShi + Service Starters Registry module ) JianMing summary . 

## structure 
- **AI GuiZe **: WenJianDingBuZhuShi block , GuiDingQuanYingWenDaiMa , not Xie test and WenDang , not XieKaiFaGuoCheng summary , BianLiang in WenJianKaiTouShengMing , PowerShell Jiao this LuJing and char FuChuanGuiZe , JinZhiXiuGaiGuiZe . 
- ** module **: JSDoc note for 1:1 YiZhiZi pycore/pythreadpool/service_starters.py; require #@logger; SERVICE_STARTERS Kong to Xiang ; Liu start* HanShu (heartbeat, rpc_v2, speech, ui, timer, electron_ui) ; registerServiceStarter, getServiceStarter, getAllServiceNames; module.exports. 

## key points 
- **heartbeat**: TongGuo threadBus.getHeartbeatSystem() QiDong , not Ke use when FanHui null. 
- **rpc_v2**: ncore/utils/rpc.createExpressServer(port/host/basePath), MoRen 58100, 0.0.0.0, /rpc, start() HouDa log. 
- **speech / ui / timer**: Node DuanWeiShiXian , Jin logger.warn. 
- **electron_ui**: require ncore/utils/electron, launchElectronApp(config), FanHui { launching: true } or null. 
- ** ZhuCe **: registerServiceStarter(name, func) JiaoYanLeiXingHouXieRu SERVICE_STARTERS; getServiceStarter, getAllServiceNames GongChaXun . 

## purpose 
as FuWuQiDongHanShu Ji in ZhuCeBiao , GongDiao use FangAnFuWuMingHuoQu and Zhi line QiDongLuoJi , TongYiGuanLi heartbeat, RPC v2, Electron UI etc. FuWu ChuShiHua . 
