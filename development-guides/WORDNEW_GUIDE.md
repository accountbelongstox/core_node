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
| 4 | `generate:pycore` | 直连 pycore 生成（复用 pycore 队列管线 `ui/queue_center/promote_local_head`）；书籍计划的片段不走此阶段（R11） | 选中的 pycore 直连可用，且只含它能生成的片段（R4） |
| 5 | `transfer:relay` | 经 Laravel 中转的 pycore 传输 | 没有直连可用的 pycore，且中转可用 |
| 6 | `generate:relay` | 经中转的 pycore 生成 | 同上，且只含它能生成的片段（R4） |
| 7 | `generate:laravel` | Laravel 队列生成（移到队列最前）；书籍计划的片段不走此阶段（R11） | Laravel 可用，且只含被询问的 pycore（直连，否则中转）不能生成的片段；没有任何 pycore 时为全部片段（R4） |

App 端与网页端顺序完全相同，不允许互换；一端只能省略自己没有的阶段（网页端省略 1）。网页端不落本地：Laravel 片段直接播放地址，pycore 片段只在当前页面内以对象 URL 存在。

### 1.2 其他硬性规则

- **R2** 直连 pycore 的阶段只在选中的 pycore 直连可用时执行。
- **R3** 中转阶段只在没有直连可用的 pycore、且中转可用时执行。
- **R4** Laravel 生成只对"被询问的 pycore 不能生成"的片段执行，且 Laravel 可用。被询问的 pycore = 直连可用时的直连 pycore，否则是中转可用时的中转 pycore，否则没有。"能生成"= 该 pycore 声明的通道能力（`ui/queue_center/lane_capability`：通道、语言、引擎，与它领取租约时声明的一致）覆盖片段的（类型, 语言）；能力未知（旧 pycore、尚未读到）视为能生成。于是 pycore 阶段与 Laravel 阶段拥有互不相交的片段：没有 pycore 时 Laravel 生成全部；pycore 能生成的片段不交给 Laravel；pycore 不能生成的（例如 CPU pycore 的英文句子）由 Laravel 生成，不会永远停在生成中。能力由 `WordNewLaneCapability` 缓存，选中的 pycore 变化、通道恢复、运行开始时读取。例外：服务器书籍计划（R11）的片段不论 pycore 状态如何，都由 Laravel 的工作租约分派给所有节点生成；各阶段只把它们标记为 `generating`。
- **R5** 每个批量请求拿到传输名额（`core/network/TransferLimiter`）后，必须重新确认所属阶段的通道仍可用；每个生成请求在任何重试等待之后、发送之前，必须重新读取所属阶段的门（通道和能力，R4）。通道或能力中途消失后，不得再向它发送请求（该批不标记为生成中，游标不前进，下一阶段按新的门接手）。
- **R6** 生成阶段在本次运行中不交付片段。每次运行最多请求 `generate_max_items` 个**新的**缺失片段（按播放顺序，从该阶段的游标开始）；有效期内已请求过的片段保持 `generating` 标记、不再重复请求。继续靠 `recheckGenerating` 检查加任务续跑（`WordNewOrchComposer` 的生成监视），阶段本身不得等待。服务器书籍计划（R11）的片段：每次运行只向直连 pycore 请求 App 主导分配（R12）给它的份额（尚未算出分配时为 `book_plan.local_head_items` 个），其他生成阶段一个都不请求；之后由计划的游标（而不是 `recheckGenerating`）继续。
- **R7** 通道是否可用，每一端只有一个来源。wordnew 用 `apps/wordnew/services/compute/WordNewCompute.ts` 的 `wordNewChannels`（与计算调度器共用，带防抖）。阶段自己不得判断可用性，也不得新增第二套可用性判断。pycore 可用 = 共享 `pycoreLink` 判定选中目标在线（探测或请求已应答）或 HTTP/事件连接在线，不得只依赖“请求成功后才得知”的可达性（否则在第一次请求前永远不可用）；可用性在模块加载时启动，首次读数会通知订阅者。局域网直连：开启 LAN 绑定（`rpcLanBind`）的 pycore 在 Laravel 节点名册里上报局域网地址（`lan_urls`）；App（原生壳）对选中机器的局域网地址探测成功后，请求改走局域网（`setPycoreLanRoute`，局域网内无需密钥），失败或断线立即回到选中地址、稍后重试。局域网路线只是同一台选中机器的地址，不是第二个可用性来源；事件 WebSocket 仍走选中地址。阶段游标按选中的机器（pycore）或服务器 id（Laravel 端点 id）保存，不按请求实际使用的地址：局域网路线与选中地址之间的切换、同一服务器的端点切换都保留游标（`OrchClipChannel.cursorKey`）；生成阶段的游标另含通道能力（`capabilityKey`），能力变化后重新请求。
- **R8** 每个片段每次运行只交付一次；通道没有交付的片段要立即释放（不能停在"加载中"），交给下一阶段。只有本次运行中至少有一个后端应答过（或某个可用阶段跳过了它有效游标之前的片段，即该后端在有效期内已应答过；否则恢复运行什么都不请求，片段会一直停在排队、也不会被生成监视），才能把剩余片段记为缺失；没有任何后端应答（通道全部不可用、请求被中止）时，片段保持排队，留给下一次运行。

