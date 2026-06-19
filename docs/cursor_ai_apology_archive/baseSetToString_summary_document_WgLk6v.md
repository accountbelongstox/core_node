# baseSetToString module - summary document [WgLk6v]

to use HuTiGong `<content>` (baseSetToString ShiXian ) JianMing summary . 

## structure 
- DaoRu : constant (./constant.js) , defineProperty (./_defineProperty.js) , identity (./identity.js) . 
- baseSetToString: if !defineProperty ZeFuZhi for identity; FouZe for function(func, string), within Ceng use defineProperty(func, 'toString', { configurable: true, enumerable: false, value: constant(string), writable: true }), FanHui func. 
- export default baseSetToString. 
- JSDoc: base implementation of setToString without hot loop shorting; @private; CanShu func, string; FanHui func. 

## key points 
- HuanJing no defineProperty when not ZuoXiuGai , ZhiJieFanHuiYuanHanShu (identity) . 
- have defineProperty when to HanShuGuaZaiZiDingYi toString, Qie enumerable: false, Bian at TiaoShiYou not Can and MeiJu . 

## purpose 
for HanShuSheZhiKe config , not KeMeiJu toString FanHuiZhi , Chang use at Lodash etc. Ku within BuJiShiXian ( such as not HanReXunHuanDuanLuLuoJi setToString) . 
