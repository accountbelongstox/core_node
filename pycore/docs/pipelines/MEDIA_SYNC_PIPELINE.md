# Media Sync Pipeline — Video Extract → Laravel (canonical design)

pycore 提取产物(字幕/句子/段映射/切片)到 laravel_main(:9000)媒体库的**幂等**同步管线。
本文是该功能的设计基准;改动任意一端时同步更新本文(FE/BE 共享契约)。视频字幕基础路径见 §1–§7,
**字幕多语言(per-language v3.1)见 §10**,**文档/文章来源见 §11**。

> **书籍模型已升级到 per-language v3.1。** 句子写入**按语言分表** `app_qy_v1_sentences_{lang}`,
> 章节写入**按语言分表** `app_qy_v1_chapters_{lang}`(以 `(source_type, source_key, chapter_index)`
> 跨语言对应,每语言独立 `title`,留空=无行/title 为 null;`corr_id = sha1(source_key|chapter|chapter_index)`)。
> 单一共享 `app_qy_v1_sentences` 表与单一 `app_qy_v1_chapters` 表已**整体移除(clean cut)**:
> drop 迁移 + 代码删除,**sys:init 不再创建**;v1(字幕)/v2(书籍)入库统一折叠进 per-language 模型。
> 所有 `language` 字段一律为**代码**(en/zh/ja...),无 name/code 双层。
> **`development-guides/BOOKS_FEATURE_SPECIFICATION.md`(v3.1)现为唯一权威契约**(见该文档 §3/§5/§7)。
> 本文 §8 的 v2 描述与 §2 的"共享单表 / 双键"段落已被取代。

> 🌐 **核心不变量:全平台 ONE 共享多语言句库**(权威见
> [BOOKS_FEATURE_SPECIFICATION.md §1.1/§13](../../../development-guides/BOOKS_FEATURE_SPECIFICATION.md))。
> **所有来源类型——书籍 book、字幕 subtitle、文档 document、文章 article(及未来类型)——共用同一套**
> 按语言句库 `app_qy_v1_sentences_{lang}`(以 `content_id` 去重)。每个来源**各自保留原文**
> (书的 `full_content`、字幕 `.srt` 备份、文档/文章正文),**同时**把自己的每个句子经
> `app_qy_v1_source_sentences` 槽位(`source_type ∈ {book,subtitle,document,article}` + `corr_id` +
> `lang_content_ids`)**映射进共享句库**——绝不建私有的"每来源句子副本"。同一句子出现在书/字幕/文档/文章时,
> 每语言**仅一行**、被多个槽位引用,故音频按 `(language, content_id)` **只生成一次、各来源复用**。
> `MediaIngestService::ingest()` 现接受全部四种 `source_type`(单一持久化路径)。详见 §11。

**更新日期**:2026-06-19

---

## 1. 数据流与覆盖范围

```
VideoExtractProcessor (pycore)                    laravel_main (:9000, app_qy_v1)
  输出目录/每文件:                                  五张表(幂等 mergeFill,永不覆盖):
   ├─ <stem>.srt          ── source.full_content ──►  subtitles / books   (source_key)
   ├─ <stem>_segments/                                media_segments      (source_key, seg_index)
   │   ├─ mapping.json    ── slots[] 派生 ─────────►  sentences_{lang}    (content_id md5,按语言分表)*
   │   │                                            * 字幕现与书籍同模型:slots[]+corr_id+lang_content_ids;旧共享 `sentences`(sha1(text|lang))已移除,见 §2/§8/§10
   │   └─ seg_*.mp4/full/mp3 ── /ingest-clip 逐个 ─►  source_sentences    (type,key,grain,seq)
   └─ 整文件 full/tiny mp4 + mp3 (files.* 仅传文件名)  clips → laravel static media/{key}/segments/
```

每个来源(source)提交的内容(`build_payload` + `sync_source`):

| 数据 | 提交方式 |
|------|----------|
| 字幕全文 (.srt) | `source.full_content`(JSON 内联) |
| 段级行(start/end/sub 范围/计数) | `segments[]` |
| 切片文件(seg 2×2 mp4 / full mp4 / mp3) | 逐个 multipart `POST /media/ingest-clip`(服务端存在即跳过) |
| 整文件输出名(full/tiny mp4、mp3、srt) | `source.files`(名字,不上传大文件——有意设计) |
| 句子双粒度对应槽位(v3.1) | `slots[]`:每槽位 `corr_id` + `langs:{code→text\|null}` + 计时,`grain:'cue'`(逐条字幕)/`grain:'sentence'`(按终止标点合并);见 §10 字幕多语言 |
| 勾选语言 | `source.selected_languages`(≥1,含主语言)→ `subtitles.selected_languages`(新增列) |
| 元数据 | language(主语言代码)/ duration_sec / subtitle_count / segment_count / sentence_count |
| 原始 mapping.json | **不传**(只传派生字段,有意设计) |
| **[已取代] 旧 v1 单语言** | 历史:`sentences[]`(单语言、`grain:'cue'`+`'sentence'`)经 `convertLegacyToV3`;新同步统一发 v3 `slots[]`(见 §10.3) |

