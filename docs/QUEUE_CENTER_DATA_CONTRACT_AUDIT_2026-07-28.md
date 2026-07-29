# Queue Center / GlobalTask 数据契约代码对照审计

> 初始审计日期：2026-07-28  
> 代码复核日期：2026-07-29  
> 复核范围：config、poly_apps/laravel_main、pycore、poly_apps/pycore_laravel_wordflow_ui、apps/mcp-chrome  
> 本文只判断当前代码是否已经落地，不把“已写入代码”等同于“已通过编译、测试或端到端运行”。

## 1. 结论

当前状态应表述为：

**Queue Center 的中央契约、Laravel 状态机、Pycore Worker 主链路、两套 Manager UI 边界、Chrome Worker 基础设施及 c.txt 第 8 部分的合并功能均已在代码中落地；当前剩余项是编译、测试和真实端到端运行验证。**

### 1.1 完成状态总表

| 项目 | 状态 | 代码对照结论 |
|---|---|---|
| 中央 JSON 契约 | 已完成 | config/queue_center_contract.json 是当前唯一中央定义源，schema_version 为 3 |
| Python、Laravel、共享前端、mcp-chrome 适配器 | 已完成 | 四端均直接读取或导入中央 JSON，没有发现正在使用的第二份 shared_contracts 副本 |
| Laravel GlobalTask 状态机与 Worker API | 已完成 | 创建、领取、接受、结果回传、取消、提权、详情、列表、统计和事件流已接入中央契约 |
| Laravel Processor 入口收敛 | 已完成 | 现有 Processor 统一继承 AbstractTaskProcessor，没有发现业务 Processor 自行保留 canProcess/getPriority 实现 |
| Pycore 通用 Worker 主链路 | 已完成 | 注册、心跳、领取、结果回传、重试、熔断和 in-flight 控制已集中在 BaseLaravelWorker |
| Pycore 音频任务合流 | 已完成 | word_audio、article_audio、sentence_audio 进入共享音频处理路径 |
| Pycore Manager UI 的 RPC v2 边界 | 已完成 | UI 通过 PycoreApiLocal 和 ui.* RPC 路由访问后端；未发现任务中心页面直接发起 HTTP/SSE |
| Laravel Manager UI 的访问边界 | 已完成 | ServerManagerAPI 直接访问 Laravel，并复用共享 Queue Center 类型 |
| mcp-chrome Worker 生命周期 | 已完成 | 通用 Worker 与 Processor 基类已统一注册、心跳、拉取、处理、结果回传和 outbox |
| mcp-chrome Task Center 元数据 | 已完成 | 任务类型、状态、事件、限制、lane 和用户能力开关均由中央契约派生 |
| 契约类型防漂移 | 已完成 | Python 和两套 TypeScript 适配器均对 12 个 wire_shapes 执行 DTO 字段覆盖断言 |
| WXT 直接导入中央 JSON | 已完成 | 只保留一个 vite 配置和一个仓库根 fs.allow；无效 env 配置已移除 |
| 遗留 QueueCenterPanel | 已完成 | 已改为复用 UnifiedTaskCenter，不再引用不存在的组件 |
| c.txt 第 8 部分功能合并 | 已完成 | 有效性、Web-AI 翻译和 Bing 翻译由一个中央开关控制，并复用统一写回 |
| TaskResult 同名导入 | 已完成 | DeepSeek 本地结果已改名为 DeepSeekTaskResult，中央 TaskResult 保持唯一 |
| 编译、测试、真实 Worker 联调 | 未验证 | 本次按项目规则只做代码对照，没有运行构建、测试、服务或端到端任务 |

## 2. 已完成：中央契约

中央定义文件：

- config/queue_center_contract.json

当前中央契约包含：

| 内容 | 数量或值 |
|---|---|
| schema_version | 3 |
| task_types | 18 |
| wire_shapes | 12 |
| callback roles | 9 |
| categories | 13 |
| section_scopes | 5 |
| live statuses | pending、assigned、processing |
| terminal statuses | completed、completed_demo、failed、cancelled |
| worker reportable statuses | processing、completed、failed |
| priorities | default=0、manual=50、fast=100、maximum=1000 |

18 个登记任务类型为：

1. word_translation
2. dictionary_explanation
3. dictionary_explanation_demo
4. prompt_translation
5. word_media
6. word_audio
7. article_audio
8. article_tts_generation
9. sentence_audio
10. subtitle_search
11. poster
12. notebooklm
13. gemini_image
14. gemini_chat
15. chatgpt_chat
16. word_validity
17. stt
18. audio_transcribe

这里的“18 个任务类型已登记”只表示契约定义完成，不表示每种任务都已经进行过真实运行或完成过任务实例。

### 2.1 四端适配器

以下适配器已经指向同一中央 JSON：

