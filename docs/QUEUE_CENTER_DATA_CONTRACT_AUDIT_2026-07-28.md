# Queue Center 数据契约整改报告

日期：2026-07-28  
范围：`/pycore-manager/queue-center`、Pycore RPC v2 聚合层、`poly_apps/laravel_main` Queue Center 读模型，以及 Pycore Manager 内相关媒体资源调用  
状态：代码整改已完成；按项目约束未运行测试、构建或服务

## 1. 整改结论

原审查确认的 QCD-001～QCD-015 已落实到代码：

- Queue Center 的 category、control、section、默认 section DTO、claimant 和 queue metric 语义只有一个语言无关来源：`config/queue_center_contract.json`。
- Python、PHP、TypeScript 只保留各自的薄适配器，并在文件注释中互相指明对齐文件。
- Pycore Manager 的业务调用统一为 RPC v2 WebSocket；浏览器不再直接调用 Pycore/Laravel GET、POST，也不再把 Pycore/Laravel 资源 URL 直接放入 `img`、`audio` 或下载链接。
- Pycore 是唯一 Queue Center 聚合与控制面；只有 Pycore 后端可通过共享 `LaravelClient` 对 Laravel 使用 HTTP。
- Assist、overview、section builder、endpoint cache 和 vocabulary proxy 的重复实现已收敛到单一服务或基类。
- Laravel live overview 与 Pycore fallback 始终输出相同的 13 个 category，不再因 Laravel 在线/离线改变卡片集合。

## 2. 唯一中心契约

### 2.1 文件和适配器

| 角色 | 文件 | 数据结构/职责 |
|---|---|---|
| 唯一语言无关来源 | `config/queue_center_contract.json:2` | `schema_version=2`、metric 语义、control 名称、section 默认 DTO、capability claimant、section scope、13 个 category |
| Python 适配器 | `pycore/callmodule/services/queue_center_contract.py:65` | 加载中心 JSON，导出 Python 常量/TypedDict；不得拥有第二份目录 |
| Laravel 适配器 | `poly_apps/laravel_main/app/Support/QueueCenterContract.php:15` | 加载同一 JSON，规范化 Laravel metrics，派生 claimant/category |
| TypeScript 适配器 | `poly_apps/pycore_laravel_wordflow_ui/core/api-libs/pycore/QueueCenterContract.ts:25` | Queue Center 前端类型、runtime catalog、默认 section 和仅显示层 normalization |

三个适配器的文件头均指向另两个适配器及 `config/queue_center_contract.json`。`poly_apps/shared_contracts` 下不再保留 Queue Center 契约副本。

### 2.2 中心结构

`config/queue_center_contract.json` 当前拥有以下结构：

| JSON 字段 | 唯一含义 |
|---|---|
| `schema_version` | RPC snapshot 契约版本；前端拒绝不支持的版本 |
| `metric_semantics` | `pending`、`leased`、`processing`、`total` 的唯一语义 |
| `control_names` | 只允许 `assist_translation`、`word_audio`、`sentence_audio` |
| `section_contract_defaults` | `queue`、`worker`、`toggle`、`lifecycle`、error、freshness 的默认 DTO |
| `capability_claimants` | capability 到可处理 runtime 的唯一映射 |
| `section_scopes` | 五个 section 的显式 `category_keys[]` 和 `queue_metrics` 属性 |
| `categories` | category key、label、Laravel task type、capability、primary handler |

category 不再重复保存 claimant。Python、PHP、TypeScript 都用 `category.capability -> capability_claimants` 派生 `claimants[]`；capability 为空时用 `primary_handler` 派生。

固定 category 集合为：

`word_translation`、`ai_translate`、`word_media`、`word_audio`、`sentence_audio`、`subtitle_search`、`subtitle_lang`、`book_lang`、`cover`、`poster`、`notebooklm`、`gemini_image`、`gemini_chat`。

固定 section scope 为：

| scope | category_keys | queue_metrics |
|---|---|---|
| `heartbeat` | 空 | `false` |
| `assist_translation` | `word_translation`、`ai_translate`、`subtitle_search`、`subtitle_lang`、`book_lang` | `true` |
| `word_audio` | `word_audio` | `true` |
| `sentence_audio` | `sentence_audio` | `true` |
| `media_image` | `word_media`、`cover`、`poster`、`gemini_image` | `true` |

category 输出结构统一为：

```text
PcQueueCategory {
  key, label, capability,
  primary_handler,
  claimants[],
  active_handlers[],
  pending, leased, processing, total,
  by_language?, by_status?, sample?, engine?
}
```

