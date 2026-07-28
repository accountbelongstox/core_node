# FIX_20260728_LEGACY — 遗留 TypeScript 错误清单（文档化，不修复）

> 来源：c.txt 全量 BUG 修复批次（见本次会话 S3）演算阶段发现。
> 按用户指示：本文件仅登记遗留错误与修复建议，**不在本批次修复**。
> 采集命令（2026-07-28，工作区含 S3 全部修复）：
>
> ```bash
> cd apps/mcp-chrome/app/chrome-extension && npx vue-tsc --noEmit   # → 60 errors
> cd poly_apps/pycore_laravel_wordflow_ui && npx tsc --noEmit       # → 255 errors
> ```
>
> 已顺手修复（不在清单内）：`tab-controller.ts` 两处 `chrome.tabs.OnActivatedInfo/OnRemovedInfo`
> → 新版 @types/chrome 的 `TabActiveInfo/TabRemoveInfo`。

---

## A. mcp-chrome（vue-tsc，60 项）

### A.1 真实缺陷级（建议优先）

| 文件 | 数量 | 错误 | 建议修法 |
|---|---|---|---|
| `entrypoints/background/deepseek-polling-service.ts` (359–383) | 6 | `result is possibly 'undefined'` | 解构前判空：`const r = result; if (!r) return/continue;` |
| `entrypoints/background/tools/browser/computer.ts` (206–673) | 19 | `success/error/message/element/direction/ticks/tagName does not exist on type 'object'/'{}'` | 为 `chrome.scripting.executeScript` 的返回定义结果接口（`{success?, error?, ...}`），不要用裸 `object`；`{x,y} | null` → 目标类型 `... | undefined`，赋值前 `?? undefined` |
| `entrypoints/popup/components/extensions/QueueCenterPanel.vue` (39–40) | 2 | 找不到 `./LocalTaskQueue.vue`、`./LogViewerPanel.vue` | 组件已不存在：删除这两个 import 及其模板用法，或恢复组件文件 |
| `entrypoints/background/tools/base-browser.ts` (82–85) | 5 | overload 不匹配 + `void` 参与真值判断 + `never.error` | 修正调用的参数签名；`void` 表达式不要 `&&` 短路读取 `.error` |
| `entrypoints/background/ai-web-client-listener.ts` (70–76) | 3 | 联合类型上无 `.text` | 窄化：`const c = result?.content?.[0]; const text = c && 'text' in c ? c.text : ''` |
| `entrypoints/background/tools/audio.ts` (153) | 1 | 少传 1 个实参 | 按目标签名补第二参数 |

### A.2 类型签名漂移级（机械修复）

| 文件 | 数量 | 错误 | 建议修法 |
|---|---|---|---|
| `dialog.ts` / `gif-recorder.ts` / `performance.ts` (×3) / `userscript.ts` / `web-search.ts` | 7 | `Tab \| null` → `Tab \| undefined` | `?? undefined` 或把中间变量类型改为 `\| undefined` |
| `bing-dictionary-client-listener.ts` (110) | 1 | `string` → `'"en"'` | 参数类型放宽为 `string` 或调用处收窄字面量 |
| `web-ai-translate-worker-service.ts` (98) | 1 | `waitForCompletion` 不在参数类型 | 参数接口补可选字段 `waitForCompletion?: boolean` |
| `userscript.ts` (149) | 1 | `code` 不在 `InjectScriptParam & ScriptConfig` | 交叉类型补 `code?: string` |
| `howtopronounce.ts` (127–128) | 3 | `audio` 不在 `HowToPronounceResult` | 结果接口补 `audio?: ...` |
| `audio-recorder.ts` (130) | 1 | `mandatory` 不在 `MediaTrackConstraints` | 强转为旧式约束对象或更新约束写法 |
| `TaskCenterPanel.vue` (89) | 1 | `string \| number` → `string` | `String(...)` 包裹 |
| `ExtensionStorage.ts` (23) | 1 | overload 不匹配（`StorageKey[]` vs `keyof T`） | 泛型调用处显式类型实参或放宽键类型 |
| `duoreader-audio-store.ts` / `web-search-cover-cache.ts` (×2) | 3 | `Uint8Array<ArrayBufferLike>` → `FileSystemWriteChunkType/BlobPart`（TS 5.7 ArrayBuffer 泛型） | `new Uint8Array(new ArrayBuffer(n))` 或 `as Uint8Array<ArrayBuffer>` |
| `duoreader-importer-core.ts` (809) | 2 | 无交集比较（`'tts'/'catchup'` vs `DuoreaderImportStep`） | 死分支：删除或把 step 联合类型补齐 |
| `pz-bunzip.ts` (8) | 1 | 缺 `bzip2.mjs` 声明 | 新增 `types/bzip2.d.ts`：`declare module '*.mjs'` 或精确声明 |
| `wxt.config.ts` (72) | 1 | `env` 不在 `UserConfig` | 移到 wxt 支持的配置位或 `as any` 标注 |
| `services/duoreader-importer-service.ts` (762) | 1 | 联合类型 → `BackendChapterIngestStatus` | 判空窄化后传参 |

