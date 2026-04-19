# module.exports (Proximity API) — 总结文档

对用户提供的 `<content>`（minified JS 的 module.exports，C 为 "Proximity API"）的简明总结。

## 结构
- 单行 CommonJS：module.exports = { A: {...}, B: 4, C: "Proximity API", D: true }。A 为多层嵌套（A.A～A.S），子对象键多为 "1" 或 "2"，值为空格分隔的标识符串。

## 要点
- **A**：按字母分组的符号/映射表；各子对象 "1"/"2" 对应不同版本或环境。
- **B**：4。**C**："Proximity API"。**D**：true。整体为压缩后的配置或运行时查找表。

## 用途
在打包或运行环境中通过 A 查找符号或配置；B、C、D 提供版本与 API 名称等元信息；与 Proximity API 相关模块配套使用。
