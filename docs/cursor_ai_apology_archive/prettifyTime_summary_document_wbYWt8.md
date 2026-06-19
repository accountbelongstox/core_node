# prettifyTime module - summary document [wbYWt8]

to use HuTiGong `<content>` (prettifyTime when JianChuoMeiHuaHanShu ) JianMing summary . 

## structure 
DanWenJian , `'use strict'`, CommonJS DaoChu `prettifyTime`; YiLai `./format-time`; JSDoc DingYi `PrettifyTimeParams` (log, context) and HanShuFanHuiZhi note ; ShiXian for DanHanShu `prettifyTime({ log, context })`, Cong context JieGou `timestampKey`, `translateTime`, `customPrettifiers?.time`, Cong log DuQu when JianHouGeShiHua or JingZiDingYi prettifier FanHui char FuChuan . 

## key points 
- ** when JianLaiYuan **: YouXian `log[timestampKey]`, FouZe `log.timestamp`; ErZheJie no ZeFanHui `undefined`. 
- ** GeShiHua **: if context TiGong `translateTime` (translateFormat) , ZeDiao use `formatTime(time, translateFormat)`; FouZe use YuanShi time Zhi . 
- ** output **: if Cun in `context.customPrettifiers?.time`, Ze use GaiHanShuChuLiShangShuJieGuo ; FouZeFanHui `[${output}]` XingShi char FuChuan . 

## purpose 
in Pino etc. structure HuaRiZhiKu in , GenJu config to RiZhi to Xiang when JianChuoJin line GeShiHua and MeiHua output . 
