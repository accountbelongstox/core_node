# Pattern（glob 片段视图）— 总结文档 [NgOsTl]

对用户提供的 `<content>`（glob 库中 Pattern 类）的简明总结。

## 结构
- 导入 GLOBSTAR（minimatch）、isPatternList/isGlobList、customInspect。
- export class Pattern：私有字段 #patternList、#globList、#index、#platform、#rest、#globString、#isDrive、#isUNC、#isAbsolute、#followGlobstar；constructor(patternList, globList, index, platform) 内校验并在 index===0 时规范化 UNC/drive/absolute 的根；方法 [customInspect]、pattern、isString、isGlobstar、isRegExp、globString、hasMore、rest、isUNC、isDrive、isAbsolute、root、checkFollowGlobstar、markFollowGlobstar；末尾 sourceMappingURL。

## 要点
- **角色**：基于两数组与 index 的不可变视图，表示“当前片段”及后续 rest。
- **根规范化**：index 为 0 时，UNC（''/''/host/share）合并为单段加 /；drive（C:）或 absolute（/）将首段与尾部空段合并为 p1+'/'，并同步更新 globList 与 length。
- **判断**：isUNC（win32、pl[0]===''、pl[1]===''、pl[2]/pl[3] 非空字符串）；isDrive（win32、pl[0] 匹配 /^[a-z]:$/i）；isAbsolute（pl[0]==='' 且 length>1，或 isDrive，或 isUNC）。
- **rest**：hasMore 时 new Pattern(..., index+1)，并继承 #isAbsolute/#isUNC/#isDrive；否则 null。
- **globstar**：checkFollowGlobstar、markFollowGlobstar 控制 ** 是否跟随符号链接。

## 用途
在 glob/minimatch 体系中表示并遍历已解析的 pattern 与 glob 片段，支持 Windows UNC、盘符与 Unix 绝对路径及 globstar 符号链接跟随控制。