旧单值 `handler` 已从 Laravel、Pycore 和前端类型中删除。

section 输出结构统一为：

```text
QueueCenterSectionContract {
  type, category,
  queue { pending, leased, processing, total },
  worker { online, claimed, ok, fail, last_heartbeat },
  toggle { requested_by, enabled, reason, graceful_stop, paused_by_user },
  lifecycle, error_code, last_error,
  observed_at, age_s, stale
}
```

`lifecycle/error` 只存在于 section 顶层，不再重复塞入 `toggle`。

## 3. 当前唯一数据链路

| 顺序 | 文件/路由 | 责任 |
|---|---|---|
| 1 | `apps/pycore-manager/hooks/useQueueCenterHub.tsx:129` | 发起一次 RPC v2 snapshot；只做 schema 校验和显示安全的 scalar normalization |
| 2 | `core/api-libs/pycore/PycoreApiLocal.ts` | 调用 `ui.task_center.get_queue_center_snapshot` / control RPC；无 GET/POST fallback |
| 3 | `pycore/callmodule/rpc_routes/local_task_center_routes.py` | RPC v2 薄路由 |
| 4 | `task_center_controller.py:341` | 唯一 snapshot composer；输出 canonical controls、sections、slice data 和 errors |
| 5 | `queue_overview_service.py:150` | 唯一 Queue overview；合并 Laravel metrics、local worker、engine、fast-lane |
| 6 | `task_center_assist.py` | 只负责 Laravel overview fetch/cache、worker/queue/TTS slice，不再拥有 Assist 或 overview 业务实现 |
| 7 | `AppQyV1AssistOverview.php:20` | Laravel 只生产各 category metrics，再由 PHP 中心适配器补齐目录/handler/claimant 元数据 |
| 8 | `QueueCenterContract.php:98` | 保证 13 个 category 总是存在并规范化计数字段 |

独立 `ui.queue_overview.get_queue_overview` RPC 与 Queue Center snapshot 都调用 `queue_overview_service.get_queue_overview()`，不再存在两套输出。

## 4. QCD-001～QCD-015 修复明细

| ID | 状态 | 精确文件与数据结构 | 修复结果 |
|---|---|---|---|
| QCD-001 | 已修复 | `assist_service.py:67` 的 `AssistStatus`；`native_ui_routes.py`、`local_assist_routes.py` | `assist_status/config/cycle` 只在 `assist_service.py` 实现；两组 RPC 路由均为兼容薄入口 |
| QCD-002 | 已修复 | `task_center_controller.py:264` 的 `QueueCenterSnapshot.controls` | 输出只含中心定义的三个 canonical key；`assist`/`translation` 只保留输入 alias |
| QCD-003 | 已修复 | `assist_laravel` effective settings；`queue_center_controls` intent audit；`word_tts_auto`/`sentence_audio_auto` concurrency | 生效配置只读 Assist master/capability；intent 不再覆盖配置；旧 `auto_start` 仅在 Assist 文档不存在时用于迁移兼容 |
| QCD-004 | 已修复 | `config/queue_center_contract.json:70`、`AppQyV1AssistOverview.php:26`、`queue_overview_service.py:59` | 在线/离线统一 13 个 category；Laravel/Pycore 不再各有 catalog |
| QCD-005 | 已修复 | `queue_overview_service.py:150` | 只保留一个 `get_queue_overview()`；snapshot 与独立 RPC 共用 |
| QCD-006 | 已修复 | `AppQyV1AssistQueueMetrics.php:231`、`:388`、`:453`；`AppQyV1AssistMediaOperations.php` | GlobalTask：pending=`pending`、leased=`assigned`、processing=`processing`；Sentence/Cover/Poster 将活跃 lease 从 pending 扣除；`total` 按中心定义表示完整 source population |
| QCD-007 | 已修复 | `PcQueueCenterPage.tsx:151` | Overview badge 只对 canonical `overview.categories[].pending` 求和；不再相加五个 section，不重复 cover/poster，不混入 heartbeat |
| QCD-008 | 已修复 | `task_center_sections.py:167` 的 `heartbeat` section | heartbeat 的 queue 四个计数固定为 0；运行健康只进入 `worker/toggle/lifecycle/error` |
| QCD-009 | 已修复 | `useQueueCenterHub.tsx:193`、`QueueCenterContract.ts:226` | 删除前端 280+ 行业务 fallback builder；前端只解析后端 section，并从中心 JSON 构造空显示值 |
| QCD-010 | 已修复 | `QueueCenterContract.ts:98`、`task_center_sections.py:137` | toggle 只含声明字段；lifecycle/error 只在 section 顶层 |
| QCD-011 | 已修复 | `EndpointScopedCache`、`task_center_assist.py`、`PcQueueOverviewPanel.tsx:83` | slice 保留源 `observed_at/age_s/stale`；UI 显示 overview 源时间，不用 envelope 组装时间冒充 |
| QCD-012 | 已修复 | `endpoint_scoped_cache.py:12`、`word_tts_auto.py:32`、`sentence_audio_auto.py:38`、`task_center_assist.py` | 三类 Laravel-backed cache 均先解析 endpoint，再按 normalized endpoint 分区；stale 最长 300 秒，不无限回退 |
| QCD-013 | 已修复 | `poly_apps/laravel_main/app/Http/Controllers/TaskCenterController.php` | 删除不兼容的 Laravel `section_contracts`；Laravel legacy translation setting 只保留 soft-deprecated no-op，不再作为控制真值 |
| QCD-014 | 已修复 | `QueueCenterContract.php:80`、`QueueCenterContract.ts:25`、`PcQueueOverviewPanel.tsx:121` | 使用 `primary_handler/claimants/active_handlers`；Laravel manager 与 Pycore manager UI 均已对齐 |
| QCD-015 | 已修复 | `QueueCenterContract.ts`、`pycoreTypes.ts`、`BooksAPI.ts`、`PycoreVocabTypes.ts` | 补齐 freshness/runtime/category/worker 字段；Queue Center 路径移除 `as any` 协议绕过和“8 categories”漂移注释 |

