# Reflect.getPrototypeOf module - summary document [EgFRKZ]

to use HuTiGong `<content>` (Reflect.getPrototypeOf polyfill/shim) JianMing summary . 

## structure 
ZhuShi : 26.1.8 Reflect.getPrototypeOf(target). require: ./_export, ./_object-gpo (getProto) , ./_an-object. $export($export.S, 'Reflect', { getPrototypeOf: function(target) { return getProto(anObject(target)); } }). 

## key points 
- in Reflect ShangGuaZai getPrototypeOf; ShiXian for Xian to target Diao use anObject ( LeiXingJiaoYan ) , ZaiChuan getProto HuoQuYuanXing . 
- to Ying ES spec 26.1.8; $export.S BiaoShiJingTai method DaoChu . 
- use at not ZhiChiYuanSheng Reflect.getPrototypeOf HuanJing ( such as JiuBanLiuLanQi or Node) BuDing . 

## purpose 
as Reflect.getPrototypeOf polyfill/shim, BaoZheng in MuBiaoHuanJing in KeAnQuanHuoQu to XiangYuanXing . 
