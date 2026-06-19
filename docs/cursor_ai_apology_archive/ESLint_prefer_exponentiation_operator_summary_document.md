# ESLint prefer-exponentiation-operator GuiZe - summary document 

to use HuTiGong `<content>` (ESLint GuiZe : Jin use Math.pow, JianYi **) JianMing summary . 

## structure 
- @fileoverview + "use strict"; Requirements: astUtils, CALL/ReferenceTracker; Helpers: PRECEDENCE_OF_EXPONENTIATION_EXPR, doesBaseNeedParens, doesExponentNeedParens, doesExponentiationExpressionNeedParens, parenthesizeIfShould; Rule Definition: meta (type, docs, schema, fixable, messages) , create(context) within report ( Han fix) , Program in ReferenceTracker ZhuiZong Math.pow and report. 

## key points 
- ** Mu **: Jin use Math.pow, JianYi use ** YunSuanFu ; fixable, KeZiDongTiHuan . 
- ** KuoHaoLuoJi **: base for AwaitExpression/UnaryExpression or YouXianJi ** when XuKuoHao ; exponent YouXianJi < ** when XuKuoHao ; ZhengTi in Fu for ClassDeclaration or MouXie Expression QieYouXianJi item JianManZu when XuKuoHao ; BiMian and ChainExpression, CallExpression CanShu , MemberExpression computed etc. ChongTu . 
- **fix**: Qu base/exponent Wen this , AnXuJiaKuoHao , PinCheng base**exponent, BiYao when Jia prefix/suffix KongGe to BaoChi token KeXiangLin ; replaceText TiHuanJieDian . 

## purpose 
in ESLint in TongYi use ** TiDai Math.pow, and ZiDongXiuFuQieBaoZhengYunSuanFuYouXianJi and KuoHaoZhengQue . 
