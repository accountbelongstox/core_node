# Claude Code 特性文档 (基于官方文档)

> 来源: https://code.claude.com/docs/en/

---

## 1. 概述

Claude Code 是 Anthropic 的 AI 编程代理工具，可以读取代码库、编辑文件、执行命令、
集成开发工具。支持终端 CLI、VS Code/Cursor、JetBrains IDE、桌面应用、Web 浏览器。

---

## 2. 认证与凭据存储

### 2.1 登录方式

| 方式 | 说明 |
|------|------|
| Claude Pro/Max 订阅 | 浏览器 OAuth 登录 |
| Claude Teams/Enterprise | 团队账户 OAuth |
| Claude Console | API 计费 |
| Amazon Bedrock | 环境变量, 无需浏览器登录 |
| Google Vertex AI | 环境变量 |
| Microsoft Foundry | 环境变量 |

### 2.2 凭据存储位置

**这是本项目最关键的信息之一:**

| 平台 | 存储位置 | 保护方式 |
|------|---------|---------|
| **macOS** | 系统 Keychain (加密) | macOS Keychain 加密 |
| **Linux** | `~/.claude/.credentials.json` | 文件权限 `0600` |
| **Windows** | `~/.claude/.credentials.json` | 继承用户目录 ACL |

- 可通过 `$CLAUDE_CONFIG_DIR` 环境变量自定义配置目录
- 凭据文件 **绑定到当前系统用户** (每个 OS 用户独立)

### 2.3 认证优先级 (从高到低)

1. **云服务商凭据** — `CLAUDE_CODE_USE_BEDROCK` / `CLAUDE_CODE_USE_VERTEX` / `CLAUDE_CODE_USE_FOUNDRY`
2. **`ANTHROPIC_AUTH_TOKEN`** — 作为 `Authorization: Bearer` 发送 (用于 LLM 网关/代理)
3. **`ANTHROPIC_API_KEY`** — 作为 `X-Api-Key` 发送 (Console API key)
4. **`apiKeyHelper`** — 运行脚本获取动态凭据 (如从 vault 获取短期 token)
5. **订阅 OAuth** — `/login` 产生的凭据 (默认, Pro/Max/Teams/Enterprise)

### 2.4 自定义凭据脚本

- `apiKeyHelper` 设置可配置一个 shell 脚本, 运行后返回 API key
- 默认每 5 分钟刷新, 或 HTTP 401 时立即刷新
- 可通过 `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` 自定义刷新间隔
- 脚本超过 10 秒会显示警告

### 2.5 CLI 认证命令

```bash
claude auth login             # 登录 (支持 --email, --sso, --console)
claude auth logout            # 登出
claude auth status            # 查看状态 (--text 人类可读; 退出码 0=已登录, 1=未登录)
```

---

## 3. 配置系统

### 3.1 配置文件位置

| 数据 | 路径 |
|------|------|
| 用户设置 | `~/.claude/settings.json` |
| 全局配置 (偏好/OAuth/缓存) | `~/.claude.json` |
| 凭据 (Linux/Windows) | `~/.claude/.credentials.json` |
| 凭据 (macOS) | macOS Keychain |
| 自动记忆 | `~/.claude/` (可通过 `autoMemoryDirectory` 自定义) |
| 计划 | `~/.claude/plans/` |
| 用户子代理 | `~/.claude/agents/` |
| 项目设置 | `.claude/settings.json` |
| 项目本地设置 | `.claude/settings.local.json` (gitignore) |
| 项目 MCP | `.mcp.json` |
| 项目指令 | `CLAUDE.md` 或 `.claude/CLAUDE.md` |

### 3.2 配置作用域 (优先级从高到低)

| 作用域 | 位置 | 影响范围 |
|--------|------|---------|
| Managed | 系统级 `managed-settings.json` | 所有用户 (IT 部署) |
| User | `~/.claude/settings.json` | 当前用户所有项目 |
| Project | `.claude/settings.json` | 所有协作者 |
| Local | `.claude/settings.local.json` | 当前用户当前项目 |

### 3.3 Managed 设置位置