---

## B. wordflow UI（tsc，255 项）

### B.1 最大集群：`apps/wordnew/api-libs/wordflow/`（171 项）— 一次未完成的重构

`wordflowMethods.ts` (96)、`wordflowGroupMethods.ts` (60)、`WordflowApi.ts` (15)。
症状高度一致，根因是一轮没做完的抽取重构：

- 引用了从未定义/导入的名字：`StorageCenter`、`StorageKey`、`User`、`Word`、`WordGroup`
  （`wordflowApiTypes.ts` 里只有部分类型；`Word/WordGroup` 未从此模块导出）。
- `Module '"./WordflowApi"' declares 'WordflowTransport' locally, but it is not exported`
  （`wordflowMethods.ts` / `wordflowGroupMethods.ts` 都需要它）。
- `this.request` / `this.recitationCache` / `RECITATION_CACHE_TTL` 在类上不存在
  （基类抽取时遗漏的成员声明）。
- `Duplicate identifier 'invalidatePublicMediaCache'`，且 `WfLibraryCenter.ts` 外部调用
  `protected invalidatePublicMediaCache`（4 项 TS2445）——可见性设计与调用方矛盾。
- `toFullLanguageName` 未导出（`wordflowApiTypes.ts:338` 为模块内 const）。

建议修法（二选一）：
1. **完成重构**：在 `wordflowApiTypes.ts` 补齐 `Word/WordGroup/StorageCenter/StorageKey/User`
   导出（或从正确模块 re-export）；`WordflowApi.ts` 导出 `WordflowTransport`；
   基类补 `request/recitationCache` 声明；`invalidatePublicMediaCache` 改为 public 或
   经由 public 方法暴露；导出 `toFullLanguageName`。
2. **若属死代码**：旧 wordflow app 已废弃（shell 注释确认），评估整目录
   `apps/wordnew/api-libs/wordflow/` 下线；注意 `services/Wf*Center.ts` 仍在 import
   `wordflowApi`（见 WfUserCenter/WfLibraryCenter 等 10+ 处），下线前需先迁移这些调用方。

### B.2 缺名字/缺导出（多为少 import）

| 文件 | 数量 | 缺失 |
|---|---|---|
| `apps/wordnew/api/WfNewApiMockHelpers.ts` | 12 | `WfNewPost/WfNewPostComment/WfNewLive/WfNewLiveMsg/Word/MOCK_VOCABULARY_MAP/MOCK_WALKMAN_WORDS`（应 import 或恢复常量） |
| `apps/pycore-manager/pages/PcQueueOverviewPanel.tsx` | 1 | `Users`（lucide-react 漏 import） |
| `apps/pycore-manager/pages/PcSettingsPage.tsx` | 1 | `loadAssist`（漏 import/漏定义） |
| `components/vocabulary/QuizPanel.tsx` | 1+1 | `RefreshCw` 漏 import；QuizQuestion `type` 需收窄为字面量联合 |
| `core/api-libs/pycore/PycoreApi.ts` (217) | 1 | `guardPycoreReachability`（漏 import/漏定义） |
| `apps/wordnew/api/methods/social.ts` | 4 | `absUrl` 漏 import |
| `apps/wordnew/hooks/useWfNewContentHandlers.ts` (262) | 1 | `getCachedGroupIds` 漏 import（cache/WfNewContentCache 已有此导出） |
| `apps/wordnew/api/types/social.ts` | 2 | `WfNewSocialStats` 未定义（应补 interface） |
| `apps/pycore-manager/components/PcWordAudioPanel.tsx` | 1 | `JSX` namespace（改 `React.JSX.Element` 或补 React 19 类型引用） |
| `apps/pycore-manager/pc-locales/zh.ts` | 1 | 缺 `ttsServerSingleHint`、`ttsModelLoaded` 两条翻译键 |
| `hooks/useApiRequest.ts` | 1 | `APIResponse` 应为 `ApiResponse`（`../types`） |
| `core/api/base/APICache.ts` | 1 | `../types` 模块不存在（路径失效，需指向真实类型模块） |
| `core/api/modules/ServerManagerV1.ts` | 1 | `NginxSite` 未从 `../../types` 导出 |
| `core/routing/viewRoute.ts` | 1 | 路由表缺 `ai_management/word_audio/dev_history` 三个 ViewType 映射 |

