# Debian 13 / Windows Python 3.10 与 TTS 开发执行计划

依据：`docs_fix/origin/todebian.txt`。本文件供普通 AI 按顺序开发；当前仅规划，不代表代码已实现或运行通过。适配 Windows、Debian 13 服务器/桌面、Ubuntu，并保留 Kali 的通用 Linux 路径。

业务范围（用户最新要求）：本次五个目标模型仅用于单词生成；句子、短文生成由 Qwen 独享。现有 Qwen 的引擎选择、任务、缓存、接口和交付行为保持不变；五个模型的底层类库仍按句子/长文本标准实现分块、拼接、预算与完整性保障。具备长文本能力不代表获得句子或短文业务入口。

补充要求：幂等性必须落实到每个最小操作，不能仅由总入口或完成标记兜底。安装方式支持 native/docker；对官方推荐 Docker 的平台展示推荐说明，首次选择等待 20 秒后自动采用显示的默认方式。模型选择 Docker 后，Linux 自动将既有 START_DOCKER 开启并调用安装链；Windows 关联现有 WSL 脚本。具体执行约束见步骤 16–21，优先于前文仅原生安装的描述。

## 步骤 01：固定需求边界与执行规则

状态：规划完成，待开发。依赖：无。

1. 保留默认 Python 3.13；新增独立 Python 3.10 与 `python310`、`pip310` 命令。五个目标引擎为 CosyVoice、Fish Speech、VoxCPM2、GPT-SoVITS、MeloTTS；native 各用自己的 venv，docker 各用独立镜像/环境，不共用一个 TTS 依赖环境。
2. 实际开发先读根目录 `AGENTS.md`、`CLAUDE.md`、`development-guides/PYTHON_PYCORE.md`、`development-guides/DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`。代码、注释、日志、脚本输出均为英文；产品显示使用现有 i18n。沿用文件顶部声明、绝对导入、分层与 THREAD_BUS 规则。
3. 本次只写此计划；不执行安装、构建、测试、服务、验证命令或 Git 操作。后续普通 AI 开发也不得自行创建、修改或运行测试；运行验证需用户另行明确要求。
4. Linux 新解释器使用绝对路径，命令链接放 `/usr/local/bin`；禁止依赖 `source venv/bin/activate`、shell profile 或交互式别名。已有项目 globals 的载入遵循原规范，不能把“不激活 venv”误解为删除项目既有 globals 加载。
5. 安装器仅补缺失二进制、文件、包及独立修复链接；不得无条件升级、重建环境、覆盖系统 Python、删除原缓存或模型。损坏环境报告明确原因，涉及删除/替换用户数据先取得批准。
6. 每实施完一个步骤立即在本节追加实际文件、已完成内容、未解决事项、验证状态；禁止最后一次性补写进度。未运行验证必须写“未运行”，不能写“通过”。实现记录只放本计划，不放源码。
7. 原材料里的“wheel 存在”“Requires-Python 下限”“官方有 Linux 安装示例”只作为候选兼容性证据，不等于完整依赖可安装或 CPU 推理已证实。引擎数量按实际注册表统计；不沿用未经清点的“8/13”。

交付条件：后续每步都有具体文件、输入输出、执行顺序、失败处理及完成标准；可独立移交给普通 AI，不需要复原本轮对话。

## 步骤 02：建立源码改动地图与统一配置契约

状态：规划完成，待开发。依赖：01。

已读源码的关键事实：`runtime_policy.py` 把 cosyvoice、fishspeech、voxcpm2 标为非隔离；gptsovits、melotts 已标隔离。Fish Speech 当前包清单含云端 SDK，不能据此判定本地模型已安装。CosyVoice 已有 HTTP 客户端；VoxCPM2 已有 engine 文件，不能另起同名实现。Qwen 已有独立服务、环境清理、分块生成与拼接代码。

|职责|必须先读并优先修改的现有文件|
|---|---|
|ABI 与兼容性|`pycore/pyfoundations/runtime_abi.py`、`pycore/pyutils/common/python_env/runtime_policy.py`|
|隔离环境|`pycore/pyutils/common/python_env/isolated_venv.py`、`isolated_venv_runtime.py`（同目录）|
|Windows 公共安装|`scripts/shells/win/win_common/GlobalVars.ps1`、`PythonRuntimeCommon.ps1`、`TtsCompatibilityCommon.ps1`、`TtsInstallAssetsCommon.ps1`|
|Linux 公共安装|`scripts/shells/linux/common/venv_python_common.sh`、`python_venv_setup_common.sh`、`tts_install_assets_common.sh`、`prepare_pycore_prerequisites.sh`；定位既有 `LGar.sh`、`gvar_common.sh`|
|服务与引擎|`pycore/pyutils/tts/tts_service_manager.py`、`engine_registry.py`、`engine_policy.py`、五个 `*_engine.py`|
|Qwen 参考|`pycore/pyutils/tts/qwen/standalone_service.py`、`pycore/tts_install_assets/qwen3tts_synthesis.py`、`qwen3tts_api_server.py`|
|业务接线|`pycore/pyctl/tts/laravel_audio_worker_execution.py`、`laravel_audio_worker.py`、`word_audio_service.py`、`pycore/callmodule/rpc_routes/tts_routes.py`；`sentence_audio_auto.py` 只作为保护现有 Qwen 行为的阅读依据|

执行细节：

1. 在现有全局配置体系登记独立 `PYTHON310_INSTALL_DIR`、`PYTHON310_EXE_PATH`、`PYTHON310_PIP_PATH`（名称若已存在则复用），不得复写默认 `PYTHON_EXE_PATH`、`VENV_PYTHON3` 或默认包安装路径。
2. 沿用 `COSYVOICE_PYTHON`、`GPTSOVITS_PYTHON` 等已有引擎覆盖项；缺少的 Fish Speech、VoxCPM2、MeloTTS 覆盖项采用相同命名。覆盖值的含义统一为“创建该引擎 venv 的基础解释器”，实际启动使用该 venv 的绝对解释器。
3. 解析顺序固定为：引擎显式覆盖 → 已登记 Python 3.10 → 报告缺失；不得默默退回默认 3.13。已有有效引擎 venv 优先复用；兼容性读取所选解释器的主次版本，不使用宿主 `sys.version_info` 替代。
4. 统一引擎记录包含 engine、model_id、model_revision、source_revision、base_python、venv_python、device_policy、resolved_device、dependency_profile、managed/external、endpoint、状态与原因。先映射已有字段，仅增加缺项，不能另造一套旁路注册表。
5. pyfoundations 只保留底层常量/纯策略；公共环境实现放 `pyutils/common/python_env`；TTS 能力留在 `pyutils/tts`；业务编排放 `pyctl`；RPC 只转发。

完成标准：默认/3.10/各引擎 venv 三类路径互不混淆；每项配置只有一个权威来源，Windows/Linux 消费同一引擎策略。

## 步骤 03：固定上游证据、版本边界与长文本限制

状态：规划完成，待开发。依赖：02。以下为 2026-09-17 读取官方仓库/文档所得；main 分支可变，开发落地时保存所选发布版本或提交标识与模型 revision，不自动追踪 latest。

