 ---

  BUG 2（先修这个）：pyfoundations 层内循环导入

  完整环链（每条边都在模块顶层 import）：

  1. pycore/callmodule/global_config.py:16 →

  serialized_worker

  2. pycore/pyfoundations/serialized_worker.py:16 →

  thread_bus（THREAD_BUS）

  3. thread_bus/__init__.py:36 → shutdown_stack.py:21 →

  pybasecommon.color_print

  4. import color_print 会先执行包初始化

  pybasecommon/__init__.py:21，eager 导入 compute_caps（17

  个符号）

  5. compute_caps.py:40 → from ...serialized_worker import

  SerializedValue —— 此时 serialized_worker 卡在自己的第 16

  行，部分初始化 → ImportError

  架构根因：

  - R1 — compute_caps 违反自身层约。它的 docstring 自称

  "stdlib-only kernel ... without sideways pyfoundations

  imports"，却向上 import 了 serialized_worker（依赖

  thread_bus 的高层模块）。pybasecommon

  是最低层内核，serialized_worker/thread_bus

  在其上，方向反了。且 SerializedValue 在这里只用于存一个

  callable（_TORCH_GETTER_STATE），属于用重型总线封装存一个模

  块级变量。

  - R2 — pybasecommon/__init__.py 的 eager

  再导出。任何对内核包叶子模块的 import（如 thread_bus 只想用

  ColorPrint）都会拖入整个 CUDA/ONNX

  内核，把局部依赖放大成包级依赖，正是它闭合了环。

  - R3 — 包级三角依赖：pybasecommon → serialized_worker →

  thread_bus → pybasecommon。

  修复清单（BUG 2）：

  #: F1

  动作: 移除 compute_caps.py:40 对 SerializedValue

  的依赖：_TORCH_GETTER_STATE 改为模块级普通变量（必要时加

  threading.Lock），保持内核 stdlib-only

  位置: pybasecommon/compute_caps.py:40-45

  ────────────────────────────────────────

  #: F2

  动作: 防御性：pybasecommon/__init__.py 的重导出改为 PEP 562

  **getattr** 惰性加载，杜绝叶子 import 拖入全包

  位置: pybasecommon/__init__.py:21-39

  ────────────────────────────────────────

  #: F3

  动作: 回归校验：python -c "import pycore.callmodule" 及

  pycore_module_[caller.py](http://caller.py) 启动路径

  位置: —

  F1 是正解（切断反向边）；F2

  防未来再次闭环。不建议用函数内局部 import

  掩盖（项目规则明确禁止）。

  ---

  BUG 1：qwen3tts 隔离 venv 健康探针失败且不可诊断

  链路：Step61 → ensure_venv("qwen3tts") → 在 venv 内执行探针

  import torch, torchaudio; from qwen_tts import

  Qwen3TTSModel（+ *gpu*required_probe 追加的 CUDA assert）→

  失败，stderr 只有最后一行 TypeError: 'NoneType' object is

  not iterable 被打印。

  架构根因：

  - A1 — 报错信息被丢弃。_venv_healthy（isolated_venv.py:168-

  170）只打印 tail[-1]，完整 traceback（能指出是哪个模块、哪

  一层抛的）全部丢弃，日志只剩一行无上下文的 TypeError。

  - A2 — 探针是单体 exec。一行 import a, b; from c import

  D，无法定位失败模块；且 *gpu*required_probe:150 把 CUDA

  assert 拼进同一探针，import 失败与 CUDA

  策略失败走同一通道，无法区分。

  - A3 — overlay 架构的盲区。qwen3tts venv 是

  --system-site-packages 依赖叠加层（复用主解释器的 CUDA

  torch 组），但 venv

  stamp（_write_stamp/engine_fingerprint）只指纹 venv

  侧安装计划，不指纹主解释器侧被复用的

  torch/torchaudio/transformers 版本。主栈一变（例如

  parler/bark 把 transformers 钉到 4.46.x），venv 静默失效而

  stamp 仍匹配；且 *install*into

  的"原地修复"只是重装同一计划，主层引起的 import

  失败会永远以同样方式失败——这正是观察到的无限 "will retry

  next run"。

  - A4 — 重试无升级路径。Step61 失败只删 .deps_done

  打印被动重试；ensure_venv:486-497 又明确禁止删除重建

  venv。确定性失败无 -Force 提示、无

  quarantine、无诊断输出（无 pip check）。

  修复清单（BUG 1）：

  #: F4

  动作: *venv*healthy 失败时输出完整 stderr（截断到末 ~20

  行）+ 探针内容 + venv python 路径

  位置: isolated_venv.py:168-171

  ────────────────────────────────────────

  #: F5

  动作: 探针改为逐模块循环（每个模块独立 try/except，打印

  FAIL: <module> 及 module.__file__ 所属层），CUDA assert

  拆成独立探针独立报错

  位置: isolated_venv.py:129-150、runtime_policy.py:156-160

  ────────────────────────────────────────

  #: F6

  动作: stamp/fingerprint 纳入 overlay

  复用的主层关键包版本（torch/torchaudio/transformers），主栈

  变化能触发重检

  位置: runtime_policy.py:229、isolated_venv.py:298-308

  ────────────────────────────────────────

  #: F7

  动作: 重装后健康检查仍失败时，自动跑 pip check +

  逐模块诊断并输出结果；连续 N

  次同样失败时给出明确动作（Step61 -Force 重建）而非被动

  "retry next run"

  位置: isolated_venv.py:439-441、Step61_InstallQwen3Tts.ps1:

  168-173

  F4+F5 是当务之急——现在的日志形态下这个 TypeError

  无法定位（典型嫌疑：overlay 双层的 importlib.metadata

  扫描到半写入的 .dist-info，或主层 transformers 版本与

  qwen-tts 不兼容，在 import 期迭代到

  None）；有了逐模块诊断才能定到具体包。

  ---

  优先级：BUG 2 是启动阻断级（pycore_module_[caller.py](http://caller.py)

  起不来），先 F1；BUG 1 先做 F4/F5 拿到真实失败点，再决定

  F6/F7。需要我按此清单动手修的话说一声。

---

## 修复进度（2026-07-27）

| 编号 | 状态 | 说明 |
|---|---|---|
| F1 | 已完成 | `compute_caps.py` 使用模块级普通 getter 状态，不再依赖 `SerializedValue`。 |
| F2 | 已完成 | `pybasecommon.__init__` 使用 PEP 562 `__getattr__` 惰性重导出。 |
| F3 | 未执行 | 按项目规则未运行启动回归命令；需由维护者后续执行。 |
| F4 | 已完成 | 健康探针失败输出 venv Python、探针内容；短 stderr 完整输出，长 stderr 输出首 12 行和末 20 行。 |
| F5 | 已完成 | Qwen3TTS 依赖逐模块探针并输出模块文件位置；CUDA 可用性独立检查。 |
| F6 | 已完成 | isolated venv fingerprint 纳入主解释器复用的 `torch`、`torchvision`、`torchaudio` 版本。 |
| F7 | 已完成 | 安装后失败自动执行 `pip check`；重复健康失败达到阈值时提示使用 Step61 `-Force`。 |

追加诊断：本次实际失败原因为 qwen overlay 中 `accelerate-1.12.0.dist-info` 缺少
`METADATA`。`transformers` 因此获得 `accelerate` 模块但无法获得版本号，最终对
`None` 执行版本解析。已在 `_install_into()` 增加损坏 dist-info 检测，并使用检测到的
版本执行 `pip install --ignore-installed --no-deps`；普通 `pip install` 不再掩盖此类半写入状态。

本轮未运行测试、构建、服务或启动验证。

后续 Qwen venv 扫描结论：当前实现通过主解释器创建
`--system-site-packages` overlay，不复制或继承 `py_venv_3.13` 的 venv-local
包；`py_venv_qwen3tts_3.13_9b964a661332` 是旧哈希命名实现留下的未引用目录。
修复逻辑已改用 pip 官方建议的 `--ignore-installed` 覆盖损坏包，并将缺失
`METADATA` 或 `RECORD`、以及候选包目录为空纳入损坏检测；Qwen 候选也包含本地 pip。

追加诊断：Qwen 修复后发现 `qwen_tts` 仍从主解释器加载，而不是 overlay。
已增加 overlay-owned package 检查；`qwen-tts` 缺少本地副本时会使用
`--ignore-installed --no-deps` 写入 Qwen venv，避免主环境 `qwen_tts` 与 overlay
`transformers` 混用。

追加架构修复：已显式定义 `MAIN_INTERPRETER` 与
`QWEN3TTS_INTERPRETER` 两个解释器常量。主进程继续使用基础解释器；Qwen3-TTS
服务进程由管理器使用专用 venv Python 启动，两个进程通过本地 HTTP 服务通信。

追加诊断：修复包归属后，`transformers` 顶层导入已经通过，但
`qwen_tts.Qwen3TTSModel` 仍因懒加载包装异常失败，日志只显示
`GGUF_CONFIG_MAPPING`，未显示真正的底层导入错误。已增加独立的
`AutoConfig`、`AutoModel`、`AutoProcessor` 和 `GGUF_CONFIG_MAPPING` 健康探针，
并将失败 stderr 改为短日志完整输出、长日志输出首 12 行和末 20 行，以便下一次
运行直接定位具体依赖或模块。

最终根因：Qwen venv 的 `tokenizers-0.22.2.dist-info/RECORD` 存在，但
`tokenizers/implementations.py` 实际缺失。`transformers 4.57.3` 导入
`AutoConfig` 时触发该缺失文件，随后被懒加载器包装成 `GGUF_CONFIG_MAPPING`
错误。已将 RECORD 中列出的缺失文件纳入损坏分发检测，并将 `tokenizers` 加入
Qwen 修复候选；下一次安装会用 `--ignore-installed --no-deps tokenizers==0.22.2`
覆盖恢复完整 wheel。