| 平台 | 路径 |
|------|------|
| macOS | `/Library/Application Support/ClaudeCode/` |
| Linux/WSL | `/etc/claude-code/` |
| Windows | `C:\Program Files\ClaudeCode\` |
| macOS MDM | `com.anthropic.claudecode` |
| Windows 注册表 | `HKLM\SOFTWARE\Policies\ClaudeCode` |

---

## 4. CLI 完整参数

### 4.1 会话命令

| 命令 | 说明 |
|------|------|
| `claude` | 交互式会话 |
| `claude "query"` | 带初始提示的交互式会话 |
| `claude -p "query"` | 非交互模式 (打印后退出) |
| `cat file \| claude -p "query"` | 管道输入 |
| `claude -c` | 继续当前目录最近的对话 |
| `claude -c -p "query"` | 非交互继续 |
| `claude -r "session" "query"` | 恢复指定会话 |
| `claude update` | 更新到最新版 |
| `claude auth login/logout/status` | 认证管理 |
| `claude agents` | 列出子代理 |
| `claude mcp` | 配置 MCP 服务器 |
| `claude remote-control` | 启动远程控制 |

### 4.2 关键 CLI 标志

| 标志 | 说明 |
|------|------|
| `-p, --print` | 非交互模式 |
| `-c, --continue` | 继续最近的对话 |
| `-r, --resume` | 恢复指定会话 (ID 或名称) |
| `-n, --name` | 设置会话名称 |
| `-w, --worktree` | 在隔离的 git worktree 中启动 |
| `-v, --version` | 输出版本号 |
| `--model` | 指定模型 (`sonnet`, `opus`, 或完整名称) |
| `--effort` | 思考深度: `low`, `medium`, `high`, `max` |
| `--output-format` | 输出格式: `text`, `json`, `stream-json` |
| `--verbose` | 详细日志 |
| `--include-partial-messages` | 启用 token 级别流式事件 (需配合 `stream-json` + `--verbose`) |
| `--session-id` | 指定会话 UUID |
| `--fork-session` | 恢复时创建新会话 ID |
| `--max-turns` | 限制代理回合数 (仅 print 模式) |
| `--max-budget-usd` | 最大花费限制 (仅 print 模式) |
| `--fallback-model` | 默认模型过载时的备选模型 |
| `--no-session-persistence` | 不保存会话到磁盘 |
| `--permission-mode` | 权限模式: `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions` |
| `--system-prompt` | 替换整个系统提示 |
| `--append-system-prompt` | 追加到系统提示 |
| `--allowedTools` | 自动允许的工具 (不弹确认) |
| `--disallowedTools` | 禁用的工具 |
| `--tools` | 限制可用工具集 |
| `--bare` | 最小模式 (跳过自动发现, 加速启动) |
| `--add-dir` | 添加额外工作目录 |
| `--mcp-config` | 加载 MCP 配置 |
| `--agent` | 指定代理 |
| `--agent-teams` | 启用实验性代理团队 |
| `--chrome` | 启用 Chrome 集成 |
| `--remote` | 在 claude.ai 创建 Web 会话 |
| `--remote-control, --rc` | 启用远程控制 |
| `--teleport` | 将 Web 会话拉到本地 |
| `--dangerously-skip-permissions` | 跳过所有权限确认 (仅限隔离环境) |
| `--input-format` | 输入格式: `text`, `stream-json` |
| `--json-schema` | 结构化输出 (JSON Schema 验证) |
| `--debug` | 调试模式 |
| `--debug-file` | 调试日志写入文件 |

### 4.3 流式输出关键参数组合

```bash
claude -p "<prompt>" \
  --output-format stream-json \     # NDJSON 逐行 JSON
  --verbose \                       # 完整逐轮信息
  --include-partial-messages        # token 级别增量 (关键!)
```

> **`--include-partial-messages` 是实时流式输出的关键!**
> 没有它只会在消息完成后才输出, 没有逐 token 增量。

---

## 5. 权限模式

| 模式 | 说明 |
|------|------|
| `default` | 标准模式, 首次使用每个工具时确认 |
| `acceptEdits` | 自动接受文件编辑, 命令仍需确认 |
| `plan` | 只分析不修改 |
| `auto` | 自动批准 + 后台安全检查 (研究预览) |
| `dontAsk` | 未预先批准的自动拒绝 |
| `bypassPermissions` | 跳过所有确认 (仅限 `.git`, `.claude`, `.vscode`, `.idea` 仍保护) |

权限规则评估顺序: **deny → ask → allow** (deny 永远优先)

---

## 6. 内置工具

| 工具 | 需要权限 | 说明 |
|------|---------|------|
| Agent | 否 | 生成子代理 |
| Bash | 是 | 执行 shell 命令 |
| Edit | 是 | 编辑文件 |
| Write | 是 | 创建/覆盖文件 |
| Read | 否 | 读取文件 |
| Glob | 否 | 文件模式匹配 |
| Grep | 否 | 内容搜索 |
| WebFetch | 是 | 获取 URL |
| WebSearch | 是 | 网页搜索 |
| NotebookEdit | 是 | 编辑 Jupyter notebook |
| Skill | 是 | 执行技能 |
| LSP | 否 | 代码智能 (定义/引用/类型错误) |
| SendMessage | 否 | 发消息给团队成员 |

---

## 7. 会话管理

- 会话通过 ID 或名称标识
- `claude -c` 继续当前目录最近的对话
- `claude -r "session"` 恢复指定会话
- `--fork-session` 恢复时分叉为新会话
- `--name` 设置会话名称; `/rename` 会话中修改
- `--no-session-persistence` 禁止保存到磁盘 (仅 print 模式)
- `cleanupPeriodDays` 控制会话保留天数 (默认 30 天)
- 会话保存为 `.jsonl` 文件
- 设置 `cleanupPeriodDays: 0` 删除所有历史并禁用持久化

---

## 8. stream-json 事件流生命周期

```
system (初始化)
 └─ session_id, model, tools, cwd

