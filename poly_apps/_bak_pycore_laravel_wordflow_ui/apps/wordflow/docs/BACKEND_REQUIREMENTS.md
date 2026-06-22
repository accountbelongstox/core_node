> WordFlow 后端功能要求(功能层)— 描述后端必须做到的行为,不含接口/数据库/代码;实现由 AI 自由设计。

本文件只描述 WordFlow 前端对后端的**功能性要求**——后端必须**做到**哪些行为。具体的接口路径、请求/响应字段、数据库表与列、索引、错误码、队列技术选型等,全部由实现者(AI)自由设计,只要满足下述行为即可。

This document specifies only the **functional requirements** the WordFlow backend must satisfy — what the backend must **do** for the frontend. Endpoint shapes, schemas, tables, indexes, error codes, and queue technology are left entirely to the implementer; any design that produces the described behavior is acceptable.

---

## 概念区分 / Core Concepts

贯穿全文需区分两个概念:

- **词组 / Word Group(词库)**:一组单词的集合。来源可以是系统预置、用户上传文档、或用户手动创建。
- **背诵分组 / Study Group(学习计划)**:用户组织学习内容的容器,可包含多个词组,并**绑定一种语言**。

A **Word Group** is a collection of words (system-provided, document-imported, or user-created). A **Study Group** is a user's learning container that can hold multiple word groups and is **bound to a single language**.

---

## 1. 注册自动初始化 / Registration Auto-Init

用户注册成功后,后端必须自动完成以下行为:

1. **自动为用户的学习语言创建一个默认背诵分组**。若用户未设置首选语言,使用 `en` 作为默认。新分组应是该语言的"语言默认分组"。
2. **不得创建任何测试 / 演示 / 种子词组数据**。注册流程中不应注入示例词组、示例词库或任何占位数据。
3. **让用户自主选择或上传学习内容**。新用户的词库列表(Library)初始应为空;如果系统提供预置词库,这些词库必须明确标记为系统词库,且**不自动加入**用户的分组,仅作为可选内容展示。
4. **创建必须幂等**:对同一用户、同一语言重复触发初始化时,不得产生重复的默认分组;若已存在则复用现有分组。

On successful registration the backend must automatically provision a default study group for the user's learning language (falling back to `en`), create no test/demo/seed data, leave the user's library empty (system-provided libraries, if any, are clearly marked as system content and never auto-added), and make this provisioning idempotent so repeated triggers never produce duplicate default groups.

> 对历史测试账号的清理是一次性运维动作,不属于持续的功能要求,故不在本文展开。

---

## 2. 背诵分组:语言绑定 / Study Groups: Language Binding

后端必须把"按语言组织词汇"作为分组的核心规则,具体行为:

- **每个背诵分组必须绑定且仅绑定一种语言**。
- **每个用户每种语言自动拥有一个"语言默认分组"**;每用户每语言**有且仅有一个**默认分组。
- **可为同一语言创建多个分组**(默认分组之外的额外分组)。
- **添加词组到分组时只能加入同语言的分组**:候选分组按语言过滤,后端必须在写入前校验语言一致性。
- **跨语言添加必须被拒绝**:当词组语言与目标分组语言均已知且不一致时,后端拒绝该操作,并向前端清楚说明这是语言不匹配(返回双方语言以便前端给出可读提示)。若任一方语言未知/为空,则跳过该校验、允许加入。
- **分组语言一经创建不可更改**;要换语言,用户须新建分组。
- **统计需保持一致**:增删词组、更新学习进度时,分组的"词组数 / 总词数 / 已学词数 / 进度"等聚合信息必须随之同步,使前端看到的统计始终正确。
- **数据隔离与归属**:所有分组操作必须限定在当前登录用户范围内,用户只能访问和修改自己的分组。