- **R11** 有书籍的任务向 Laravel 提交一次书籍计划（`orch_audio/book_plans`，按书 + 章节 + 语言 + 是否含单词识别），由 Laravel 负责片段清单、优先级（从阅读位置往后的头部窗口优先），并通过工作租约分派给所有节点生成（App 打开时由 App 按 R12 主导分配，App 关闭时 Laravel 自行调度）。传输阶段只请求服务器已报告就绪的计划片段（就绪 id 按游标分页取得，`clip.ready` 实时事件触发下一次拉取），以及所有计划外的片段；这类任务不保留传输游标。计划不可用时，按 R1–R10 原样调度。只有原生壳把已交付的片段留在本机，所以就绪游标只在原生壳里跨运行保留；网页端每次运行都从 0 重新取全部就绪 id（片段只在当前页面内存在，沿用上次游标会让已就绪的片段永远取不回来）。

- **R12** 书籍计划的 App 主导调度：App 打开且计划进行中时，wordnew（`services/orchestration/WordNewBookPlanAssigner.ts`）按它知道的节点（Laravel 在线节点名册：通道、算力类别、吞吐，加上直连 pycore）把计划接下来待生成的片段分成窗口（节点短 id、通道、语言、数量，自阅读位置起依次排列，窗口大小为节点每小时处理量乘合同 `book_plan.assignment_horizon_minutes`，且不小于节点的租用批量 `batch_size`，使节点下一次领取全部落在计划内），每 `book_plan.assignment_refresh_seconds` 向 `orch_audio/book_plans/{planId}/assignments` 提交一次（即计划心跳；窗口和直连节点没有变化时，两次心跳之间不重复提交）。Laravel 在最后一次提交后的 `book_plan.assignment_ttl_seconds` 内只把窗口内的行租给被指定的节点；直连 pycore 的窗口没有任何节点会租，由 App 通过 `generate:pycore` 直接生成（份额见 R6）。直连窗口只为直连 pycore 声明能力覆盖的（通道，语言）提交（CPU pycore 没有英文句子窗口，份额为 0），窗口 sid 为 `book_plan.direct_sid:<设备 id 前 book_plan.direct_sid_device_chars 位>`（每台设备一个，多设备各保留自己的直连范围，互不覆盖），请求同时带 `device_id` 和直连 pycore 的节点 sid（`direct_node_sid`）；直连 pycore 与名册节点按节点 sid 匹配（旧 pycore 无节点 sid 时回退为主机标签）。直连 pycore 下线、切换了选中的 pycore 或能力变化时，立即重新计算并提交（不等下一次心跳；有请求在途时在其结束后立即再提交一次），被丢弃的直连范围随提交释放。心跳过期（App 已关闭）后，Laravel 回到自己的公平份额调度，作为后备调度器。计数来自服务器计划计数器和本机存储，不得按次重算；每个节点显示 已分配 / 生成中 / 已完成，跨运行只增不减。