- Python：pycore/callmodule/services/queue_center_contract.py
- Laravel：poly_apps/laravel_main/app/Support/QueueCenterContract.php
- 共享 TypeScript：poly_apps/pycore_laravel_wordflow_ui/core/api-libs/pycore/QueueCenterContract.ts
- mcp-chrome：apps/mcp-chrome/app/chrome-extension/utils/queue-center-contract.ts

代码搜索未发现有效的 poly_apps/shared_contracts/queue_center_contract.json，也未发现 schema_version=2 的在用副本。

## 3. 已完成：Laravel 服务端主链路

### 3.1 状态和事件

GlobalTask 与 GlobalTaskEvent 已通过 QueueCenterContract 读取状态、事件和相关枚举。相关业务范围内没有发现继续使用 GlobalTask::STATUS_*、GlobalTaskEvent::EVENT_* 或旧 TranslationTaskManager 常量的调用。

### 3.2 创建、领取和结果回传

TaskManagerService 已负责：

- 按 task_types 解析任务定义、lane、capability 和 claimant
- 创建任务并应用中央优先级
- 在数据库事务和 lockForUpdate 下领取任务
- 处理 capability 匹配和状态迁移
- 接收 Worker 处理结果并写入终态

TaskController 与 WorkerController 已使用中央 limits、wire_shapes、状态和事件定义，覆盖任务详情、列表、统计、事件流以及 Worker 注册、心跳、拉取、接受和结果回传。

### 3.3 Processor 收敛

现有 11 个业务 Processor 均继承 AbstractTaskProcessor：

- DictionaryTaskProcessor
- GeminiTextTaskProcessor
- SentenceAudioTaskProcessor
- WordValidityTaskProcessor
- NotebookLmTaskProcessor
- PromptTranslationTaskProcessor
- ArticleAudioTaskProcessor
- WordGeminiImageTaskProcessor
- WordTranslationTaskProcessor
- SubtitleSearchTaskProcessor
- PosterTaskProcessor

canProcess 和 getPriority 的实现只保留在接口与抽象基类范围，业务 Processor 不再各自维护一套判定入口。

## 4. 已完成：Pycore Worker 与 Manager UI

### 4.1 Worker

pycore/callmodule/workers/base_laravel_worker.py 已集中处理：

- Worker 注册与心跳
- 任务拉取与结果回传
- 重试、熔断和 in-flight 控制
- Worker 可上报状态校验

worker.py 使用中央任务类型分发任务。word_audio、article_audio、sentence_audio 进入 handlers/audio.py 的共享音频处理路径。

lane_gating.py 已按中央 lane/capability 计算有效 Worker 能力，并把翻译、音频和句子音频接入对应调度回调。

callmodule_main.py 同时注册 translation_worker 和 always-on global_task_worker；两者调用同一 worker.poll_once，并依赖 single-flight 防止并发重复拉取。代码结构已经统一，但双触发在真实运行下是否完全符合预期，本次没有联调证据。

### 4.2 Manager UI

Pycore Manager UI 通过 PycoreApiLocal.callRpc 调用 ui.* 路由。实际路由已拆分到：

- local_task_center_routes.py
- local_task_history_routes.py
- local_heartbeat_workers_routes.py
- local_queue_overview_routes.py

这些模块由 rpc_routes/__init__.py 注册。旧结论中把任务中心路由全部归到 native_ui_routes.py 不准确，本次已纠正。

任务中心相关 UI 范围内没有发现 fetch、axios、EventSource、XMLHttpRequest 或直接 WebSocket 构造调用，因此 Pycore UI 的 RPC v2 边界在代码上已经成立。

## 5. 已完成：Laravel Manager UI

Laravel Manager UI 的 ServerManagerAPI 直接访问 Laravel API，符合该 UI 的部署边界。它复用共享 Queue Center DTO，并使用中央任务流事件名称监听 assigned、processing、completed、failed、timeout、reclaimed 和 cancelled。

## 6. 已完成：mcp-chrome

以下部分已经接入中央契约：

- WorkerApiClient 使用中央 Worker 拉取限制
- SimpleWorkerBase 统一注册、心跳、拉取、处理、回传和 outbox
- WorkerServiceProcessorBase 统一 Processor 启停和状态
- 11 个具体 Processor 通过 init-processors 注册
- task-center-lanes 从中央 task catalog 派生 distributed lanes
- task-center-meta 从中央任务目录派生任务类型和 capability 展示信息
- UnifiedTaskCenter 使用中央任务类型、live statuses、status roles 和 limits
- TaskDetailModal 使用中央状态与事件
- history store 使用中央终态、事件、限制和流事件名称
- useTaskCenter 与 ServerManagerAPI 使用中央流事件常量

task-capabilities.ts 现在只把中央 chrome_capability_switches 的 snake_case 字段转换为既有弹窗 API，不再维护第二份 key、标签或 processor 映射。Task Center 的 batchSize 默认值和最大值也分别来自 worker_pull_default 与 worker_pull。