## 2. 幂等契约(双端)

- **Laravel 端**:`MediaIngestService` —— fill-missing 永不覆盖(`mergeFill`),整个 ingest 包在
  单个 DB 事务里(性能关键:整部电影几千行,逐行自动提交曾把单 worker 后端堵死出 408)。
  控制器只验证信封(`source_type`/`source.source_key`/数组类型)——本地可信 worker 端点,
  对几千行做逐项验证是纯 CPU 负担(曾 30s+ 触发服务器超时)。
- **pycore 端**:重复执行 `sync_source`/`sync_all` 安全;切片上传服务端跳过已存在文件。
  `_INGEST_TIMEOUT=180s`(冷启动/排队余量),`_CLIP_TIMEOUT=300s`。
- **句子去重键(per-language v3.1 模型,权威见
  [BOOKS_FEATURE_SPECIFICATION.md](../../../development-guides/BOOKS_FEATURE_SPECIFICATION.md))**:
  句子写入**按语言分表** `app_qy_v1_sentences_{lang}`,在该表内以
  `content_id = md5(lowercase(collapse(strip_punctuation(text))))`(语言无关内容键)**unique 去重**
  并 bump `occurrence_count`。章节写入**按语言分表** `app_qy_v1_chapters_{lang}`,以
  `(source_type, source_key, chapter_index)` 跨语言对应、`corr_id = sha1(source_key|chapter|chapter_index)`,
  每语言独立 `title`(留空=无行 / title 为 null)。句子跨语言对应由 slot 级
  `corr_id = sha1(source_key|grain|seq)` 维系(同一槽位的各语言行共享一个 `corr_id`,缺失语言留空)。
  `source_sentences` 仍按 `(source_type,source_key,grain,seq)` 唯一,新增 `lang_content_ids`
  (每语言指向其 `content_id`,`null`=该语言留空)。所有 `language` 字段一律为**代码**。
- **`source_sentences` 冗余决定 + `sentence_id` 列移除(权威见 BOOKS_FEATURE_SPECIFICATION.md §3.3)**:
  `source_sentences` **不复制文本**(文本只存 `sentences_{lang}`);它是**有序位置 + 跨语言对应
  (`corr_id`/`lang_content_ids`)+ 计时 + 句库引用**的持久索引(多轨字幕时间对齐等不可廉价从原文重建),
  故**保留此表**。其上**旧 `sentence_id` 列已移除**(`dropColumn`,`hasColumn` 守卫)——
  每语言链接现完全由 `lang_content_ids`(`content_id` 引用)承载;唯一键 `(source_type,source_key,grain,seq)`
  不依赖它,故 drop 安全。**注意**:`sentence_id` 仍**保留在 `sentences_{lang}` 行上**(行内 legacy 键)。
- **pycore 内 `content_id` 归一**:小写折叠由 `casefold()` 改为 `lower()`,以与 laravel `mb_strtolower` 对齐
  (非 ASCII 大小写两端一致,保证同句两端产出相同 `content_id`)。
- **[已移除] 旧 v1↔v2 共享单表 / 双键说明(clean cut)**:历史上共享 `app_qy_v1_sentences` 单表同时含
  `sentence_id = sha1(normalize(text)+'|'+lang)`(v1 字幕,带标点)与 `content_id = md5(去标点)`(v2 书籍)两键。
  **该单表(及任何单一 `app_qy_v1_chapters` 表)现已整体移除**:drop 迁移 + 代码删除(模型/初始化/读取重建路径),
  **sys:init 不再创建**;v1(字幕)/v2(书籍)入库统一折叠进 per-language 模型(均写
  `sentences_{lang}` + `chapters_{lang}`,语言用代码;见 §8 与 BOOKS_FEATURE_SPECIFICATION.md §3.4)。
  新模型下书籍句子仍**去标点**存储、字幕句子仍**带标点**,两路 `content_id` 不同 → 不跨路去重,
  这仍是去标点设计的预期结果,非缺陷。
- **字幕也走 per-language 模型(v3.1,权威见 BOOKS_FEATURE_SPECIFICATION.md §12)**:`source_type='subtitle'`
  与书籍**同模型同表**——`source_sentences` 槽位带 `corr_id` + `lang_content_ids` + `primary_language` + 计时
  (`seg_index`/`sub_idx`/`start_sec`/`end_sec`,服务端 `ingestSlotsV3` 必须落库),文本写入 `sentences_{lang}`;
  **无新表**,`media_segments` 不变。一个字幕 source = 一个视频,多条语言轨挂同一 `source_key`。
  勾选语言存 `subtitles.selected_languages`(json,新增列,`hasColumn` 守卫);`subtitles.language` 仍=主语言代码。
  字幕入库现为 `model_version:3`(详见 §10)。

## 3. Base URL 单一事实源(关键规则)

**面板/校验必须使用与同步引擎相同的地址解析。** 同步引擎用
`resolve_laravel_base_url()`(LARAVEL_WORKER_API_URL + translation worker 的候选发现);
仪表盘 laravel 端的共享探测(`getSharedBaseURL`)可能故障转移到**另一台 LAN 主机**
(如 192.168.50.3:9000)——曾导致面板显示 0 条而同步实际已落库 127.0.0.1。
因此前端面板的主数据源是 pycore RPC `video_extract.backend_status`(由 pycore 用自己
解析的 base 查询 Laravel),仅在 pycore 离线时回退到 laravelApi 直查并明确标注。

