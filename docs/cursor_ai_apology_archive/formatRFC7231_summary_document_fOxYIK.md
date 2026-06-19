# formatRFC7231 - summary document [fOxYIK]

to use HuTiGong `<content>` (date-fns formatRFC7231 HanShuShengMing and JSDoc) JianMing summary . 

## structure 
JSDoc: @name formatRFC7231, @category Common Helpers, @summary (RFC 7231) , @description (UTC JieGuo ) , @typeParam DateType, @param date, @returns, @throws (Invalid Date) , @example. ShengMing : export declare function formatRFC7231&lt;DateType extends Date&gt;(date: DateType | number | string): string. 

## key points 
- An RFC 7231 (HTTP date, such as Last-Modified) GeShiHuaRiQi ; JieGuoShiZhong for UTC, ShiLi "Wed, 18 Sep 2019 19:00:52 GMT". 
- CanShu date Ke for Date ShiLi , number ( when JianChuo ) or string; if for Invalid Date ZePaoChu . 
- DateType FanXingZhiChi UTCDate etc. KuoZhanLeiXing . 

## purpose 
in date-fns in TiGong conform to RFC 7231 RiQi char FuChuan , Gong HTTP XiangYingTou or Qi it XuYaoBiaoZhunRiQiGeShi ChangJing use . 