## 5. 控制面合并

### 5.1 生效配置

`pycore/pyctl/assist/assist_settings.py` 的 `assist_laravel` 文档是唯一 effective worker 配置：

- master：`enabled`
- translation：`capabilities.translation` / `capabilities.ai_translate`
- word audio：`capabilities.tts`
- sentence audio：`capabilities.sentence_audio`

`queue_center_control_service.py` 的 `queue_center_controls` 只保存 `requested/requested_by/reason/graceful_stop/timestamp` 审计意图。

`word_tts_auto.py:57` 和 `sentence_audio_auto.py:63`：

- Assist 文档存在时，`auto_start` 从 Assist master+capability 派生。
- 原 `word_tts_auto.auto_start`、`sentence_audio_auto.auto_start` 只在旧安装尚无 Assist 文档时读取。
- 两个 worker 自有 section 只继续保存 worker-specific `concurrency`，不再拥有 enable 真值。

### 5.2 控制执行

`task_center_controller.py:429` 的 `set_queue_center_control()` 是唯一 Queue Center control base：

- `assist_translation` 更新 translation/ai_translate capability。
- `word_audio` 更新 TTS capability 并调用 word worker runtime adapter。
- `sentence_audio` 更新 sentence capability 并调用 sentence worker runtime adapter。
- 开启子 capability 时可开启 Assist master；关闭单一 capability 不会误关 master 并连带停止其他 worker。

## 6. Laravel 读模型对齐

### 6.1 Category 生成

`AppQyV1AssistOverview.php:26` 只维护 `metricsByKey`；label、capability、primary handler、claimants 由 `QueueCenterContract::normalizeCategories()` 从中心 JSON 合并。

`AppQyV1AssistQueueItems.php:33` 使用中心 `categoryKeys()` 验证 drill-down category，使用中心 `laravel_task_type` 路由 GlobalTask 类别；`ai_translate` 与普通 `word_translation` 按 capability 分开。

### 6.2 计数语义

中心语义为：

- `pending`：尚未 claim 的 ready work。
- `leased`：已 assigned/claimed、尚未进入 processing。
- `processing`：正在处理。
- `total`：该 category source population 的全部记录，可包含 terminal records，因此不要求等于三个 active bucket 之和。

实现位置：

- GlobalTask：`AppQyV1AssistQueueMetrics.php:231`
- AI translation split：同文件 `:270`
- Sentence Audio：同文件 `:388`
- Assist requests：同文件 `:453`
- Cover/Poster lease：`AppQyV1AssistMediaOperations.php`
- Drill-down status 映射：`AppQyV1AssistQueueItems.php:94`

## 7. RPC v2 与资源边界

### 7.1 Queue Center

Pycore Manager Queue Center 只使用：

- `ui.task_center.get_queue_center_snapshot`
- `ui.task_center.set_queue_center_control`
- `ui.queue_overview.get_queue_overview`（兼容独立消费者，仍复用同一 service）

前端没有 GET/POST fallback，也没有前端直接 Laravel API client。

### 7.2 媒体与二进制资源