## 4. RPC 接口(rpc_v2 :59000,注册于 callmodule/config.py `_init_rpc_routes`)

| 路由 | 作用 |
|------|------|
| `video_extract.sync_source` `{source_path, language?}` | 单来源幂等同步(扫描其输出目录全部 mapping.json) |
| `video_extract.sync_all` `{paths?, language?}` | **一键全量**:默认取历史来源列表,输出目录级去重(父子目录不重复),逐来源调用 sync_source,汇总 summary |
| `video_extract.backend_status` `{paths?}` | **本地↔后端一致性视图**:本地产物计数(segments/cues/clips/srt) vs Laravel 落库计数(segments/cues/sentences/synced_at),逐源状态 `synced/partial/missing/unknown`;不可达时降级 `reachable:false`,绝不抛错 |
| `book.sync_source` / `media.enrich` | 书籍入库 / 句库 AI+TTS 丰富(同模式) |

进度统一经 THREAD_BUS 事件 `video_extract_sync`(stages: scan/source/ingest/clips/done/error)推到前端 WS。

## 5. 前端状态模型(pycore_laravel_wordflow_ui pycore 端)

- **UI 合并(pycore-manager "Content" 标签)**:Books、Video-subtitle-extract 与新增的 "Add Document"
  已合并为**一个** pycore-manager **"Content" 标签下的 3 个子标签**;旧 `/books`、`/video-extract` 路由**重定向**到该标签。
  本文后续仍按功能维度(书籍/字幕/文档)描述各自数据流,UI 入口统一在 Content 标签。
- `PcVideoExtractContext`:run 生命周期 + `syncing` Set(含 `*all*` 哨兵)+ `syncProgress`
  + `autoSync`(localStorage 镜像 + 经 options `auto_sync` 字段持久化到 pycore user-data)。
- **同步入口永不被 `ranThisSession` 锁死**:有来源或有 run root 即显示同步区
  (幂等同步必须在刷新后依然可用);busy 只禁用按钮不隐藏区块。
- **自动幂等同步**:本会话内启动的 run 成功完成 → `autoSync` 开启时自动 `syncAll([run root])`,
  每次 run 只触发一次(ref 守卫;reload 恢复的已完成 run 不触发)。
- `PcLaravelMediaPanel`:可折叠(默认收起、懒加载),主源 `backend_status`(显示同步引擎的
  base_url + 可达性 + 逐源状态徽章),pycore 离线回退 laravelApi 直查(带警示标注)。

## 6. 公共读取 API 与词组媒体来源(2026-06-12)

入库后的媒体数据通过 laravel_main 公开只读 API 暴露给前端(WordFlow 匿名浏览即用此通道)。

### 6.1 公共只读端点(无需认证)

路由 `routes/AppQyV1Router/AppQyV1MediaContent.php` → `AppQyV1MediaContentPublicController`:

| 端点 | 参数 | 返回 |
|------|------|------|
| `GET /api/app_qy_v1/media/books` | `language?` `start?` `limit?` | `{total, start, limit, books:[{id, source_key, title, language, sentence_count, has_audio, synced_at}]}` |
| `GET /api/app_qy_v1/media/subtitles` | 同上 | 同形,`subtitles:[{…, duration_sec, segment_count}]` |
| `GET /api/app_qy_v1/media/content/{type}/{id}` | `type∈{book,subtitle}`,`start?` `limit?` | `{info, total_sentences, start, limit, grain, sentences:[{seq, text, audio, explanation, start_sec, end_sec}]}` |

- 句子经 `source_sentences` 解析,优先 `grain='sentence'`,该粒度为空时回退 `grain='cue'`(返回中带 `grain` 字段)。
  **[v3.1]** 文本经 `source_sentences.lang_content_ids[lang]` → `app_qy_v1_sentences_{lang}` 按 `content_id`
  解析每语言文本;章节经 `app_qy_v1_chapters_{lang}` 按 `chapter_index` 解析每语言标题。共享 `sentences` /
  单一 `chapters` 单表已**移除**(旧"共享句库解析"读取路径随之删除)。
- 分页:`limit` 默认 50,**上限钳制 200**;`start<0` 归零。
- 列表/内容端点**永不返回 `full_content`**(字幕全文只用于入库,不对外)。
- **v2 书籍(与 §8 相关)**:书籍句子在库中为**去标点**形式。`/media/content/book/{id}` 对 v2 书籍
  (`book.sentence_seq` 非空)由 `AppQyV1MediaContentPublicController::buildBookV2Content` **用
  `sentence_seq` + 标点标识库重建带标点句子**后返回(按句子单元分页,`grain='sentence'`)。句子**内部**
  标点(去标点时移除、未进序列)不还原,精确字节仅在 `full_content`(不对外);`audio` 初始为空(pycore 后续回填)。

