# d3-fetch — 总结文档

对用户提供的 `<content>`（d3-fetch 压缩包源码）的简明总结。

## 结构
- UMD 压缩包（v3.0.1），依赖 d3-dsv；入口为 IIFE，根据 exports/define/global 挂载到 `t.d3`。
- 内部：对 fetch 响应的检查函数（e/r/o 对应 blob/arrayBuffer/text）；u 为 fetch+text；f 为“fetch 后解析”的工厂（csv/tsv 用）；a 为 json（非 204/205 时）；c 为 DOMParser 工厂（xml/html/svg）；最后将 blob、buffer、text、csv、tsv、dsv、json、html、xml、svg、image 挂到导出对象。

## 要点
- 所有基于 fetch 的方法在 `!t.ok` 时抛出 `Error(status + statusText)`。
- csv/tsv 通过 d3-dsv 的 parse 解析文本；dsv 支持自定义分隔符与 parse 选项。
- json 在 204/205 时不读 body；html、xml、svg 用 DOMParser 的 parseFromString；image 用 new Image() 加载并返回 Promise。
- 支持可选 init 参数（第二个参数）传入 fetch 选项。

## 用途
在浏览器中统一封装 fetch，并直接得到解析后的数据（CSV/TSV/JSON/HTML/XML/SVG）或 Blob/ArrayBuffer/Image，供 D3 等数据可视化或前端脚本使用。