wxt.config.ts 只保留一个 vite 配置，中央 JSON 的仓库根读取边界只声明一次。QueueCenterPanel.vue 改为 UnifiedTaskCenter 的兼容包装。

DeepSeek 队列的本地 TaskResult 已改名为 DeepSeekTaskResult，避免 WXT 自动导入扫描与中央 Worker TaskResult 冲突。

## 7. 已完成：c.txt 第 8 部分功能合并

| 要求 | 代码状态 |
|---|---|
| 有效性检测拉取 Laravel 全量待处理单词 | WordValidityRunnerService 递归拉取 validity/pending，直到队列清空 |
| 默认 DeepSeek，可切换其他可用 Web AI | 默认 DeepSeek；Settings 提供 DeepSeek、Gemini、ChatGPT，均有实际页面驱动 |
| 有效性与缺失翻译合并 | 同一提示一次返回 valid、invalid 和目标语言翻译；Laravel 同一报告写回有效性和缺失翻译 |
| 只补缺失翻译 | AppQyV1WordTranslationWriteback 按目标语言 fill-missing，不覆盖现有翻译 |
| 8.2 默认只处理 EN，也可处理其他语言 | 默认 en；保留常用语言按钮并支持输入两至三字母语言码 |
| 8.3 Web-AI 翻译逻辑合并 | WebAiTranslateWorkerService 复用 word-validity-web-runtime，不再维护独立提示和解析器 |
| 8.4 音频由 Pycore 辅助 | Task 页不显示音频开关；Qwen TTS Processor 代码仍保留 |
| 8.5 短文由 Pycore 辅助 | Task 页不显示短文开关；Pycore agent-history 路径仍保留 |
| 8.6 Bing 翻译逻辑合并 | 中央 validity 开关同时拥有 web_ai_translate 和 bing_dictionary；Bing watchdog 按 processor run-intent 判断 |
| 8.7 Unified Task Center 与 Laravel 数据一致 | 汇总数字使用 Laravel task-center/overview.queue.by_type，不再从截断列表推算；失败时清除旧快照 |
| 8.8 Data 内容只显示在 Data Tab | DataPanel 使用单根节点，App.vue 对各 Panel 分别执行 v-show |
| 8.9 无效图片无限重试 | 客户端提交前校验 magic bytes；invalid/not_found 作为 outbox 终态丢弃 |
| 8.10 底层数据共享 | capability、lane、limits、状态和事件来自中央契约；popup/background 状态使用共享 composable、message type 和 storage key |

Task 页当前只显示三个中央能力开关：图片与封面、单词有效性与翻译、NotebookLM。有效性与翻译开关启动三个协作部分：有效性全量 Runner、Web-AI 翻译 Worker、Bing 翻译 Worker。

有效性报告提交失败时先进入持久 outbox，然后结束当前轮次，避免立即重复演算同一批；Task Center watchdog 会继续恢复运行。

## 8. 已完成：DTO、WXT 与静态引用收敛

- Python TypedDict、共享 TypeScript DTO 和 mcp-chrome DTO 均覆盖中央 12 个 wire_shapes
- TypeScript 在编译期检查断言字段确实属于对应 DTO，并在模块加载时核对中央字段顺序
- Python 在适配器加载时检查每个中央 wire shape 均有 TypedDict 且没有缺失字段
- WXT 中重复 vite 属性和无效 env 配置已移除
- QueueCenterPanel 不再引用缺失的 LocalTaskQueue.vue 与 LogViewerPanel.vue
- DeepSeekTaskResult 与中央 TaskResult 已消除同名导入

## 9. 尚未验证：运行状态

本次没有运行：

- Laravel 或前端构建
- Python、PHP、TypeScript 测试
- Pycore、Laravel、mcp-chrome 服务
- Worker 注册、心跳、拉取、ACK、结果回传
- SSE/WebSocket 断线重连与回放
- 18 个任务类型的真实端到端任务

因此本文不能给出“全部可运行”“所有任务均完成”或“零回归”的结论。

## 10. 最终判定

### 可以标记为代码实现完成

- 中央 Queue Center JSON 契约
- 四端中央契约适配器
- Laravel GlobalTask 状态机和 Worker API
- Laravel Processor 判定入口收敛
- Pycore 通用 Worker 主链路
- Pycore 音频任务共享处理
- Pycore Manager UI 的 RPC v2 访问边界
- Laravel Manager UI 的直接 Laravel 访问边界
- mcp-chrome Worker 生命周期基础设施
- 主 Task Center 对中央任务类型、状态、事件和限制的消费
- c.txt 第 8 部分的有效性、Web-AI 与 Bing 合并链路
- WXT 配置、遗留面板和 TaskResult 同名问题修复
- DTO wire-shape 防漂移断言

### 仍不能标记为运行验证完成

- 编译、测试及真实端到端联调

后续报告应分别使用“代码已落地”“静态检查通过”“编译通过”“端到端验证通过”四种表述，不能再用一个“已完成”覆盖不同验证层级。