- **R13** 静态音频的存放与质量底线：每个 pycore 生成的每个静态片段都永久保留在本机缓存（单词缓存、句子缓存、`audio_clips`），用于幂等查找、wordnew 同步和作为 Laravel 的后备；交付完成、重试或丢弃交付行都不得删除已生成的片段（outbox 只清理自己持有的 retained 副本）。每个片段还必须上传到 Laravel，Laravel 离线时留在持久 outbox（SQLite）里，pycore 启动时从磁盘加载并重试直到成功。wordnew 取片段仍是先直连 pycore、再 Laravel（R1 顺序不变）。质量底线只约束英文句子（合同 `work_leases.sentence_quality.accepted_engines_by_language`，当前只有 `en`）：英文句子只接受 qwen3tts（GPU）生成的音频——Laravel 拒收其他引擎的英文句子报告，英文句子行只租给 GPU 节点（任务类型 `sentence_audio` 的 `compute_by_language.en` 为 `gpu_required`），pycore 不用其他引擎合成或上报英文句子，句子快速通道（kokoro）已关闭（`book_plan.fast_pass.enabled=false`）；已存的低质量英文句子（记录的来源不在合格引擎内）不算最终音频，由 sys:init / 定时任务（只扫描底线语言）退回池中等待 qwen3tts 重新生成，下一次合格报告会替换文件。其余一切——单词、短语、中文句子（含单词 / 短语释义片段和短文中文行）——不受底线限制，CPU（kokoro）或 GPU 均可生成。因此 CPU pycore 能做释义、单词、短语和中文句子，不能做英文句子；谁能做什么由 pycore 声明的通道能力决定，wordnew 据此分配（R4、R12）。

- **R14** **（重要）已缓存的静态资源永不删除、永不重复下载**：无论编排如何运行（计划、重排、重新布局、切换语言或书籍、重置、续跑、失败重试、应用重启、版本升级），设备上已缓存的静态资源（音频片段、片段包、单词/句子音频、图片及其他已下载的静态文件）都不得被删除、覆盖或淘汰（包括按容量预算淘汰、存放在系统可清理的缓存目录），下载前必须先按稳定内容键（`resourceId`）查本机缓存，已持有就不再请求。唯一例外是专门的清理或更新接口：用户触发的清除缓存、删除某条资源、迁移存储位置，以及服务器对该资源声明的内容更新（版本变化）。更新路径：Laravel 的 `audio/lookup`（带 `with_version`）与批量包帧头报告每个片段的 `version`（服务器所提供文件的修改时间）和该文件的地址；`WordNewClipUpdater` 分批、按持久游标检查本机索引，只在报告的版本与本机记录的版本不同时，才把新文件下载到旁边、下载完成后替换该片段（没有记录版本的片段只记录首次报告的版本，不下载）。阅读器音频缓存（wfnew-audio）里的句子，以及调用方已声明身份（种类、语言、文本）的单词，按 `resourceId` 存入片段库，其余文件按地址路径存放，主机或查询参数变化不会重新下载。

- **R16** 编辑编排不中断下载：修改编排（调整步骤顺序如英中改为中英、增减步骤或释义、单词组 / 阅读状态等）时，正在进行的旧计划运行不中止，转为后台运行：不再显示，把取得的片段交给当前运行，并在阶段边界停止请求新计划已不需要的片段（动态调整下载集合）。新计划立即用内存中的输入重新编排，按片段键继承旧计划的进度（状态表；游标只覆盖旧阶段已全部请求过的最长前缀，`orchCarryProgress`），本机阶段和预览不等待书籍计划请求；后台运行仍在取的片段，新计划的网络阶段不重复请求（保持排队，后台运行结束后当前计划续跑）。新计划的预览 / 结果只作为"替换"提示给出，正在阅读的版本由用户确认后才替换（`WordNewOrchEditionStore`）。只有同一计划的"重新解析"和清除缓存会中止运行。

- **R10** 状态与进度：状态是 `OrchClipTable`（每个计划片段 1 字节：状态 / 来源 / 通道 / 生成标记；计划的片段数组就是映射，下标 ↔ 片段），进度是每个阶段的游标（端点、计划位置、时间），由 `OrchCursorBook` 管理；有效期为合同 `transfer.absence_recheck_minutes`。不得再引入按条目保存的对象或文本。恢复运行时各阶段从有效的游标继续；本机阶段一次批量查找（`wordNewOrchClipStore.lookup`），本机缓存优先。进度上报不得复制表，发布时按 `table.version` 刷新。本机片段索引是快照 + 追加日志（每个片段一行，`JOURNAL_COMPACT_RECORDS` 条后才重写快照），不得每次变更重写整个索引；时长测量先一次取出已存时长，只探测新片段，并上报 `measureProgress`。界面 memo 依赖计划 / 时间线 / 片段表等引用，不依赖 session 对象。

### 1.3 相关约定

