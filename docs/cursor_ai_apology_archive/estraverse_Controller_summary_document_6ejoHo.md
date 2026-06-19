# AST BianLi / TiHuanKu (estraverse FengGe ) - summary document [6ejoHo]

to use HuTiGong `<content>` (IIFE XingShi AST BianLi and TiHuanShiXian ) JianMing summary . 

## structure 
- TouBu : BSD BanQuan (Yusuke Suzuki, Ariya Hidayat) ; jslint/jshint ZhuShi ; IIFE (function clone(exports){ ... }(exports)). 
- GongJu : deepCopy; upperBound(array, func) ( ErFenShangJie , Ji at LLVM libc++) ; Syntax ( JieDianLeiXingMing ) ; VisitorKeys ( LeiXing sub ShuXingShuZu ) ; BREAK/SKIP/REMOVE, VisitorOption; Reference(parent, key) Han replace/remove; Element(node, path, wrap, ref) . 
- Controller: path(), type(), parents(), current(), __execute, notify/skip/break/remove, __initialize, traverse(root, visitor), replace(root, visitor); within Bu use worklist/leavelist, Element, VisitorKeys/__fallback, isNode/isProperty/candidateExistsInLeaveList ShiXian enter/leave BianLi and TiHuan . 
- DingCengHanShu : traverse, replace; extendCommentRange(comment, tokens); attachComments(tree, providedComments, tokens) ( GenJu range GuaZai leadingComments/trailingComments) . 
- DaoChu : Syntax, traverse, replace, attachComments, VisitorKeys, VisitorOption, Controller, cloneEnvironment. 

## key points 
- ESTree FengGe AST enter/leave BianLi and Yuan TiHuan ; ZhiChi SKIP, BREAK, REMOVE; VisitorKeys QuDong sub JieDianFangWen ; attachComments YiLai range XinXi . 

## purpose 
as estraverse LeiKu HeXin , Gong JS JieXi / ZhuanHuanGongJu to AST Jin line BianLi , TiHuan and ZhuShiGuaZai . 
