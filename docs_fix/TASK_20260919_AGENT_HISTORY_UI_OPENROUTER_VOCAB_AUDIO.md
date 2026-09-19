# TASK 2026-09-19: Agent History UI Follow-up — Load Order, OpenRouter Panel, Prompt Override, Audio Orchestration

> Status: in progress. This file records the original requirement verbatim (§1) and the working breakdown (§2). Do not treat design docs as source of truth — verify against actual code.
> UI root: `poly_apps/pycore_laravel_wordnew_ui/apps/pycore-manager`
> Pycore root: `pycore/`

## §1 Original requirement (verbatim)

注意，以上功能还没有完全完成，不用去看文档，而是看实际代码：

1. 首页现在显示黑屏，需要很长时间才加载，查看是否是UI的加载和行为的加载搞反了，因为网络测试，或者资源载入，device，laravel等导致UI加载被阻塞在后面，这些都应该是UI先完加载完。PcFloatingPanel.tsx、LaravelMediaUrl.ts、PcAgentHistoryLogPanel.tsx、PcAgentHistoryVideoLogPanel.tsx、PcAgentHistoryAiPanel.tsx、PcAgentHistoryToolCheckboxes.tsx、TurnView.tsx 这几个为什么卡到最后才加载出来。

2. OpenRouter 请求（中文+英文 = 2 次/篇）扩展出一个或者复用现在系统存在的面板，用来显示 OpenRouter 的所有生成记录，分页显示请求记录，是否成功，发给 OpenRouter 的提示词，返回内容，一次返回时间等。如果系统中有了类似的功能或面板，复用和扩展；同样，可以扩展为一个通用的UI面板供其他AI复用。之后点击以上的时候加载面板并加载记录。OpenRouter 调用尝试不够详细，可以扩展，同时还要显示如果正在有请求也要显示正在请求的进度，可以按时间查询，按天，等查询。

3. pycore 内部预置的提示词，现在在面板中编辑，如果编辑，则直接保存在用户数据目录，同时加载时优先使用用户数据目录中的，代码中的作为原生替换的兜底提示词内容。

4. 生成学习视频（复用选定用户的播放设置，并与千问任务独立并行：学习用户名 / 虚拟已读批次 / default / 视频并发数）是放在 /pycore-manager/vocabulary 中的音频编排的一个功能。现在推导音频编排，如果有复用代码就复用，如果没有，移除 /pycore-manager/agent-history 中的"生成学习视频"，但可以添加一个快捷标签直接连接到 /pycore-manager/vocabulary 中对应的 tab。

   4b. 音频编排中的 "ffmpeg 检测中…"：直接缓存在前端，扩展前端中心缓存库，扩展为通用，同时每 3 小时检测一次，或者客户端 pycore 的 Relay 为新的重新检测，所以要扩展缓存库。

   4c. 编排任务（如 NIV-Bible_20260917_052030.364_4f381de0，NIV-Bible · 10 段落 · 仅新词（虚拟已读），生成中 / 补齐资源，5570/29177 音频项，0/10 段落，缓存命中 5,530 · 来自 Laravel 6 · 本地生成 8 · 已同步 8 · 缺失 26）以上扩展出分页面板，点击数据的时候需要在分页面板中查看每个数据的详细，包括进度、缓存命中、本地生成（注意这里要联动 pycore 中的 qwentts 句子生成和单词生成底座）、禁止各自写复用的类库、已同步、缺失都要补全，并复用调用 UI 中的和 PYCORE 中的数据和类库。如果以上代码还没有关联，推导并全部关联为中心类库和中心数据。

5. 以上提示词先写到 docs_fix 目录中，然后再开发。（本文档即该要求产物）

## §2 Work breakdown

- [x] T1 UI first-paint ordering: page must render shell immediately; network/device/laravel probes must not block panel components (PcFloatingPanel, LaravelMediaUrl, PcAgentHistoryLogPanel, PcAgentHistoryVideoLogPanel, PcAgentHistoryAiPanel, PcAgentHistoryToolCheckboxes, TurnView).
- [x] T2 OpenRouter records panel: reuse/extend existing panel infra (PcFloatingPanel + PcPager + tool_fragment-style paging), paginated records (success, prompt, response, latency), in-flight progress, time/day filtering; generic enough for other AI providers. Backend record source in pycore.
- [x] T3 Prompt override: pycore preset prompts editable in panel; edits saved to user data dir; load order user-dir > code fallback.
- [x] T4 Move "生成学习视频" (learning video generation) out of agent-history into vocabulary audio orchestration tab; leave a shortcut link in agent-history. Reuse existing orchestration code; no duplicate libs.
- [x] T4b ffmpeg detection: cache result in frontend central cache library (extend it to generic), re-check every 3h or when pycore relay reports a new client.
- [x] T4c Orchestration task detail panels: per-statistic paged panels (progress, cache hits, from Laravel, local generation linked to pycore qwentts sentence/word generation base, synced, missing); centralize shared libs/data between UI and pycore.

## §3 Implementation log