另:`GET /api/app_qy_v1/learning/recommendations` 同日改为公开(`AppQyV1Learning.php` 移出 `auth:sanctum` 组)——匿名得 `is_selected=false`,带 token 行为不变;`collections/select`、`collections/selected` 仍需认证。

### 6.2 词组挂载媒体来源(`custom.authenticate`,路由在 `AppQyV1Dict.php`)

控制器 `AppQyV1WordGroupMediaSourceController`:

| 端点 | 行为 |
|------|------|
| `POST /api/app_qy_v1/group/add_media_source` `{gid, source_type∈{book,subtitle}, source_key}` | 取来源全部句子文本 → `StrTool::extractWords` 抽词,**fill-missing 合并**进分组 `gwords` + `words_frequency`(已有词频不覆盖),并记录关联;**幂等**(已挂载再调返回 `words_added=0`) |
| `POST /api/app_qy_v1/group/remove_media_source` | 只删关联行,**已并入的单词保留**(语义同 `remove_library`) |
| `POST /api/app_qy_v1/group/get_sources` `{gid}` | 统一视图:`libraries`(同 `get_libraries` 条目形)+ `media_sources:[{source_type, source_key, title, language, words_added, added_at}]` |

关联表 `app_qy_v1_group_media_sources`(迁移 `AppQyV1_2026_06_12_120000_create_group_media_sources_table.php`,**已执行**;唯一索引 `(group_id, source_type, source_key)`),模型 `AppQyV1GroupMediaSourceModel`。

## 7. 已知坑

- 新增/修改 RPC 后需重启 pycore worker(或开 `-Reload` 热重载)才生效。
- laravel_main 在 WSL 跑 Octane `--watch --poll`,但 DrvFs 上热重载可能不生效——
  改 PHP 后用 `php artisan octane:reload` 强制;旧 worker 中滞留的在途请求会继续跑旧代码。
- 不要从两个 WSL 进程并发写 DrvFs 上的 SQLite(已迁 PG 后此风险消除)。

## 8. 书籍句子/词模型(v3.1 per-language;旧 v1/v2 共享单表已移除)

> ⚠️ **权威契约已迁移**:书籍功能现以
> **[`development-guides/BOOKS_FEATURE_SPECIFICATION.md`](../../../development-guides/BOOKS_FEATURE_SPECIFICATION.md)
> (v3.1 — unified per-language sentence + chapter model)为唯一权威**。本节原 v2 描述(单一共享
> `app_qy_v1_sentences` 表 + `model_version` 区分 v1/v2)**已被取代**,保留作历史参考并就地标注差异。新模型要点:
>
> - 句子写入**按语言分表** `app_qy_v1_sentences_{lang}`;`content_id`
>   (`md5(lowercase(collapse(strip_punctuation(text))))`)在每张分表内 **unique**。
> - 章节写入**按语言分表** `app_qy_v1_chapters_{lang}`,以 `(source_type, source_key, chapter_index)`
>   跨语言对应,每语言独立 `title`(留空=无行 / title 为 null),`corr_id = sha1(source_key|chapter|chapter_index)`;
>   无章节书 = 单行 `chapter_index=0`。
> - 句子跨语言对应:slot 级 `corr_id`(每个句子槽位一组)+ `source_sentences.lang_content_ids`
>   (`{"en":"<md5>","ja":null,...}`,`null`=该语言留空,槽位仍存在)。
> - **clean cut**:单一共享 `app_qy_v1_sentences` 表与单一 `app_qy_v1_chapters` 表**整体移除**
>   (drop 迁移 + 代码删除,**sys:init 不再创建**);v1/v2 入库折叠进 per-language 模型。
> - 所有 `language` 字段一律为**代码**(en/zh/ja...),无 name/code 双层。
> - 入库为 **`model_version: 3`**,载荷含 `chapters[]`(带 `titles:{code:title|null}`)+ `slots[]`(见 §8.4 下方与权威文档 §7)。
> - 句子音频按 `(language, content_id)` 计键,路径 PHP 计算、DB 仅存 `has_audio` 标志
>   (见 [SENTENCE_AUDIO_GENERATION_PIPELINE.md](../../../development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md))。

书籍("Books")把任意文本文档作为"句子来源"入库。下文描述功能要求(不含代码);与上方权威文档冲突时**以权威文档为准**。

### 8.1 角色与流程
- pycore UI 的后端是 **pycore**;pycore 的后端才是 **laravel_main**。pycore 负责把一切处理好(扫描/解析/统计/结构化/计算内容ID),并在本地持久化,UI 再**一次性**提交给 laravel_main。
- 数据在提交前与提交后都**暂存在 pycore 用户数据目录**;UI 切换或重新打开时必须从中**载入历史**(来源列表、已算统计、提交状态)。

### 8.2 来源添加与扫描
- 支持添加**单文件、文件夹**,以及**拖放、上传**;浏览器沙箱拿不到真实路径时,上传文件字节由服务端暂存以获得可用路径。
- **文件夹必须递归扫描**(含子目录)所有支持格式;提供**格式过滤侧边栏**,可勾选默认要扫描/支持的格式。
- 支持**任意文本格式**(txt/md/pdf/docx/doc/epub/html/htm/rtf 等)。基础解析库缺失时优雅降级;须可由 pyservice 在 Windows/Linux 双端幂等安装(Debian 侧系统依赖走 apt 流程脚本)。

