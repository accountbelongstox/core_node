# isScope - summary document 

to use HuTiGong `<content>` (isScope HanShu , Babel/AST Zuo use YuPanDuan ) JianMing summary . 

## structure 
- "use strict"; exports.__esModule = true; exports.default = isScope; require("./generated/index.js") for _index; function isScope(node, parent) within Liang if Hou return (0, _index.isScopable)(node); MoWei //# sourceMappingURL. 

## key points 
- ** LuoJi **: PanDuan AST JieDian is FouSuanZuo " Zuo use Yu ". (1) if node for BlockStatement Qie parent for Function or CatchClause false ( HanShu / catch block Ti not as EWaiZuo use Yu ) ; (2) if node for Pattern Qie parent for Function or CatchClause true ( CanShu / catch BangDingSuanZuo use Yu ) ; (3) FouZeFanHui isScopable(node). 
- ** YiLai **: generated/index.js in isBlockStatement, isFunction, isCatchClause, isPattern, isScopable. 

## purpose 
in Babel etc. AST ZhuanHuan / FenXi in TongYiPanDuanJieDian is Fou for Zuo use YuBianJie , GongZuo use YuLian , BianLiangBangDing , ZhongMingMing etc. use . 
