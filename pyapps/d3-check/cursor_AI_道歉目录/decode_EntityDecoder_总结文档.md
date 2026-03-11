# decode.js (EntityDecoder) 总结文档

本文档对用户提供的 `<content>`（HTML/XML 实体解码模块）做简明总结。

## 结构概览
- **依赖**：`generated/decode-data-html.js`、`decode-data-xml.js`（解码用 trie）；`decode-codepoint.js`（replaceCodePoint、fromCodePoint）。
- **常量与枚举**：CharCodes（# ; = 0-9 a-f x z A-F Z）、TO_LOWER_BIT、BinTrieFlags（VALUE_LENGTH/BRANCH_LENGTH/JUMP_TABLE）、EntityDecoderState（EntityStart、NumericStart、NumericDecimal、NumericHex、NamedEntity）、DecodingMode（Legacy、Strict、Attribute）。
- **核心类**：EntityDecoder（decodeTree、emitCodePoint、errors；state、consumed、result、treeIndex、excess、decodeMode）；方法 startEntity、write、stateNumericStart/Decimal/Hex、addToNumericResult、emitNumericEntity、stateNamedEntity、emitNotTerminatedNamedEntity、emitNamedEntityData、end。
- **辅助**：getDecoder(decodeTree) 返回 decodeWithTrie；determineBranch(decodeTree, current, nodeIndex, char) 用于 trie 分支查找。
- **对外 API**：decodeHTML、decodeHTMLAttribute、decodeHTMLStrict、decodeXML；并导出 htmlDecodeTree、xmlDecodeTree 及 decodeCodePoint 相关。

## 要点
- 实体解析为状态机：`&` 后遇 `#` 进入数值分支（再分 x 十六进制/十进制），否则为命名实体，用 trie 逐字符匹配。
- write() 可多次调用以支持不完整输入；返回消耗字符数，不完整时返回 -1；end() 用于输入结束时的收尾与错误报告。
- Strict 要求实体以分号结尾；Attribute 模式下属性内对结尾字符有限制（isEntityInAttributeInvalidEnd）；Legacy 允许无分号。
- 命名实体通过 BinTrieFlags 从 trie 节点取 valueLength、branchCount、jumpOffset，determineBranch 支持单分支、跳转表、字典二分三种查找。

## 用途
在 HTML/XML 解析器中解码字符引用（如 &amp; &#123; &#x7B; 及命名实体），供 htmlparser2 等库使用，并区分文本/属性与严格模式。