### B.3 unknown / 类型收窄

| 文件 | 数量 | 建议 |
|---|---|---|
| `apps/wordnew/hooks/useVisibleWordPriority.ts` | 9 | 给队列查询结果定义行类型（`{queueKey, word, hasTranslation, hasAudio, hasImage, language}`）替代 `unknown` |
| `apps/pycore-manager/components/PcAiCapabilityView.tsx` (324) | 3 | API 返回补接口（`{key_count, keys, image_keys}`） |
| `apps/pycore-manager/pages/vocabulary/VocabStatisticsTab.tsx` | 2 | 同上（`{count, size}`） |
| `apps/wordnew/pages/WfNewBookReader.tsx` (565) | 1 | 结果窄化后取 `.text` |
| `components/vocabulary/VocabAssistQueuesPanel.tsx` (91) | 1 | `unknown > number`：比较前 `Number(...)` 或补类型 |
| `components/views/Settings.tsx` (115) | 1 | 联合收窄：`if (!res.ok) res.error` |
| `apps/wordnew/components/admin/WfNewAdminWords.tsx` (333) | 1 | `unknown[]` → `string[]`（map 时标注） |
| `apps/wordnew/api/WfNewAdminApi.ts` (334,338) | 2 | 交叉类型 → `Record<string, unknown>`：展开为新对象 |
| `core/api-libs/pycore/PycoreCapabilityStore.ts` (155) | 1 | `window.setInterval` 返回 number：把 `pollId` 类型改为 `number \| null` |
| `core/api/modules/InviteCodeAPI.ts` | 5 | 后端 envelope 未解包：`data.items` 类型补接口，勿把 `{}` 当 `InviteCode[]` |

### B.4 组件 props / 边界类

| 文件 | 数量 | 建议 |
|---|---|---|
| `components/views/media/ViewerErrorBoundary.tsx` | 12 | class 组件未继承 `React.Component<Props, State>`（或改成函数组件 + ErrorBoundary 库模式）；`ViewerErrorBoundaryProps` 补 `downloadUrl/label` |
| `components/views/media/FileViewer.tsx` | 2 | 同上，props 对齐 |
| `components/admin/Toast.tsx` (164) | 1 | 去掉多传的 `key` 或补 props 类型 |
| `components/views/CodeBrowserV2.tsx` (414) | 1 | `string \| number` → `Number(...)` |
| `components/views/SystemInfo.tsx` (130) | 1 | 样式对象补 `checkbox` 键 |
| `core/models/ITToolsModel.ts` | 6 | 工具入参类型补可选字段（`text/number/paragraphs/value`），均为工具定义与调用漂移 |

---

## C. 超 800 行文件拆分候选（AGENTS.md「Modular」规范）

| 行数 | 文件 | 拆分建议 |
|---|---|---|
| 1197 | `poly_apps/pycore_laravel_wordflow_ui/shared/capabilities/CapFilesystem.ts` | 按 OPFS/native 后端、CapBlobStore、CapLargeCache、hooks 四块拆 |
| 1095 | `pycore/database/repositories/state_repository.py` | 按 operations / rpc_outbox / ui_snapshots / idempotency 拆多个 repo 模块 |
| 933 | `poly_apps/laravel_main/app/Http/Controllers/MediaBrowseController.php` | 按 subtitles/books/documents/articles 拆控制器或服务层 |
| 849 | `poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Services/AppQyV1AssistMediaOperations.php` | 多封面（MoviePosterStore 交互）与 provenance 规则可再抽服务类 |
| 836 | `poly_apps/pycore_laravel_wordflow_ui/apps/wordnew/WfNewApp.tsx` | 各 tab 的 motion.div 区块抽为独立页面组件（daily-reading/book-reader/social 已有组件，直接搬渲染段） |
| 795 | `poly_apps/pycore_laravel_wordflow_ui/apps/wordnew/hooks/useWfNewAppState.ts` | 接近上限；hash 路由段可抽 `useWfNewHashRouter` |

注意：`wordflowMethods.ts`/`WordflowApi.ts`（各 667 行）暂低于 800，但 B.1 的重构收尾会改变其体量，建议合并处理。

---

## D. 验收方式

修复后逐项回归：

```bash
cd apps/mcp-chrome/app/chrome-extension && npx vue-tsc --noEmit   # 目标 0 errors
cd poly_apps/pycore_laravel_wordflow_ui && npx tsc --noEmit       # 目标 0 errors
```

拆分类改动额外要求：`pnpm build`（wordflow UI）与 `wxt build`（mcp-chrome）通过；
pycore 侧 `python -m py_compile` 通过；laravel 侧 `php -l` 通过。