为消除浏览器通过元素 `src` 或下载 URL 发起 HTTP，以下资源改为 RPC base64/data URL：

| 数据 | Pycore 后端 | 前端 |
|---|---|---|
| completed archive | `task_history_controller.py:42` 返回 `content_base64/mime/filename` | `PycoreApiLocal.ts:90`、`PcRecentTasksPanel.tsx` |
| word audio | dedicated word-audio RPC 返回 base64 | `PycoreApiLocal.ts:381`、`PcWordAudioPanel.tsx` |
| speech/image history | `pycore.router.resource` RPC | `PcBlobMedia.tsx`、`PcRecordsPanel.tsx`、`PcAiStudioView.tsx` |
| image-search thumbnails | `ImageSearchController.resource()` 在 Pycore 下载外部图片并返回 base64 | `PcImageSearchPage.tsx` lazy RPC image component |
| vocabulary cover/TTS | `vocabulary_service.py:122` / `:227` 在 Pycore 读取 Laravel bytes | `PycoreApiLocal.ts:453`、`VocabLibrariesTab.tsx`、`VocabTranslateTab.tsx` |
| Laravel media lists/detail | `laravel_media_query_service.py:36` / `:49` | `PcLaravelMediaPanel.tsx:139` / `:181` |

`PcLaravelMediaPanel` 已删除原来的 browser `laravelApi` fallback。当前链路严格为：

```text
Pycore Manager UI
  -> RPC v2 WebSocket
  -> Pycore service
  -> shared LaravelClient HTTP
  -> selected Laravel endpoint
```

外部图片结果的“打开来源页面”仍是显式用户导航，不属于后台数据/API transport；自动加载的缩略图字节已经改走 RPC。

### 7.3 重复 proxy 合并

`native_ui_routes.py` 原内联 vocabulary HTTP path/method map 已删除。它现在只调用 `vocabulary_service.dispatch_vocabulary_action()`；dedicated vocabulary RPC 也调用同一 service。HTTP verb 和 Laravel path 只由 `vocabulary_service.py` 决定。

## 8. UI 对齐

- `useQueueCenterHub.tsx`：单 snapshot、单状态源、schema v2 gate；默认 auto refresh 在未保存 preference 时为开启。
- `PcQueueCenterPage.tsx`：Overview count 使用去重 category pending。
- `PcQueueOverviewPanel.tsx`：展示 primary/eligible/active handlers 和真实 freshness。
- `VocabAssistQueuesPanel.tsx`、`VocabLearningTasksPanel.tsx`：不再读取已删除的 `handler`，改用中心 `primary_handler/claimants`。
- `PcTaskAudioPreview.tsx`、`PcRecentTasksPanel.tsx`、`PcWordAudioPanel.tsx`：音频/下载资源走 RPC data URL。
- `PcAiStudioView.tsx`、`PcRecordsPanel.tsx`、`PcImageSearchPage.tsx`、`VocabLibrariesTab.tsx`：图片字节走 RPC data URL。
- Pycore Manager 内已移除 runtime `fetch`、`axios`、`laravelApi`、`getSharedBaseURL` 和 `rewritePycoreEndpoint` 业务调用。

## 9. 兼容边界

- `assist`、`translation` control alias 仅用于旧输入，snapshot 永远输出 `assist_translation`。
- 旧 word/sentence `auto_start` 只用于首次迁移；Assist 文档一旦存在即不再作为生效真值。
- Laravel `task-center/settings` GET/POST 路由仍为非 Pycore 旧客户端保留，但 translation 写入是 no-op，Queue Center 前端不调用。
- core API 库仍保留 SSE/HTTP compatibility 工具供其他应用使用；Pycore Manager 的 canonical live/event transport 是 RPC v2 WebSocket，SSE 不自动启动。

## 10. 本次未执行的验证

根据项目 `AGENTS.md`，本次没有运行测试、构建、服务或运行态验证，也没有执行 git 操作。已完成的检查仅包括静态文件追踪和只读搜索：

- Queue Center 中心契约只存在于 `config/queue_center_contract.json`。
- Pycore 只剩一个 `assist_status/config`、一个 `get_queue_overview` 和一个 endpoint cache 基类。
- Pycore Manager runtime 代码中未发现 `fetch`、`axios`、直接 `laravelApi` 或 endpoint rewrite 业务调用。
- Laravel 不再输出与 Pycore 同名但不同 shape 的 `section_contracts`。

后续如明确授权运行验证，应至少检查：RPC schema version、13 个 category、三组 control、endpoint 切换后的 cache isolation、resource data URL、Laravel online/offline freshness 和 Queue Center 五个 section 的实际渲染。
