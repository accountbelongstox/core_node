# wordnew 开发指南

适用范围：`poly_apps/pycore_laravel_wordnew_ui/apps/wordnew`、`shared/orchestration`，以及 pycore-manager 中复用编排的部分。全局规则（`AGENTS.md`）优先，并与本文叠加。

## 1. 片段调度器（硬性规则）

编排所需的单词、句子音频片段从哪里取，**只由** `shared/orchestration/orchClipScheduler.ts` 决定。任何一端（wordnew 手机端、网页端、pycore-manager）都必须用 `buildOrchClipSchedule` 构建来源链，不得自己拼来源数组或另写取片段逻辑。

### 1.1 顺序（R1，代码中 `ORCH_CLIP_STAGE_ORDER`，构建时自检，违反直接报错）

| 顺序 | 阶段 ID | 内容 | 何时执行 |
|---|---|---|---|
| 1 | `device` | 本机存储 | 总是（仅 App 端；网页端没有本机存储，从 2 开始） |
| 2 | `transfer:pycore` | 选中的 pycore 直连传输（批量包） | 选中的 pycore 直连可用 |
| 3 | `transfer:laravel` | Laravel 传输（批量包；旧服务器回退为逐个文件） | Laravel 可用 |
| 4 | `generate:pycore` | 直连 pycore 生成（复用 pycore 队列管线 `ui/queue_center/promote_local_head`） | 选中的 pycore 直连可用 |
| 5 | `transfer:relay` | 经 Laravel 中转的 pycore 传输 | 没有直连可用的 pycore，且中转可用 |
| 6 | `generate:relay` | 经中转的 pycore 生成 | 同上 |
| 7 | `generate:laravel` | Laravel 队列生成（移到队列最前） | 没有任何可达的 pycore（直连或中转），且 Laravel 可用 |

App 端与网页端顺序完全相同，不允许互换；一端只能省略自己没有的阶段（网页端省略 1）。网页端不落本地：Laravel 片段直接播放地址，pycore 片段只在当前页面内以对象 URL 存在。

### 1.2 其他硬性规则

- **R2** 直连 pycore 的阶段只在选中的 pycore 直连可用时执行。
- **R3** 中转阶段只在没有直连可用的 pycore、且中转可用时执行。
- **R4** Laravel 生成只在没有任何可达的 pycore、且 Laravel 可用时执行。
- **R5** 每个批量请求拿到传输名额（`core/network/TransferLimiter`）后，必须重新确认所属阶段的通道仍可用。通道中途消失后，不得再向它发送请求。
- **R6** 生成阶段在本次运行中不交付片段。每次运行最多请求 `generate_max_items` 个**新的**缺失片段（按播放顺序，从该阶段的游标开始）；有效期内已请求过的片段保持 `generating` 标记、不再重复请求。继续靠 `recheckGenerating` 检查加任务续跑（`WordNewOrchComposer` 的生成监视），阶段本身不得等待。
- **R7** 通道是否可用，每一端只有一个来源。wordnew 用 `apps/wordnew/services/compute/WordNewCompute.ts` 的 `wordNewChannels`（与计算调度器共用，带防抖）。阶段自己不得判断可用性，也不得新增第二套可用性判断。
- **R8** 每个片段每次运行只交付一次；通道没有交付的片段要立即释放（不能停在"加载中"），交给下一阶段。

- **R10** 状态与进度：状态是 `OrchClipTable`（每个计划片段 1 字节：状态 / 来源 / 通道 / 生成标记；计划的片段数组就是映射，下标 ↔ 片段），进度是每个阶段的游标（端点、计划位置、时间），由 `OrchCursorBook` 管理；有效期为合同 `transfer.absence_recheck_minutes`。不得再引入按条目保存的对象或文本。恢复运行时各阶段从有效的游标继续；本机阶段一次批量查找（`wordNewOrchClipStore.lookup`），本机缓存优先。进度上报不得复制表，发布时按 `table.version` 刷新。本机片段索引是快照 + 追加日志（每个片段一行，`JOURNAL_COMPACT_RECORDS` 条后才重写快照），不得每次变更重写整个索引；时长测量先一次取出已存时长，只探测新片段，并上报 `measureProgress`。界面 memo 依赖计划 / 时间线 / 片段表等引用，不依赖 session 对象。

### 1.3 相关约定

- 片段身份：`resourceId = sha256("kind:language:content")`，句子的 content 为 content id，单词为小写原词；pycore、Laravel、客户端三端一致。
- 批量包格式与上限：`config/audio_orchestration_contract.json` 的 `transfer` 段（pycore 与 Laravel 回答同一种帧格式）。手机端由原生 Cronet 插件（`ProtocolHttp.bundle`）直接写入片段目录，片段内容不经过 WebView 通道。
- 并发：所有大流量传输都通过 `TransferLimiter` 占用后端通道的名额；上限是本机设置，默认值来自合同 `transfer.parallel_defaults`。
- 每个交付的片段记录来源通道 `via`（`pycore` / `relay` / `laravel`）；界面（`WordNewOrchChainBadge`、进度条目）据此显示。

- **R9 反复上下线的恢复**（pycore 和 Laravel 相同，代码在 `WordNewOrchComposer`）：
  - 可用性只看 `wordNewChannels`，上线和下线都有防抖，链路抖动不会反复触发。
  - 通道中途下线：本次运行中，该通道的阶段不再收到请求（R5），片段交给下一阶段；拿不到的片段记为缺失，任务状态为 `partial`。运行失败（例如输入加载时 Laravel 不在）时，任务保持 `resolving`（界面显示"已暂停"），不会退回草稿。
  - 任一通道（直连 pycore、中转、Laravel）由不可用变为可用、切换了选中的 pycore 或 Laravel 端点、浏览器 `online` 事件、应用或页面启动时：本设备所有 `resolving`/`partial` 任务都自动续跑，不论页面是否打开。
  - 正在运行的任务遇到上述事件，本次运行结束后再补跑一次。
  - 续跑幂等：沿用已保存的进度，只补缺失的片段。
  - 已交给后端生成的片段每隔 `generation_recheck_seconds` 检查一次，pycore 一旦拥有就续跑，最长持续 `generation_watch_minutes`。超时后，下次通道恢复时仍会续跑。
  - TTS/OCR 单次计算由 `wordNewCompute` 调度：作业写入持久日志；两端都离线时作业保持等待，任一端恢复后自动继续；已提交给 Laravel 的作业在重新加载后继续轮询。

### 1.4 修改流程

修改以上任何规则，都需要先获得用户同意，并同步更新：
1. `orchClipScheduler.ts` 的 HARD RULES 注释和 `ORCH_CLIP_STAGE_ORDER`；
2. 本指南第 1 节；
3. 演练脚本 `docs_fix/TEST_20261001_ORCH_CLIP_SCHEDULER_DRILL.md`。修改后用 bun 运行，S1–S8 和随机 300 轮必须 0 违规。

设计背景：`docs_fix/REQUIREMENTS_20260930_WORDNEW_CLIENT_ORCHESTRATION.md` 4.13–4.17。
