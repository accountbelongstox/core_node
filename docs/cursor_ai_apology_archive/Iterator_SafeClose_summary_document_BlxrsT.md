# Iterator Safe Close module - summary document [BlxrsT]

to use HuTiGong `<content>` ( DieDaiQi step Jin in AnQuanGuanBi JS module ) JianMing summary . 

## structure 
CommonJS DanWenJian : YiLai `./_an-object`; DaoChuDanHanShu , CanShu for `(iterator, fn, value, entries)`; HanShuTi within try/catch, catch in Diao use `iterator['return']` HouChongXin throw. 

## key points 
- ** line for **: in DieDaiQiMouYi step ShangZhi line `fn`; if `entries` for ZhenZe `fn(anObject(value)[0], value[1])`, FouZe `fn(value)`. 
- ** CuoWuChuLi **: to Ying ES 7.4.6 IteratorClose: FaShengYiChang when if Cun in `iterator.return` ZeDiao use and ChuanRu `anObject(ret.call(iterator))`, RanHouChongXinPaoChuYuanYiChang , BaoZhengDieDaiQi by GuanBi . 
- ** purpose **: in for-of, ZhanKai etc. XiaoFeiDieDaiQi when , ChuCuo also NengZhengQueZhi line `return` QingLi , BiMianZiYuanXieLou . 
