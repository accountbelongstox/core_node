查查看后端qy APP v1是否有提交一pian文章，然后自动转写为语言，并提取单词的方
法（单词为对文章进行空格 - _ , ? 等解析），目前先支持英文，随后返回文章，句子
对应语音，单词组，注意要和心跳中心联动，因为语音并不会立即生成，所以要利用任
务系统不停的生成语言，𥩝前端提交后得到一个任务ID和resraul，如果没有完成将不停
的查询，交更新数据。注意使用全局缓存。

AppQyV1TTSGenerationTask.php 
集成到其中每个任务添加将立即进处理，每次只处理一个任务，建立数据表，对文章作
为每日阅读。同进，单词将与词库联动，同时扩展文章类型，目前先支持英文。 

__misc__\_pycore 在旧代码中找到文章转词组的方法，然后先给php扩展公共方法。

根据代码检查，AppQyV1 后端目前没有完整的文章提交并生成语音的功能，但已经有
  部分基础设施可以支持这个需求。

  现有功能架构分析

  ✅ 已存在的组件

  1. TTS 语音生成服务 (app/Services/EdgeTTS/EdgeTTSService.php)
    - 支持 82 种语言
    - 单个文本生成: generate()
    - 批量生成: batchGenerate()
    - 支持类型: sentence, word, letter
  2. 缓存管理器 (app/Services/EdgeTTS/TTSCacheManager.php)
    - 基于文件的 JSON 缓存
    - 按语言、文本类型分文件存储
    - 自动清理机制（最多 1000 条/文件）
  3. 定时任务系统 (app/Services/TimerTasks/AppQyV1TTSGenerationTask.php)
    - 每 60 秒执行一次
    - 自动为词典中的单词生成语音
    - 支持重试机制（最多 3 次）
  4. 全局任务系统 (app/Http/Controllers/TaskController.php)
    - 任务创建: POST /api/task/create
    - 任务状态查询: GET /api/task/{taskId}/status
    - 支持多种执行类型: local_timer, remote_compute, remote_io 等
    - Worker 心跳机制: POST /api/worker/heartbeat
  5. 现有路由 (routes/AppQyV1Router/AppQyV1AITools.php)
  POST /api/app_qy_v1/ai_tools/tts/generate
  POST /api/app_qy_v1/ai_tools/tts/batch-generate
  GET  /api/app_qy_v1/ai_tools/tts/audio/{language}/{type}/{filename}

  ❌ 缺失的功能

  1. 文章提交接口 - 不存在
  2. 文章解析为句子 - 不存在
  3. 单词提取逻辑（按空格、-、_、,、? 解析）- 不存在
  4. 文章级别的异步任务 - 不存在
  5. 前端轮询机制 - 不存在

  建议的实现方案

  方案架构

  前端提交文章
       ↓
  创建全局任务（task_type: article_tts_generation）
       ↓
  返回任务 ID 给前端
       ↓
  后台 Worker 处理任务：
    1. 解析文章 → 句子数组
    2. 提取单词 → 单词数组（去重）
    3. 批量生成句子语音（异步）
    4. 批量生成单词语音（异步）
    5. 更新任务进度
       ↓
  前端轮询任务状态（GET /api/task/{taskId}/status）
       ↓
  任务完成后返回：
    - 文章原文
    - 句子数组 + 语音 URL
    - 单词数组 + 语音 URL

  需要创建的文件

  AppQyV1ArticleController.php (app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AI
  Tools/AppQyV1ArticleController.php:1-150)
  - submitArticle() - 提交文章，创建任务
  - getArticleTaskStatus() - 查询任务状态

  AppQyV1ArticleTextParser.php
  (app/Apps/AppQyV1/Utils/AppQyV1ArticleTextParser.php:1-100)
  - parseSentences() - 按标点符号解析句子
  - extractWords() - 按空格、-、_、,、? 等提取单词

  AppQyV1ArticleTTSWorker.php
  (app/Services/Workers/AppQyV1ArticleTTSWorker.php:1-200)
  - Worker 处理文章 TTS 任务
  - 集成全局任务系统

  路由文件更新 (routes/AppQyV1Router/AppQyV1AITools.php:69-75)
  Route::prefix('article')->group(function () {
      Route::post('/submit', [AppQyV1ArticleController::class,
  'submitArticle']);
      Route::get('/task/{taskId}', [AppQyV1ArticleController::class,
  'getArticleTaskStatus']);
  });

  数据库考虑

  建议使用 Redis 缓存 存储任务中间结果，避免数据库频繁写入：

  Cache::put("article_task:{$taskId}", [
      'article_text' => $text,
      'sentences' => $sentences,
      'words' => $words,
      'progress' => 0.5,
      'audio_urls' => []
  ], 3600); // 1小时过期

  建议

  1. 优先使用全局任务系统（已存在）而不是创建新的任务机制
  2. 复用 EdgeTTSService 的批量生成功能
  3. 利用 TTSCacheManager 避免重复生成相同文本的语音
  4. 前端轮询间隔建议: 2-3 秒查询一次任务状态
  5. 任务超时设置: 根据文章长度动态计算（如 60s + 每个句子 5s）
  6. 英文单词解析正则:
  preg_split('/[\s\-_,?.!;:]+/', $text, -1, PREG_SPLIT_NO_EMPTY)

  需要我开始实现这个功能吗？

