# DuiDieBuJuHanShu (series, order) - summary document [H1uIGj]

to use HuTiGong `<content>` (export default function(series, order)) JianMing summary . 

## structure 
- export default function(series, order); if !(series.length > 0) Ze return. 
- dual ZhongXunHuan : j Cong 0 to m = series[order[0]].length; i Cong 0 to n = series.length. to d = series[order[i]][j], dy = d[1]-d[0]: dy>0 when d[0]=yp, d[1]=yp+=dy; dy<0 when d[1]=yn, d[0]=yn+=dy; FouZe d[0]=0, d[1]=dy. Yuan XiuGai , no return. 

## key points 
- An order to Duo item series every YiLie (j) ZuoDuiDie ; ZhengChaXiangShangLeiJia (yp) , FuChaXiangXiaLeiJia (yn) , use at DuiDieTu . 

## purpose 
DuiDieBuJu ( such as D3 stack) JiShiXian , JiangGeXiLie every segment [y0,y1] Zhuan for DuiDieHou ZongZuoBiao . 