### T1 UI first-paint ordering
- Root cause: `PcUiStateBackupGate` blocked the whole app until `pycoreManagerUiStateSync.initialize()` finished; the backend state read went through MasterApiClient with a 30-minute default timeout, so the lazily-loaded page chunks (PcFloatingPanel, LaravelMediaUrl, the agent-history panels, TurnView) painted last behind a black screen.
- `apps/pycore-manager/persistence/PcUiStateBackupGate.tsx`: 1200ms grace race — children render after the grace window even if the state read is still in flight; listeners register immediately; if a late reconcile actually changed state, the app reloads once to apply it.
- `persistence/PycoreManagerUiStateSync.ts`: `initialize()` returns `Promise<boolean>` (reconcile changed state); state read capped by `STATE_READ_CEILING_MS = 10_000`.
- `PcApp.tsx`: module-level `void import('./pages/PcAgentHistoryPage')` pre-warms the home-page chunk.

### T2 OpenRouter records panel
- `pycore/pyctl/ai/ai_usage_log.py`: `_DETAIL_CAP = 12000`; per-record `prompt`/`response` fields; in-memory in-flight registry (`begin_call`/`end_call`/`in_flight_calls`); `usage_log` gains `page`/`page_size`/`day` (iso-prefix match) returning `total`/`page`/`page_count`/`in_flight`.
- `pycore/pyctl/ai/ai_chat.py`: `chat_once` wraps calls in begin/end_call and records prompt + response.
- `pycore/callmodule/rpc_routes/local_ai_probe_routes.py`: usage route passes the new paging params through.
- UI: `core/integrations/pycore/PycoreAiTypes.ts` + `PycoreApiAi.ts` (`getAiUsage(number | AiUsagePageOptions)`, backwards compatible).
- New generic panel `apps/pycore-manager/components/PcAiUsageRecordsPanel.tsx` (PcFloatingPanel + PcPager, 20/page, day filter, 4s in-flight polling, expandable prompt/response rows, `provider`/`sources`/`defaultDay` props) — reusable by any AI provider surface.
- `PcAgentHistoryAiPanel.tsx` refactored onto it (`provider="openrouter"`, sources article+translate, `defaultDay` follows the dashboard period).

### T3 Prompt override (user data dir)
- New `pycore/pyctl/agent_history/pipeline/prompt_templates.py`: `DEFAULT_ARTICLE_CN_PROMPT` / `DEFAULT_TRANSLATE_EN_PROMPT` (moved verbatim out of article_stages), token replace render, `resolve_prompt` (user config non-empty wins, code is the fallback), `prompt_defaults()`.
- `pipeline/config.py`: whitelist adds `prompt_article_cn` / `prompt_translate_en`; `config/agent_history.settings.json` defaults add both as `""`.
- `ui_service.py`: runtime payload adds `article_prompt_defaults`.
- UI: `AgentHistoryRuntimeStore.ts` (`articlePromptDefaults`), `PcAgentHistoryConfigPanel.tsx` collapsible prompt editors (dirty-ref guard against refresh clobbering, saving identical-to-default stores `""`, "reset to default" clears the override).

### T4 Learning video moved to vocabulary orchestration
- `PcVocabularyPage.tsx`: honors `?tab=` URL param (beats localStorage).
- New `pages/vocabulary/orchestration/OrchLearningVideoPanel.tsx`: same backend `video_*` config via `useAgentHistoryRuntime` / `persistAgentHistoryArticleConfig`, same `PcAgentHistoryVideoLogPanel` — no duplicated logic.
- `PcAgentHistoryConfigPanel.tsx`: video section removed, replaced by a shortcut link to `/pycore-manager/vocabulary?tab=audio-orch` (new locale keys `videoMovedToOrch` / `openAudioOrch`).

### T4b ffmpeg detection frontend cache
- `apps/pycore-manager/api/PycoreCache.ts`: generic TTL cache `saveTtlCache` / `loadTtlCache` / `loadTtlCacheStale` (prefix `pycore_ttl_cache:`).
- `VocabAudioOrchTab.tsx`: `orch.system_status` cached 3h; stale value paints instantly; expiry forces `orchSystemStatus(true)`; a pycore relay device change triggers a fresh probe.

### T4c Orchestration manifest drill-down panels
- `orch_generate.py`: manifest persists a new `resource_meta` map (`{resource_id: {source, provider, synced, sync_queued}}`) written in `_resource_done`; `_load_resume_state` reads it back (old manifests without it still resume).
- `orch_service.py`: new `task_manifest_page(task_id, category, page, page_size)` — pages the manifest's unique resources joined with `resolved` + `resource_meta`; categories all/cache/laravel/generated/synced/missing/pending.
- Routes: `UI_AUDIO_ORCH_TASK_MANIFEST_PAGE = "ui/audio_orch/task/manifest_page"` in `route_names.py`, registered in `local_audio_orchestration_routes.py`.
- UI: `PycoreHttpRoutes.ts` + `PycoreApiOrchestration.ts` (`orchTaskManifestPage`, `OrchManifestItem`/`OrchManifestPageResponse` types); new `pages/vocabulary/orchestration/OrchManifestPanel.tsx` (PcFloatingPanel + PcPager + category tabs, 5s live refresh while the task runs; generated rows show the provider, i.e. the qwen TTS base); `OrchTaskList.tsx` stats counters (cache / from Laravel / generated / synced / missing, plus the "x/y audio items" progress) are now buttons opening the panel at the matching category.

### Verification
- `npx tsc --noEmit`: zero errors in all touched files; repo total unchanged at 97 pre-existing errors unrelated to this task.
- `ast.parse` passes for every touched Python file.
- Not verified at runtime (pre-existing environment gaps, not introduced here): no php cli on this machine, default python lacks aiohttp so a live pycore smoke run was not possible.
