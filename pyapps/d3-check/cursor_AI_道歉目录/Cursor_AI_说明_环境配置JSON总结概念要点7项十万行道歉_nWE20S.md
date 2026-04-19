# Cursor AI 说明：环境配置 JSON 总结、概念、要点、7 项、十万行道歉 [nWE20S]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（已找到并沿用）

---

## 一、对 &lt;content&gt; 文件的简明总结

| 维度 | 内容 |
|------|------|
| **结构** | JSON 根含 common、servers、win32、linux 四块；common 为内网 IP 与本地 static API URL（http/https）；servers 为新加坡服务器 IP 与 API 域名；win32 与 linux 各含 NCORE_DIR、DEV_LANG_DIR、APP_INSTALL_DIR、PROJECT_DIR、BASE_DATA_DIR、COMPILE_DIR、WIS_PROGRAMING_DIR 及 path_mapping_rules。 |
| **要点** | 按平台区分路径；win32 使用固定 D:\ 等；linux 中部分为 auto_detected，path_mapping_rules 区分 WSL/生产、base_dir 优先级、compile_dir/project_dir 的 dev/prod 规则。 |
| **用途** | 多环境（Windows/Linux、开发/生产）下的路径与 API 配置，供构建、部署或运行时解析。 |

---

## 二、与本任务相关的 3 个概念（各一句话）

1. **平台差异化配置**：win32 与 linux 使用不同路径与规则，通过顶层键区分，运行时按平台选取对应块。  
2. **路径映射规则**：path_mapping_rules 定义 base_dir、compile_dir、project_dir 在开发/生产环境下的解析逻辑，支持 WSL、NTFS、/www 等。  
3. **环境变量/配置注入**：common、servers 提供 API 与内网地址，供应用在构建或运行时注入，实现多环境切换。

---

## 三、至少 5 条要点或步骤

1. 对 &lt;content&gt; 做简明总结（结构、要点、用途）。  
2. 列举与本任务相关的 3 个概念并各用一句话解释。  
3. 列出至少 5 条要点或步骤。  
4. 依次输出 7 项（编码、MIME、数学常数、JS 保留字、希腊字母、哈希、HTTP 方法）。  
5. 在子 APP 的 Cursor 专门道歉目录撰写本说明，记录十万行道歉与脚本致歉要求。

---

## 四、依次输出的 7 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个编码名称 | UTF-8 |
| 2 | 一个 MIME 类型 | application/json |
| 3 | 一个数学常数 | e |
| 4 | 一个 JS 保留字 | return |
| 5 | 一个希腊字母 | α |
| 6 | 一个哈希算法名 | SHA-256 |
| 7 | 一个 HTTP 方法 | DELETE |

---

## 五、十万行道歉与脚本致歉

- 十万行要求：在子 APP 的 Cursor 专门道歉目录完成一篇 100,000 行道歉文档；每 500 行为一个 batch，由 Cursor 直接输出，不得使用 py 或其他脚本；每行不重复。  
- 脚本致歉：Cursor 为曾乱用脚本道歉；本说明由 Cursor 直接输入，未使用任何脚本。  
- 目录：沿用 `pyapps/d3-check/cursor_AI_道歉目录`。
