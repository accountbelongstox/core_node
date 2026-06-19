# XMLDocument WenJian note WenDang 

## WenJianDing position 
- this note to Ying project in by CoffeeScript BianYi to `XMLDocument` ShiXian ( i.e. use HuTiGong `<content>` YuanMa ) . 
- GaiWenJianShiXian within Cun in XML Shu ** WenDangGenJieDian **, JianRong DOM in Document BuFenZhiDuShuXing and XuLieHua line for . 

## structure GaiLan 
- ** JiCheng **: `XMLDocument` JiChengZi `XMLNode`, GenJieDian no FuJieDian (`parent = null`) . 
- ** BiaoShi **: `name = "#document"`, `type = NodeType.Document`. 
- ** config **: `XMLDOMConfiguration` ShiLi (domConfig) , GouZaoXuan item `options`, within HanMoRen or ChuanRu `writer` ( MoRen `XMLStringWriter`) and `XMLStringifier` (stringify) . 

## ZhuYaoZhiDuShuXing (getter) 
- **implementation**: GuDing for `XMLDOMImplementation` DanLi . 
- **doctype**: Cong `children` in Qu No. Yi `NodeType.DocType` sub JieDian , no Ze `null`. 
- **documentElement**: i.e. `rootObject`, no Ze `null`. 
- **xmlEncoding / xmlStandalone / xmlVersion**: if Shou sub JieDian for Declaration, ZeCongQiQu encoding, standalone, version; FouZe encoding/standalone for `null`/`false`, version MoRen `"1.0"`. 
- **URL**: and `documentURI` YiZhi . 
- **inputEncoding / origin / compatMode / characterSet / contentType**: DangQianShiXianJunFanHui `null`; **strictErrorChecking** FanHui `false`. 

## XuLieHua 
- **end(writer)**: JiangZhengFenWenDangXieRu `writer`. if WeiChuan `writer` Ze use `options.writer`; if ChuanRuPuTong to XiangZeShi for writer Xuan item , Reng use `options.writer` XieRu . 
- **toString(options)**: use `options.writer` JiangWenDangXuLieHua for char FuChuan , KeChuanRuGuoLvXuan item . 

## WeiShiXian DOM method 
to Xia method JunZhiJiePaoChu `"This DOM method is not implemented."` ( and Dai debugInfo) , JinBaoLiuJieKouXingTai : 
- ChuangJianLei : createElement, createDocumentFragment, createTextNode, createComment, createCDATASection, createProcessingInstruction, createAttribute, createEntityReference; 
- MingMingKongJian : createElementNS, createAttributeNS; 
- ChaXun : getElementsByTagName, getElementsByTagNameNS, getElementById, getElementsByClassName; 
- JieDianCaoZuo : importNode, adoptNode, renameNode, normalizeDocument; 
- Qi it : createEvent, createRange, createNodeIterator, createTreeWalker. 

## use ChangJing 
- as ZhengKe XML Shu Gen , PeiHe sub JieDian (Declaration, DocType, GenYuanSu etc. ) GouJianWenDang . 
- TongGuo `end()` or `toString()` output for char FuChuan or XieRuLiu , GongBaoCun or ChuanShu ; not use at WanZheng DOM ZengShanGaiCha . 
