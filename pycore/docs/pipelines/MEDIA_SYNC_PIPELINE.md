# Media Sync Pipeline — Video Extract → Laravel (canonical design)

pycore 提取产物(字幕/句子/段映射/切片)到 laravel_main(:9000)媒体库的**幂等**同步管线。
本文是该功能的设计基准;改动任意一端时同步更新本文(FE/BE 共享契约)。视频字幕路径见 §1–§7,
**书籍(任意文本文档)句子/词模型 v2** 见 §8(本文为其唯一权威契约)。

**更新日期**:2026-06-15

---

## 1. 数据流与覆盖范围

```
VideoExtractProcessor (pycore)                    laravel_main (:9000, app_qy_v1)
  输出目录/每文件:                                  五张表(幂等 mergeFill,永不覆盖):
   ├─ <stem>.srt          ── source.full_content ──►  subtitles / books   (source_key)
   ├─ <stem>_segments/                                media_segments      (source_key, seg_index)
   │   ├─ mapping.json    ── segments[] 派生 ──────►  sentences           (sha1(text|lang) 共享句库)
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
| 句子双粒度 | `sentences[]`:`grain:'cue'`(逐条字幕)+ `grain:'sentence'`(按终止标点合并) |
| 元数据 | language / duration_sec / subtitle_count / segment_count / sentence_count |
| 原始 mapping.json | **不传**(只传派生字段,有意设计) |

## 2. 幂等契约(双端)

- **Laravel 端**:`MediaIngestService` —— fill-missing 永不覆盖(`mergeFill`),句子按
  `sha1(normalize(text)+'|'+lang)` 去重并 bump occurrence_count;**整个 ingest 包在单个
  DB 事务里**(性能关键:整部电影几千行,逐行自动提交曾把单 worker 后端堵死出 408)。
  控制器只验证信封(`source_type`/`source.source_key`/数组类型)——本地可信 worker 端点,
  对几千行做逐项验证是纯 CPU 负担(曾 30s+ 触发服务器超时)。
- **pycore 端**:重复执行 `sync_source`/`sync_all` 安全;切片上传服务端跳过已存在文件。
  `_INGEST_TIMEOUT=180s`(冷启动/排队余量),`_CLIP_TIMEOUT=300s`。
- **句子键 v1↔v2(重要,避免误读)**:共享 `app_qy_v1_sentences` 现含**两个**键 ——
  `sentence_id = sha1(normalize(text)+'|'+lang)`(v1 字幕路径,文本**带标点**,本节上文所述)
  与 `content_id = md5(去标点归一化文本)`(v2 书籍路径,唯一,见 §8.4)。v2 写入时句子文本**去标点**,
  并附带回填 `sentence_id`(对去标点文本求 sha1)以兼容旧读取。**因此同一句子在字幕(带标点)与
  书籍(去标点)两路不会跨路去重**(键不同)——这是去标点设计的预期结果,非缺陷。

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

## 5. 前端状态模型(laravel_dashboard pycore 端)

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

- 句子经 `source_sentences → sentences` 共享句库解析,优先 `grain='sentence'`,该粒度为空时回退 `grain='cue'`(返回中带 `grain` 字段)。
- 分页:`limit` 默认 50,**上限钳制 200**;`start<0` 归零。
- 列表/内容端点**永不返回 `full_content`**(字幕全文只用于入库,不对外)。
- **v2 书籍注意(与 §8 相关)**:书籍句子在库中为**去标点**形式,故 `/media/content/book/{id}` 返回的
  `text` 是去标点文本,`audio` 初始为空(由 pycore 后续回填)。带标点原文的精确重建依赖
  `book.sentence_seq` + 标点标识库(§8.5/§8.6)。**当前公共读取控制器尚未做重建**(直接返回库中
  `text`)——见 §8.12 待办。

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

## 8. 书籍句子/词模型(v2,功能要求)

书籍("Books")把任意文本文档作为"句子来源"入库。本节是该功能的唯一权威契约(仅描述功能要求,不含代码)。

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
  注意:字幕(v1)路径句子仍**保留标点**,故共享库会同时存在带标点(字幕)与去标点(书籍)两类句子,
  两者不跨路去重(见 §2 的"句子键 v1↔v2")。
- **句子内容ID = 去标点归一化文本的 MD5(不含语言),具 unique 属性**;书与词同样以 MD5 内容ID标识(词ID = 词的 MD5;书ID = 去标点归一化全文的 MD5)。

### 8.5 标点标识库
- 内置一套**可扩展**的标点标识库;ASCII 与全角等不同字形各为**独立标识**(以便精确重建原文)。
- 该库须在 **sys:init 中幂等处理**(播种到 laravel_main 的标点标识参考表;重复执行不覆盖)。

### 8.6 书结构
- 书须存:**书名、原文**(完整备份)。
- 书须存**句子外连ID序列**:有序、句子内容ID 与标点标识**交替**、**允许重复**(同一句可在多处出现,如 id1、标点、id2、标点、又 id1);该序列与原文连续,可据此重建。
- 书须存**外连词IDs**(与句库引用同一字段载体,按语言分组);这些词同时**加入词库**。

### 8.7 词库
- 词库按语言对应到 `app_qy_v1_tts_cache_<lang>`(MD5 键)。入库时每个不重复词须**幂等加入**对应语言词库(已存在不覆盖)。
- 词的音频由 TTS 管线后续填充(词库自带音频字段)。
- **概念区分**:此处"词库"指按语言的**全局** `tts_cache_<lang>`(本节);与 §6.2 的用户"**词组**"
  (`word_groups.gwords`/`words_frequency`,挂载媒体来源时抽词)是**不同概念**,勿混淆。

### 8.8 句子音频
- 句子表须有**音频字段**:入库时**留空**,后续由 pycore 生成回填(当前回填逻辑以注释形式预留)。

### 8.9 幂等与提交
- laravel_main 端沿用 §2 的 fill-missing 永不覆盖;句子按**内容ID**去重并累计出现次数;整个入库包在单事务内;仅验证信封。
- pycore **一次性批量提交**(选中来源 → 构建载荷 → 入库 → 标记已同步并持久化);重复提交安全。
- 旧版(v1,句子带标点)路径保留,以 `model_version` 区分。

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

### 8.12 已知坑(书籍)
- 标点标识库与句子去标点规则两端必须一致(pycore 为权威定义,laravel sys:init 播种须镜像)。
- **公共读取未重建(待办)**:`/media/content/book/{id}`(§6.1)目前直接返回**去标点**库文本,且 `audio`
  初始为空;若需对外显示带标点原文,需让 `AppQyV1MediaContentPublicController` 用 `book.sentence_seq`
  + 标点标识库重建文本。该控制器尚未做 v2 改造。
- v2 书籍的 `source_sentences` 仅按**首次出现顺序**存**去重后**的句子(grain=`sentence`);**完整含重复的顺序**在 `book.sentence_seq`。§6.1 经 `source_sentences` 读取得到的是去重首现序,非逐字重现序。
- 拖放取路径依赖 `File.path`,PySide6 QtWebEngine 沙箱不暴露 → 退化为上传暂存;选择器/手输路径始终可用。
- 同 §7:改 RPC/入库逻辑后需重启 pycore worker;改 PHP 后须 `octane:reload`。
