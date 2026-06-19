# throttle HanShu summary document 

this WenDang to use HuTiGong `<content>` (throttle JieLiuHanShuShiXian ) ZuoJianMing summary . 

## structure GaiLan 
- ** YiLai **: `debounce.js`, `isObject.js`. 
- ** ChangLiang **: FUNC_ERROR_TEXT ("Expected a function") . 
- ** DaoChu **: MoRenDaoChu `throttle(func, wait, options)`. 

## key points 
- ** CanShu **: func for DaiJieLiuHanShu , wait for when JianJianGe ( HaoMiao ) , options KeXuan , Han leading ( MoRen true) , trailing ( MoRen true) . 
- ** ShiXian **: within BuZhiJieDiao use `debounce(func, wait, { leading, maxWait: wait, trailing })`, i.e. TongGuo debounce maxWait ShiXian " every wait within ZuiDuoZhi line YiCi " JieLiu ; FanHui HanShuJiCheng debounce cancel, flush method . 
- ** line for **: leading KongZhi when JianChuangKaiShi when is FouZhi line , trailing KongZhiJieShu when is FouZhi line ; if leading and trailing Jun for true, in wait within DuoCiDiao use when Jin in trailing when Zhi line YiCi . 
- ** JiaoYan **: func FeiHanShu when PaoChu TypeError. 

## purpose 
in GaoPinShiJian ( such as scroll, resize, click) in XianZhiHuiDiaoZhi line PinLv , JianShaoXingNengKaiXiao ; Shi use at position ZhiGengXin , XuQi token etc. ChangJing . 
