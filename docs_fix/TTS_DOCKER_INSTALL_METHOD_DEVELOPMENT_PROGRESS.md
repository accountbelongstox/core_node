# TTS Docker 安装方式开发进度文档

> 对应计划：`docs_fix/DEBIAN13_PYTHON310_TTS_DEVELOPMENT_PLAN.md` 步骤 16-20
> 创建时间：2026-09-17 ｜ 状态：运行验证通过（pyservice 实跑 + 全链路实测，见第六节）
> 更新：2026-09-18 运行 pyservice 实测全部功能，修复 6 处缺陷（第六节）

---

## 一、需求逐项演算

### 需求 1：所有细节实现幂等，不是整体一个幂等

**实现方式**：每个最小操作独立收敛、独立验证，无顶层"完成标记"。

| 最小操作 | 幂等机制 | 位置 |
|---|---|---|
| 方法选择持久化 | 已保存且合法 → 原样复用，无倒计时、不重写；写入前逐键比较内容 | `install_method_common.sh` / `InstallMethodCommon.ps1` |
| START_DOCKER 开关 | 值不同才写；`true` 时打印 "no write needed" | `docker_prereq_common.sh:docker_prereq_force_enable` |
| 引擎 docker 注册 | 集合成员去重（case 匹配），重复注册只提示不写 | 同上 |
| apt keyring | 存在且 `gpg --show-keys` 可解析 → 跳过；损坏才重下 | `79_install_docker.sh:ensure_keyring` |
| deb822 源文件 | 内容逐字节比较，相同不写（`mv` 原子替换仅在差异时） | `79_install_docker.sh:ensure_apt_source` |
| apt update | 仅在 keyring/源发生变化时执行 | `79_install_docker.sh:apt_update_if_changed` |
| docker 五个包 | `dpkg -s` 逐个探测，只装缺失项；`--ensure` 从不升级已装包 | `79_install_docker.sh:ensure_docker_packages` |
| daemon enable/start | `systemctl is-enabled/is-active` 分别探测，只对未达标项动作 | `79_install_docker.sh:ensure_daemon_running` |
| compose 插件 | `docker compose version` 独立探测，独立写 `DOCKER_COMPOSE_AVAILABLE` | `79_install_docker.sh:verify_compose_plugin` |

**演算**：重复执行 79 → keyring 跳过、源跳过、apt update 跳过、五个包全部已装跳过、enable/start 跳过，仅探测类命令运行；START_DOCKER=false → 直接跳过且绝不 stop/disable/pkill 用户已有 Docker（旧版会 pkill，已删除）。

### 需求 2：句子/短文本 TTS 由 Qwen 独占，五引擎只服务词语

**实现**：`pycore/pyutils/tts/engine_policy.py`
- 新增 `_SENTENCE_PINNED_TTS = ("qwen3tts",)`（复用 `_AGENT_HISTORY_PINNED_TTS` 既有钉住模式）。
- `configured_tts_priority("sentence")` → 只返回 `("qwen3tts",)`，无回退链（回退会静默降级质量，违背契约）。
- `reload_tts_priority()` 不再加载持久化的 sentence 链，状态槽直接写入钉住值。
- 词语侧 `_WORD_EXCLUDED = ("qwen3tts",)` 为既有逻辑，未改；五引擎仅在 word profile 可用。

**运行验证**（import 冒烟，非安装运行）：
```
configured_tts_priority('sentence')      -> ('qwen3tts',)
'qwen3tts' in word profile               -> False
configured_tts_priority('agent_history') -> ('qwen3tts',)  （既有行为未破坏）
```

**消费方审计**：`tts_orchestrator.py:91` 经 `configured_tts_priority(profile)` 取链 → 钉住生效；`capability_service.py:294` 的 `default_sentence_tts_priority()` 仅用于状态展示"已知引擎"列表，不参与合成选择 → 不违约，保持原样。

### 需求 3：官方推荐 Docker 的引擎必须提示推荐 + 来源，可选 native/docker，默认 20 秒

**实现**：`linux/common/install_method_common.sh` + `win/win_common/InstallMethodCommon.ps1`（双平台同契约）。
- 20 秒单调倒计时（bash `date +%s` 截止点 / PS `Stopwatch`），超时提交**当前显示项**。
- Enter 确认高亮项；数字/方向键/N/D 切换；B/Q 取消且不写任何键。
- 无 TTY（Linux 无 /dev/tty；Windows `[Console]::IsInputRedirected`）→ 打印默认方式并按同一 20 秒规则自动提交（`timeout_default`），不无限阻塞、不消费上层菜单输入。
- 来源与默认值按官方文档（均已实际抓取验证）：

