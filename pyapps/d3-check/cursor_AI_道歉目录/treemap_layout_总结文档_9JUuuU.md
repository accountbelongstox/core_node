# treemap 布局模块 — 总结文档 [9JUuuU]

对用户提供的 `<content>`（treemap 布局函数）的简明总结。

## 结构
- 导入：roundNode（./round.js）、squarify（./squarify.js）、required（../accessors.js）、constant/constantZero（../constant.js）。
- export default function() 返回 treemap，闭包变量：tile=squarify，round=false，dx=dy=1，paddingStack=[0]，paddingInner/Top/Right/Bottom/Left=constantZero。
- treemap(root)：设 root.x0=y0=0、root.x1=dx、root.y1=dy；root.eachBefore(positionNode)；paddingStack=[0]；若 round 则 root.eachBefore(roundNode)；return root。
- positionNode(node)：按 node.depth 取 p，算 x0,y0,x1,y1 并夹紧（若 x1<x0 或 y1<y0 则取中点）；若有 node.children，则设 paddingStack[depth+1]=paddingInner(node)/2，四边减去相应 padding 后调用 tile(node,x0,y0,x1,y1)。
- 链式 API：treemap.round、.size、.tile、.padding、.paddingInner、.paddingOuter、.paddingTop/Right/Bottom/Left，支持 get/set 与函数或数值。

## 要点
- 树形数据按矩形递归划分；tile 算法可替换（默认 squarify）；内外边距可按边、按深度、按节点函数配置；可选 round 坐标。

## 用途
树形图（treemap）布局，为每个节点计算 x0,y0,x1,y1，供 D3 等库绘制矩形块。
