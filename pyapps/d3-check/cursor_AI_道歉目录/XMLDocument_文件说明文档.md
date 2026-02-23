# XMLDocument 文件说明文档

## 文件定位
- 本说明对应项目中由 CoffeeScript 编译得到的 `XMLDocument` 实现（即用户提供的 `<content>` 源码）。
- 该文件实现内存中 XML 树的**文档根节点**，兼容 DOM 中 Document 的部分只读属性和序列化行为。

## 结构概览
- **继承**：`XMLDocument` 继承自 `XMLNode`，根节点无父节点（`parent = null`）。
- **标识**：`name = "#document"`，`type = NodeType.Document`。
- **配置**：`XMLDOMConfiguration` 实例（domConfig）、构造选项 `options`，内含默认或传入的 `writer`（默认 `XMLStringWriter`）及 `XMLStringifier`（stringify）。

## 主要只读属性（getter）
- **implementation**：固定为 `XMLDOMImplementation` 单例。
- **doctype**：从 `children` 中取第一个 `NodeType.DocType` 子节点，无则 `null`。
- **documentElement**：即 `rootObject`，无则 `null`。
- **xmlEncoding / xmlStandalone / xmlVersion**：若首子节点为 Declaration，则从其取 encoding、standalone、version；否则 encoding/standalone 为 `null`/`false`，version 默认 `"1.0"`。
- **URL**：与 `documentURI` 一致。
- **inputEncoding / origin / compatMode / characterSet / contentType**：当前实现均返回 `null`；**strictErrorChecking** 返回 `false`。

## 序列化
- **end(writer)**：将整份文档写入 `writer`。若未传 `writer` 则用 `options.writer`；若传入普通对象则视为 writer 选项，仍用 `options.writer` 写入。
- **toString(options)**：用 `options.writer` 将文档序列化为字符串，可传入过滤选项。

## 未实现的 DOM 方法
以下方法均直接抛出 `"This DOM method is not implemented."`（并带 debugInfo），仅保留接口形态：
- 创建类：createElement、createDocumentFragment、createTextNode、createComment、createCDATASection、createProcessingInstruction、createAttribute、createEntityReference；
- 命名空间：createElementNS、createAttributeNS；
- 查询：getElementsByTagName、getElementsByTagNameNS、getElementById、getElementsByClassName；
- 节点操作：importNode、adoptNode、renameNode、normalizeDocument；
- 其它：createEvent、createRange、createNodeIterator、createTreeWalker。

## 使用场景
- 作为整棵 XML 树的根，配合子节点（Declaration、DocType、根元素等）构建文档。
- 通过 `end()` 或 `toString()` 输出为字符串或写入流，供保存或传输；不用于完整 DOM 增删改查。