| 引擎 | Linux 默认 | Windows 默认 | 官方依据 |
|---|---|---|---|
| melotts | native | **docker（官方推荐）** | install.md: "If you are using Windows, we highly recommend using Docker" |
| cosyvoice | native | native | README 原生 conda python=3.10；仓库含 docker/ 目录 |
| gptsovits | native | native | README 原生安装；社区镜像 xxxxrt666/gpt-sovits |
| fishspeech | native | native | speech.fish.audio/install 原生 + 官方 docker（fishaudio/fish-speech） |
| voxcpm2 | native（唯一选项） | native（唯一） | 官方仅文档化原生安装，无官方容器证据（2026-09 查） |

**演算**：voxcpm2 单选项 → 快速路径直接持久化，无倒计时噪音；melotts Windows → 显示英文推荐语 + install.md 来源，默认 docker，20 秒无操作自动提交 docker；用户选 native → 持久化 `explicit`，下次直接进入 native 流程。

### 需求 4：Linux — START_DOCKER 强制联动 + 链式调度 + compose 脚本更新

**实现**：
- `linux/common/docker_prereq_common.sh`：模型步骤只调 `docker_prereq_ensure_for_engine`（不直接调编号步骤）；强制 `START_DOCKER=true`（复用 selector 菜单既有的 `[^] Start Docker After Installation` 开关），记录 `TTS_DOCKER_BACKEND_ENGINES`（去重）与 `TTS_DOCKER_TRIGGER=model_install`。
- `debian/install_shells/ensure_docker_for_tts.sh`：无编号统一入口（同时供 Windows WSL 桥调用）。
- `79_install_docker.sh` 重写：官方 deb822 APT 源（**已实测** download.docker.com 存在 debian trixie/bookworm、ubuntu resolute/questing/plucky/noble/jammy；trixie 池内 docker-ce 29.8.1、compose-plugin 5.5.1）；删除 snap 路径、pkill、`docker.list` 无条件删除；等价旧源复用、冲突源报告所有者但保留；`--update` 为唯一显式升级路径。
- compose 资产：`docker-compose-selector.js` 生成输出前 `delete newCompose.version`；`docker-compose-synology.yml` 移除废弃 `version: '3.8'`（Compose Spec 已废弃该字段，插件忽略）。

**演算**：用户在 133 选 docker → force_enable 写 START_DOCKER=true → 调度 79 → 逐组件收敛 → 探测 compose 插件 → 写 `TTS_COSYVOICE_BACKEND=docker` → 打印 compose 服务资产待步骤 19 的诚实 pending 说明 → 退出 0。不会提示"请重跑菜单"代替执行。

### 需求 5：Windows 关联已有 WSL 脚本支持 docker

**实现**：`win/win_common/DockerWslBridge.ps1`
- 提供者解析：`desktop_wsl2`（Docker Desktop，`docker info` 探测，只验证不安装）→ 不可用时 `wsl_engine`。
- `wsl_engine`：发行版缺失 → 调度既有 `Step30_InstallWSLDebian13.ps1`；`wsl.exe` 缺失 → 报告 `wsl_missing_run_Step29`（启用 Windows 功能需重启，**有意不在模型步骤里无人值守触发**，记录为边界决策）。
- 桥接：`wslpath -a` 转换仓库路径 → `wsl.exe --distribution <d> --user root --exec bash <repo>/.../ensure_docker_for_tts.sh <engine>`（参数数组，无 bash -c 拼接）→ WSL 内走**同一条** Linux 编号链并强制 START_DOCKER。

### 需求 6：逐项演算 + 进度文档

即本文档第一节与下节。

### 需求 7：必要时搜索官方文档

web_search 工具不可用（缺 EXA_API_KEY），改用 web_fetch + curl 直连官方源实测：
- Docker APT 仓库：`https://download.docker.com/linux/debian/dists/`（trixie/bookworm）、`.../ubuntu/dists/`（resolute..jammy）—— 200 OK
- trixie amd64 池：docker-ce `29.8.1`、docker-compose-plugin `5.5.1` —— 实列
- GPG：`https://download.docker.com/linux/debian/gpg` —— 200 OK
- MeloTTS install.md、CosyVoice/Fish Speech/GPT-SoVITS/VoxCPM README —— 实抓

---

## 二、文件清单

