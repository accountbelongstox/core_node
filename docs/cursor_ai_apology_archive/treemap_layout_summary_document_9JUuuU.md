# treemap BuJu module - summary document [9JUuuU]

to use HuTiGong `<content>` (treemap BuJuHanShu ) JianMing summary . 

## structure 
- DaoRu : roundNode (./round.js) , squarify (./squarify.js) , required (../accessors.js) , constant/constantZero (../constant.js) . 
- export default function() FanHui treemap, BiBaoBianLiang : tile=squarify, round=false, dx=dy=1, paddingStack=[0], paddingInner/Top/Right/Bottom/Left=constantZero. 
- treemap(root): She root.x0=y0=0, root.x1=dx, root.y1=dy; root.eachBefore(positionNode); paddingStack=[0]; if round Ze root.eachBefore(roundNode); return root. 
- positionNode(node): An node.depth Qu p, Suan x0,y0,x1,y1 and JiaJin ( if x1<x0 or y1<y0 ZeQu in Dian ) ; if have node.children, ZeShe paddingStack[depth+1]=paddingInner(node)/2, SiBianJianQuXiangYing padding HouDiao use tile(node,x0,y0,x1,y1). 
- LianShi API: treemap.round, .size, .tile, .padding, .paddingInner, .paddingOuter, .paddingTop/Right/Bottom/Left, ZhiChi get/set and HanShu or ShuZhi . 

## key points 
- ShuXingShuJuAnJuXingDiGuiHuaFen ; tile SuanFaKeTiHuan ( MoRen squarify) ; within WaiBianJuKeAnBian , AnShenDu , AnJieDianHanShu config ; KeXuan round ZuoBiao . 

## purpose 
ShuXingTu (treemap) BuJu , for every JieDianJiSuan x0,y0,x1,y1, Gong D3 etc. KuHuiZhiJuXing block . 
