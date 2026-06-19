# no-empty-static-block ESLint GuiZe summary document 

this WenDang to use HuTiGong `<content>` (ESLint GuiZe no-empty-static-block) ZuoJianMing summary . 

## structure GaiLan 
- ** LeiXing **: ESLint GuiZe module , `"use strict"`, DaoChu `module.exports = { meta, create }`. 
- **meta**: type for `"suggestion"`, hasSuggestions for true; docs Han description, recommended, url; schema for KongShuZu ; messages Han `unexpected`, `suggestComment`. 
- **create(context)**: FanHui AST FangWenQi , JinChuLi `StaticBlock` JieDian . 

## key points 
- ** ChuFa item Jian **: DangJingTai block `node.body.length === 0` ( i.e. block within no YuJu ) QieBiHeHuaKuoHaoQian no have ZhuShi when , BaoGaoWenTi . 
- ** BaoCuo position Zhi **: Cong openingBrace to closingBrace loc; messageId for `"unexpected"`. 
- ** JianYiXiuFu **: TiGongYi item suggestion, messageId for `suggestComment`; fix Jiang openingBrace.range[1] to closingBrace.range[0] of Jian within RongTiHuan for `" /* empty */ "`, i.e. in Kong block within ChaRuZhan position ZhuShi . 
- ** ShiXianXiJie **: TongGuo `sourceCode.getFirstToken(node, { skip: 1 })` and `getLastToken(node)` HuoQuHuaKuoHao ; use `getCommentsBefore(closingBrace).length === 0` PanDuan no ZhuShi . 

## purpose 
in JavaScript/TypeScript in JinZhiKong `static { }` block , BiMian no YiYiDaiMa ; if XuBaoLiuKong block ( such as Zhan position ) , KeTongGuoZiDongJianYiTianJia `/* empty */` ZhuShi and TongGuoJianCha . 
