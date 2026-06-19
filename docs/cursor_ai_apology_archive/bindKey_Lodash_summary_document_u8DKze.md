# bindKey (Lodash) module - summary document [u8DKze]

to use HuTiGong `<content>` (_.bindKey ShiXian ) JianMing summary . 

## structure 
- DaoRu : baseRest, createWrap, getHolder, replaceHolders. position YanMaChangLiang WRAP_BIND_FLAG=1, WRAP_BIND_KEY_FLAG=2, WRAP_PARTIAL_FLAG=32. 
- bindKey = baseRest(function(object, key, partials) { bitmask = BIND | BIND_KEY; if have partials Ze replaceHolders, bitmask |= PARTIAL; return createWrap(key, bitmask, object, partials, holders); }); bindKey.placeholder = {}; export default bindKey. 
- JSDoc: ChuangJianDiao use object[key] and YuTian partials HanShu ; and _.bind not Tong in at An key YanChiJieXi ( method Ke by ZhongDingYi ) ; Zhan position Fu note and ShiLi . 

## key points 
- Diao use when ZaiJieXi object[key], ZhiChi method HouXu by TiHuan ; ZhiChiBuFenYing use and Zhan position Fu . 

## purpose 
Lodash _.bindKey: An to Xiang , method Ming , BuFenCanShuShengChengBangDingHanShu , Shi use at method KeNengZhongDingYi or ShangWeiCun in ChangJing . 