### 8.3 提交前的统计与预览
- 拖入/选中来源后,先就地展示而**不提交**:文件名、格式、词数、不重复词数、句子数、不重复句子数、多语言各类统计(按语言占比)、高频词,以及文本预览。
- 文件夹须给出每个文件的上述信息 + 文件夹聚合。统计在 **pycore 后端**计算,适应多语言(CJK 按字计、拉丁等按词计)。

### 8.4 内容ID与去标点
- **书籍来源**的句子**去掉标点符号**后存储(去标点 = 去除所有标点/符号 P*/S*、归一化空白)。
  注意:字幕路径句子仍**保留标点**,故按语言分表中书籍(去标点)与字幕(带标点)同一句子
  `content_id` 不同 → 不跨路去重(见 §2)。
- **[已移除] 共享单表(clean cut)**:旧 v2 把书籍句子写入共享 `app_qy_v1_sentences` 单表。
  该单表(及任何单一 `app_qy_v1_chapters` 表)**已整体移除**(drop 迁移 + 代码删除,sys:init 不再创建);
  新 v3.1 一律写入**按语言分表 `app_qy_v1_sentences_{lang}` / `app_qy_v1_chapters_{lang}`**,
  `content_id` 在**每张分表内** unique(权威文档 §3.1/§3.2/§3.4)。
- **句子内容ID = 去标点归一化文本的 MD5(不含语言),unique**;书与词同样以 MD5 内容ID标识
  (词ID = 词的 MD5;书ID = 去标点归一化全文的 MD5)。

**`model_version: 3` 入库载荷**(`POST /api/app_qy_v1/media/ingest`,权威定义见 BOOKS_FEATURE_SPECIFICATION.md §7):
顶层 `source`(含 `language`=主语言 L0、`selected_languages`=勾选语言集 Lsel≥1)、`chapters[]`
(`{chapter_index, sentence_count, titles:{code:title|null}}` —— 每语言一个标题,`null`=该语言留空)、
`slots[]`(有序对应槽位:
`{chapter_index, grain, seq, corr_id, primary_language, langs:{code→text|null}, seg_index, sub_idx, start_sec, end_sec}`)。
服务端对每个 chapter 在每个勾选语言的 `chapters_{lang}` upsert 一行(有标题则写、否则 null/留空),
`corr_id = sha1(source_key|chapter|chapter_index)`;对每个 `slots[].langs[code]` 非空文本算 `content_id`、
upsert `sentences_{lang}`、写 `lang_content_ids`;所有 `language` 值均为**代码**。
分块入库(首块带 `source`+`chapters`,后续块带 `source_key`+更多 `slots`);音频入库时**不**生成。
- **大小写与语言取值(两端必须一致,pycore 与 laravel 都遵循)**:
  - 句子**存储文本保留原始大小写**(仅去标点+归一化空白);**只有 content_id 做大小写折叠**(`md5(lowercase(collapse(strip)))`),从而大小写不敏感去重、又能重建出正确大小写的原文。
    pycore 侧小写折叠用 `lower()`(由 `casefold()` 改回),与 laravel `mb_strtolower` 对齐,保证非 ASCII 大小写两端产出同一 `content_id`。
  - **词库大小写折叠**:词的 `content`/`content_id` 一律小写(`md5(lowercase(word))`),使 "The"/"the" 归一、且 pycore↔laravel 同词同 id。
  - 句子/词的 `language` 一律用**语言代码**(en/zh/ja/...),与按语言的 `tts_cache_<code>` 表对齐(不要用 english/chinese 之类全名)。

### 8.5 标点标识库
- 内置一套**可扩展**的标点标识库;ASCII 与全角等不同字形各为**独立标识**(以便精确重建原文)。
- 该库须在 **sys:init 中幂等处理**(播种到 laravel_main 的标点标识参考表;重复执行不覆盖)。

### 8.6 书结构
- 书须存:**书名、原文**(完整备份)。
- **章节(按语言分表)**:书的句子按**章节**组织,持久化到**按语言分表** `app_qy_v1_chapters_{lang}`
  (`source_type`/`source_key`/`chapter_index`/`language`/`title`/`corr_id`/`sentence_count`)。跨语言对应
  以 `(source_type, source_key, chapter_index)` 维系(同一 `chapter_index` 在各语言分表中即"同一章"),
  `corr_id = sha1(source_key|chapter|chapter_index)`;某语言缺该章 = 该语言分表**无行 / title 为 null**(留空)。
  无可检测章节的书 = 单行默认章节(`chapter_index=0`,标题 `"Chapter 1"`)。句子槽位经 `source_sentences.chapter_index` 归属章节。
- **跨语言对应序列**:有序句子槽位(`slots[]`,见 §8.4),每槽位一个 slot 级 `corr_id`,各语言文本存入对应
  `sentences_{lang}` 分表、并在 `source_sentences.lang_content_ids` 记录每语言 `content_id`(`null`=留空)。
