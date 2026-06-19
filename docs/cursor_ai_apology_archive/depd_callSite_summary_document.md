# depd (callSite) summary document 

this WenDang to use HuTiGong `<content>` (depd module in CallSite GeShiHuaLuoJi ) ZuoJianMing summary . 

## structure GaiLan 
- ** module **: Node.js module `depd`, MIT XuKe , DanWenJian , YanGeMoShi ; to WaiJinDaoChu `callSiteToString`. 
- ** HanShu **: `callSiteFileLocation(callSite)`, `callSiteToString(callSite)`, `getConstructorName(obj)` ( within BuFuZhu ) . 

## key points 
- **callSiteFileLocation**: GenJu CallSite LeiXingShengCheng " WenJian position Zhi " char FuChuan . if `isNative()` FanHui `"native"`; if `isEval()` use `getScriptNameOrSourceURL()` or `getEvalOrigin()`; FouZe use `getFileName()`. if have WenJianMing , ZeZhuiJia `: line Hao `, if have LieHaoZaiZhuiJia `: LieHao `; no ZeFanHui `"unknown source"`. 
- **callSiteToString**: ShengChengDan line KeDuDuiZhan . XianQu fileLocation; ZaiGenJu is Fou for method Diao use , GouZaoHanShu , DingCeng or Jin have HanShuMing , PinChuLeiXingMing , method Ming , `[as methodName]`, `new FunctionName` etc. ; ZuiHou in XuYao when ZhuiJia ` (fileLocation)`. if Ji no method Ming also no HanShuMing , ZeZhi output fileLocation Qie not JiaHouZhui . 
- **getConstructorName**: Cong `obj.receiver.constructor.name` QuGouZaoHanShuMing , Gong method Diao use when XianShiLeiXingMing . 

## purpose 
Jiang V8 CallSite to XiangGeShiHua for RenLeiKeDu DuiZhan line ( WenJianMing , line Hao , LieHao , HanShu / method Ming , GouZaoHanShuMing ) , Chang use at depd Qi use JingGao or Qi it DuiZhan output ChangJing . 