- 片段身份：`resourceId = sha256("kind:language:content")`，句子的 content 为 content id，单词为小写原词；pycore、Laravel、客户端三端一致。
- **编排之外的所有音频**（单词喇叭按钮、单词列表 / 小组学习播放、每日阅读、阅读器句子与单词卡、字幕词、点击发音、随身听）只有一个入口：`runtime-store/WfNewAudioCache` 的片段接口（`ensureClipAudio`、`playableClip`、`awaitPlayableClip`、`heldClipAudio`、`preloadClipAudio*`，调用方传 kind / language / text 与负载给出的文件地址）。顺序固定：先按 `resourceId` 查本机片段库（R14，已持有就不请求）→ `WordNewClipResolver` 用与编排相同的传输阶段取（`WORDNEW_ORCH_SCHEDULE` 的 device、`transfer:*`，可用性只来自 `wordNewChannels`（R7），一次一个传输名额；**不触发任何生成阶段**，生成仍由 `WordNewQueueCenter` 的队列头请求与编排运行负责）→ 负载给出的 Laravel 文件；取到的一律存入同一片段库，身份与版本记录同 R13 / R14（网页端不落本地，沿用 R1）。口音 / 音色变体文件不是编排片段（`pickWordAudioUrl` 的 `variant`），仍按地址路径存放；浏览器语音是最后一级。不得再新增音频缓存或取片段逻辑；已持有片段的词不再向生成队列请求。
- 批量包格式与上限：`config/audio_orchestration_contract.json` 的 `transfer` 段（pycore 与 Laravel 回答同一种帧格式）。手机端由原生 Cronet 插件（`ProtocolHttp.bundle`）直接写入片段目录，片段内容不经过 WebView 通道。
- 并发：所有大流量传输都通过 `TransferLimiter` 占用后端通道的名额；上限是本机设置，默认值来自合同 `transfer.parallel_defaults`。
- 首次运行（还没有选中的 pycore）时，`WordNewPycoreLink` 在可达的候选中优先选 Laravel 在线工作节点里的 GPU 节点，其次 CPU 节点，最后才按延迟选最快的（按主机名匹配节点的 `label`）；之后只由用户切换。
- 节点身份：每个 pycore 在 Laravel 名册和 wordnew 里只是一个节点（`work_nodes` 按设备 id `node_id` 合并该设备所有通道的 worker；`sid` 由设备 id 派生；`workers` 给出通道到 worker 的映射，`lane_rates` 给出每通道吞吐）。R12 的窗口仍按（节点 sid，通道）提交，由该通道的 worker 租用；Colab/Kaggle 标签为 `<平台>-<设备 id 前 6 位>`。离线超过 `work_leases.node_hide_seconds` 的节点不再列出。
- 短语片段（kind `phrase`）：身份 `content_id = media_content_id(短语)`、`resourceId = sha256("phrase:language:content_id")`；编排步骤 `phrases`（每个句子之后读其短语，`meaning` 时再读中文释义，释义是 zh 句子片段）。短语片段走同一条来源链（R1 不变），不受 R13 句子质量底线限制（CPU/kokoro 可生成，任务类型 `phrase_audio` 为 `cpu_ok`，Laravel 租约通道 `phrase_audio`）；短语的中文释义是 zh 句子片段，同样 CPU 或 GPU 均可。编排页打开且连着在线的直连 pycore 时，短语音频由 wordnew 主调度（`generate:pycore` + R12 窗口通道 `phrase_audio`），Laravel 次要；否则 Laravel 主调度。短语文本由 Laravel 定时任务调用 OpenRouter 免费模型 + 预置 prompt 幂等生成（模型按实时免费目录选取并按健康度冷却，状态 `phrases/extraction_status`）。设计：`docs_fix/DESIGN_PHRASE_PIPELINE.md`。
- 短文条目（`config.passages`，仅有短文时来源为 `passages`）：`article` 条目（每日阅读 / Agent 短文，英文正文和中文参考存在任务配置里）或 `prompt` 条目（按任务键引用的改写结果）。短文句子是普通 `sentence` 片段（`resourceId = sha256("sentence:<语言>:<content id>")`），编号接在来源之后（`orchNextSeq`）并标记 `passage`，原样走 `buildOrchClipSchedule`（R1 顺序不变，不新增阶段或规则）；服务器书籍计划只管书籍片段（`orchBookCoveredKeys`），只属于短文的片段走普通来源链（R11）；来源保留自己的分段设置，每个条目一段。没有中文行的短文句子（英文正文没有对齐的中文参考、改写结果没有译文）在加载输入时由 Laravel 机器翻译（`ai_tools/translation/batch`，服务器缓存），按句子 content id 存进条目 `zh`（随任务配置同步，不改计划哈希，像短语一样加入同一计划并清掉阶段游标），之后每句英文都有自己的中文句子片段（中文句子不受 R13 质量底线限制，CPU 或 GPU 均可）。演练：`docs_fix/TEST_20261001_ORCH_CLIP_SCHEDULER_DRILL.md` P2。
- 单词释义的补取：单词在查词时服务器还没有释义（释义为空）时，计划不含它的释义片段；`WordNewOrchMeaningWatch` 在任务运行结束后，每 `generation_recheck_seconds` 用完整查词重新询问这些单词（每次最多 200 个，最长 `generation_watch_minutes`），一旦有了释义就更新已保存的读状态并重新编排该任务（阶段游标作废，已持有的片段不重复请求，R14），释义片段随之加入计划。
- 客户端遥测：`services/monitor/WordNewMonitorReporter.ts` 向 `app_qy_v1/orch_audio/clients/report`（合同 `client_monitor`）报告本客户端的最新状态（路由、通道、选中的 pycore 和 Laravel 端点、任务按片段类型的计数和阶段、已提交的 App 主导分配），供 laravel-manager 的编排监视页使用。路由变化防抖、片段表变化节流（`min_interval_seconds`）、每 `report_seconds` 一次；只报最新状态，不排队不重试，`seq` 在同一次运行（`instance_id`）内单调递增；它不是任何通道的可用性来源（R7），客户端也不等待它。只报告仍存在的任务（别的设备删除的任务不再报告）；监视接口返回 `server_time`，laravel-manager 用它换算所有服务器时间戳的“多久以前”，不用本机时钟。
- 每个交付的片段记录来源通道 `via`（`pycore` / `relay` / `laravel`）；界面（`WordNewOrchChainBadge`、进度条目）据此显示。