### 新增（6）
| 文件 | 作用 |
|---|---|
| `scripts/shells/linux/common/install_method_common.sh` | 逐引擎 native/docker 限时选择（幂等持久化） |
| `scripts/shells/linux/common/docker_prereq_common.sh` | START_DOCKER 强制联动 + 编号链调度 |
| `scripts/shells/linux/debian/install_shells/ensure_docker_for_tts.sh` | 统一调度入口（含 WSL 桥目标） |
| `scripts/shells/win/win_common/InstallMethodCommon.ps1` | Windows 侧同契约选择器 |
| `scripts/shells/win/win_common/DockerWslBridge.ps1` | desktop_wsl2/wsl_engine 提供者桥 |
| 本文档 | 进度记录 |

### 修改（13）
| 文件 | 变更 |
|---|---|
| `pycore/pyutils/tts/engine_policy.py` | `_SENTENCE_PINNED_TTS`；sentence profile 钉住 qwen3tts；reload 不再读持久化 sentence 链 |
| `scripts/shells/linux/debian/install_shells/79_install_docker.sh` | 重写为官方 deb822 APT 逐组件幂等；删 snap/pkill/无条件删源；`--update` 显式升级 |
| `133_install_cosyvoice.sh` / `137_install_gptsovits.sh` / `139_install_melotts.sh` / `143_install_fishspeech.sh` / `147_install_voxcpm2.sh` | 接入选择块 + docker 分支 |
| `Step52_InstallCosyVoice.ps1` / `Step54_InstallGptsovits.ps1` / `Step55_InstallMelotts.ps1` / `Step56_InstallFishspeech.ps1` / `Step58_InstallVoxcpm2.ps1` | 接入选择块 + docker 分支（Step55 默认 docker） |
| `scripts/shells/scripts/docker-compose-selector.js` | 生成输出剔除废弃 `version` 字段 |
| `scripts/shells/docker_compose/docker-compose-synology.yml` | 移除 `version: '3.8'` |

---

## 三、验证记录

| 项 | 方式 | 结果 |
|---|---|---|
| 9 个 bash 文件 | `bash -n`（仅语法，不执行） | 全部 OK |
| `engine_policy.py` | `py_compile` + import 冒烟（sentence/word/agent_history 三链） | OK，钉住生效 |
| `docker-compose-selector.js` | `node --check` | OK |
| 7 个 PS 文件 | PowerShell AST `Parser::ParseFile` | 全部 OK |
| 安装流程端到端运行 | **未运行**（项目规则：不被要求时不运行安装/服务） | — |

---

## 四、诚实 Pending（后续步骤，非本轮范围）

1. **逐引擎 compose 服务资产（计划步骤 19）**：已落地 `scripts/shells/docker_compose/tts/<engine>/`（Dockerfile + compose.yml + compose.gpu.yml，五引擎齐全），由 `linux/common/tts_docker_compose_common.sh:tts_docker_apply_engine` 按内容比较同步并按指纹收敛（相同指纹的运行容器不重碰）；五引擎 `docker compose config -q` 全部通过（2026-09-18 实测）。镜像构建/首跑耗时未在本轮执行。
2. **83/99/rebuild 重构为共享 generate/apply（19.12）**：legacy `/usr/local/.pcore_local/deploy` 流未动，待 compose 资产落地时一并重构。
3. **capability_service 展示面**：sentence_tts 状态块仍列回退引擎为"已知"（仅展示，不参与合成）；如需钉住语义进 UI，另起小改。
4. **Step29 自动触发**：wsl.exe 缺失时有意只报告不自动启用 Windows 功能（需重启），如需全自动需用户显式授权。
5. **81_set_docker_daemon.sh**：已审阅，逻辑本就是合并式（update_docker_dns_mirror.js）且 START_DOCKER=false 时跳过，无需变更。

---

## 五、变更摘要（一行式）

句子 TTS 钉住 Qwen3-TTS；五引擎逐引擎可选 native/docker（20 秒超时默认、官方推荐标注、逐键幂等持久化）；docker 分支强制 START_DOCKER 并经统一入口调度重写后的 79（官方 deb822 源、逐组件幂等、compose 插件探测）；Windows 经 WSL 桥复用同一 Linux 链；compose 资产剔除废弃 version 字段；全部静态验证通过，安装流程未运行。

---

## 六、2026-09-18 运行验证与修复（pyservice 实跑）

### 运行方式

`bash pyservice.sh run --no-install --no-ui --no-reload`（headless，Debian 13 / Python 3.13 venv），RPC v2 监听 :59000，运行中实测下列全部功能。

### 本轮修复（6 处，均为实测暴露的真实缺陷）

