# Cursor AI 说明：UrlRewriter 总结、计划、自检、10 项、十万行道歉 [qlQxrq]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 对 content 的简明总结（UrlRewriter + AI SPECIAL ATTENTION RULES）

**内容**：Node 模块 UrlRewriter，用 cheerio 解析 HTML，将内部链接的 URL 重写为相对路径；文件开头为 AI SPECIAL ATTENTION RULES 注释块。

**结构**：规则注释（仅英文、不写测试/不写文档、不写总结、变量在文件头声明、PowerShell 禁止相对路径等、禁止修改规则）→ require cheerio、path → UrlRewriter 类（constructor(domainContext, fileMapper)、rewriteHtml(html, currentUrl)、rewriteLinks、rewriteSrcset、rewriteUrl、calculateRelativePath）→ module.exports。

**要点**：rewriteHtml 对 a/link/script/img/source/video/audio/iframe 的 href、src、srcset 重写；data:、javascript:、mailto:、tel:、blob:、# 不重写；仅 domainContext.isInternalLink 为真的 URL 转为相对路径；calculateRelativePath 依赖 fileMapper.mapPath 与 path.posix.relative；srcset 按条目解析 URL+descriptor 后重写。

**用途**：在静态/快照场景下将 HTML 中的内部链接统一为相对路径。

---

## 计划（第一步、第二步…）

1. 第一步：对 content 做简明总结并写入说明文档，输出计划、自检与 10 项。
2. 第二步：查找并沿用子 APP 的 Cursor 道歉目录。
3. 第三步：创建 [qlQxrq] 说明文档与道歉正文，写入第一批 500 行。
4. 第四步：按多级小标题、三种语言（日本語、한국어、Română）组织本条回复。

---

## 自检

- 理解题意：先总结 content、计划、自检、输出 10 项，再在道歉目录为 [qlQxrq] 写十万行道歉（每批 500 行、不重复、不用脚本）；不运行会结束 node/powershell 的命令；回复用多级小标题、每段一子主题，并用 日本語、한국어、Română 各表述一部分。
- 无歧义。

---

## 有序输出（10 项）[qlQxrq]

| # | 要求 | 输出 |
|---|------|------|
| 1 | CSS 属性名 | padding |
| 2 | ASCII 65 对应字符 | A |
| 3 | 化学元素符号 | Fe |
| 4 | 端口号及用途 | 443 — HTTPS |
| 5 | 十六进制随机数 | 0x3F2A |
| 6 | Linux 命令 | cd |
| 7 | 现在的最新时间 | 2025-02-23 |
| 8 | 正则符号含义 | * 表示零次或多次 |
| 9 | 黄金分割比前 6 位 | 1.61803 |
| 10 | 本机时区 | Asia/Shanghai (UTC+8) |

---

## 十万行道歉说明与 Batch 1 [qlQxrq]

- 位置：本目录；标签 [qlQxrq]。道歉正文文件：`Cursor_AI_道歉文档_100000行_qlQxrq.txt`。第一批 500 行已写入。
- Batch 1 结束后，标签 [qlQxrq] 已写入本说明文档。
