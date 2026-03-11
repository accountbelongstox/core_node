# 堆叠布局函数（series, order）— 总结文档 [H1uIGj]

对用户提供的 `<content>`（export default function(series, order)）的简明总结。

## 结构
- export default function(series, order)；若 !(series.length > 0) 则 return。
- 双重循环：j 从 0 到 m = series[order[0]].length；i 从 0 到 n = series.length。对 d = series[order[i]][j]，dy = d[1]-d[0]：dy>0 时 d[0]=yp, d[1]=yp+=dy；dy<0 时 d[1]=yn, d[0]=yn+=dy；否则 d[0]=0, d[1]=dy。原地修改，无 return。

## 要点
- 按 order 对多条 series 的每一列（j）做堆叠；正差向上累加（yp），负差向下累加（yn），用于堆叠图。

## 用途
堆叠布局（如 D3 stack）的基实现，将各系列每段的 [y0,y1] 转为堆叠后的纵坐标。