Each study group is bound to exactly one language; every user gets exactly one language-default group per language; multiple non-default groups per language are allowed; word groups may only be added to a same-language group and cross-language adds are rejected (reporting the mismatch with both languages, skipping the check only when either side's language is unknown); a group's language is immutable after creation; aggregate statistics stay consistent across add/remove/progress changes; and every operation is scoped to the owning user.

### 自动建组行为 / Automatic Group Creation

当用户在设置中**新增一种学习语言**时,系统必须确保该语言存在一个默认分组(若缺失则创建,幂等)。无论该"确保存在"的动作由前端在选择语言时触发、还是由后端在更新学习语言时附带完成,**最终结果都必须是:每个被学习的语言恰好有一个语言默认分组,且不产生重复**。

When a user adds a new learning language, the system must guarantee a (single, non-duplicated) default group exists for that language. Whether the "ensure exists" step is triggered by the frontend on language selection or performed by the backend when learning languages are updated, the end state must be the same: exactly one language-default group per learned language.

### 支持的语言 / Supported Languages

后端需将一组语言视为受支持,并为每种语言提供可展示的元信息(中文名、英文名、图标、主题色),供前端统一呈现。当前商定的语言集合:

The backend treats a fixed set of languages as supported and supplies display metadata (Chinese name, English name, icon, theme color) for each, for consistent frontend rendering. The currently agreed set:

- 英语 / English (`en`)
- 中文 / Chinese (`zh`)
- 日语 / Japanese (`ja`)
- 韩语 / Korean (`ko`)
- 法语 / French (`fr`)
- 德语 / German (`de`)
- 西班牙语 / Spanish (`es`)
- 越南语 / Vietnamese (`vi`)
- 老挝语 / Lao (`lo`)

向不受支持的语言创建分组应被拒绝并提示语言无效。

---

## 3. 音频生成协调 / Audio Generation Coordination

词库可能包含数千个单词,音频不会全量预先生成。后端必须支持一种**请求 → 异步生成 → 就绪通知**的协调行为:

1. **接受音频生成请求**:前端在浏览词库时发现某些单词缺少音频,向后端提交这些单词(连同语言)请求生成。
2. **去重 / 跳过已有**:后端对已存在音频的单词不重复生成,只把缺失的单词纳入待生成集合,并告知前端有多少被跳过、多少进入生成。
3. **异步生成**:后端在后台逐步生成音频(调用 TTS、保存文件、记录可访问的音频地址),无需前端同步等待。生成可设优先级(用户实时请求优先于后台预生成),失败可自动重试若干次后标记为失败。
4. **让前端得知就绪**:前端能够查询单词的音频生成状态,后端如实返回每个单词当前是"等待中 / 生成中 / 已完成 / 失败";**只有已完成时才提供可播放的音频地址**。前端据此在音频就绪后更新播放按钮,全部完成后停止查询。

The backend must support an asynchronous coordination flow: accept audio-generation requests for a list of words, skip words that already have audio (reporting skipped vs. queued counts), generate the remaining audio in the background (with priority and bounded retries), and let the frontend learn each word's current state (pending / processing / completed / failed) — exposing a playable audio location only once a word is completed. Specific endpoints, queue technology, and TTS provider are implementation choices.

> 外部 worker 能力(2026-06-12 起为正式行为):后端允许受信任的外部处理端(如 pycore)**领取**待生成任务并**回传**结果以扩展吞吐。回传必须经过**服务端结果校验**——载荷非空、确为有效音频、与所领取的词条一致、落盘后复验——校验不通过的结果只记一次失败尝试,**绝不**写入正式数据;领取有时效,超时未回传的任务自动回到待生成状态。"需要生成什么"由**正式数据本身**回答(无音频即待生成),不依赖任何中间队列存储;初始化(sys:init)可幂等地修正音频标记与数据的不一致。
>
> External-worker capability (formal behavior as of 2026-06-12): trusted external processors (e.g. pycore) may CLAIM pending generation work and REPORT results back. Every reported result must pass server-side validation (non-empty, genuinely valid audio, matching the claimed word, re-verified after persisting) — rejected results only record a failed attempt and never touch canonical data; claims expire, returning unreported work to pending. "What needs generating" is answered by the canonical data itself (no audio ⇒ pending) with no intermediate queue storage, and sys:init idempotently reconciles audio flags against the data.

---

## 4. 批量状态查询 / Batch Status Check

为避免对大量单词逐个查询造成过多连接与往返开销,后端必须支持**一次性查询多个单词的音频状态**:

- 前端可在一次请求中提交一批单词(连同语言),后端对这批单词逐一返回当前状态(等待中 / 生成中 / 已完成 / 失败),并对已完成的单词给出可播放音频地址。
- 对于**不在生成队列中的单词**,后端需区分两种情况并告知前端:一种是确实未被请求过(不在队列),另一种是**音频已生成并缓存**(已可用)——后者应让前端知道音频其实已经可用。
- 返回中应包含一个汇总(各状态各有多少、未找到多少),便于前端快速判断整批进度。
- 批量查询需要认证,并对单批数量设上限以保护后端;超限或格式错误应被拒绝。
- 后端在保留批量查询的同时,可继续支持原有的单词级查询以向后兼容。

The backend must let the frontend ask the status of many words in one request and answer each word's state, supplying a playable location for completed ones. It must distinguish words that are not in the queue from words whose audio is already generated and cached (i.e. already available), provide a summary tally, require authentication, cap the batch size, and may keep a single-word query for backward compatibility.

---

## 5. 公共内容匿名可浏览 / Anonymous Browsing of Public Content（2026-06-12 新增）

公共学习内容必须支持**未登录浏览**,登录只在用户做出"占有性"操作时才被要求:

1. **公共内容只读浏览不需要任何认证**:词库推荐、已同步的书籍列表、字幕列表,以及单本书 / 单个字幕的句子内容(含句子文本、读音音频地址、讲解、时间轴),匿名用户都能分页浏览。
2. **匿名响应须降级而非报错**:与"当前用户"相关的标记(如某词库集合"是否已被我选择")在匿名访问时一律返回未选中;携带有效登录凭证时返回真实状态。同一入口对两类用户都可用,不得对匿名用户返回认证错误。
3. **内容浏览须分页且有上限**:句子内容按分页返回并对单页数量设上限(保护后端);**原始全文(整份字幕/书籍全文)永不通过公共浏览接口返回**——全文只用于入库管线。
4. **占有性操作仍需登录**:把内容加入自己的分组、选择词库集合、记录学习进度等写操作必须认证;前端在匿名用户触发这类操作时引导登录,登录后回到原意图(见 DESIGN_SYSTEM 的受保护操作约定)。

Public learning content (library recommendations, synced book and subtitle lists, and per-source sentence content with text/audio/explanation/timing) must be browsable **without authentication**, paginated with a capped page size, and must never expose the raw full text through public browse. Anonymous responses degrade gracefully (per-user flags such as "selected by me" return unselected) instead of erroring; the same entry point serves both anonymous and authenticated callers. Possessive/write actions (adding content to one's groups, selecting collections, recording progress) still require login, with the frontend routing anonymous users through login and back to their original intent.

---

## 6. 媒体来源挂载到分组 / Media Sources in Study Groups（2026-06-12 新增）

除词库(library)外,分组还必须支持挂载**媒体来源**(已同步的书籍或字幕),行为要求:

1. **挂载即取词合并**:把某个媒体来源挂载到分组时,后端从该来源的全部句子中提取单词,**只补缺、永不覆盖**地并入分组的单词集合与词频信息(已有单词与已有词频保持原值),并记录这次挂载(含来源类型、标题、语言、本次新增词数、挂载时间)。
2. **挂载必须幂等**:对同一分组重复挂载同一来源不得重复并词,应返回成功并表明本次新增 0 词。
3. **移除只解除关联**:从分组移除媒体来源只删除挂载关系,**已并入分组的单词全部保留**——与移除词库(library)的既有语义一致。
4. **统一的来源视图**:前端能一次取得某分组的全部来源(词库 + 媒体来源)用于"Sources"视图统一展示;两类来源各自携带可展示的元信息(名称/标题、语言、词数或新增词数、加入时间)。
5. **归属与校验**:挂载/移除/查询均限定在当前登录用户自己的分组;不存在的分组或媒体来源应得到明确的"未找到"回应。

Beyond libraries, a study group must also accept **media sources** (synced books or subtitles): attaching one extracts the words from the source's sentences and merges them into the group fill-missing (never clobbering existing words or frequencies) while recording the link (type, title, language, words added, time); attaching is idempotent (re-attaching adds 0 words); removing deletes only the link — words already merged stay, matching the existing remove-library semantics; the frontend can fetch a unified view of all of a group's sources (libraries + media sources) for a single "Sources" view; and all operations are scoped to the owning user with explicit not-found responses for missing groups or sources.

---

## 6.5 账户偏好与每日目标漫游 / Account Preferences & Daily-Goal Roaming（2026-06-12 新增）

"我的"区域(账户/进度/设置)依赖账户级偏好,行为要求:

1. **每日目标按用户存储**:用户在"学习目标"设置中选定的每日单词目标必须保存到账户偏好中;学习统计(今日进度/每日目标)必须按该用户自己的目标汇报,而不是全局固定值。未设置时使用系统默认目标(20)。
2. **应用设置随账户漫游**:登录用户的客户端设置(学习/显示/通知等)作为一个整体随账户保存与下发,换设备登录后能恢复;游客与离线场景完全依赖本地存储,功能不降级。
3. **同步必须尽力而为**:偏好的拉取/推送失败不得阻塞设置页或统计页的正常使用——本地副本始终是可用的后备。
4. **成就由真实计数派生**:成就不是后端实体;所有端上的成就展示必须从同一套真实学习计数(已学/已掌握/总词数/连续天数/学习天数)派生,禁止伪造解锁状态或进度。
5. **统计不虚构**:没有数据来源的统计字段(如学习时长)不得用伪造值展示;前端只展示有真实来源的指标(如学习天数)。

The Mine/Account area depends on account-level preferences: the user's daily word goal persists on the account and learning statistics (today's progress vs. daily goal) must report against that personal target (system default 20 when unset); a signed-in user's client settings roam with the account across devices while guests/offline sessions run fully from local storage; preference pulls/pushes are best-effort and must never block the settings or stats pages; achievements are not a backend entity — every surface derives them from the same real learning counters (learned/mastered/total/streak/study days) with no fabricated unlock states; and metrics with no real data source (e.g. study time) are not displayed with fabricated values.

## 6.6 每日背诵 / Daily Recitation（2026-06-12 新增）

1. **追加式按日日志驱动既有计数器**:每日背诵以一张追加式(append-only)按日日志表记录(用户, 日期, 单词, 动作 read|learn|review_correct|review_wrong);长期的逐词学习状态**不另建并行状态**,仍由既有 personal_dicts 词条计数器承载(read/learned/reviewed/weight/last_read_time/review_time;答错复习同时累加 weight)。
2. **batch_id 幂等供离线重放**:`POST /recitation/log` 携带 batch_id 时,同一 (用户, batch_id) 的重放返回上次汇总并标记 `replayed:true`,不写入任何数据——前端离线队列重放永不重复计数。
3. **连续天数由服务端从日志日期派生**:streak(当前连续/最长连续/近 35 天活跃)由日志表的去重日期在服务端统一计算;今日计划(到期词按 reviewed 间隔曲线 + 默认分组新词补位)同样以"当日是否已有日志"为排除依据,每日目标沿用 §6.5 的账户偏好 daily_goal。

Daily recitation = an append-only per-day log table (user, date, word, action read|learn|review_correct|review_wrong) driving the EXISTING personal_dicts per-word counters (read/learned/reviewed/weight/last_read_time/review_time; a wrong review also bumps weight) — no parallel per-word state. `POST /recitation/log` is idempotent per (user, batch_id): replays from the FE offline queue return the previous summary with `replayed:true` and write nothing. Streaks (current/longest/last-35-days activity) are derived server-side from distinct log dates; the today-plan (due words via the reviewed-count spacing curve, filled with new words from the language-default group) excludes anything already logged today, and the daily goal reuses the §6.5 account preference.

---

## 7. 已商定的持续性决策 / Settled Durable Decisions

以下是前后端商定、应作为**长期行为契约**保留的决策:

- **移除学习语言时,保留该语言的默认分组,不删除(保留不删)**。用户取消勾选某学习语言后,对应的语言默认分组及其内容应被保留,用户仍可从分组列表访问;不做删除或强制归档。
- **不允许删除语言默认分组本身**(即每语言始终保有其默认分组的承诺)。
- **分组语言不可变**:创建后不能修改分组语言;需要其他语言时新建分组。
- **每用户每语言唯一默认分组**:系统保证不会出现同一用户同一语言的多个默认分组。
- **语言匹配校验在双方语言均已知时才执行**:任一方语言为空则跳过校验、允许加入。
- **创建词组/分组时语言可缺省**:未显式提供语言时,默认按 `en` 处理(语言是可选输入而非强制输入)。
- **新增学习语言的"确保默认分组存在"由前端驱动即可**:这是已确认可接受的协作方式,后端无需强制内置自动创建逻辑——只要最终"每语言一个默认分组、无重复"的结果成立。
- **公共内容匿名可浏览、占有性操作登录门控**(2026-06-12):词库推荐与媒体内容的只读浏览不要求登录,匿名时按用户相关标记降级处理;加入分组/选择/进度等写操作仍需认证(见 §5)。
- **移除来源永不删词**(2026-06-12):从分组移除词库或媒体来源都只解除关联,已并入分组的单词保留(见 §6)。
- **分组总词数 = 两种表示合并计数**(2026-06-12):一个分组的单词同时存在两种表示——历史 `gwords` JSON(原始词文本;来源:建组、文档导入、媒体来源挂载)与 `group_words` 词条 ID 映射(来源:挂载词库)。两者是**不相交的来源**,所有面向用户的分组总词数(分组列表、分组详情、进度统计等)必须按 `count(gwords) + ID 映射条数` 合并报告,不做文本去重;**挂载词库只写入词条 ID 映射,永不把词文本复制进 gwords**(合并引用,绝不复制)。
- **词典表是唯一词存储、word_id 全局统一为词典 ID**(2026-06-12 Wave B):每语言词典表 `app_qy_v1_tts_cache_{lang}` 是唯一的单词存储;词库(`vocabulary_libraries`)只持有 `word_ids` JSON(有序的词典 ID 数组),封面在同一行的 `cover_*` 列。旧表 `vocabulary_items/words/covers/collections` 已删除。**接口中出现的所有 `word_id` 都是词典 ID**——`group/get_words` 返回的 `word_id` 与 `/words/{id}`(详情/收藏/学会/复习)是同一 ID 空间,可直接互通;`(word_id, language_code)` 是完整引用。所有响应外形保持字节兼容,前端无需任何修改。
- **每分组一行 JSON 进度、短键图例、前端侧计算、批量 update_progress、blob 端点**(2026-06-12 Wave C):分组成员与学习进度合并存储为 `app_qy_v1_group_word_progress` 的**每 (用户, 分组) 一行**——`words` JSON 映射 `word_id → {fr,lr,lv,nr,rc,vc,wt,pf,aa}` + `total_words` 计数缓存;旧的逐词两表 `group_words` / `user_word_progress` 已删除。短键图例(时间戳一律 **unix 秒 UTC 整数**):`fr=first_read_at, lr=last_read_at, lv=last_review_at, nr=next_review_at, rc=read_count, vc=review_count, wt=weight, pf=proficiency(0-100 浮点), aa=added_at`,唯一权威定义在 `AppQyV1GroupWordProgressModel::ENTRY_LEGEND`。**新端点 `POST /group/get_progress_blob {gid}`**(与 `get_words` 同认证)一次返回 `{gid,gname,language_code,total_words,legend,words}`,**前端应基于 blob 在客户端计算统计/筛选**(单行读取、无 65535 绑定参数上限、无 join);兼容性端点(`get_words with_progress`/`get_progress_stats`/`get_review_words`/analysis)保留服务端计算、外形不变。`update_progress` 同时接受旧单词形 `{gid,word_id,action,…}` 与**批量形 `{gid,updates:[{word_id,correct}]}`**(+5/−10、0-100 截断、复习时间按熟练度档位重算),后端每次调用只做**一次整 JSON 写**(绝不逐词循环保存)。分组总词数合并语义不变:`count(gwords) + total_words`。删除分组时该进度行随之删除;移除词库/媒体来源仍只解除关联、不删词。

Durable, agreed behaviors to preserve long-term: removing a learning language **preserves** that language's default group (保留不删) rather than deleting it; the language-default group itself cannot be deleted; a group's language is immutable; there is exactly one default group per user per language; the language-match check runs only when both sides' languages are known (skipped otherwise); language is an optional input on group creation (defaulting to `en`); and it is acceptable for the frontend to drive the "ensure a default group exists" step when a learning language is added, so long as the end state (one default group per language, no duplicates) holds. Additionally (2026-06-12): a group's words live in two **disjoint** representations — legacy `gwords` JSON text (group creation, document import, media-source attachment) and `group_words` word-ID mappings (library attachment) — and every user-facing group word total (group list, group detail, progress stats) reports the merged sum `count(gwords) + mapping count` with no textual dedupe; library attachment stores **only** word-ID mappings and never copies word text into `gwords` (merge by reference, never copy).

Storage consolidation (2026-06-12, Wave B, durable): the per-language dictionary tables `app_qy_v1_tts_cache_{lang}` are the **only** word store; vocabulary libraries hold membership as a `word_ids` JSON array of ordered dictionary ids (covers live on the same row's `cover_*` columns), and the legacy `vocabulary_items` / `vocabulary_words` / `vocabulary_covers` / `vocabulary_collections` tables are gone. Every `word_id` exposed by the API — `group/get_words` and the progress endpoints — **is a dictionary id**, the same id space `/words/{id}` (detail / favorite / learn / review) uses, so ids flow between group word lists and the word-detail actions without translation; `(word_id, language_code)` is the full word reference. All response shapes stayed byte-compatible — the consolidation required zero frontend changes.

Group progress consolidation (2026-06-12, Wave C, durable): group membership + per-word progress live in **one `app_qy_v1_group_word_progress` row per (user, group)** — a `words` JSON map `word_id → {fr,lr,lv,nr,rc,vc,wt,pf,aa}` plus a `total_words` cache; the row-per-word `group_words` / `user_word_progress` tables are gone. The short-key legend (all timestamps **unix seconds UTC as ints**): `fr=first_read_at, lr=last_read_at, lv=last_review_at, nr=next_review_at, rc=read_count, vc=review_count, wt=weight, pf=proficiency (float 0-100), aa=added_at` — single source of truth `AppQyV1GroupWordProgressModel::ENTRY_LEGEND`. The FE fetches the whole map via **`POST /group/get_progress_blob {gid}`** → `{gid, gname, language_code, total_words, legend, words}` and computes stats/filters client-side (one row read, no joins, no 65,535 bind-param ceiling); the compatibility endpoints (`get_words with_progress`, `get_progress_stats`, `get_review_words`, analysis) keep server-side computation with unchanged shapes. `update_progress` accepts the legacy single shape and the **batch shape `{gid, updates:[{word_id, correct}]}`** (+5/−10 proficiency clamped 0-100, next-review recompute by proficiency tier); every call performs exactly **one whole-JSON write** (never per-word saves in loops). Merged group totals stay `count(gwords) + total_words`; deleting a group deletes its progress row, while removing a library/media source still only unlinks (words stay).