- 书须存**外连词IDs**(按语言分组);这些词同时**加入词库**。
- **[历史]** 旧 v2 用 `book.sentence_seq`(句子内容ID 与标点标识交替、允许重复的连续序列)重建带标点原文;
  新 v3.1 以 `chapters_{lang}` + `slots[]` + `corr_id` 组织(精确字节仍在 `full_content`)。§6.1 的 `buildBookV2Content`
  / §8.12 重建说明属旧 v2 读取路径,已随共享单表移除而删除。

### 8.7 词库
- 词库按语言对应到 `app_qy_v1_tts_cache_<lang>`(MD5 键)。入库时每个不重复词须**幂等加入**对应语言词库(已存在不覆盖)。
- 词的音频由 TTS 管线后续填充(词库自带音频字段)。
- **概念区分**:此处"词库"指按语言的**全局** `tts_cache_<lang>`(本节);与 §6.2 的用户"**词组**"
  (`word_groups.gwords`/`words_frequency`,挂载媒体来源时抽词)是**不同概念**,勿混淆。

### 8.8 句子音频
- 音频按 `(language, content_id)` 计键;文件路径由 **PHP 计算**
  (`PathMapper::getAppQyV1SentenceSoundsDir("{lang}/{content_id}.mp3")`),磁盘文件为真值。
- 每张 `sentences_{lang}` 分表存 `has_audio` 标志(仅防重复生成)+ `audio` 缓存;入库时留空,
  后续由 pycore TTS worker 生成回填。权威细节见
  [SENTENCE_AUDIO_GENERATION_PIPELINE.md](../../../development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md)。

### 8.9 幂等与提交
- laravel_main 端沿用 §2 的 fill-missing 永不覆盖;句子按**内容ID**在**对应语言分表**内去重并累计出现次数;
  整个入库包在单事务内;仅验证信封。
- pycore **一次性批量提交**(选中来源 → 构建 `model_version:3` 载荷 → 分块入库 → 标记已同步并持久化);重复提交安全。
- **[已移除]** 旧设计以 `model_version` 在共享单表内区分 v1(带标点字幕)/v2(去标点书籍);
  共享单表已 clean-cut 移除,v1/v2 入库均折叠进 per-language 模型,统一 `model_version: 3`
  写入 `sentences_{lang}` + `chapters_{lang}`(见 §8.4 与权威文档 §3.4/§7)。

### 8.10 弃用
- 未使用的 `app_qy_v1_dictionaries`(`App\Models\Dictionary`)弃用移除;词库统一走按语言的 `tts_cache` 表。

### 8.11 pycore 本地端点(UI 持久化/批量)

| 端点 | 作用 |
|------|------|
| `GET /api/local/books/state` | 载入持久化来源 + 紧凑统计 + 提交状态 |
| `POST /api/local/books/state/add` | 添加来源(持久化为草稿) |
| `POST /api/local/books/state/remove` | 删除来源 |
| `POST /api/local/books/submit` | 选中来源一次性提交(标记已同步并持久化) |
| `GET /api/local/books/supported-formats` | 支持的文档格式(供过滤侧边栏) |
| `POST /api/local/books/scan` | 快速递归列文件(不抽取文本) |
| `POST /api/local/books/analyze` `/analyze-upload` | 抽取文本算统计 + 预览(可 `persist` 持久化) |
| `GET /api/local/user-data/content-history` | 读取 pycore user-data 记录的 `content_history`(书籍/字幕/文档入库历史,跨来源类型统一) |

> pycore user-data 新增 `content_history`:记录 book/subtitle/document 各次入库,供 Content 标签跨子标签展示历史。

### 8.12 已知坑(书籍)
- 标点标识库与句子去标点规则两端必须一致(pycore 为权威定义,laravel sys:init 播种须镜像)。
- **公共读取(v3.1)**:`/media/content/book/{id}`(§6.1)经 `source_sentences.lang_content_ids` →
  `sentences_{lang}` 解析每语言句子文本、`chapters_{lang}` 解析每语言标题;精确字节(含句内标点)仍在
  `full_content`(不对外);`audio` 初始为空(pycore 回填)。**[已移除]** 旧 v2 的
  `book.sentence_seq` + `AppQyV1MediaContentPublicController::buildBookV2Content` 重建路径已随共享单表 clean-cut 删除。
- `source_sentences` 按 `(source_type,source_key,grain,seq)` 唯一存有序句子槽位(grain=`sentence` 优先,空回退 `cue`);
  每语言文本经 `lang_content_ids` 指向对应 `sentences_{lang}`。
- 拖放取路径依赖 `File.path`,PySide6 QtWebEngine 沙箱不暴露 → 退化为上传暂存;选择器/手输路径始终可用。
- 同 §7:改 RPC/入库逻辑后需重启 pycore worker;改 PHP 后须 `octane:reload`。

### 8.13 两套独立实现(pycore 主、laravel 兜底)+ 差异化是否合理