- **R9 反复上下线的恢复**（pycore 和 Laravel 相同，代码在 `WordNewOrchComposer`）：
  - 可用性只看 `wordNewChannels`，上线和下线都有防抖，链路抖动不会反复触发。
  - 通道中途下线：本次运行中，该通道的阶段不再收到请求（R5），片段交给下一阶段；拿不到的片段记为缺失，任务状态为 `partial`。运行失败（例如输入加载时 Laravel 不在）时，任务保持 `resolving`（界面显示"已暂停"），不会退回草稿。
  - 任一通道（直连 pycore、中转、Laravel）由不可用变为可用、切换了选中的 pycore 或 Laravel 端点、浏览器 `online` 事件、应用或页面启动时：本设备所有 `resolving`/`partial` 任务都自动续跑，不论页面是否打开。
  - 正在运行的任务遇到上述事件，本次运行结束后再补跑一次；但如果运行已进入时长测量阶段且还有未解决的片段，立即中止并从游标重跑，不等测量结束。
  - 应用回到前台（`capApp.onResume`）也触发续跑。长时间运行期间持有 Android 前台服务（`ForegroundSyncService`，dataSync 类型），应用在后台时仍保持联网；前台服务启动失败时，靠回到前台的续跑补上。
  - 续跑幂等：沿用已保存的进度，只补缺失的片段。
  - 传输请求失败（网络错误、无应答）先用 `orchRetry` 按合同 `transfer.retry_*` 退避重试；重试后仍失败的阶段记为 `failed`，任务按 `transfer.rerun_*` 退避自动从游标重跑，直到不再失败。
  - “本设备的任务”用持久随机 id（`wfnew.orch.deviceId`）；旧任务的指纹 id 每次会话会变，本机持有其进度即视为本设备任务并迁移。
  - 已交给后端生成的片段每隔 `generation_recheck_seconds` 检查一次，pycore 一旦拥有就续跑，最长持续 `generation_watch_minutes`。超时后，下次通道恢复时仍会续跑。
  - TTS/OCR 单次计算由 `wordNewCompute` 调度：作业写入持久日志；两端都离线时作业保持等待，任一端恢复后自动继续；已提交给 Laravel 的作业在重新加载后继续轮询。

### 1.4 修改流程

修改以上任何规则，都需要先获得用户同意，并同步更新：
1. `orchClipScheduler.ts` 的 HARD RULES 注释和 `ORCH_CLIP_STAGE_ORDER`；
2. 本指南第 1 节；
3. 演练脚本 `docs_fix/TEST_20261001_ORCH_CLIP_SCHEDULER_DRILL.md`。修改后用 bun 运行，S1–S14、P1–P4 和随机 300 轮必须 0 违规。

设计背景：`docs_fix/DESIGN_WORDNEW_CLIENT.md`。
