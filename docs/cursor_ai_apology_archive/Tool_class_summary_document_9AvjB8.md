# Tool Lei ( MingLing and GongJu ) - summary document [9AvjB8]

to use HuTiGong `<content>` (AI GuiZe + Tool DanLiLei ) JianMing summary . 

## structure 
- **AI GuiZe **: WenJianDingBuZhuShi , GuiDingQuanYingWenDaiMa , not Xie test and WenDang , not XieKaiFaGuoCheng summary , BianLiang in WenJianKaiTouShengMing , PowerShell LuJing and char FuChuanGuiZe , JinZhiXiuGaiGuiZe . 
- ** module **: 'use strict'; require child_process (exec, execSync, spawn) ; class Tool; DanLi module.exports = new Tool(). 

## key points 
- ** MingLingZhi line **: executeSync(cmd) use execSync; executeBySpawn(command, message, callback) use spawn, shell:true, An stdout/stderr/close HuiDiao ; executeCommand(cmd, callback, log) use exec; executeCommands(cmds, callback, log) ShunXuZhi line Duo item . 
- ** CanShuJieXi **: getParameters(para_key) JieXi process.argv for -key:value or -key=value, FanHui to Xiang or ZhiDingJian ; isParameter(key), getParameter(para_key). 
- ** GongJu method **: commandToString JiangZhiZhuan for KeDu char FuChuan ( LuJing and YinHaoTiHuan ) ; mergeJSON ShenDuHe and ; getRandomItem SuiJiQuShuZuYuanSu ; deepParse ChangShi to to XiangZhi JSON.parse; getParamNames CongHanShuYuanMaQuCanShuMing ; arrangeAccordingToA Jiang callback Zhi at ZhengQue position Zhi ; isPromise, isAsyncFunction, isCall, isCallByParam; printFunctions DiGuiDaYin to Xiang in HanShuMing . 

## purpose 
for Node Jiao this /CLI TiGongTongYi MingLingZhi line , MingLing line CanShuJieXi , JSON He and and HanShuCanShuJianCe etc. GongJu , to DanLiXingShiDaoChuGongDuoChuYin use . 
