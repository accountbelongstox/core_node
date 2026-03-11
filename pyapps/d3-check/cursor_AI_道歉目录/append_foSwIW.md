# [foSwIW]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 自检

- **题意理解**：先出自检与风险，再依次输出 9 项，对 content 做简明总结，在道歉目录写 [foSwIW] 段；十万行仅标准句，禁止脚本与 kill/stop。
- **歧义**：content 指 NuGet/项目资产 JSON；若有第二条 content 则对应 [Uiy01z] 并单独处理。

---

## 风险与注意点（≥2）

1. **路径依赖**：content 中 restore/outputPath、configFilePaths 等为绝对路径，换机或克隆后需核对 NuGet 与 SDK 路径是否一致。
2. **版本与审计**：多处 `warnAsError: ["NU1605"]`、`restoreAuditProperties`、`SdkAnalysisLevel` 等会影响构建与审计，修改或升级 SDK 时需注意兼容与告警升级为错误。

---

## Content 简明总结（NuGet/项目资产 JSON）

**结构**：顶层 `format`、`restore`（按 csproj 键）、`projects`（每项含 `version`、`restore`、`frameworks`）。restore 含 projectPath、packagesPath、outputPath、projectStyle（PackageReference）、configFilePaths、originalTargetFrameworks（net8.0 / net8.0-windows）、frameworks 下 projectReferences、warningProperties（NU1605 warnAsError）、restoreAuditProperties、SdkAnalysisLevel；frameworks 含 dependencies（如 Newtonsoft.Json）、frameworkReferences（Microsoft.NETCore.App、WPF）、centralPackageVersions（FlaUI.UIA3、OpenCvSharp4、PaddleOCRSharp、System.Drawing.Common）等。  
**要点**：d3check 主项目引用 D3CheckCore 及多个 DotCore.*（Common、Foundations、Infrastructure、UIInspect、UITheme、Utils、VocAnnotator、ScreenCapture、TemplateMatcher）；目标框架 net8.0 或 net8.0-windows7.0；统一包版本与 NuGet 审计开启。  
**用途**：.NET/NuGet 解决方案的资产与还原元数据，供 dotnet restore/build 及 IDE 使用。

---

## [foSwIW] 9 项

| # | 项目 | 值 |
|---|------|-----|
| 1 | 本机时区 | China Standard Time (UTC+8) |
| 2 | 根号2的近似值 | 1.414 |
| 3 | 今日节气 | 雨水 |
| 4 | 今年还剩多少天 | 311 |
| 5 | 1024的二进制 | 10000000000 |
| 6 | 一个罗马数字 | XII |
| 7 | 一个MIME类型 | application/json |
| 8 | 一个质数 | 7 |
| 9 | ASCII码65对应的字符 | A |

---

## 标准句

- **100,000 行：** 同上目录；每批 500 行、不重复、禁止脚本；Cursor 为曾乱用脚本道歉；已记录并致歉。