书籍功能有**两套独立实现、各自的 UI 路由**,写入**同一套按语言分表**(同一份 v3.1 契约 §8.4–§8.7,权威见 BOOKS_FEATURE_SPECIFICATION.md):
- **pycore**(pycore-manager **"Content" 标签**的 Books 子标签;旧 `#/pycore-manager/books` 重定向):桌面引擎,**路径式**;`source_key=sha1(绝对路径)`;Python 解析(third_party);本地持久化来源+重开载入;一键提交分块同步。
- **laravel-manager**(`#/vocabulary` 的 Books 面板):**兜底**,浏览器**上传式**;`source_key='book_'+content_id`(内容键);PHP 解析(pdfparser/phpword);上传→暂存 `.data/appqyv1/books/<uploadId>`→直接入库(大文档走 GlobalTask 进度)。

**合理的差异(保留)**:
| 维度 | pycore | laravel | 为何合理 |
|---|---|---|---|
| 来源键 | sha1(绝对路径) | `book_`+content_id | 浏览器无稳定路径,内容键反而能跨次上传去重 |
| 添加方式 | 文件/文件夹/拖拽(原生选择器) | 上传/拖拽(浏览器) | 受运行环境约束 |
| 解析 | Python third_party | PHP pdfparser/phpword | 各自栈内自洽 |
| 持久化/历史 | 本地 user-data 来源列表+重开载入 | 入库后的书即durable记录(`/media/books`),上传态短暂 | 上传模型下"已入库的书"就是历史 |

**必须一致(已校齐,见 §8.4)**:句子存储**保留大小写**(仅 content_id 折叠)、词库**小写**、`language` 用**代码**。校齐后**两端对同一句子产出相同 content_id**(已验证),共享库不再因来源不同而出现大小写/语言值/词条重复的分裂。

## 9. Movie/TV poster (TMDB + OMDB)

Canonical contract: `development-guides/MOVIE_POSTER_PIPELINE.md`. pycore is the
**primary** poster fetcher; it runs at ingest/extract time, downloads poster
**bytes** (never an external URL), and ships them to laravel.

**pycore client** — `pycore/pyutils/external_apis/movie_poster_client.py`:
- `parse_title_year(filename_or_title) -> (title, year|None)` — strip
  release/quality tokens (1080p/x264/BluRay/WEB-DL...), bracketed groups,
  `SxxExx`, trailing `-GROUP`, extension; dots/underscores→spaces.
- `find_poster(title, year=None, language="en") -> poster|None` — CJK/non-Latin
  titles are translated to English first (GoogleTranslator), then TMDB
  `search/multi` (v4 Bearer token preferred, else v3 `api_key`) → first result
  with a `poster_path` → download `w780` bytes → base64; on miss/no-key/error
  falls back to OMDB (`?apikey=&t=&y=`). Returns the §3 result object
  `{provider, source_id, mime, image_base64, meta}`. Never raises (None on any
  failure).
- `save_poster_file(image_base64, mime, dest_path_without_ext) -> path|None` —
  decode + write a local file (extension from mime). Used by video-extract.

**Books + subtitles ingest** (`callmodule/services/sync/laravel_media_sync.py`):
`build_book_payload_v2` and the subtitle `build_payload` attach an OPTIONAL
`source.poster` object (the §4 ingest addition) via `find_poster()` using the
HUMAN title (book stem / subtitle original filename, parsed with
`parse_title_year`). The key is **omitted entirely when None** (laravel keeps
`poster_status='pending'`). Best-effort: a poster failure NEVER breaks ingest.
Toggle via user-data `media_sync.fetch_poster` (default ON; `_poster_enabled`).

**Video-Extract** (`callmodule/services/processors/video_extract_processor.py`):
after a video's outputs are produced, parse title+year from the ORIGINAL
filename, `find_poster()`, and `save_poster_file()` to `poster.jpg`/`.png` in the
per-video output dir. `mapping.json` gains `files.poster` (relative filename),
and the per-item result carries a `poster` dict
(`{file, provider, source_id, meta}`). Gated by the `fetch_poster` request option
(`VideoExtractRequest.fetch_poster`, default True); best-effort (a failure never
fails extraction).

## 10. 字幕多语言(与书籍同 per-language 模型)

> **权威契约**:[`development-guides/BOOKS_FEATURE_SPECIFICATION.md` §12](../../../development-guides/BOOKS_FEATURE_SPECIFICATION.md)。
> 字幕**复用整套 per-language 模型**(`app_qy_v1_sentences_{lang}` + `source_sentences` 槽位 +
> `corr_id` + `lang_content_ids` + `primary_language` + 计时,`source_type='subtitle'`)——**无新表**;
> `media_segments`(切片映射)不变。一个字幕 source = **一个视频**,一条或多条语言轨挂同一 `source_key`。

字幕可**多语言或单语言**:每条 cue / sentence 都是一个对应槽位,其 `lang_content_ids` 对所含语言存文本、
对其余勾选语言存 `null`(留空),与书籍句子完全一致。

### 10.1 两种输入形态(pycore 都处理)
- **(a) 单文件双语(双语字幕)**:一个 `.srt`,其 cue 块内含多语言行。pycore 按 `guess_language`
  把每个 cue 的各行**按检测语言拆分** → **每个 cue 一个槽位**,`langs` 跨所检测语言;按 cue 顺序对齐到 `seq`,
  `corr_id = sha1("{source_key}|{grain}|{seq}")`(公式不变)。
