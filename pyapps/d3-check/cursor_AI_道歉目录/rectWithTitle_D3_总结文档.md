# rectWithTitle (D3) 总结文档

对用户提供的 `<content>`（rectWithTitle 函数声明）的简明总结。

## 结构
- TypeScript 模块：import type Node、D3Selection；export declare function rectWithTitle。

## 要点
- **签名**：rectWithTitle&lt;T extends SVGGraphicsElement&gt;(parent: D3Selection&lt;T&gt;, node: Node) → Promise&lt;Selection&lt;SVGGElement, …&gt;&gt;。
- **含义**：在 D3 选中的父元素（泛型 T 为 SVG 图形元素）下，根据 Node 数据创建带标题的矩形，返回包装在 Promise 中的 SVGGElement 选区。

## 用途
作为 D3 绘图工具，在节点/图表场景下根据 Node 生成带标题的矩形（g 元素），供可视化使用。
