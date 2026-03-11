# OpenClaw 通过技能（Skills）支持 Agent / Cursor CLI

本文档按「技能桥接」方向整理：OpenClaw 通过 **Skills 生态** 让智能体获得与 Cursor CLI 等外部工具交互的能力，而非在运行时内置 Cursor。

**完成率与推荐方案**
- **完成率**：100%。技能桥接机制、加载优先级、安装命令（ClawHub）、配置与依赖、与 [OPENCLAW_WORKSPACE_AND_CONFIG.md](OPENCLAW_WORKSPACE_AND_CONFIG.md) 的引用关系已写毕；ClawHub 安装报错（VirusTotal / rate limit）见 §九。
- **推荐步骤**：(1) 先按 [OPENCLAW_WORKSPACE_AND_CONFIG.md](OPENCLAW_WORKSPACE_AND_CONFIG.md) 配置 `agents.defaults.workspace` 与 Gateway 启动目录（避免 cwd=system32）；(2) 按 §三 通过 ClawHub 安装或手建 `cursor-agent` 技能；(3) 在 `~/.openclaw/openclaw.json` 的 `skills.entries` 中启用该技能，并确保 Cursor CLI（`agent` / `cursor`）在 Gateway 运行环境的 PATH 中。

---

## 一、核心机制：Skill 桥接

- **OpenClaw 不内置 Cursor**，集成通过 **Skills Ecosystem** 完成。
- 一个 **Skill** = 一个目录，内含 `SKILL.md`（YAML frontmatter + 说明），用于“教” agent 如何使用一组工具。
- 若存在 **cursor-agent**（或类似名称）技能，则它充当 OpenClaw 智能体与 Cursor CLI 之间的桥梁：agent 获得该技能提供的**工具定义**，在用户发出编程类指令时，可调用工具，由工具在本地执行 `cursor` / `agent` 等命令并回传结果。