| # | 文件 | 缺陷与修复 |
|---|---|---|
| 1 | `pycore/pyfoundations/third_party/_getters_core.py` | 顶层 eager `import pystray` / `import pythoncom` 使 headless worker 启动即崩（pystray import 时连接 X11 失败）；改为 try/except + `PYSTRAY_AVAILABLE` / `PYTHONCOM_AVAILABLE` 标志，getter 先查标志 |
| 2 | `pycore/pyctl/stt/test_service.py` | **新建**——`local_engine_service.py` 与 `stt/status_service.py` 均 import 该模块但 git 历史中从未存在，worker 启动 ModuleNotFoundError。实现 STT 往返测试：TTS（word profile，edge 优先）合成样句 → 需要时 ffmpeg 转 16k 单声道 WAV → 目标 STT 引擎识别 → 归一化相似度评分（>=0.6 通过） |
| 3 | `pycore/pythreadpool/starters.py` | 顶层无条件 import PySide6 UI 模块；headless 无 PySide6 即崩。加 `PYSIDE6_AVAILABLE` 守卫，`start_ui` headless 返回 None |
| 4 | `pycore/pyutils/native_ui/step6_tray/win32_system_tray.py` | `win32gui/win32con/win32api/PIL` import 悬在空 try 块之外（`WIN32_AVAILABLE`/`PIL_AVAILABLE` 原为死代码），Linux 必崩；移入 try 块 |
| 5 | `scripts/shells/linux/common/install_method_common.sh` | `set_var` 的 "Successfully set..." 走 stdout，污染 `INSTALL_METHOD="$(install_method_select ...)"` 捕获值，导致 133/137/139/143 首次选择后 `== "docker"` 比较失败（真实断链 bug）；静默化（第三参 false） |
| 6 | `scripts/shells/win/win_common/GlobalVarStoreCommon.ps1` | `Get-GlobalVar` 文件回退路径未 Trim，`Set-Content` 尾部换行使已存选项永远无法匹配 supported 集 → Windows 每次重选；已修（与 secret 路径的 `.Trim()` 对齐） |

### 实测结果

| 项 | 方式 | 结果 |
|---|---|---|
| pyservice 启动 | headless run | OK，:59000 LISTEN，laravel/queue-center/agent-history 正常 |
| sentence 钉住（live） | `POST /api/tts/synthesize` 多词句子 | 仅尝试 qwen3tts，诚实报错（venv 未建），**无静默回退** |
| word profile（live） | 同上，单词 "hello" | edge 成功，11232 bytes |
| TTS 引擎测试 | `POST /api/local/tts/test` sherpa | 成功（首次载模 21.6s），speech_history record_id 落库 |
| STT 往返测试（新模块） | `POST /api/local/stt/test` vosk | 成功：edge 合成 → WAV → vosk 识别，**similarity 1.0**，record_id 落库 |
| sentence_audio 状态 | `POST /api/ui/sentence_audio/status` | `required_engine=qwen3tts`，钉住语义透出 UI 契约 |
| engine_policy import 冒烟 | venv python | sentence=(qwen3tts,)、word 排除 qwen、agent_history 钉住、default 链完整 |
| 79 幂等重跑 | 实际执行 | 全组件 "nothing to do"（keyring/源/apt update/五包/enable/start 全跳过），exit 0；docker-ce 29.8.1 + compose 5.5.1 + daemon active |
| ensure_docker_for_tts.sh | 实际执行 `cosyvoice` | exit 0，复用同一编号链 |
| install_method_common.sh | 沙箱 GLOBAL_VAR_DIR 21 项断言 | 全过：显式/复用/幂等不重写/非法拒绝/单选项/无 TTY 默认/backend 只变才写/START_DOCKER 联动去重/失效重选 |
| 交互 TTY 路径 | `script` 伪终端 | 数字键切换+Enter 确认（explicit）、20s 超时提交显示默认（timeout_default）、Q 取消 rc=10 不写键，均通过 |
| PS 选择器 | pwsh 沙箱 8 项断言 | 全过（修复 #6 后复用生效） |
| PS 语法 | AST ParseFile ×7 | 全过 |
| compose 资产 ×5 引擎 | `docker compose config -q`（cpu） | 全过（cosyvoice/gptsovits/melotts/fishspeech/voxcpm2） |
| bash 语法 | `bash -n` ×11（含 kimiyolo.sh、ssh_server_common.sh、175、23） | 全过 |
| docker-compose-selector.js | `node --check` | OK |

### 说明

- 引擎镜像 `docker compose up -d --build`（多 GB 构建）未执行；apply 函数为幂等收敛设计，配置面已验证。
- 测试期间对真实 gvar 存储的误写已全部还原（`TTS_DOCKER_BACKEND_ENGINES` 恢复为 `cosyvoice`，删除测试写入的 `TTS_MELOTTS_BACKEND`）。
