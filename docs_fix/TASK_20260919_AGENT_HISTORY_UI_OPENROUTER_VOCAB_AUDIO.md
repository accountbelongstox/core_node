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

- [ ] T1 UI first-paint ordering: page must render shell immediately; network/device/laravel probes must not block panel components (PcFloatingPanel, LaravelMediaUrl, PcAgentHistoryLogPanel, PcAgentHistoryVideoLogPanel, PcAgentHistoryAiPanel, PcAgentHistoryToolCheckboxes, TurnView).
- [ ] T2 OpenRouter records panel: reuse/extend existing panel infra (PcFloatingPanel + PcPager + tool_fragment-style paging), paginated records (success, prompt, response, latency), in-flight progress, time/day filtering; generic enough for other AI providers. Backend record source in pycore.
- [ ] T3 Prompt override: pycore preset prompts editable in panel; edits saved to user data dir; load order user-dir > code fallback.
- [ ] T4 Move "生成学习视频" (learning video generation) out of agent-history into vocabulary audio orchestration tab; leave a shortcut link in agent-history. Reuse existing orchestration code; no duplicate libs.
- [ ] T4b ffmpeg detection: cache result in frontend central cache library (extend it to generic), re-check every 3h or when pycore relay reports a new client.
- [ ] T4c Orchestration task detail panels: per-statistic paged panels (progress, cache hits, from Laravel, local generation linked to pycore qwentts sentence/word generation base, synced, missing); centralize shared libs/data between UI and pycore.

## §3 Implementation log

(filled during development)