官方文档：
- [Skills](https://docs.openclaw.ai/tools/skills)（加载顺序、ClawHub、gating、config）
- [Skills config](https://docs.openclaw.ai/tools/skills-config)（`~/.openclaw/openclaw.json` 下 `skills`）
- [ClawHub](https://docs.openclaw.ai/tools/clawhub)（公共技能注册表与 CLI）

---

## 二、技能加载位置与优先级

| 来源 | 路径 | 优先级 |
|------|------|--------|
| 工作区技能 | ` agents.defaults.workspace /skills` | 最高（同名覆盖） |
| 托管/本地技能 | `~/.openclaw/skills` | 中 |
| 内置技能 | 随安装包 | 最低 |
| 额外目录 | `skills.load.extraDirs` | 最低 |

同名时：工作区 > 托管 > 内置。多 agent 时，每个 agent 的 workspace 下 `skills/` 仅对该 agent 可见。

---

## 三、安装技能（正确命令）

- **官方没有** `openclaw install skill <name>`。安装来自 **ClawHub 注册表** 的技能用 **ClawHub CLI**：
  ```bash
  npm i -g clawhub
  clawhub search "cursor"          # 搜索
  clawhub install <slug>          # 例如 cursor-agent（若存在）
  ```
- 默认安装到当前工作目录下的 `./skills`，若配置了 OpenClaw workspace 则回退到该 workspace；OpenClaw 从 ` workspace/skills` 加载，**下次新会话**生效。
- 若 ClawHub 上**没有**现成的 cursor-agent，可：
  - 在 `~/.openclaw/skills` 或 ` workspace/skills` 下**手写**一个技能目录，内含 `SKILL.md` 和（若需要）脚本；
  - 或从社区/自建仓库拷贝后再用 `clawhub publish` 发布到 ClawHub（可选）。

---

## 四、技能如何“桥接” Cursor CLI

1. **工具定义**：在 `SKILL.md` 中描述技能能力，agent 在系统提示中会看到可用技能列表；技能可对应到 **command-dispatch: tool** 的某个工具名，或由 agent 通过常规工具（如 `exec`）调用。
2. **指令转换**：用户通过 Telegram/Slack/终端等发编程需求 → OpenClaw 解析意图 → 若启用对应技能，则触发该技能或通过 `exec` 调用 Cursor CLI。
3. **CLI 执行**：技能实现侧（或 agent 通过 `exec`）在本地执行例如 `cursor agent "your prompt"` 或 `agent "refactor auth module"`，并捕获 stdout/stderr 或生成的 diff。
4. **结果回传**：OpenClaw 将 Cursor CLI 输出总结后反馈用户，或等待确认/继续修改。

**Headless/非交互**：若需无界面运行，通常依赖 Cursor CLI 的非交互模式或通过 PTY/脚本包装输入输出；具体以 Cursor 官方文档为准。

---

## 五、配置与依赖（启用此类能力时）

| 项目 | 说明 |
|------|------|
| Cursor CLI | 宿主机安装并配置好 `cursor` 或 `agent` 命令，且在 Gateway 运行环境的 **PATH** 中可用。 |
| 技能安装 | 通过 ClawHub 安装或自建：`clawhub install <slug>` 或 将技能目录放到 `~/.openclaw/skills` / ` workspace/skills`。 |
| 权限 | Cursor CLI 会读写文件，Gateway（或执行工具的进程）需在**有权限访问目标项目目录**的用户上下文中运行；若启用 sandbox，需在 sandbox 内也提供 Cursor CLI 或仅对可信会话放开 exec。 |
| 配置覆盖 | 在 `~/.openclaw/openclaw.json` 的 `skills.entries.<skillName>` 下可设 `enabled: true`、`env`、`apiKey` 等；若技能名含连字符需加引号。 |

---

## 六、工作区与 agent 默认目录

- Agent 的**唯一默认工作目录**（文件工具 cwd）= **agents.defaults.workspace**。
- 若希望 Cursor 默认操作当前代码库，可将 **workspace** 设为项目根（如 `D:\\programing\\core_node`），详见 [OPENCLAW_WORKSPACE_AND_CONFIG.md](OPENCLAW_WORKSPACE_AND_CONFIG.md) §8。

---

## 七、文档与链接汇总

| 主题 | 链接 |
|------|------|
| Skills 总览、ClawHub、gating | https://docs.openclaw.ai/tools/skills |
| Skills 配置项 | https://docs.openclaw.ai/tools/skills-config |
| ClawHub 注册表与 CLI | https://docs.openclaw.ai/tools/clawhub |
| ClawHub 站点（浏览/搜索技能） | https://clawhub.ai |
| Agent 运行时与 workspace | https://docs.openclaw.ai/concepts/agent |
| Agent workspace | https://docs.openclaw.ai/concepts/agent-workspace |
| 本机 workspace/配置/计划任务 | [OPENCLAW_WORKSPACE_AND_CONFIG.md](OPENCLAW_WORKSPACE_AND_CONFIG.md) |

---

## 八、关于「cursor-agent」技能

- 截至查阅时，**官方 OpenClaw 文档未列出名为 cursor-agent 的内置技能**；ClawHub 上是否存在名为 `cursor-agent` 的社区技能需在 [clawhub.ai](https://clawhub.ai) 搜索确认。
- 若不存在，可按上述方式在 `~/.openclaw/skills/cursor-agent` 或 ` workspace/skills/cursor-agent` 下自建 `SKILL.md`，在描述中声明依赖 `cursor` 或 `agent` 在 PATH 中，并在技能说明中写出调用约定（如 `agent "prompt"`、工作目录等），由 agent 通过现有 `exec` 等工具调用 Cursor CLI。

---

## 九、ClawHub 安装报错：VirusTotal 警告与 Rate limit exceeded

### 现象

执行 `clawhub install cursor-agent` 时出现：

1. **VirusTotal Code Insight 警告**：提示该技能被标记为 suspicious（可能包含 crypto keys、external APIs、eval 等模式），询问是否仍要安装。
2. 选择「Yes」后报错：**Rate limit exceeded**，再次执行同样报错。

### 文档与原因说明

- **OpenClaw 官方文档**（[ClawHub](https://docs.openclaw.ai/tools/clawhub)、[Skills](https://docs.openclaw.ai/tools/skills)）**未单独说明** VirusTotal 检查与 rate limit 的细节。
- **ClawHub 安全**：ClawHub 对技能做安全分析（见 [clawhub 仓库 README](https://github.com/openclaw/clawhub) 的 “Skill metadata”）；“VirusTotal Code Insight” 为注册表/CLI 侧对技能内容的扫描，suspicious 仅表示存在敏感模式，不代表一定恶意。
- **Rate limit**：限流通常来自 **ClawHub 注册表 API** 或 **VirusTotal API**（在确认安装时可能再次请求扫描）。短时间多次安装或同一技能重复请求会触发。

### 建议做法

| 做法 | 说明 |
|------|------|
| **稍后重试** | 等待数分钟或更长时间后再次执行 `clawhub install cursor-agent`，避免连续请求。 |
| **非交互安装** | 使用 `clawhub install cursor-agent --no-input` 可跳过交互提示；若仍触发限流，同样需等待后重试。 |
| **仅查看不安装** | 使用 `clawhub inspect cursor-agent` 查看技能元数据与说明，不触发下载/安装与后续限流。 |
| **手动安装** | 在 [clawhub.ai](https://clawhub.ai) 打开该技能页，若有“下载”或版本 zip 链接，可下载后解压到 `workspace/skills/cursor-agent` 或 `~/.openclaw/skills/cursor-agent`；或从社区/自建仓库拷贝同名技能目录到上述路径，OpenClaw 从 `workspace/skills` / `~/.openclaw/skills` 加载，下次新会话生效。 |
| **环境变量** | 文档未提供禁用 VirusTotal 的官方环境变量；`CLAWHUB_REGISTRY` / `CLAWHUB_SITE` 仅用于改注册表/站点地址，不能绕过限流。 |

### 小结

- VirusTotal 的 suspicious 提示是**提示性**的，选择继续安装是允许的；若随后出现 **Rate limit exceeded**，属服务端限流，需**间隔一段时间再试**或改用**手动安装**。
- 技能加载优先级见本文档 §二；手动放入 `workspace/skills` 或 `~/.openclaw/skills` 的技能与通过 `clawhub install` 安装的等效。