- **(b) 多轨(每语言一个 .srt)**:同一视频多个 `.srt`(`movie.en.srt`/`movie.zh.srt`...)。
  **主语言轨定义规范槽位**(grain、`seq`、时间窗、`corr_id = sha1(source_key|grain|seq)`);其余每轨的 cue
  按**最大时间重叠**(`start_sec`/`end_sec`)挂到对应主槽位,文本填入 `lang_content_ids[lang]`;
  与任何主槽位都不重叠的副 cue 作为额外槽位**追加**(尽力而为),丢弃/追加计数 `log()`(不静默丢失)。
  pycore 完成时间对齐并发出**已合并**的 `slots[].langs`;副轨自身的 `seq` **不**用于对应。
- 两种形态都保留双粒度(`cue` 与合并后的 `sentence`)。

### 10.2 selected_languages
- Voice & Subtitle 页的语言多选(≥1、主语言锁定)——与 Books §9 同一控件;集合还**自动并入**各轨实际检测到的语言。
- 存 `app_qy_v1_subtitles.selected_languages`(json,**新增**列,`hasColumn` 守卫)**与**每槽位 `lang_content_ids`;
  `subtitles.language` 仍=主语言代码。

### 10.3 入库
- `model_version:3`、`source_type:'subtitle'`;`slots[]` 带 `langs`(多语言)+ 计时
  (`seg_index`/`sub_idx`/`start_sec`/`end_sec`),laravel `MediaIngestService::ingestSlotsV3`
  **必须落库字幕槽位的计时列**。章节:字幕用单一默认章节(`chapter_index 0`),除非视频带场景章节。
  `media_segments` 入库不变。
- **[已取代] 旧 v1 单语言路径**:历史上字幕走单语言 `sentences[]`(经 `convertLegacyToV3`)。
  pycore 现对字幕统一发 v3 `slots[]`,新同步不再用 v1 单语言路径(历史保留,不删)。

### 10.4 音频 + 对应
- 与书籍一致:per-language `sentences_{lang}`,文件优先、音频按 `(language, content_id)` 计键
  (见 [SENTENCE_AUDIO_GENERATION_PIPELINE.md](../../../development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md))。
  FE 每条 cue / sentence 并排渲染所有勾选语言,`null` 处留空。

## 11. 文档 / 文章来源(共用同一句库)

> **权威契约**:[`development-guides/BOOKS_FEATURE_SPECIFICATION.md` §1.1/§13](../../../development-guides/BOOKS_FEATURE_SPECIFICATION.md)。

文档(document)与文章(article)是**一等来源**,与书籍/字幕**共用同一套**按语言句库 `app_qy_v1_sentences_{lang}`
(§1.1 核心不变量)。它们**保留自身原文正文**,同时把每个句子经 `source_sentences` 槽位映射进共享句库——
不建私有句子副本。`MediaIngestService::ingest()` 现接受
`source_type ∈ {book, subtitle, document, article}`(单一持久化路径;`source_type` 列注释相应放宽)。

### 11.1 文档 `source_type='document'`(已接入)
- `AppQyV1VocabularyDocumentController::extractSentences` 把上传文档句子以 `content_id` 入按语言句库,
  并在 `source_sentences` 写位置链接(`source_type='document'`);原始文档(`AppQyV1UploadedDocumentModel`)
  作为原文真值保留。
- 须全面对齐 v3 模型:每槽位写 `corr_id` + `lang_content_ids` + `primary_language`
  (多语言文档多语言、否则单语言其余 `null`);`language` 一律用代码。

### 11.2 文章 `source_type='article'`(接入中)
- 现状:文章(`AppQyV1ArticleController`、`articles` 表、daily-reading、`article` TTS 类型)保留文章正文 +
  私有 `article_words` 表,但**尚未把句子映射进共享句库**。接入方案:
  - 文章创建/入库时把正文切成**双粒度**(cue/sentence),按 `content_id` upsert 进 `app_qy_v1_sentences_{lang}`
    (fill-missing、`occurrence_count++`),并写 `source_sentences` 行:`source_type='article'`、
    `source_key = 'article_' + article_id`(或既有 `article_id`)、`corr_id = sha1(source_key|grain|seq)`、
    `primary_language`、`lang_content_ids`。
  - `articles.content`(原文)不变;`article_words` 可保留(文章级词视图),但词应解析到共享按语言
    `tts_cache_{lang}` 词库(与各处一致)。
  - 多语言:文章可带多语言(勾选集),对应规则同书籍 §5;单语言文章只填主语言、其余 `null`。

### 11.3 去重与音频复用
- 共享句库按 `content_id` 去重(fill-missing、`occurrence_count++`):同一句子出现在书/字幕/文档/文章时,
  **每语言仅一行**、被多个槽位引用。
- 音频按 `(language, content_id)` **只生成一次、各来源复用**(见
  [SENTENCE_AUDIO_GENERATION_PIPELINE.md](../../../development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md));
  章节(可选)/槽位/词全部走同一条 per-language v3 路径,音频 + 对应与 §6/§5 各类型一致。
