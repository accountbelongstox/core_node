# baseUpdate module - summary document [eGbUxR]

to use HuTiGong `<content>` (baseUpdate ShiXian ) JianMing summary . 

## structure 
- DaoRu : baseGet (./_baseGet.js) , baseSet (./_baseSet.js) . 
- function baseUpdate(object, path, updater, customizer) { return baseSet(object, path, updater(baseGet(object, path)), customizer); }
- JSDoc: base implementation of _.update; @private; CanShu object, path (Array|string) , updater (Function) , customizer (Function, KeXuan ) ; returns object. 
- export default baseUpdate. 

## key points 
- use baseGet Qu path DangQianZhi , updater JiSuanXinZhi , baseSet XieHui ; customizer use at LuJingChuangJian when DingZhi . 

## purpose 
Lodash within Bu _.update JiShiXian , AnLuJing to to XiangShuXingZuo " Du GengXinHanShu Xie " GengXin . 