|引擎|已获得的官方证据|开发采用的限制解释|
|---|---|---|
|CosyVoice|[官方仓库](https://github.com/FunAudioLLM/CosyVoice)；[frontend.py](https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/cosyvoice/cli/frontend.py) 使用 `token_max_n=80`、`token_min_n=60`、`merge_len=20` 分段|这些是前端 token 分段参数，不能写成“最多 80 个字”或整个模型的硬上限。保留官方前端，对超长无标点段另加保护；不得重复归一化。|
|Fish Speech|[pyproject.toml](https://raw.githubusercontent.com/fishaudio/fish-speech/main/pyproject.toml) 声明 Python >=3.10、torch/torchaudio 2.8.0，并列 CPU extra；[schema.py](https://raw.githubusercontent.com/fishaudio/fish-speech/main/fish_speech/utils/schema.py) 的 `chunk_length` 默认 200、范围 100–1000，`max_new_tokens` 默认 1024|前者是分块参数，后者是生成 token 预算；都不是全文字符上限。模型上下文还需扣除参考音频/文本及历史。不能采用云端 SDK 的不同范围替代本地 API。|
|VoxCPM2|[core.py](https://raw.githubusercontent.com/OpenBMB/VoxCPM/main/src/voxcpm/core.py) 支持明确 `device`，`max_len=4096` 为生成 token 长度；有最多 3 次的 badcase 重试参数|4096 不等于 4096 字或秒。服务需要外层文本分段、总任务期限和与原生重试合并计算的预算。CPU 禁用非必要 compile，并确认降噪器也使用可用设备。|
|GPT-SoVITS|[api_v2.py](https://github.com/RVC-Boss/GPT-SoVITS/blob/main/api_v2.py) 与 [text_segmentation_method.py](https://raw.githubusercontent.com/RVC-Boss/GPT-SoVITS/main/GPT_SoVITS/TTS_infer_pack/text_segmentation_method.py) 提供文本切分入口|优先复用官方切分策略，具体 cut 方法按选定 revision 映射；参考音频时长与目标音频最长时长必须分开记录。未取得统一硬上限，不能承诺任意长单次生成。|
|MeloTTS|[安装文档](https://github.com/myshell-ai/MeloTTS/blob/main/docs/install.md) 的已测试环境是 Ubuntu 20.04/Python 3.9，Windows 建议 Docker；[api.py](https://raw.githubusercontent.com/myshell-ai/MeloTTS/main/melo/api.py) 有 CPU 选择、分句与拼接|Python 3.10 原生 Windows 是本项目适配目标，不能说官方已保证。保留原生分句，补无标点超长输入保护；未取得统一全文硬上限。|

执行细节：

1. 在现有 `runtime_policy.py` / `tts_model_tiers.py` 对应记录落实模型、依赖来源、Python ABI、CPU/GPU 支持级别、token/字符/音频单位、分段配置。官方默认值与项目保守值分字段保存。
2. 五个引擎均优先 Python 3.10；若选定上游版本依赖无法解析，先选择有官方证据的兼容发布，不扩大宿主依赖、不绕过 pip 依赖解析。必须记录不能兼容的具体包与约束。
3. 不把主环境 cu130 强加给全部引擎；Fish Speech 已见 2.8.0 依赖，需独立选择其可用的 CPU/CUDA wheel。驱动能力、系统 toolkit 与各 venv 的 wheel runtime 分别处理。
4. 每个引擎的“最大限制”记录至少包括来源、revision、参数名、单位、是否硬上限、参考提示占用、停止条件。没有公开数值就明确未知，依靠可配置分块及总预算管理，不能编造秒数。
5. 尚需开发前补证据：选定 CosyVoice/GPT-SoVITS 版本的 CPU 依赖及启动参数；Fish Speech 本地服务的模型/codec 配对；MeloTTS Python 3.10 的原生 Windows 依赖。只读官方源码和安装文档即可，不通过试装冒充规划。

完成标准：每个配置数值能区分“官方已读到”“项目设计值”“仍需确认”；不能把模型可安装、服务可启动、真实推理可用合并为一个布尔值。

## 步骤 04：重命名默认 Python 安装入口并迁移引用

状态：规划完成，待开发。依赖：02。

必须使用以下名称，原有编号及默认解释器行为保持不变：

|目录|原名称|新名称|
|---|---|---|
|`scripts/shells/win/install_powershells`|`Step8_InstallPython.ps1`|`Step8_InstallDefaultPython.ps1`|
|`scripts/shells/linux/debian/install_shells`|`13_ensure_python.sh`|`13_install_default_python.sh`|
|同上|`15_install_python_prereq_packages.sh`|`15_install_default_python_prereq_packages.sh`|
|同上|`19_enable_pipx.sh`|`19_install_default_pipx.sh`|
|同上|`21_enable_poetry.sh`|`21_install_default_poetry.sh`|

执行细节：

1. 先梳理显式清单与数字扫描入口，再改名及更新引用；不使用 Git 命令。保留文件内容和执行权限，不在改名步骤顺便调整依赖。
2. Windows 至少更新 `win_common/InstallerScriptsList.ps1`、`main_powershells/WinScriptsInstaller.ps1` 下载清单、`menu_itemshells/AppInstallMenu.ps1`、`pyservice.ps1` 的路径与提示；其他安装器中旧 Step8 提示同步改名。
3. Linux 至少更新 `common/prepare_pycore_prerequisites.sh`、`menu_itemshells/app_install_menu.sh`、`35_install_certbot.sh` 对 pipx 的调用、`dd.sh` 及实际安装调度文件；默认 venv 的引用说明同步改名。历史资料不做无关大范围改写。
4. 文件存储中若保存菜单选择键，兼容读取旧 `script:<旧名>` 并映射新键，之后写新键；避免升级后丢失用户选项。不得创建两个都被数字扫描的真实安装入口。
5. 调用者信任解析后的脚本路径，不新增 Test-Path/状态预检查包装；安装状态由安装器负责。若旧文件由外部系统直接引用，先记录外部依赖，再选择不被自动扫描的兼容转发方案。

完成标准：活跃安装/启动链只引用新入口；默认 Python、pipx、Poetry 的安装目标与此前相同；远程引导下载不会遗漏改名文件。

## 步骤 05：新增 Windows Python 3.10 安装与独立命令

状态：规划完成，待开发。依赖：03、04。

新增 `scripts/shells/win/install_powershells/Step13_InstallPython310.ps1`，当前已读清单的 13 空缺；实施前确认未被新增脚本占用。登记到 GlobalVars 的包分类、InstallerScriptsList、下载安装清单及菜单。位置在默认 Python 后、所有目标 TTS 前。

执行细节：

1. 复用 `PythonRuntimeCommon.ps1` 的安装目录、镜像、下载及文件存储模式；独立安装目录来自 `PYTHON310_INSTALL_DIR`，不拼接默认 Python 路径。所有路径通过 Split-Path/Join-Path/Resolve-Path 得到绝对值。
2. 优先寻找已登记 3.10 二进制，存在则只修复缺少的 pip 和命令入口；缺少再走项目 winget → choco → web 顺序。各渠道必须明确 3.10 产品标识和独立目录，不能退回通用最新 Python 包。
3. 官方 [Python 3.10.11 发布页](https://www.python.org/downloads/release/python-31011/) 提供 Windows 安装器。不能把它当最新 3.10 安全补丁版本；若采用更新的维护构建，记录来源与完整性信息，并确认 venv/pip 可用，不使用缺乏正常 venv 能力的嵌入包替代开发运行时。
4. 安装参数关闭默认 PATH 注入和文件关联接管，不替换默认 launcher 配置。只向已有公共命令目录添加独立命名入口。`python310` 应支持任意参数、引号及带空格路径；`pip310` 最终调用绝对 3.10 解释器的 `-m pip`。
5. 优先复用项目现有 Windows shim/链接机制；不能用名为 python.exe 的入口覆盖默认命令。若使用包装脚本，内容为英文、路径绝对，保留子进程退出状态但不以退出码承载版本或路径。
6. 分别写入基础解释器路径、pip 入口和安装来源到文件存储；不把逐引擎依赖安装进基础 3.10。普通用户启动 pyservice 时也应能读取和执行这些路径。
7. 已存在同名用户入口且不属于本项目时报告冲突，不强制覆盖。版本识别交给共用 Python 主次版本策略，PowerShell 不用 regex 解析完整版本，不强制包小版本。

完成标准：设计上 `python`/`python3` 仍使用默认解释器；`python310`/`pip310` 明确指向 3.10；重复安装只修复缺项。

## 步骤 06：新增 Debian / Ubuntu Python 3.10 安装与链接

状态：规划完成，待开发。依赖：03、04。

新增 `scripts/shells/linux/debian/install_shells/14_install_python310.sh`；在 LGar/globals 包定义、安装菜单与必要 manifest 登记。执行顺序为默认 Python → Python 3.10 → 默认 prerequisites → 后续 TTS；不要让编号排序把新脚本漏掉。

执行细节：

1. 安装根为 `$COMPILE_DIR/python310`，将全局基础解释器登记为该目录内 `bin/python3.10`。使用 `$USE_SUDO`，不直接写 sudo；所有跨脚本配置走 `set_var/get_var`。
2. 已有可用二进制时不重编译；缺少时优先复用可信系统 Python 3.10 的绝对路径，系统未提供则使用 Python 官方 3.10 源码构建到独立 prefix。禁止给 Debian 加 Ubuntu PPA，也不能更改 `/usr/bin/python3`、alternatives 默认项。
3. 源码分支根据发行版安装缺少的编译依赖：编译器、make、OpenSSL、zlib、bz2、readline、sqlite、ffi、lzma 开发包及证书；按实际 apt 包名映射，记录架构，不能拿 x86_64 二进制用于 ARM。下载校验和记录来自官方发布信息。
4. 构建采用独立 prefix 和 `make altinstall` 语义；官方 [Unix 安装说明](https://docs.python.org/3.10/using/unix.html) 指出普通 install 可能覆盖 python3。开发只编写该逻辑，本次不运行构建。不要把构建临时产物留在 /root 供普通用户依赖。
5. 补齐该解释器自身 pip 后，将 `/usr/local/bin/python310` 链到真实解释器；将 `/usr/local/bin/pip310` 链到该安装的 pip3.10。必要时加 python3.10/pip3.10 入口，但不得覆盖已存在且归用户/系统所有的不同目标。
6. `python310` 必须能创建 venv；实际安装业务包始终调用 `<engine-venv>/bin/python -m pip`，不能调用未限定的 pip。遵守 Debian 外部管理环境约束，不使用 `--break-system-packages`。
7. 不 source 激活脚本，不改 .bashrc/.profile，不以 PATH 查找替代登记路径。systemd 环境中同样用绝对路径，服务用户必须具备模型缓存和输出目录权限。
8. 网络失败、缺编译依赖或不支持架构时写入具体失败阶段；默认 Python 和已装引擎继续保持原状态。已存在的冲突链接不强删。

完成标准：服务器和桌面安装链一致，不需要 DISPLAY、DBUS 或登录 shell；Debian/Ubuntu 没有发行版 3.10 包时仍有可实施来源；默认命令不被接管。

## 步骤 07：扩展公共隔离环境，消除跨 Python ABI 共享

状态：规划完成，待开发。依赖：02、05、06。

已定位缺口：`isolated_venv_runtime.py::_create_venv` 当前使用 `sys.executable -m venv --system-site-packages`；`isolated_venv.py` 存在共享包覆盖移除逻辑；`runtime_policy.py::engine_fingerprint` 读取主环境包版本。这些行为不能直接用于 3.13 宿主管理 3.10 引擎。

执行细节：

1. 为现有环境策略增加显式隔离模式：保留现有同 ABI overlay 行为；新增 `self_contained` 用于五个目标引擎。创建函数接收已解析 base_python，执行该二进制 `-m venv`，不带 `--system-site-packages`。
2. 五个引擎设 isolated=true、基础解释器首选 3.10、禁止宿主包共享；torch、torchaudio、numpy、transformers 等均在对应 venv 内解析安装。不能通过 .pth、PYTHONPATH、目录链接导入 3.13 的 site-packages。
3. 将环境创建、身份判断、包存在性、兼容性、fingerprint、就绪读取统一绑定目标解释器。身份至少包括基础解释器真实路径、主次版本、架构、隔离模式、引擎策略版本、CPU/GPU profile、模型/依赖 revision。
4. 修改 `_base_identity_matches`、`_create_venv`、`_compatible` 及调用方，让路径和版本保持同一来源；self_contained 分支不执行 `_remove_local_shared_overrides`，否则会卸掉引擎自己必须的 torch。
5. 同一引擎环境以 engine + Python ABI + device profile 区分，沿用现有目录生成函数扩展，不在两套 shell 各自拼新规则。已存在老环境身份不匹配时标为需迁移，新建独立目标目录；不自动删除或 --clear 老目录。
6. 启动子进程清理 PYTHONPATH、PYTHONHOME，禁止用户 site 污染；保留证书、代理、模型缓存等有意继承项。Windows DLL/CUDA 搜索路径和 Linux LD_LIBRARY_PATH 只在必要的子进程环境中设置，禁止污染全局。
7. missing 包判断基于目标环境 distribution，不因宿主存在同名包跳过。与上游 requirements 冲突时返回依赖冲突详情，不强装 `--no-deps` 蒙混；不以每次启动自动升级解决。
8. 依赖安装只发生在安装链；运行时 resolve/start 不偷偷创建 venv、安装包或下载权重。安装完成标记只能在全部必需产物就位后写入；不把历史 .deps_done 当完整证据。

完成标准：宿主能管理 3.10 venv，但五个服务不导入宿主二进制依赖；Qwen 既有环境策略保持可选且不被一刀切改坏；包缺失和 ABI 不匹配可分别诊断。

## 步骤 08：统一五个安装器的 CPU/GPU 与依赖处理

状态：规划完成，待开发。依赖：03、07。

|引擎|Windows 文件，位于 install_powershells|Linux 文件，位于 install_shells|
|---|---|---|
|CosyVoice|`Step52_InstallCosyVoice.ps1`|`133_install_cosyvoice.sh`|
|Fish Speech|`Step56_InstallFishspeech.ps1`|`143_install_fishspeech.sh`|
|VoxCPM2|`Step58_InstallVoxcpm2.ps1`|`147_install_voxcpm2.sh`|
|GPT-SoVITS|`Step54_InstallGptsovits.ps1`|`137_install_gptsovits.sh`|
|MeloTTS|`Step55_InstallMelotts.ps1`|`139_install_melotts.sh`|

十个脚本按同一流程实现：读取全局配置 → 判断启用条件 → 按步骤 17 选择/复用安装方式 → 读取统一 engine spec → 选择 device profile → native 补 3.10/venv/依赖，docker 按步骤 18–20 补宿主与容器资产 → 补模型资产 → 写结果。每个子动作独立幂等，公共 helper 不替代资源自身补缺责任。

1. device 策略为 auto/cpu/cuda；CPU 显式设置优先于显卡探测。auto 在目标环境支持 GPU 时使用 GPU，否则采用该模型已支持的 CPU 路线；cuda 显式要求无法满足时报告不可用，不能暗中宣称 GPU 成功。
2. CPU 环境选择官方 CPU torch index；取消 flash-attn、TensorRT、GPU ONNX 等可选加速依赖。若 requirements 将 GPU 包强制列入，依据官方 CPU 安装文件/extra 生成独立 CPU 依赖方案，不能盲删任意依赖。
3. CUDA 环境以模型 requirements 的 torch/torchaudio ABI 配对为准，再确定 wheel CUDA runtime 与最低驱动要求；不能仅根据 `nvidia-smi` 的 CUDA 字段拼 cuXXX URL。所有细包版本由官方依赖文件与 pip 解析处理。
4. 对无 NVIDIA 的 Debian 服务器，不进入驱动强制安装、CUDA 编译或桌面依赖链。允许 CPU 合成慢，但必须可明确报告加载和生成超时；不能把慢等同 unsupported。
5. CosyVoice 保留上游源码/资源结构和必要子模块；Fish Speech 必须有本地 `fish_speech` 推理包、匹配 codec 与权重，只有 fish-audio-sdk 时标“缺本地推理依赖”。VoxCPM2 检查模型 architecture，避免误装 VoxCPM v1 模型。
6. GPT-SoVITS 的 GPT 与 SoVITS 权重、BERT/SSL 前端必须属于兼容的模型版本；CPU 关闭不支持的 half 精度。MeloTTS 分语言准备 tokenizer、词典、MeCab/fugashi/unidic 等实际依赖，不以存在一个词典目录判全部语言就绪。
7. 现有 `--full`、NEURAL_TTS_INSTALL、MELOTTS_INSTALL 等外部兼容入口可以保留；内部把选项写入文件存储再消费。MeloTTS 保持明确 opt-in；用户已选择该引擎时不能因默认宿主 3.13 再次跳过。
8. 新源码下载采用固定 revision 的官方归档及所需依赖资源；不在开发过程中执行 Git。未来安装器若沿用仓库获取逻辑，遵循用户当时授予的安装权限与项目 Git 规则，不能本轮直接 clone。
9. 使用既有共享模型下载缓存，补缺失文件时避免覆盖用户自定义权重。下载中断不得写 ready；文件/包已存在时不重复拉取大模型。

完成标准：两平台对每个引擎产生同义安装状态；无 GPU 具有明确 CPU profile 或有证据的具体阻塞原因，不因 CUDA 缺失而导致整个 pyservice 失败。

## 步骤 09：统一服务类库与进程生命周期

状态：规划完成，待开发。依赖：07、08。

优先扩展 `pycore/pyutils/tts/tts_service_manager.py` 与 `pycore/pyutils/common/managed_service.py`、`managed_service_facade.py`；复用 ServiceSpec、lease、single-active、idle shutdown、busy protection。源码提到的 `development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md` 当前指定位置不存在，不能声称已读取；实施时定位迁移文件，未找到则以现有代码和已提供规范为依据。

执行细节：

1. 五个引擎由独立 Python 3.10 运行时承载重依赖：native 为各引擎 venv 子进程，docker 为各引擎容器进程；主进程只持有客户端/adapter。VoxCPM2 从当前进程内 model 类型迁移为 server 类型，同时移除主进程模型加载路径，防止双重加载。
2. 已有 CosyVoice/GPT-SoVITS 官方 server 可继续作为底层实现；Fish Speech/MeloTTS 复用已有 assets 后升级；VoxCPM2 仅在没有可复用服务端时新增 `pycore/tts_install_assets/voxcpm2_api_server.py`。薄服务封装负责协议统一，不再建第二套服务管理器。
3. 对外客户端统一表达 `available/config_ready/disabled_reason/service_report/synthesize`，实际名字对齐 engine_registry 的既有 adapter；保证旧 synthesize(text, lang, output_mp3, speed) 调用仍能工作。只在现有结构不足时引入共享基类，实例定义在所属具体模块，__init__.py 不做注册。
4. start 使用 venv 绝对解释器、绝对入口、明确 cwd 与子进程 env；运行时不补包。服务默认绑定 loopback；对外访问仍经现有 RPC v2/relay，不额外暴露未认证端口。
5. readiness 分为 installed、configured、process_running、model_loaded、synthesis_ready。HTTP 200 或配置了 URL 不能直接代表可合成；只读 capability/health 不偷偷加载大模型。
6. status 至少含 engine、model_id/revision、runtime ABI、device、supported_languages、voice/reference 要求、chunk capability、busy、错误代码及可读原因。未知字段使用 unknown/null，不填假值。
7. owned 与 external 服务分开：只停止自己创建的进程；端口被其他应用占用时报告身份不匹配，不能杀占用者。进程归属绑定 PID 与创建身份，避免 PID 复用误杀。
8. 同模型默认串行，服从已有全局 single-active 策略；一次长文本任务从首块到最终文件写入始终持有 lease，防止块间被 idle unload。任务取消在块边界观察，不留永远 busy 的状态。
9. Python 主进程的线程/共享状态使用既有 THREAD_BUS 所有者；standalone assets 可用其规则允许的独立实现，但不可 import pycore。对子进程传入缓存/临时绝对目录，替换 Fish Speech bridge 内现有硬编码 D:\\.tmp 等路径。
10. 未预期程序错误保留可诊断信息，不复制旧代码的广泛吞异常模式；已知超时、HTTP 错误和模型失败用结构化结果传递。stderr/stdout 由既有输出泵收集，主进程通过 ColorPrint 报告。

完成标准：五个引擎共享相同所有权、启停、忙碌保护和空闲释放语义，默认主进程不 import 五个模型的 torch/transformers 依赖。

## 步骤 10：逐引擎落实请求、参考音频和 CPU 行为

状态：规划完成，待开发。依赖：03、09。

### 10.1 CosyVoice

- 修改 `cosyvoice_engine.py`，保留现有 URL、mode、speaker、reference 配置兼容性。SFT/instruct 要求有效 speaker；zero-shot 要求参考音频及所选模型需要的转写；instruct2 依据模型能力开放，不把四个模式全部宣称可用。
- 当前客户端用固定 22050 包装 PCM；改为从选定模型/服务元数据获取真实采样率和格式。无法确定裸 PCM 参数时拒绝转换，不能输出语速/音调错误的“成功”文件。
- [官方 cosyvoice.py](https://raw.githubusercontent.com/FunAudioLLM/CosyVoice/main/cosyvoice/cli/cosyvoice.py) 是 CPU/加速分支核对入口：无 GPU 关闭 JIT/TRT/vLLM/FP16 等不适用选项，依版本映射，不能把 GPU flags 原样带入 CPU。
- 官方可迭代输出的所有片段必须消费完毕；缺参考配置应返回明确不可用原因，不等请求发出才失败。

### 10.2 Fish Speech

- 修改 `fishspeech_engine.py` 与 `fishspeech_api_server.py`。当前 assets 只是上游代理/云 SDK bridge，health 仅凭 URL 或 API key 判 ready；新增本地模型托管路径后必须分清 local/external/cloud。
- 本地模式启动官方 [tools/api_server.py](https://raw.githubusercontent.com/fishaudio/fish-speech/main/tools/api_server.py) 对应版本或其薄适配层，绑定本地模型权重和 codec；云 SDK 保留为既有显式选择，不作为本地安装失败后的暗中替代。
- 请求序列化、Content-Type、reference_id/参考音频、格式与 chunk_length 按选定官方 API 实现匹配；JSON/MessagePack 不能想当然互换。上游非 2xx 不得被 bridge 包装成音频 200。
- 参考音色从服务能力或配置读取，不预置不存在的 ID。CPU profile 从官方 pyproject 的 CPU index 及设备参数生成，确认 precision/compile 默认值适用于 CPU。

### 10.3 VoxCPM2

- 修改 `voxcpm2_engine.py` 为轻客户端，保留原有公共调用形式；新增服务端封装 `VoxCPM.from_pretrained` 与 generate，模型初始化只做一次，先校验 architecture 为 voxcpm2。
- 区分 prompt_wav_path + prompt_text 的 continuation 与 reference_wav_path 的声音参考；按 API 要求成对提供 prompt，所有分块复用相同参考/风格配置。
- CPU 显式 device=cpu，并关闭不必要 optimize；降噪器延迟加载且服从设备策略。读取模型实际 sample rate，不固定为其他引擎采样率。
- 透传 token 上限和 badcase 参数，但外层重试不能与内部重试相乘失控；失败记录本次总尝试数。

### 10.4 GPT-SoVITS

- 修改 `gptsovits_engine.py` 与托管启动配置，继续利用官方 api_v2；GPT/SoVITS 权重版本、参考音频、prompt_text、prompt_lang、text_lang 在发请求前完成配置映射。
- 官方 [install.sh](https://raw.githubusercontent.com/RVC-Boss/GPT-SoVITS/main/install.sh) 明确包含 CPU 分支，但依赖 conda。复用其 CPU 包/资源选择，转换为本项目绝对 3.10 venv 安装流程；不能直接调用该脚本而引入 conda activate、全局 pip 或不受控清理。
- CPU 禁用 half，设备参数按该版本 TTS config 填写。保留 text_split_method、speed_factor、fragment_interval 的语义；批处理重排最终恢复原文本顺序。
- 更换模型时先等待本服务在途请求结束；拒绝请求中指向任意服务端文件的模型/参考路径，沿用已登记资源路径。

### 10.5 MeloTTS

- 修改 `melotts_engine.py`、`melotts_api_server.py`，使用独立 3.10 venv，保持 opt-in。按语言读取模型 speaker 映射，拒绝语言/说话人不匹配；CPU 明确使用 device=cpu。
- 在安装阶段准备选定语言词典与 BERT/tokenizer 资产，运行阶段离线读取；缺资源时给出资源名称，不自动下载掩盖安装不全。
- Windows 按步骤 17 提示官方 Docker 推荐，首次默认 Docker，20 秒自动确认；仍可选择 native。原生遇到 MeCab/fugashi 等问题时记录具体组件缺口；选择 Docker 则实际执行步骤 18–20，不要求先尝试失败的原生安装，也不能将 Docker 完成记为 native 完成。
- 复用官方句子切分和 waveform 拼接；需要外层保护时标记分段所有者，避免内外两次插静音或两次调速。

完成标准：每个引擎有准确请求映射、音频元数据、配置缺失原因和 CPU/GPU 参数分支；不把云 API 成功当成本地推理成功。

## 步骤 11：实现共享长文本分块、有限重试与完整拼接

状态：规划完成，待开发。依赖：03、09、10。

参考 Qwen 的 `_split_long_text`、`_generate_chunked` 设计，复用 `audio_utils.py`、`audio_validation.py` 中现有通用能力。五个目标引擎的公共纯算法集中到不依赖 pycore 的 standalone assets 辅助模块（建议 `tts_text_chunking.py`、`tts_audio_assembly.py`，若已有等价文件则扩展）；主进程经服务调用使用结果，避免复制五份算法或让 assets 反向 import pycore。本步骤不要求迁移 Qwen 实现，不改变其现有分块、句子协议或输出行为。下面的长文本要求属于底层能力标准，不将五个引擎开放给句子业务。

执行顺序与契约：

1. 输入保存原文及归一化文本；空字符串/纯空白返回既有输入错误。针对语言选择段落 → 句末标点 → 分句标点 → 空白 → Unicode 安全边界的切分降级顺序。小数、缩写、URL、数字及括号不能任意按每个点切开。
2. 优先使用模型 tokenizer 计算预算，扣除参考文本/音频、控制 token 和必须的生成余量。无 tokenizer 的保护值使用字符单位，并标注为项目保守值；字符数不能冒充 token 数。
3. `chunk_policy` 至少含 owner(native/project)、unit、soft_limit、hard_limit（未知可空）、generation_budget、max_chunks、total_deadline、max_attempts、pause_ms。参数集中配置，并随任务冻结，处理中不被 UI 配置变化影响。
4. 初始项目保护值可采用每块 200 字符、单任务至多 256 块、串行生成、块间 120ms 静音、包括首次在内最多 3 次尝试；这些仅为可调整设计值，不宣称模型极限。token 约束较小时优先服从 token 预算；原生已经拼接的引擎不得再次加入块内静音。
5. 每个块保存 task_id、chunk_index、原文跨度、归一化文本摘要、模型/音色/参考摘要、参数摘要、状态和音频位置。必须覆盖全文且保持顺序；不丢弃超限尾部，不重复拼接参考转写。
6. 一个任务固定 engine/model/language/voice/reference/speed/seed 策略。分块生成期间不能失败后悄悄换音色或引擎；需要切换时整任务重新生成，绝不合成半篇 A 引擎、半篇 B 引擎。
7. 对明确的长度预算耗尽、重复异常或 OOM，允许在剩余重试与期限内缩小当前块重试；拆分后更新原文覆盖和顺序。缺模型、错误音色、无效语言、依赖缺失直接失败，不对确定性错误盲重试。
8. 根据 CPU/GPU profile 分开配置单块及总超时，CPU 默认串行。运行 deadline、HTTP 超时和 worker 租约协调；取消后停止排后续块并释放 lease。原生内部 badcase 重试计入同一预算。
9. 生成结果至少检查非空、可解码、有限值、正确声道/采样率及停止原因；达到生成上限时不得默认视作完整。结构有效只能说明音频文件有效，不能宣称逐字忠实；内容完整性需后续获准的人工听验。
10. 先以 PCM/WAV 统一采样率、声道、样本格式后顺序拼接；必要时复用既有 ffmpeg 转换，不直接连接 MP3 字节。浮点音频处理截幅/NaN；静音按最终采样率计算。调速只作用一次。
11. 长任务分块落盘，使用任务专属 TMP_DIR 子目录，避免累计整个音频占满内存。临时文件名不取未过滤原文；最终文件写入同目标目录临时文件后原子替换，仅完整成功后更新缓存。
12. 任一块失败则整任务失败，不发布残缺最终文件。重试恢复只能复用 engine/model/voice/reference/text/参数指纹一致的块；清理仅限本任务拥有的临时文件，禁止递归清空共享缓存。
13. 返回保留旧字段，并增补实际 `chunk_count`、`chunked`、sample_rate、duration、生成耗时、device、模型标识及失败 chunk。引擎“支持分块”和本次“实际分块”分开表示，不能用 engine 常量代替本次统计。

完成标准：短文本不被不必要拆分；有标点/无标点超长文本都覆盖完整；生成上限、分块失败、取消和重试均不会提交残缺音频；五引擎的重复算法集中维护。

## 步骤 12：将五个引擎接入真实单词任务，保留 Qwen 句子链路

状态：规划完成，待开发。依赖：09–11。

已发现 `laravel_audio_worker_execution.py::_resolve_audio` 的一个分支传 `required_engine=QWEN3TTS_ENGINE`，其他分支使用 `self.REQUIRED_ENGINE` 或自动选择。句子分支的 Qwen 绑定必须保留；本次仅扩展单词分支，不能通过修改公共默认优先级间接改变句子任务。

执行细节：

1. 阅读 `laravel_audio_worker.py`、`laravel_audio_worker_state.py`、`word_tts_auto.py`、`sentence_audio_auto.py`、`word_audio_service.py`，明确单词与句子任务的既有类型/入口。仅在单词路径增加模型选择；句子路径继续 Qwen，不新增句子引擎偏好，不解除 required_engine 的 Qwen 约束。
2. 扩展现有 `engine_registry.py`、`engine_policy.py`、`tts_engine_params.py` 的五个 adapter 注册和参数映射；已存在注册就修改，不重复 append。VoxCPM2 的并发/生命周期信息与新 server 类型同步。
3. 单词引擎选择优先级：单词任务显式 required_engine → 用户持久化的单词引擎偏好 → 单词任务现有默认优先级。显式要求不满足时返回失败原因；只有未显式要求且单词策略允许时才 fallback。五个模型仅进入单词候选集合；句子、短文候选仅 Qwen，不参与单词偏好和 fallback。Qwen 不可用时报告原有失败/待处理状态，不能调用五模型代替。
4. 通用能力筛选检查 installed/config_ready、语言、音色/参考资源、设备、长文本支持及用户启用状态。未加载但可托管启动的服务是候选，不能因为 cold 状态永远被排除。
5. `tts_orchestrator.synthesize`/`synthesize_engine` 复用 lease、adapter 和结果处理机制；引擎候选按业务类型限定，不把单词与句子选择策略合并。业务层不自己实现 HTTP 或 chunk 循环。类型取自已有任务上下文，不能按文本长度或标点猜测用途。
6. 接线场景必须覆盖：用户将单词引擎分别设为 cosyvoice、melotts、fishspeech、voxcpm2、gptsovits 时，各走对应本地服务；相同配置下句子仍走 Qwen。缺参考音频时显示具体问题，单词引擎设置不得影响句子配置。
7. RPC 扩展限定于 `local_word_tts_routes.py` 及 `tts_routes.py` 的单词调用路径；`local_tts_status_routes.py` 可展示底层长文本能力，但业务用途仍标为 word。`local_sentence_audio_routes.py` 保留原有 Qwen 接线和协议。通用入口依据既有业务上下文限制候选，句子不能借显式 engine 参数绕过限制；路由里不实现安装或合成业务。
8. 仅扩展 `word_audio_cache.py` 的 key，纳入 engine、模型 revision、voice/reference 摘要、语言、语速和影响声音的参数；旧缓存保留可读，不能跨模型误命中。`sentence_audio_cache.py` 的键、读取、失效与已有 Qwen 缓存行为保持不变。记录单词实际 engine，不用计划 engine 冒充。
9. worker 上报复用共享投递层 `pycore/pyutils/laravel/delivery_outbox.py`（2026-09-27 起取代 `audio_delivery_outbox.py`）与原有重试/去重机制；生成成功和上传成功分状态。长文本只入队一次完整文件，上传重试复用文件，不重新生成。失败不写成功缓存，不确认任务完成。
10. backend payload 保持现有必需字段，新增信息只在接收端允许处传递；未确认接收契约前不能随意增加服务端必填项。若确需 Laravel 变更，另读 LARAVEL_GUIDE 再作最小改动。
11. 单词 worker 历史优先记录本次 result 的实际分块统计，兼容旧结果缺字段；不借此改写 Qwen 句子历史协议。默认任务并发不能绕过每服务串行和 single-active 约束；新单词服务不得中断在途 Qwen 句子生成。
12. 若现有 UI 引擎列表写死，仅更新单词候选和 i18n；句子选择继续现有 Qwen 行为。底层 capability 中的长文本支持与业务 allowed task types 分开表示，不建设新仪表盘。

完成标准：五个引擎均有“单词设置 → 单词 worker → orchestrator → registry → managed service → native/docker 3.10 运行时 → 完整音频 → outbox”代码接线；其底层具有句子/长文本处理能力。句子、短文生成由 Qwen 独享，既有配置、缓存、路由、调度与交付语义保持不变。

## 步骤 13：接入 pyservice prerequisite、Mode 2 和无桌面启动

状态：规划完成，待开发。依赖：04–12。

修改入口 `pyservice.ps1`、`pyservice.sh`，Linux `prepare_pycore_prerequisites.sh`，Windows 对应 prerequisite 调度段，以及 `pycore/pyutils/common/pyservice_mode.py` / `pycore/pyctl/runtime/pyservice_mode_service.py` 的必要消费逻辑。

1. 按 backend 建立前置：native 需要宿主 Python 3.10/venv，docker 需要 Docker/Compose 及容器内 Python 3.10；Windows docker 还需要所选 WSL provider。无目标引擎启用时不强制下载资源。单引擎 include 和独立安装也要解析其依赖，不能只靠全量 manifest 顺序。
2. 两平台都按“解释器 → 环境 → 依赖/资产 → 服务配置 → 业务调用”排列。step 脚本不相互串调，公共 orchestrator 排序；新脚本编号与 pyservice manifest 依赖次序同时维护。
3. 保留默认主进程 3.13，子服务使用登记的 3.10 venv；不能把 pyservice 整体切到 python310。prerequisite 结果按引擎存储，单个可选引擎失败不能阻塞 heartbeat/RPC/relay。
4. Mode 2 继续 local_ui_enabled=false。headless 判断独立于 mode：Debian 服务器没有可用图形会话时不加载 Qt/tray，不触发 X11、Wayland、DBUS 弹窗或桌面安装；桌面模式存在真实可用会话时才启用既有 tray。
5. 服务 API 的冷启动保持按需加载，不能启动 pyservice 就同时装入五个模型。状态扫描可列未安装/已安装/待配置，不能因扫描触发大模型下载或创建进程。
6. systemd 使用非交互环境：解释器/WorkingDirectory/资源路径明确，缓存和日志目录归服务用户可写；用户 HOME/模型缓存来源与手动启动一致。无需 source 激活、桌面登录或全局 shell 环境。
7. Windows 后台子服务无可见控制台；若使用 Start-Process 按现有规范 WindowStyle Hidden。父进程退出按既有 manager 收束其拥有的服务，不动外部用户服务。
8. 不把 Linux X11/Wayland 限制、winrt OCR、WASAPI 差异塞进 TTS 改动中；可选桌面模块保持平台守卫，避免 import 时阻断服务器 RPC。faster-whisper 的 CUDA12 路线不属于本次五 TTS 安装改造，除共享策略受影响外不顺手改动。

完成标准：Windows、Debian 13 server/desktop 与 Ubuntu 的 Mode 2 均有同一业务能力路径，headless 不以 GUI 就绪作为 TTS/RPC 的前提。

## 步骤 14：统一状态、故障反馈与非破坏迁移

状态：规划完成，待开发。依赖：07–13。

目标文件：现有 `tts_engine_probe.py`、`tts_status.py`、`pycore/pyctl/tts/status_service.py`、环境身份存储与安装结果存储。状态展示通过原有入口返回，不单独新增诊断服务。

1. 将“宿主 3.13 不兼容”改为查询所选基础解释器/venv 的兼容结果。默认主进程的版本单独显示；不能覆盖为子服务版本造成误导。
2. 既有状态枚举优先复用；缺少时补齐 disabled、not_installed、runtime_missing、dependency_conflict、model_missing、config_required、ready、busy、failed 的映射。状态应给出 phase/reason 与下一步操作，不以一个 available=false 丢失原因。
3. 典型消息区分：未装 Python 3.10、已有 3.10 但缺引擎 venv、CPU profile 未准备、GPU 被显式要求但不可用、缺少参考音频、模型架构不匹配、上游服务错误、生成达到预算、上传待重试。
4. runtime/device/model/code identity 变化时失效对应可用性缓存，不能沿用旧成功 TTL；当前正在生成的任务仍用冻结配置，下个任务才切换。
5. 安装结果独立记录每阶段，不记录密钥、完整参考音频内容或敏感正文；日志包含 task_id、engine、device、chunk index/count、耗时与错误类型即可定位。
6. 旧 self-contained 环境可直接复用；旧 overlay 环境不删除，创建新环境并将新路径写入配置；失败保留旧配置可恢复。模型权重和输出缓存不用随解释器迁移重下。
7. 包修复只处理缺失项。检测到不兼容已装包时先明确诊断所需 profile；禁止把 pip uninstall、--force-reinstall、venv --clear 当默认修复动作。需要替换的实际操作由用户明确授权。
8. 全局 Python 命令、原有 Qwen、外部服务 URL、用户引擎偏好和参考音色配置都必须在迁移时保留。新增默认值只填空缺，不能覆盖已保存值。

完成标准：安装、配置、推理和交付失败能分别定位；重新运行不会清掉模型/缓存或改变默认 Python；状态反映真实子服务而非仅反映端口打开。

## 步骤 15：按阶段交付并记录完成证据

状态：规划完成，待开发。依赖：01–14。

普通 AI 执行顺序：01–03 建立依据 → 16 最小操作幂等约束 → 04–07 原生安装与隔离 → 17 安装选择 → 18 Linux Docker 基础 → 08–11 安装器/服务/模型/分块与 19–20 容器/WSL 按依赖交错完成 → 12–14 单词业务/pyservice/状态 → 15 与 21 交付。后加步骤编号用于稳定引用，不表示 Docker 要等所有旧步骤做完才加入；步骤 19 与 09 的 backend 契约应先统一，再分别实现。不得以 demo 代替真实单词接线。

每步完成后立即在本文件追加如下记录，10.1–10.5 也分别记录，不等步骤 10 全部做完：

|记录项|必须填写内容|
|---|---|
|步骤与状态|完成 / 部分完成 / 阻塞，禁止把已规划写成已实现|
|修改文件|实际相对路径及该文件承担的变化|
|公共组件复用|复用了什么，新增内容为何不能由已有组件承担|
|外部依赖|所选上游 revision、模型、Python ABI、CPU/GPU profile；尚未确认项明确写出|
|接口影响|输入、返回、配置键、缓存、状态及旧调用兼容性|
|当前证据|仅源码阅读/已获准的实际运行；未运行写“未运行”|
|下一步|具体剩余任务，不写笼统“继续优化”|

以下为用户另行要求运行时的人工验收条件，不创建自动化测试文件，不自行执行：

|场景|预期结果与应保存的证据|
|---|---|
|Windows 默认与 3.10 并存|默认命令仍为原 Python；python310/pip310 归属一致；带空格目录和非交互启动可用|
|Debian 13 服务器 CPU|无 DISPLAY/DBUS/GPU，Mode 2 的 heartbeat/RPC/relay 可用；各已支持并配置的目标 TTS 使用 CPU，记录尚不支持的具体版本/组件|
|Debian 13 桌面 GPU|按引擎 profile 加载，实际 device 与状态一致；不要求各 venv 全部 cu130；UI/tray 不影响 TTS|
|Ubuntu / Kali 通用链|路径、权限、包映射遵循该发行版，不借用 Debian/Ubuntu 不兼容的软件源；未运行平台标明未验收|
|五引擎逐项真实任务|各自至少一个配置完整的单词任务，经单词 worker 输出最终音频并进入既有交付链；本地 Fish Speech 不依赖云 key|
|Qwen 句子链路保留|切换五个单词引擎、单词引擎失败或缺资源时，句子仍由原 Qwen 路径处理；句子缓存、RPC、交付和在途生成不受修改影响|
|底层长文本与无标点段|获准后直接验收五个服务类库的中英/支持语言长文本能力，不接入句子业务；分块完整有序，人工听验开头/边界/结尾，不能用文件存在证明内容完整|
|音色与参考一致性|同任务每块使用同一模型/参考；不同音色、模型 revision、语速不误命中缓存|
|超时、取消、块失败|无残缺成功文件、无成功上报、lease 最终释放；任务级预算内停止重试|
|缺模型/音色/语言|报告准确原因，不暗中切云端或 Qwen；其他服务保持可用|
|重复安装与已有环境|补缺项，不升级现存包、不重下完整模型、不删除旧环境；默认 Python 和入口不改变|
|服务归属与并发|自有服务冷启动一次，忙时不停止，空闲按策略释放；外部服务不被停止，端口冲突不误杀进程|
|上传失败与恢复|最终音频保留，outbox 重试交付且不重复生成；实际 provider/model/chunk 信息一致|

无需运行即可在代码阅读中逐项对照的交付清单：

- [ ] 五个旧安装入口完成指定改名，活跃引用、菜单键迁移和远程清单一致。
- [ ] 新 Windows Step13 与 Linux 14 独立安装 3.10，保留默认 Python，命令独立且路径明确。
- [ ] 五个引擎 native 分支均 self-contained，docker 分支具有独立容器环境；环境创建不错误使用宿主 sys.executable。
- [ ] 十个安装脚本走公共策略，CPU/GPU 分支、opt-in 和缺项修复齐全。
- [ ] 五个服务类库升级完成，VoxCPM2 不再在默认进程加载模型，Fish Speech 有实际本地推理路径。
- [ ] 长文本不截断，分块/音频拼接/预算/取消/缓存结果完整。
- [ ] 五模型仅接入单词任务、单词 RPC 和交付链；底层按句子长文规范开发，句子、短文由 Qwen 独享，既有缓存、接口和交付保持不变。
- [ ] pyservice Mode 2、headless 与 systemd 路径不依赖交互激活或桌面会话。
- [ ] 可用性、模型已加载、真实分块、设备与交付状态分别表达。
- [ ] 所有步骤及时追加记录；没有擅自运行 Git、安装、构建、测试、服务或验证。

规划交付范围：本文件扩展为 21 步，步骤 10 含 5 个逐引擎子步骤；新增 16–21 覆盖最小操作幂等、安装选择、Docker/Compose、WSL 和对应验收。源码事实来自本地静态阅读，官方证据链接就近列于相应条目。尚未做实际安装/推理，运行兼容性与音频质量未验收。后续开发开始前需要把 main 链接对应到实际选用 revision；未证实的上限与环境支持不能自动升级为“已支持”。

### 需求修订记录：五模型仅用于单词业务

已按用户最新要求同步修订需求边界、业务改动地图、步骤 11–12、人工验收和交付清单。五个模型保留句子/长文本级底层实现标准；不接管现有 Qwen 句子生成。本次仅修改规划文档，未修改业务源码，未运行安装、测试、服务或验证命令。

## 步骤 16：将幂等性落实到每个最小操作

状态：规划完成，待开发。依赖：01–03；必须在 04–14 的具体开发前应用，不能放到最后补做。

定义：任一操作在相同输入下重复执行，不增加重复资源、不重复改写配置、不重复下载/构建、不重复启动/生成/上传；在任意中断点恢复，只处理缺失的该项及其必要后续。总入口去重、全局 done 文件或“已装 Docker/模型”标记都不能代替子操作幂等。

每个 helper/安装动作在设计记录中列清：资源身份、期望状态、已有状态读取位置、最小变更、提交点、中断恢复、并发所有权。检测由负责该资源的组件执行；不要在每个调用者外层重复检查脚本路径。返回值使用现有结构化结果/文件存储，不用退出码编码路径、版本或业务状态。

|最小操作|独立幂等要求|
|---|---|
|目录与权限|存在且权限满足时不改；只补本组件目录及必要权限，不递归重设共享目录所有权|
|下载与解压|以来源 revision/摘要识别资源，完整文件复用；未完成文件使用独立临时名；逐文件补缺，不能仅凭目标目录存在跳过|
|Python、pip 与链接|分别判断二进制、pip、每个别名；缺 pip 不重装 Python；缺 pip310 不重建全部链接；用户冲突入口不覆盖|
|venv 与包|解释器身份、venv 配置、每个包分别处理；存在 venv 不等于依赖完整；缺一个包不清空或重建环境|
|模型与语言资产|每份权重、codec、词典、tokenizer 独立补齐；不因一个 .deps_done 跳过缺件；不重复拉取已有完整资源|
|配置键、APT 源与 keyring|键值或内容相同则不写；文件先准备再原子提交；同源不重复追加，不覆盖不归本项目管理的配置|
|Docker Engine/CLI/Buildx/Compose|四类组件分别补缺；已有 Engine 但缺 Compose 只补 Compose；不在重复运行时无条件升级|
|daemon 配置与服务|只合并本次所需键，内容没变不重启；已启动不重复 start，已 enabled 不反复 enable；启用意图与实际服务就绪分开|
|镜像、网络、卷、容器|稳定 engine/backend/profile 身份与所有权标签；同 digest 不重拉/重建；逐个补缺，不用 compose down/up 重建整个栈|
|WSL 功能与发行版|功能、内核、目标发行版、WSL2、systemd 配置分别补缺；不重复 import、不重设所有发行版、不全局 shutdown|
|安装选项与计时|已保存有效方式直接复用；仅首次选择或显式修改显示一次倒计时；中断恢复不得重复弹窗并覆盖原选择|
|生成与分块|同 task_id + 输入/参数指纹复用已完成结果；每块有独立身份和提交记录；部分失败不重新生成所有成功块|
|音频发布与上传|原子发布一次最终文件；outbox 同任务唯一身份，重试不得重复确认或重复新增后端记录|

并发处理：两个入口同时安装同模型/同 Docker 组件时复用项目已有跨进程协调机制；若缺少，抽取文件型所有权辅助组件，具有 owner 身份、完成后释放与过期恢复。单纯“先判断再创建”不能防止竞争。Python 主进程仍遵守 THREAD_BUS 规则，不增加被禁止的线程锁。APT 并发交给包管理器锁和有界等待，不删系统锁文件。

生成/上传不能凭本地标记保证跨网络绝对 exactly-once：沿用已有后端幂等键/任务确认契约；若接收端缺去重支持，明确记录这个边界，不把重试成功等同绝对无重复。

完成标准：后续每一步的每个资源都能独立判断和补缺；本地文件状态与远端状态不一致时可恢复；再次执行实际无变化的操作不产生写入、下载、重启或业务副作用。

## 步骤 17：模型安装方式选择与 20 秒默认选择

状态：规划完成，待开发。依赖：03、16；在步骤 08 安装包或下载模型前执行。

1. 在十个模型安装脚本的公共安装 helper 中加入 backend 选择；各脚本调用同一选择能力，但分别保存每个引擎选择，不能以一个全局 backend 强行覆盖所有模型。策略字段为 engine/platform 下的 supported_backends、recommended_backend、recommendation_source/revision、default_backend。
2. 选项至少为 Native 与 Docker；只有具备实际实现的方式才可选。已确认的 MeloTTS Windows 官方 Docker 推荐必须显示英文说明及来源；Linux 原生仍可选。其他引擎依据其所选 revision 的官方说明展示，不将“有 Dockerfile”误称“官方推荐 Docker”。缺少官方容器时，本项目维护的 Dockerfile 要标明 project-managed。
3. 首次默认值：该平台官方明确推荐且本计划实现的方式优先，否则 native；已保存的有效方式优先复用，不再次倒计时。MeloTTS Windows 首次默认 Docker。选择 Docker 是实际安装分支，不止打印一段命令或推荐文字。
4. 首次交互显示引擎、平台、两种方式、推荐理由、当前默认及 20 秒倒计时。Enter 立即确认当前选择；方向键/数字可切换；B/Q 明确取消，不写选择。20 秒从显示开始按单调时钟计算，到期提交当前显示的默认/高亮项；切换立即更新提示，不存在“屏幕显示 native、实际提交 docker”。
5. 无 TTY 时显式持久化配置优先；未配置则打印默认方式并按同一 20 秒期限自动选择，不无限阻塞、不错误读取消费上层菜单输入。选择结果返回后才运行安装；不得在倒计时尚未结束时预装 Docker。
6. PowerShell 复用既有菜单/超时工具，Bash 复用 common 菜单输入机制；若缺能力，分别加一个通用 timed-choice helper。参数和值写文件存储，脚本间不依赖临时环境变量或返回码传选项。
7. 保存 `TTS_<ENGINE>_INSTALL_METHOD=native|docker`（已存在等价键则复用）、选择来源 explicit/timeout_default、选用 backend 配置版本。重复运行直接进入已选方式；需要改方式由显式菜单动作触发，保留旧环境/卷与缓存，不自动卸载另一方式。
8. 原生方式继续步骤 05–10。Docker 方式执行步骤 18–20，模型 Python 3.10 和依赖装在容器内，不为该模型额外创建宿主 venv；独立 python310 安装菜单仍保留。镜像内 Python ABI 与模型依赖同样明确，不能将 latest 基础镜像默认为 3.10。
9. Docker 初始化失败不自动偷偷改 native，也不退回云端；保存原选择、具体失败阶段与可恢复状态。若需重启 Windows/WSL，记录 pending 并退出该模型安装分支，恢复后不用重新选择。

完成标准：可选、可超时默认、可取消、可恢复；每个模型独立记忆，安装结果包含实际 backend。20 秒机制只覆盖安装方式选择，不授权自动删卷、迁移已有 Docker 或重启其他业务。

## 步骤 18：Linux 菜单联动与 Docker / Compose 安装现代化

状态：规划完成，待开发。依赖：16、17；在模型 Docker 分支准备镜像前执行。

已定位：`scripts/shells/linux/common/selector_common.sh` 的 MENU_CONFIG 定义 `[^] Start Docker After Installation|START_DOCKER`，使用 `gvar_common.sh` 文件存储。涉及安装脚本为 `79_install_docker.sh`、`81_set_docker_daemon.sh`、`83_docker-compose-finish.sh`、`99_generate_docker_compose_yml.sh`。79 当前有无条件删除 docker.list、snap 安装、false 时停止/杀进程以及过早写 AVAILABLE=true 的逻辑；这些必须逐项修正。

1. 模型确认 Docker 后，立即在当前 `GLOBAL_VAR_DIR`（用户示例 `/var/_core_node/global_var`）用 `set_var` 写 `START_DOCKER=true`。同时记录需要 Docker 的引擎集合及触发来源，集合去重。不是只改当前 shell 变量，也不新建与菜单无关的第二个 enable 键。
2. 原值 false 时打印英文说明，明确模型选择使 Docker 开启；这是用户已要求的自动联动，不再次询问。菜单返回后从存储刷新为 true；模式切换初始化默认值不能覆盖此持久化选择。安装失败保留启用意图，但 DOCKER_AVAILABLE/ENABLED 依据实际状态更新。
3. 模型安装器调用公共 prerequisite 调度接口，由该接口实际调用 79 及必要配置动作，模型 step 不直接相互调用 numbered steps。用户单独运行任意模型安装脚本也必须走此接口；不能以 79 已在全量安装中跳过为由只提示重跑菜单。调度接口只编排，79 内每个操作仍独立幂等。
4. 79 改为官方 APT stable 仓库路线，按 `/etc/os-release` 的 ID、VERSION_CODENAME（Ubuntu 派生时核对 UBUNTU_CODENAME）及 dpkg 架构选择地址。Debian/Ubuntu 分别用各自仓库，不硬编码旧 Debian/Ubuntu 代号，不盲用 lsb_release 输出作为 Kali suite。
5. 按官方文档处理支持范围：[Debian](https://docs.docker.com/engine/install/debian/) 当前列出 13/trixie 与 12/bookworm；[Ubuntu](https://docs.docker.com/engine/install/ubuntu/) 当前列出 26.04、24.04、22.04。实施时按最新官方支持列表与仓库元数据更新；新版本需有实际仓库，不能把未知发行版偷偷映射为旧版。Kali 明确记录其 Debian 基线和支持级别。
6. keyring 与 signed-by 的 deb822 source 分别补缺/按内容收敛。不再无条件删除 docker.list；已等价的用户源复用，冲突源报告所有者与冲突，不擅自删除。包来源冲突也不能照抄官方卸载命令自动清除用户 containerd/runc。
7. 安装组件分别为 docker-ce、docker-ce-cli、containerd.io、docker-buildx-plugin、docker-compose-plugin。新安装取该发行版官方 stable 最新可用版本并记录实际版本；重复 ensure 仅补缺。新增显式 update 动作用于用户要求更新时升级，不能将“支持最新版本”实现成每次模型安装都升级宿主引擎。
8. Compose 统一使用 `docker compose` 插件接口，不写死 v1/v2 或某个主版本号。按 [官方 Compose 安装说明](https://docs.docker.com/compose/install/linux/) 从仓库安装插件；兼容逻辑以实际所需功能为准，旧 `docker-compose` 仅在有确切旧调用者时提供非覆盖型转发。不能因旧命令不存在就重复安装 Docker。
9. 81 及 `scripts/shells/scripts/update_docker_dns_mirror.js` 只合并本项目需要的 daemon JSON 键，保留已有 runtime、data-root、代理、镜像源；内容不变不重启。有变更需重启才能生效时记录 pending，与正在运行的容器协调，不为一个模型强行重启所有容器。
10. START_DOCKER=false 的普通安装分支只跳过，不停止用户已有 Docker，更不 pkill dockerd/containerd。模型选择 Docker 则先强制写 true，再按需启动/启用 daemon。权限不足、socket 不可访问或 daemon 尚未就绪不能标成功，禁止 chmod 666 socket。
11. APT 源、metadata、包、daemon enable、daemon start、Compose 插件、权限各有独立处理结果；输出复用状态字段和明确失败阶段，不靠 docker 命令存在宣称 Engine/Compose 均可用。

完成标准：菜单开关和模型选择使用同一持久化事实；选 Docker 必须真正补齐 Engine 与 Compose；最新受支持 Debian/Ubuntu 从正确 stable 仓库安装，重复调用不破坏其他服务。

## 步骤 19：模型 Docker 分支、Compose 生成与服务生命周期

状态：规划完成，待开发。依赖：09–11、16–18。

改动范围：十个模型安装器的 Docker 分支、现有 TtsInstallAssetsCommon、`scripts/shells/docker_compose` 下模型资产、`scripts/shells/scripts/docker-compose-selector.js` 与现有 Compose 模板/生成工具；按调用链更新 83、99 及 `scripts/shells/linux/rebuild_docker_compose.sh`。不要把 TTS 部署绑到旧 `/usr/local/.pcore_local/deploy` 的 MySQL/宝塔密码文件或旧 main.py 安装入口。

1. 每个可选 Docker 模型提供真实镜像来源或 Dockerfile + Compose 服务定义，明确模型 revision、Python ABI、依赖 profile、CPU/GPU 变体、API 入口。复用官方 Dockerfile/镜像；没有现成镜像时项目构建配方有固定来源与摘要，不假造镜像名称。
2. Dockerfile 使用绝对 Python 安装命令和分层缓存，依赖层与权重层分离；权重挂持久卷或受管缓存目录，不因应用镜像更新重复打包下载。MeloTTS 的官方 Docker 推荐作为初始落地对象，其余可选 Docker 分支按相同接口逐一完成。
3. 项目名按项目实例+引擎稳定生成；service/volume/network 使用明确命名和所有权标签。镜像首次安装解析固定 digest，后续复用；显式更新才重新解析最新候选并记录新 digest。禁止每次运行 pull latest、build --no-cache、force-recreate、down -v 或 prune。
4. 每个引擎单独 Compose 项目或明确隔离的受管服务集合，不能 `up` 全量服务器栈。83/99 拆出可复用的非交互生成函数：服务定义、路径与已保存选择作为输入，生成内容相同不写文件；模型安装不唤起无关 MySQL/Redis 选择菜单。
5. Compose 使用当前 Compose Specification，移除本项目模板中依赖旧格式 version 字段的判断；支持 service、healthcheck、volumes、ports、profiles 等实际需要的功能。旧用户 compose 文件保持原样，不通过“更新”覆盖用户服务配置。
6. CPU 服务不声明 GPU 设备、不依赖 NVIDIA runtime。GPU 服务依据 [NVIDIA Container Toolkit 官方安装说明](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html) 补宿主容器支持，并采用当前 Compose 支持的设备声明。宿主有 GPU 不等于容器可见 GPU；显式 cuda 不可用需报错，auto 可按已保存策略选择 CPU 变体。
7. 模型容器只挂所需权重、参考、输出/临时目录；默认不挂 Docker socket、不 privileged、不挂整个宿主根目录。端口发布到宿主 loopback，沿用 RPC/relay 对外入口。容器内部绝对路径通过资源映射生成，不直接传 Windows 文件路径。
8. health 区分进程、模型配置及可生成状态；安装器完成镜像/卷/配置准备后不强制常驻加载五个模型。托管 start 时只启动选定服务；停止只停止该引擎自有容器，不停止宿主 daemon，也不清理持久卷。
9. `tts_service_manager.py` 的 ServiceSpec 增加 backend 标识，native 用现有子进程控制，docker 用现有管理框架的容器控制适配；两者共享 lease、busy protection、single-active、idle shutdown 和统一 HTTP client，不能另建平行生命周期系统。
10. 容器 restart policy 必须服从托管 idle stop，不能 manager 停止后又被自动拉起。配置改变时 busy 服务延后应用，空闲时仅替换项目自有实例且保留卷；同名非本项目容器报告冲突，不删除。
11. 运行时不得安装 Docker、build/pull 镜像或下载模型；所需准备缺失时返回安装阶段状态。已有 running 容器身份符合时复用，只有单个资产缺失时由安装链修复该资产。
12. 重构 rebuild_docker_compose.sh 使其使用相同生成/应用函数与文件存储，不再自动触发整个旧部署流程；“rebuild”动作不能默认删资源。同步改活跃的 `docker-compose` 调用为插件命令，必要旧调用走公共兼容函数，不全仓库重写历史资料。

完成标准：native/docker 对调用方具有相同单词生成 API、状态与长文本底层能力；Compose 生成/镜像/卷/容器每项独立幂等；句子、短文只走现有 Qwen，模型 Docker 部署不启动其他服务器组件。

## 步骤 20：Windows Docker 与现有 WSL 安装链关联

状态：规划完成，待开发。依赖：05、16–19。

必须复用 `Step29_InstallWSL.ps1`、`Step30_InstallWSLDebian13.ps1`、`postinstall/WSLUpgradeProcessor.ps1`、`menu_itemshells/WSLDebianManager.ps1` 与 GlobalVars。新增最小公共 Docker/WSL bridge 放 `scripts/shells/win/win_common` 并登记安装资源清单；模型脚本从公共 prerequisite 调度调用，而非复制 WSL 安装逻辑。

1. Windows native 分支继续原生 3.10；docker 分支运行 Linux 容器。保存 Docker provider、目标 WSL distro、用户、Compose 路径、项目目录与 endpoint，不能只保存 docker=true 后依赖用户的默认 Docker context。
2. provider 优先复用已配置且可用的 Docker Desktop WSL2 或受管 WSL Engine；两者都不存在时本项目默认 `wsl_engine`，复用 Debian 13 发行版并在其中调用 Linux 安装链。可在配置中明确选择 `desktop_wsl2`；两种 provider 不在同一发行版自动混装。
3. [Docker 官方 WSL2 说明](https://docs.docker.com/desktop/features/wsl/) 提醒 Desktop 与发行版内直接安装的 Engine/CLI 存在冲突。检测到用户已有另一 provider 时复用其上下文或明确报告冲突，不能自动卸载。Desktop 分支使用当前官方 Windows 安装渠道及 WSL2 backend，不执行发行版内 79 去另装第二个 daemon。
4. 缺 WSL 功能时由调度触发 Step29 的目标化补缺，再触发 Step30 准备目标 Debian。已有目标 distro 不重导入、不更改默认发行版、不把所有用户 distro 升级为 WSL2。改造既有 Step29 中对全部发行版改 root/全局 shutdown 的路径，使 Docker 依赖调用只处理登记目标。
5. wsl_engine 分支在指定发行版内合并 `/etc/wsl.conf` 的 systemd 配置，依据 [Microsoft systemd 文档](https://learn.microsoft.com/en-us/windows/wsl/systemd) 启用服务能力；保留已有 user/network/automount 等节。内容已正确则不写、不重启。
6. Windows feature/WSL kernel/distro 配置需要重新启动才能生效时，复用 WSLUpgradeProcessor 写精确 pending 阶段和模型安装选择；不得假定重启已完成。禁止模型安装自动全局 `wsl --shutdown` 或重启 Windows；仅获准后重启所需目标，随后恢复未完成动作。
7. 在 wsl_engine 目标内写其 GLOBAL_VAR_DIR 的 START_DOCKER=true，再调用步骤 18 公共调度，实际运行 79 的 APT 安装路径。Windows 只桥接到相同逻辑，不再维护第二套 Debian/Ubuntu Docker 包安装实现。
8. Desktop provider 同样在 Windows 存储和所选 WSL 的菜单状态中记录启用意图，但 Linux backend provider 标记为 external/desktop；调度复用其 daemon/CLI 集成，不安装或启动第二个 dockerd。provider-aware 状态展示必须避免把外部 daemon 误当 Linux systemd 未启动。
9. 所有 Windows 路径先解析为绝对路径，通过 WSL 路径转换得到目标内路径；使用参数数组/结构化配置调用 `wsl.exe --distribution <name> --user <user> --exec ...`，不将模型文本、路径或密钥拼入 bash -c 命令。大模型缓存优先放 WSL Linux 文件系统，输出通过明确共享目录或 HTTP 音频返回 Windows。
10. Windows pyservice 仍运行默认 Python，HTTP client 调用已登记容器 endpoint；TCP 可达性按实际 WSL 网络模式处理，不能硬编码动态 WSL IP。daemon 控制经指定 provider，不向公网暴露 Docker TCP API。端口冲突和 localhost 转发不可用返回具体原因。
11. GPU 分支区分 Windows WSL GPU 支持、目标 WSL 可见设备和容器 GPU runtime；不能在 WSL 中安装 Linux 宿主 NVIDIA 内核驱动。无 GPU 时同镜像策略提供 CPU 分支；native CPU 与 Docker CPU 的状态明确区分。
12. 后台 helper 无可见窗口；停止模型只处理其容器，不关闭 Docker Desktop、整个 distro 或用户其他服务。重复进入安装时逐项补 WSL/发行版/daemon/Compose/模型资源，跳过已完成配置及 20 秒选择。

完成标准：Windows 模型 Docker 方式有实际可调用容器，并与既有 WSL 脚本及恢复流程相连；无双 daemon、无全局 WSL 重置、无默认 Python 变更；单词调用与 Qwen 句子/短文严格隔离。

## 步骤 21：新增要求的交付矩阵与逐项记录

状态：规划完成，待开发。依赖：16–20 及原有各步。

开发时每完成一个小操作，立即在所属步骤追加资源身份、已实现的幂等条件、补缺行为及未覆盖边界；不可等整套 Docker/WSL 做完才追加。“调用公共 ensure”本身不能作为该操作幂等完成证据。

|交付项|代码必须落实的行为|后续获准运行时的观察条件|
|---|---|---|
|句子、短文独享|用途判定来自既有任务类型；两类只选 Qwen，native/docker 五模型只选单词|切换任一单词 backend 后句子/短文仍由 Qwen；Qwen 不可用也不跨模型 fallback|
|20 秒选择|首次显示明确默认和倒计时；Enter/切换/取消；有配置不重复询问|超时按显示项保存；提前确认立即继续；取消不安装；无 TTY 不挂起|
|推荐与选择|MeloTTS Windows 显示官方 Docker 推荐；安装方式可独立持久化|默认进入 Docker 真正安装分支；手选 native 保留该选择|
|Linux 强制开启|模型选择 Docker 先写 START_DOCKER=true，再实际调用 79 安装链|原为 false 时菜单刷新 true；独立运行模型 step 同样补齐 Docker|
|平台版本|按实际 Debian/Ubuntu codename 与官方 stable 元数据装包|Debian 13、Ubuntu 当前支持版本使用正确源，不再固定旧发行版/旧 Compose|
|Engine/Compose 分离|组件分别补缺，已有 Engine 不掩盖缺 Compose|只移除/缺失一个受管组件的受控场景下，只补该项；不重复安装全部组件|
|daemon 幂等|JSON 内容合并、相同不写/不重启；不强杀进程|第二次运行无 daemon 重启、无现有容器中断|
|镜像/卷/配置|digest、资源标签和配置指纹独立保存|重复运行不 pull/build、不重建卷/容器、不覆盖用户 compose|
|中断恢复|每个下载/包/资源有独立提交点，失败不提交整体 ready|从明确中断阶段续作，已完整资源不重做|
|Windows WSL|只处理选定 distro/provider；pending 可恢复|已有 distro 不重装，已有 Desktop 不另装 daemon，需重启时不假报完成|
|CPU/GPU|两 backend 各自明确设备与依赖，不借宿主状态宣称容器 GPU 可用|无 GPU 可用 CPU；显式 cuda 失败准确报告；Qwen 不被切换影响|
|细粒度业务幂等|任务/块/最终文件/outbox 独立身份，复用既有远端去重契约|重复请求不重复生成/提交；网络结果未知按契约恢复而非盲确认|

额外交付清单：

- [ ] 每个小操作的幂等条件已写入对应实施记录，非仅总入口检查。
- [ ] 五模型安装方式可选，20 秒默认机制和持久化选择一致。
- [ ] 所有提供 Docker 选项的引擎都有真实容器配方和服务适配，非仅提示。
- [ ] Linux 菜单键、当前 GLOBAL_VAR_DIR 与模型强制启用为同一存储事实。
- [ ] Docker/Compose 安装、配置、生成和活跃调用支持官方当前稳定接口与发行版。
- [ ] Windows 已与现有 WSL、Debian 和重启恢复脚本接线。
- [ ] 句子、短文 Qwen 独享；五模型仅单词，底层长文本能力保留。
- [ ] 未擅自运行安装、构建、测试、服务或验证；实际运行证据缺失时写“未运行”。

本轮规划修订记录：新增步骤 16–21，并同步修改旧步骤中的原生专属假设、MeloTTS Docker 描述、业务范围、依赖顺序及交付范围。只更新本计划，未修改安装脚本或业务代码；Docker/Compose/WSL 的官方文档已只读查阅，尚未执行部署或运行验收。

---

## 步骤 16-20 实现记录（2026-09-17）

> 详细进度与逐项演算见 `docs_fix/TTS_DOCKER_INSTALL_METHOD_DEVELOPMENT_PROGRESS.md`。
> 本轮未运行任何安装流程；验证仅限静态语法/解析与 import 冒烟。

- **步骤 16（逐细节幂等）**：已实现。新增 `linux/common/install_method_common.sh`、`linux/common/docker_prereq_common.sh`、`win/win_common/InstallMethodCommon.ps1`、`win/win_common/DockerWslBridge.ps1`；重写 `79_install_docker.sh` 为官方 deb822 APT 逐组件幂等（keyring/源/apt update/五个包/daemon enable/start/compose 探测各自独立收敛）；删除旧版 snap 路径、pkill、docker.list 无条件删除与 START_DOCKER=false 时停 daemon 行为。
- **步骤 17（20 秒可选安装方式）**：已实现。五引擎 × 双平台接入统一选择块；MeloTTS Windows 默认 docker（官方 install.md 依据）；voxcpm2 无官方容器证据 → native 单选项快速路径；状态键 `TTS_<ENG>_INSTALL_METHOD{,_SOURCE,_BACKENDS}`、`TTS_<ENG>_BACKEND` 逐键内容比较后写入。
- **步骤 18（START_DOCKER 联动 + 链式调度）**：已实现。`docker_prereq_ensure_for_engine` 为模型侧唯一接口；`ensure_docker_for_tts.sh` 为无编号统一入口；`docker-compose-selector.js`/`docker-compose-synology.yml` 剔除废弃 version 字段；Docker 官方仓库实测支持 debian trixie/bookworm 与 ubuntu resolute..jammy（compose-plugin 5.5.1）。
- **步骤 19（逐引擎 compose 服务资产）**：**未实施（诚实 pending）**。docker 分支目前收敛 Docker 平台并写 backend 状态，安装脚本明确打印 compose 资产 pending，不谎报模型就绪；83/99/rebuild 共享 generate/apply 重构随之顺延。
- **步骤 20（Windows WSL 桥）**：已实现。`DockerWslBridge.ps1` 提供 desktop_wsl2/wsl_engine 双提供者；wsl_engine 经 `wslpath` + `wsl.exe --exec` 参数数组调用同一 Linux 链并强制 START_DOCKER；Step30 缺失发行版时调度，Step29（需重启）有意仅报告不自动触发。
- **句子 Qwen 独占（业务契约）**：已实现。`engine_policy.py` 新增 `_SENTENCE_PINNED_TTS`，`configured_tts_priority("sentence")` 仅返回 qwen3tts；import 冒烟验证三链正确；词语链既有 `_WORD_EXCLUDED` 未改。
- **验证**：9 bash `bash -n` OK；7 PS AST 解析 OK；`node --check` OK；`py_compile` OK；安装端到端 **未运行**。

---

## 步骤 02/03/07/08/09/10/11/12/13 实现记录（2026-09-17 第三轮）

> 前两轮记录见步骤 16-20 实现记录与 `docs_fix/TTS_DOCKER_INSTALL_METHOD_DEVELOPMENT_PROGRESS.md`。
> 注意：02/03/07 的记录此前因写入标记错误未落盘，本节补齐。本轮验证为静态语法/解析与逻辑冒烟；**未运行真实安装、venv 创建或推理**。

### 步骤 02 — 完成（前序轮次）

- `scripts/shells/ai_runtime_policy.env` 新增 `AI_PYTHON310_VERSION='3.10'`；`runtime_abi.py` 新增 `PYTHON310_VERSION`、`ISOLATION_MODE_OVERLAY/SELF_CONTAINED`。
- `runtime_policy.py::resolve_engine_base_python(engine)`：引擎 override `<ENGINE>_PYTHON` → 已注册 3.10（env/pygvar/`python310` 链接）→ 报告缺失，**永不回落宿主 3.13**。
- `win_common/GlobalVars.ps1` 注册 `PYTHON310_*` 全局变量；不复写默认 `PYTHON_EXE_PATH`。

### 步骤 03 — 完成（前序轮次）

- 五引擎 spec：`isolated=True`、`isolation_mode=self_contained`、`python_recommended=3.10`、`device_policy=auto`、`upstream`/`limits` 证据落码；qwen3tts 显式 `overlay` 不变。新字段进入 `engine_fingerprint`。

### 步骤 07 — 完成（前序轮次）

- `isolated_venv_runtime.py`：`venv_dir(engine, version_tag)`、`_find_existing_venv_python`（跨 ABI 扫描）、`_engine_venv_dir`、`resolve_python` self_contained 分支、`_subprocess_env(clean=)`（剥 PYTHONPATH/PYTHONHOME + PYTHONNOUSERSITE，仅 self_contained venv 子进程）、`_create_venv(base_python, target)`、基身份 stamp/指纹。
- `isolated_venv.py`：`_ensure_venv_self_contained`（解析基→兼容窗口→按基 tag 建 venv→基身份比对阻断→`_install_into(self_contained=True)` 跳过共享覆盖移除与共享约束）。

### 步骤 04/05/06 — 完成（前序轮次，本轮核实代码）

- `Step8_InstallPython.ps1`→`Step8_InstallDefaultPython.ps1`；Linux `13_install_default_python.sh`、`15_install_default_python_prereq_packages.sh`、`19_install_default_pipx.sh`、`21_install_default_poetry.sh` 均已改名在库。
- 新增 `Step13_InstallPython310.ps1`（winget `Python.Python.3.10`，写 GlobalVar + pygvar `PYTHON310_EXE_PATH`，python310.cmd/pip310.cmd 独立入口）与 `14_install_python310.sh`（独立 prefix + `make altinstall` 语义 + `/usr/local/bin/python310|pip310` 链接 + set_var 登记）。引用（InstallerScriptsList、WinScriptsInstaller、AppInstallMenu、pyservice.ps1 提示）已同步。

### 步骤 08 — 完成（本轮）

- **政策层**：`runtime_policy.py` 五引擎 spec 新增 `torch_packages`（cosyvoice/gptsovits: torch+torchaudio；melotts/voxcpm2: torch；fishspeech 桥接范围不带 torch，health_imports 去掉 `import torch` 并注明本地推理托管为待办）；`engine_spec()` 归一化该字段；新增 `base_interpreter_compatibility()` + CLI `base-compatibility`（解析基解释器并探测其版本，宿主 3.13 不再误杀 3.10-3.12 窗口引擎）。
- **venv 层**：`isolated_venv.py` 新增 `_torch_stack_target()`（`<ENGINE>_DEVICE=cpu` 显式优先 → cpu index；`cuda*` → 已配置 CUDA tier 索引；auto → 宿主 torch 探测）与 `_install_torch_stack()`（先于引擎包装入 venv，设备感知 index：CPU 用官方 cpu index，CUDA 用 `TORCH_INDEX_BASE/<tag>`）；`_ensure_venv_self_contained` 在 `_install_into` 前调用。修复 `_install_package_steps` 把 `-r <file>` 拆成两次 pip 调用的缺陷（选项与路径现在成组）。
- **兼容门**：`TtsCompatibilityCommon.ps1::Test-TtsEngineCompatible` 与 `tts_install_assets_common.sh::tts_engine_compatible` 的 isolated 回落从“仅 `<ENGINE>_PYTHON` override”改为 `base-compatibility`（override → 注册 3.10）。
- **十个安装器**：Step52/56/58 与 133/143/147 的依赖段从“主解释器 pip”改为 `Invoke-IsolatedTtsVenvEnsure` / `tts_provision_isolated_venv`（linux 助手扩展为可传显式 pip 包列表，cosyvoice 传 `-r requirements.txt`）；完成探针去掉主解释器 import 检查（voxcpm/fishaudio 不再入主环境）；就绪捷径增加 venv provisioned 条件；fishspeech 安装器同步 `tts_text_chunking.py` 到 staging。Step54/55/137/139 清扫“--system-site-packages 复用宿主 torch”的过期注释，移除对主/基解释器的 `Install-PycoreTorchStack`/`install_pycore_torch_stack` 调用（torch 由 venv 自带）。
- **验证**：6 个 PS AST 解析 OK（含 TtsCompatibilityCommon）；5 个 sh `bash -n` OK（含 tts_install_assets_common）；runtime_policy/isolated_venv `py_compile` OK；`base-compatibility` CLI 在无 3.10 时正确报 `python310_not_registered`。未运行真实安装。

### 步骤 09/10 — 完成（本轮，服务层）

- **VoxCPM2 model→server**：新增 `pycore/tts_install_assets/voxcpm2_api_server.py`（FastAPI；`/health` `/load` `/synthesize`；模型常驻一次加载；服务端 `generate_chunked` 分段：拆分→逐块原生 generate→校验→按序拼接；prompt_wav/prompt_text/cfg/timesteps 可透传；恒出 PCM16 WAV）；`voxcpm2_engine.py` 重写为 stdlib urllib HTTP 客户端（镜像 melotts_engine；mp3 目标在主进程经 `audio_utils.wav_to_mp3` 转换）；`engine_registry.py` 改 `managed_kind="server"` + health_paths + availability_signal；`tts_service_manager.py` 新增 `_voxcpm2_start_command`（venv 解析、资产直启、VOXCPM2_* 透传、模型 id 解析）、`_server_scripts` 代码身份三文件；`network_constants.py` 新增 `VOXCPM2_HTTP_PORT=57214`/`VOXCPM2_HTTP_TIMEOUT_SECONDS=900`。
- **MeloTTS（10.5）**：`melotts_api_server.py` 新增 `_synthesize_guarded`——owner=native、soft==hard==400 的保护性分段：正常文本单次原生调用（不二次插静音、不二次调速），仅超长输入分段、逐块原生合成、块间策略停顿。
- **CosyVoice/GPT-SoVITS（10.1/10.4）**：客户端保护性分段——新增 `pycore/pyutils/tts/chunked_synthesis.py`（按路径加载共享 `tts_text_chunking.py`；stdlib wave 做 PCM 帧级拼接，参数不一致即报错）；两个 engine 接入，单块直达保持旧行为；`tts_service_manager` 的 cosyvoice/fishspeech 启动切到 `resolve_isolated_python` + `_isolated_env`（剥 PYTHONPATH/PYTHONHOME）。
- **Fish Speech（10.2）**：桥接 `fishspeech_api_server.py` upstream 模式服务端分段（project owner，soft 200；逐块 `format=wav` 请求上游、wave PCM 拼接；云 SDK 路径保持单发）；修掉硬编码临时目录之外的改造维持现状（TMP_DIR 仍为既有行为）。
- **验证**：10 文件 py_compile OK；chunked_synthesis 冒烟（单块直达、4 块拼接帧数精确 11938、块失败整任务失败）；voxcpm2 服务模块按路径加载冒烟（health/400 正常）；melotts guard 与 fishspeech 桥拼接帧数精确；主进程注册表/服务管理器导入冒烟通过（voxcpm2 无 venv 时 `start_command` 返回 None、disabled_reason 指向安装器）。**未运行真实推理**。

### 步骤 11 — 完成（前序轮次 + 本轮接入）

- `tts_text_chunking.py`（纯 stdlib：缩写/小数/域名/首字母屏蔽，句→从句→空白→Unicode 安全硬切，ChunkBudgetError）与 `tts_audio_assembly.py`（重试上限、总期限、块边界取消、校验、定停拼接、拒绝半成品）前序已建并经功能验证；本轮被 melotts/voxcpm2/fishspeech 服务端与 pycore 客户端助手实际接入。

### 步骤 12 — 完成（核实既有 + 本轮小修）

- `engine_policy.py`：`configured_tts_priority("sentence")` 钉死 qwen3tts；word 链 `_DEFAULT_WORD_PRIORITY` 含五引擎且排除 qwen3tts；用户持久化 word 偏好档（`TTS_WORD_PRIORITY`/`word_tts`）既有。`laravel_audio_worker.py`：`PRIORITY_PROFILE="word"` + `REQUIRED_ENGINE=None`（自动 word 优先级），句子 worker 子类 `REQUIRED_ENGINE=QWEN3TTS_ENGINE` 未动。`word_audio_cache` 键含 engine。
- 本轮小修：`tts_engine_probe.engine_installed` 的 cosyvoice/fishspeech/voxcpm2 改以 `isolated_venv.venv_ready` 为准（不再探测主解释器包）。
- 验证：`configured_tts_priority` 三链断言冒烟通过。

### 步骤 13 — 完成（核实既有 + 本轮小修）

- Linux `prepare_pycore_prerequisites.sh` manifest：`python310|14_install_python310.sh` 位于 cuda_policy 之后、五个 TTS 引擎之前；五引擎条目齐全（neural/explicit 模式正确）。
- Windows：`InstallerScriptsList.ps1`/`WinScriptsInstaller.ps1`/`AppInstallMenu.ps1` 已登记 Step13；**本轮补** `PycorePrerequisitesList.ps1` 缺失的 `python310` 条目（位于 cuda_policy 与 python_prereqs 之间），否则五引擎自包含安装在 Windows 全量链上缺基解释器。
- Mode 2 / headless / systemd 路径沿用既有实现，未改动。

### 衔接状态（未完成项）

- 步骤 14（状态枚举/故障细分/迁移）：未开始。
- 步骤 19（逐引擎 compose 服务资产）：仍 pending（16-20 记录已声明）。
- Fish Speech 本地 `fish_speech` 推理托管（10.2 的 local 模式权重+codec）：仍 pending；当前 venv 承载 bridge/SDK 范围。
- 10.1 的“PCM 采样率从服务元数据读取”（cosyvoice 客户端当前固定 22050）：未实施。
- 真实安装/推理/听验：未运行（按约束）。

### BUG 修复记录（2026-09-17 第三轮续，来源 docs_fix/origin/todebian_fix_item）

1. **pyservice 自动运行反复弹 20 秒安装方式倒计时**：根因——`win_common/InstallMethodCommon.ps1::Select-TtsInstallMethod` 缺少 Linux 侧已有的 "2b 单选项快速路径"（`install_method_common.sh` 第 200-208 行）：voxcpm2 等 native 单选项引擎在 Windows 上首次运行也进倒计时。已补 PS 版 2b 分支：单选项引擎直接持久化默认方式（source=timeout_default）并返回，无倒计时；多选项引擎行为不变（已保存选择直接复用）。PS AST 解析通过。
2. **pip/临时目录落到 C 盘**：pycore 侧本就全部经 `pygvar.TMP_DIR`（`D:\.tmp`）且 pygvar import 时已重定向 TEMP/TMP/TMPDIR + `tempfile.tempdir`；C 盘来源是 PowerShell 安装器直接调 pip 时进程 TEMP/TMP 仍为系统默认。修复：`win_common/GlobalVars.ps1` 在 `$Global:TEMP_DIR` 定义后确保目录存在并把 `$env:TEMP`/`$env:TMP` 重定向到 `D:\.tmp`（单点修复，所有引用 `$env:TEMP` 的既有脚本随之落到 D 盘）。pycore 内 6 处 `tempfile` 调用复查全部已带 `dir=TMP_DIR`，无遗留。
3. **qwen3tts 每次启动“重新安装”**：实查本机 `.ai_policy_fingerprint` 与当前指纹一致、`_stamp_matches/core_ready/venv_ready` 均 True；实跑 `ensure_venv('qwen3tts')` 2.8s 短路返回、无任何 pip 调用。用户所见修复段是本轮步骤 03 给 qwen3tts spec 增补 `isolation_mode` 字段导致的一次性指纹迁移重建（`engine_fingerprint` 含该字段），之后已稳定。非递归 bug。

---

## 步骤 10.1/14/19 与 Fish Speech 本地推理 实现记录（2026-09-17 第四轮）

### 10.1 CosyVoice PCM 采样率元数据化 — 完成

- `cosyvoice_engine.py`：删除硬编码 `_SAMPLE_RATE=22050`，新增 `_sample_rate()`：`COSYVOICE_SAMPLE_RATE` 覆盖 → 模型元数据推导（CosyVoice2 家族 24000 Hz，1.x 22050 Hz；默认 tier `iic/CosyVoice2-0.5B` → 24000）。**顺带修正了默认值错误**（旧 22050 对 CosyVoice2 会产生降速音频）。冒烟：默认 24000、覆盖 16000 生效。

### 步骤 14 — 状态/故障细分 — 完成（核心）

- `tts_engine_probe.py`：新增 `_self_contained_reason()`——五引擎的状态按“python310 未注册（含安装指引）/ 基解释器不兼容 / venv 未构建”分层，兼容性判定基于解析出的基解释器而非宿主 3.13。voxcpm2 删除“宿主 3.13 不兼容”旧逻辑；cosyvoice/gptsovits/fishspeech 的 reason 顺序为 配置 → 显式外部 URL → venv/基解释器 → 不可达。
- fishspeech 的 SDK 就绪判定改认 venv（fishaudio 已不在主解释器）。
- `tts_status.py::engine_chunked`：分块能力集扩为 qwen3tts/voxcpm2/melotts/fishspeech/cosyvoice/gptsovits（能力标志，与逐任务统计分离）。
- 冒烟：五引擎 reason 分别给出 python310_not_registered（含 Step13/14 指引）或配置缺失提示，不再是误导性的宿主版本错误。

### Fish Speech 本地推理托管 — 完成

- `runtime_policy.py` fishspeech：`torch_packages=("torch==2.8.0","torchaudio==2.8.0")`（上游 pyproject ABI 钉版）+ `torch_index_tag="cu128"`（2.8.0 无 cu130 wheel）；health_imports 补 torch。
- `isolated_venv.py::_torch_stack_target` 支持 per-engine `torch_index_tag` 覆盖。
- `tts_service_manager.py`：fishspeech 启动分支——本地模式（staging 有官方 `tools/api_server.py` 且 `checkpoints/<name>/config.json` 就绪）优先，用 venv 解释器带 `--listen host:port --checkpoint-path` 启动官方服务；否则回退桥接（bridge/SDK）。绑定改为 loopback（原 0.0.0.0），新增 `_fishspeech_checkpoint_dir()`。
- 安装器 143/Step56：新增 checkpoint 下载段（`fishaudio/openaudio-s1[-mini]` → `checkpoints/<name>`，sentinel + 断点续传；失败只告警不失败整步——bridge/SDK 模式不依赖权重）。
- 验证：bash -n / PS AST / py_compile 通过；compose/venv 路径静态一致。**未运行真实安装与推理**。

### 步骤 19 — 逐引擎 compose 资产 — 完成（资产 + 收敛链）

- 新增 `scripts/shells/docker_compose/tts/<engine>/` × 5：`Dockerfile`（python:3.10-slim 固定基底、torch 走官方 cpu index 构建参数、权重/缓存走卷、project-managed 标注）+ `compose.yml`（loopback 端口、`restart: "no"` 服从托管生命周期、ownership labels、内容指纹）+ `compose.gpu.yml`（NVIDIA 设备预约 overlay）。
- 新增 `linux/common/tts_docker_compose_common.sh`：`tts_docker_apply_engine`——资产按内容比对同步到 `<staging>/docker`、设备解析（`<ENGINE>_DEVICE` 显式优先，auto 探测 nvidia-smi）、compose 指纹一致且容器存在则跳过 up（不重建、不重拉）、仅本项目 `pycore-tts-<engine>` 项目级 `up -d --build`。
- 新增无编号入口 `apply_tts_docker_for_engine.sh`（与 ensure_docker_for_tts.sh 同角色，供 Windows WSL 桥复用同一 Linux 链）。
- Linux 四个安装器（133/137/139/143）docker 分支从“打印 pending”改为实际 `tts_docker_apply_engine`；voxcpm2 保持 native 单选项。
- Windows：`DockerWslBridge.ps1` 新增 `Invoke-TtsDockerApply`——wsl_engine 经 `wsl.exe --exec` + wslpath 调同一 Linux 入口；desktop_wsl2 直接在 Windows 上 `docker compose`（Desktop 自行转换卷路径）；指纹跳过逻辑与 Linux 一致。Step52/54/55/56 docker 分支接入。
- 验证：5×3 compose 文件 YAML 解析通过且服务名匹配；新增/改动 sh `bash -n` 通过；PS AST 通过。**未运行 docker build/up**（按约束）；83/99/selector 的旧服务器栈生成器与 TTS 逐引擎服务正交，其共享生成函数重构仍 deferred。