从单词解析，解析后到词库查询翻译（不存在则添加词库），查找语音缓存（使用句
  子孙为单位），查找不到添加定时心跳任务，并给出任务码。任务是一个列表，不是
  一个句子孙。当添加一个文章时要立即返回，并给出文章是否完成，以及完成部份和
  缺少部份的占位。让前端好在后续更新。


TTS 交给 TTS处理， TTS自动处理缓存，只是负责添加到任务定时器，共用一个心跳
  系统，则任务定时器自动调用TTS。中间是没有耦合的。 提交后将立即查询词库得到词的列表，没有的则添加到库库，标记为未翻译，所以查看现在的词库类库是否扩展足够。
所有代码码都要遵守规范。development-guides\LARAVEL_GUIDE.md

词库 需要单独的类库，针对不同的语言处理，因为如果有未翻译，词库类库也要处理
先查看这一点。 

A dedicated service class for dictionary operations with:

  - Language Support: English, Chinese, Spanish, French, German, Japanese,
  Korean, Vietnamese, Lao
  - Core Methods:
    - queryAndAdd() - Atomic operation to query words and add missing ones
    - queryWords() - Check word status (existing/missing/untranslated)
    - addWords() - Batch add new words marked as untranslated
    - getStatistics() - Dictionary stats per language
    - getUntranslatedWords() - Get words needing translation
    - processTextByLanguage() - Language-specific text processing

  2. Integrated into AppQyV1ArticleWord.php

  Updated createFromArticleWords() method at line 72:
  $dictionaryInfo = AppQyV1DictionaryService::queryAndAdd($language, $words);

  This ensures:
  - Words are queried from dictionary immediately after parsing
  - Missing words are added automatically
  - New words are marked as has_translation = false
  - Returns dictionary status for each word

  3. Data Flow

  Article Submit → Parse Text → Extract Words
                                      ↓
                            Query Dictionary (immediate)
                                      ↓
                      Add Missing Words (marked untranslated)
                                      ↓
                        Save Article + Words (transaction)
                                      ↓
                          Create TTS Task (async)
                                      ↓
                      Return Immediately with Placeholders

  4. Key Features

  ✅ Immediate Return: Article saved and returned instantly, TTS processes in
   background
  ✅ Dictionary Integration: Words automatically added to dictionary on
  submission
  ✅ Untranslated Tracking: New words marked with has_translation = false
  ✅ Transaction Safety: Article and words saved atomically
  ✅ Batch Optimization: Single insert for all words (not loop)
  ✅ Hot Reload: No service restart needed
  ✅ Code Compliance: Follows LARAVEL_GUIDE.md conventions

  The dictionary service is now fully integrated and operational. The system
  will automatically populate the dictionary with new words as articles are
  submitted.


查看词库，以前旧代码，是否有接口提供给第三客户端，对词库中没有翻译的词进行翻译然后回传 加传翻译、词的对应图片（如果有）、语的语音（如果有），同时查看所有语言的数据 表是否支持，同时配合 
···
同时 GlobalTask 现在，其中的任务要扩展为两种，一种是由laravel调用定时器处理的，type另一种为远程客户端处理的（比如需要运算的）
不要只考虑qy app v1 现在任务系统 是全局的，所有APP中可用。同时每个任务都可以客户端请求表，同时有一个处理时间，智能分配系统 系统 ，当一个任务被 请求后请在超时期内等待客户端回传，如果超过时间则可以继续 分配（当然回传任务时要检测可能又被处理）。
需要由websockt通信，同时你要调用一下mcp查看官方的WEBSOCKT方案，然后扫描本项目，查看规范，再继续给出第二版的设计

词库API系统完善 - 已有完整的第三方客户端接口，支持获取未翻译词、提交翻译
  /图片/语音，支持9种语言
  2. GlobalTask架构成熟 -
  已有Worker注册、任务分配、超时重试、智能匹配等完整机制
  3. WebSocket基础就绪 - Octane/Swoole配置完成，只需启用Reverb

  🎯 核心设计

  架构原则：
  - 利用现有GlobalTask系统，不重构
  - 添加EXECUTION_REMOTE_CLIENT作为通用远程客户端任务类型
  - Laravel Reverb提供实时WebSocket推送
  - 保持HTTP API向后兼容

  关键流程：
  APP创建任务 → GlobalTask存储(pending)
                      ↓
  Worker监听WebSocket → 收到任务分配事件
                      ↓
  HTTP API接受任务 → 处理 → 提交进度 → 完成
                      ↓
  WebSocket广播进度 → 前端实时更新

  技术栈：
  - Laravel 12 + Octane + Swoole
  - Laravel Reverb (WebSocket服务器)
  - GlobalTask + Worker系统
  - Redis (Reverb横向扩展)

  实施周期： 10-16天（已分5个阶段）

  📦 交付物

  上述完整设计方案包含：
  - 架构图和流程图
  - 数据库设计（无需修改现有表）
  - WebSocket集成方案
  - Python客户端SDK示例
  - 配置模板和部署指南
  - 实施路线图

  下一步建议： 如果方案获批，可以开始Phase
  1（WebSocket基础设施搭建，1-2天）。

> 实现，并写一个客户端，测试请求服务端的未翻译记记事，然后回传dome数据，注意
后端扩展dome，dome不存入数据库。 

● 收到！我将实现完整的WebSocket任务系统，并创建Python客户端进行端到端测试。重
  点是demo模式不写数据库。


不要直接操作服务，而是在./scripts/deploy.sh中写补丁包，以及添加 srtian 
sys:init 中的必要注册。development-guides\LARAVEL_GUIDE.md 
查看其中的权限重启服务方式。 