stream_event: message_start
 └─ usage: input_tokens, cache_read_input_tokens, cache_creation_input_tokens

stream_event: content_block_start
 └─ content_block.type = "thinking" | "text"

stream_event: content_block_delta          ← 核心: 逐 token
 └─ delta.type = "thinking_delta"  → delta.thinking = "思考文本"
 └─ delta.type = "text_delta"      → delta.text = "回复文本"
 └─ delta.type = "signature_delta" → (忽略)

stream_event: content_block_stop

stream_event: message_delta
 └─ usage: output_tokens, stop_reason

stream_event: message_stop

assistant (完整消息汇总)

rate_limit_event
 └─ status, resetsAt, rateLimitType

result (最终结果)
 └─ total_cost_usd, duration_ms, duration_api_ms, num_turns, modelUsage
```

### Thinking / Extended Thinking

| effort | 行为 |
|--------|------|
| 默认 | 无思考, 只有 text block |
| `low` | 最简回答 |
| `medium` | 标准 |
| `high` | 更深入 |
| `max` | **启用 extended thinking**, thinking block + text block (仅 Opus 4.6) |

---

## 9. 安全特性

### 9.1 内置保护

- **沙箱 Bash**: 文件系统和网络隔离
- **写入限制**: 只能写入启动目录及其子目录
- **命令黑名单**: 默认阻止 `curl`, `wget` 等可能获取任意内容的命令
- **命令注入检测**: 可疑 bash 命令即使已列入白名单也需手动确认
- **网络请求审批**: 网络请求默认需要用户确认
- **隔离上下文窗口**: Web fetch 使用独立上下文, 防止注入
- **信任验证**: 首次运行代码库和新 MCP 服务器需要确认

### 9.2 凭据安全

- API key 和 token 加密存储
- Linux: `.credentials.json` 权限 `0600`
- macOS: 使用系统 Keychain
- 自动创建配置文件的时间戳备份 (保留最近 5 个)

---

## 10. 对本项目的意义

### 10.1 多用户 Claude 账户管理

由于凭据存储在 `~/.claude/.credentials.json` (Linux), 每个系统用户的 Claude 登录是独立的:

```
主机上的系统用户         Claude 凭据
user1                   /home/user1/.claude/.credentials.json
user2                   /home/user2/.claude/.credentials.json
user3                   /home/user3/.claude/.credentials.json
```

- 以不同系统用户身份运行 `claude` 即可使用不同的 Claude 账户
- 可通过 `sudo -u userN claude auth status` 检查各用户的登录状态
- 可通过 `sudo -u userN claude auth login` 为特定用户登录

### 10.2 非交互模式 (print mode) 用于自动化

本项目使用 `claude -p` 的 print 模式进行自动化:

```bash
claude -p "prompt" \
  --output-format stream-json \
  --verbose \
  --include-partial-messages \
  --resume <session_id>            # 恢复对话上下文
```

关键约束:
- print 模式下 `-p` 标志使用非交互 trust verification
- `--no-session-persistence` 可避免在磁盘积累会话文件
- `--max-budget-usd` 可限制单次花费
- `--max-turns` 可限制回合数
- `--dangerously-skip-permissions` 在受信环境中跳过权限确认

### 10.3 账户信息检测

```bash
# 检查 CLI 版本
claude --version

# 检查登录状态 (JSON 输出, 退出码判断)
claude auth status
claude auth status --text          # 人类可读

# 快速可用性测试
claude -p "hi" --output-format json --max-turns 1 --no-session-persistence
```
