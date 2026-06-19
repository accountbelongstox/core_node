# Babel transform-unicode-regex - summary document [IxXK7c]

to use HuTiGong `<content>` (Babel ChaJian transform-unicode-regex) JianMing summary . 

## structure 
DanWenJian , `"use strict"`; ESM JianRongDaoChu `exports.__esModule` and `exports.default`; YiLai `@babel/helper-create-regexp-features-plugin`, `@babel/helper-plugin-utils`; ChaJianTongGuo `helperPluginUtils.declare(api => { ... })` ShengMing , within Bu `api.assertVersion(7)` and Diao use `createRegExpFeaturePlugin({ name: "transform-unicode-regex", feature: "unicodeFlag" })`; WenJianMoWeiHan `//# sourceMappingURL=index.js.map`. 

## key points 
- Babel 7+ ChaJian , MingCheng `transform-unicode-regex`, GongNeng for for ZhengZeBiaoDaShiQi use `unicodeFlag` ( i.e. `u` BiaoZhi ) . 
- ShiXianWeiTuo to `createRegExpFeaturePlugin`, and Qi it regex GongNengChaJianGong use TongYi helper. 
- not BaoHan this QingQiu in 12 item output or apology document LuoJi , Jin for GouJianLian in ZhengZe Unicode ZhiChi . 

## purpose 
in Babel ZhuanYiHou DaiMa in , ShiZhengZeBiaoDaShi Unicode MoShi (`/.../u`) in MuBiaoHuanJing in etc. Jia , ZhengQueYun line . 
