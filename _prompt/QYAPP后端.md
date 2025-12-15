查查看后端qy APP v1是否有提交一pian文章，然后自动转写为语言，并提取单词的方
法（单词为对文章进行空格 - _ , ? 等解析），目前先支持英文，随后返回文章，句子
对应语音，单词组，注意要和心跳中心联动，因为语音并不会立即生成，所以要利用任
务系统不停的生成语言，𥩝前端提交后得到一个任务ID和resraul，如果没有完成将不停
的查询，交更新数据。注意使用全局缓存。

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
