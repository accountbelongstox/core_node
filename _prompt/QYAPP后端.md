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

查看原来的代码,现在bing除了提供一个MCP工具外,还提示API功能,但不是作为服
务端,而是客户端,相当于请求服务端得到一些词,翻译后并回传(当然客户端功能是
在面板上开启),并和面板上设置的URL API访问, 


apps/mcp-chrome/app 现在将作为一个客户端请求未翻译的词库并回传，找到 laravel main / qy app v1，查看后端是否提供了必要的接口，先找出后端的问题，然后查看如何 和前端协调。你现在负责后端。

使用多CSS 多文件构架，一个说谎的爱人不要超过500行，超过了就注明，并使用多文件构架。

确保任务系统的可扩展性,而不是任务系统laravel自己会处理,同时扩展出接口给第三方
处理,注意这个规范. 

请一个测试脚本请𣷌后端,查看是否能打印未翻译的任务.不需要进行回传.不要重启后端报务,后端是热重载 


现在当前端开始自动bing队列后,将后后端实时请求任务.5各种刷新一次,请求的
任务放入一个统了缓存,不要重复.然后在面板上打印这些信息.使用当前的便当盒布
局,当有新任务时显示,当前队列总数,新请求数,重复数. 

建立成统一的本地任务中心，当浏览器开始本地任务时，启动上面的任务，注意bing只是任务之事，需要可扩展，还有deekseep等功能。在 面板上启动

作用统一状态中心，而不要开启时开启一个任务，关闭时又消除一个任务。而是使用统一的状态中心，开启时直接启动统一的任务，所有任务都使用hook在该任务中心上。

为什么请求的总是这几个词,现在要请求真实的未翻译.只是不回传.dome只是指后端不写
入数据库,而不是随便返回前端.修改后端.dome 
只是指前端传的数据不一定真实,后端忽略掉,但一切流程是真实的. 

 使用dome回传后端,后后收到后不存入数据.测试整信流程,前端自动生成domeovrn . 

  现在后端默认全自动将未翻译的词定时定入词库,在后端自动更新.前端只是请求其中的
部份,明白?


前端可以在后端注册任务,并让后端长处理,也可以请求后端的任务,前端
帮忙处理.查看后疫端是否是这个设置,同时,现在后端是否可扩展,以及是否定时截入未解
释的单词,前端就是请求这部份单词帮忙翻译,但是是dome模式,前端实际上是生成模拟数据
回传测试流程. 


注意,给前端扩展一个公共方法,ensuer 
user信息最低满足,如果后端没有头像,昵称,将立即自动生成并立即回传后端更新,
后端将保存图像,之后查看后端是否有对应的profile的接口(注意一次更新多个数据
 ),对于头像,使用php map path 中的 laravel_db中合适的路径/{appname 
v1}/xxx/xxx中保存.之后更新到数据库(数据库只保存图片名) 
注意如果没有可用表格字段,扩展artisan sys:init , 
后端要可扩展，注册时必须 有头像，

后端的任务是使用octane的心跳中
心自动读取所有词库,自动装载的,全面重构代码. 


 查前前端的任务中心是否完成,每次只处理一个任务.有一个任务中心,可以添加,但是
不能重复,每次只处理一个任务.点击添加自动开始处理,没有了就停止.后点击开始后,bi
ng往任务中心添加,之后开始处理,处理完后会递归检测只要还有任务.没有就停止.同时
其他也可以往任务中心添加比如deepseek.在面板上显示任务中心的信息. 

任务是重启后利用心跳中心自动装载的,只要重启就会自动装载。

:/www/programing/core_node# python /www/programing/core_node/apps/mcp-chrome/test-full-workflow.py
Press Ctrl+C to stop...

[20:57:12] [INFO] Registering worker...
[20:57:12] [INFO] ✓ Worker registered: demo-worker-980886a2-56b4-412f...
[20:57:12] [INFO] Polling for tasks...
[20:57:22] [INFO] No tasks available, waiting...
[20:57:27] [INFO] Polling for tasks...

 后端的装载是否正确,在该任务连中,查看可扩展的后端队列1:是否是可扩展,2是否有正确
装载,对该任务连进行扩展,需要返回后端该类语言 
下有多少词,翻译的有多少,正在队列的有多少,测试文件获取到数据要打印. 
检测以下流程是不是你乱统的：
···
  1. Provider已注册
    - 文件：bootstrap/providers.php:17
    - App\Providers\OctaneTimerServiceProvider::class 已注册
  2. 自动发现机制正常
    - 文件：app/Providers/OctaneTimerServiceProvider.php:83-161
    - 自动扫描 app/Services/TimerTasks/ 目录
    - 自动注册所有实现 OctaneTimerTaskInterface 的任务
  3. 任务类配置正确
    - 文件：app/Services/TimerTasks/AppQyV1DictionaryTranslationTask.php
    - ✓ 继承 OctaneTimerTaskAbstract
    - ✓ 实现 OctaneTimerTaskInterface
    - ✓ isEnabled() 返回 true
    - ✓ getInterval() 返回 30秒
  4. Swoole Tables已配置
    - 文件：config/octane.php:157-169
    - ✓ timer_state:1 表（存储运行状态）
    - ✓ timer_tasks:100 表（存储任务统计）
  5. Octane Tick Hook正常
    - 文件：app/Providers/OctaneTimerServiceProvider.php:166-185
    - ✓ 每秒触发一次
    - ✓ 使用 ->immediate() 立即启动


···

Edit profile 页并按原来的美化风格,同时头像点击后可以换图旬,当然要和原来的api中的profil
e同步绑定.头像点击后更换,其他可以修改后保存,用户名不能修改,邮箱修改需要提
示.密码需要两次确认,并有单独的弹出窗口.但最终都只调用同一个profile sync api. 

> http://192.168.50.3:10029/profile 这个页面,所有底部菜单都要置底,查看整
个项目,同时,不要有两个中转,在profile页显示为我的, 
设置出我的页面,显示出必要的信息,之后点击编辑,直接到 edit profilel 

/settings 在设置页, settings_lang 
显示为grid布局,同时每个语言有和个图标,调用MCP以及查看本项目使用合适的图标
库.图标是后端传递(查看后端),前端解析,之后,所有语言点击后不再以列表,而是gr
id复选框,可以多选,当多选后,在首页实时更新词库,先总结前后端怎么完成. 在后端map中只是指定一个通用的名称作为前端的图标映射,并说明,前端建立一个
强大的图标映射库,之后根据后端的通用名称,映射前端实际使用的icon库的图标. 

  我的页使用便当盒布局,不要写得难看. /profile 
顶部搜索菜单的设置图标旁边 ，加上 dart/light模式切换按钮，以及多语言切换，多语言点击后下拉可用界面语言。 


 功能模块                    | Python pycore/pylauncher   | Node.js
  ncore/launcher                        | 状态      |
  |-------------------------|----------------------------|---------------
  --------------------------------|---------|
  | 核心文件                    |                            |
                                      |         |
  | launcher主文件             | launcher.py (337行)         |
  launcher.js (177行) + launcher_config.js (65行) | ⚠️ 拆分   |
  | Native UI启动器            | native_launcher.py (340行)  | ❌ 无
                                        | 🔴 缺失   |
  | App可执行文件启动              | app_executable_launcher.py |
  app_executable_launcher.js                    | ✅ 对应    |
  | 单例检测器                   | singleton_detector.py      |
  singleton_detector.js                         | ✅ 对应    |
  | 配置参数                    |                            |
                                      |         |
  | services 字典             | ✅ 动态服务                     | ⚠️
  有但未用                                       | 🟡 未实现  |
  | force_launch            | ✅                          | ❌
                                    | 🔴 缺失   |
  | shutdown_existing       | ✅                          | ❌
                                    | 🔴 缺失   |
  | Tray 配置                 | ✅ 4个参数                     | ❌
                                         | 🔴 缺失   |
  | Heartbeat 配置            | ✅                          | ❌
                                      | 🔴 缺失   |
  | Speech 配置               | ✅ 2个参数                     | ❌
                                         | 🔴 缺失   |
  | UI 配置                   | ✅                          | ❌
                                      | 🔴 缺失   |
  | Legacy API 支持           | ✅                          | ❌
                                      | 🔴 缺失   |
  | 服务管理                    |                            |
                                      |         |
  | 动态服务注册                  | ✅ SERVICE_STARTERS         | ❌
                                          | 🔴 缺失   |
  | THREAD_BUS 集成           | ✅                          | ❌
                                      | 🔴 缺失   |
  | 硬编码服务启动                 | ❌                          | ✅
  只有 RPC                                      | 🟡 限制   |
  | 单例检测                    |                            |
                                      |         |
  | 基础检测                    | ✅                          | ✅
                                        | ✅ 对应    |
  | force_launch 逻辑         | ✅                          | ❌
                                      | 🔴 缺失   |
  | THREAD_BUS busy状态       | ✅                          | ❌
                                      | 🔴 缺失   |
  | 强制关闭（SIGTERM）           | ✅                          | ❌
                                          | 🔴 缺失   |
  | Native UI               |                            |
                                  |         |
  | launch_with_native_ui() | ✅ 60+参数                    | ❌
                                      | 🔴 完全缺失 |
  | Debug Window            | ✅                          | ❌
                                    | 🔴 缺失   |
  | System Tray             | ✅                          | ❌
                                    | 🔴 缺失   |
  | Frontend 管理             | ✅                          | ❌
                                      | 🔴 缺失   |
  | RPC v2 集成               | ✅                          | ⚠️ 简化版
                                        | 🟡 不完整  |
  | Timer 管理                | ✅                          | ❌
                                      | 🔴 缺失   |
  | Restart 支持              | ✅                          | ❌
                                      | 🔴 缺失   |
  | QtWebEngine 配置          | ✅                          | ❌
                                      | 🔴 缺失   |
  | 便捷功能                    |                            |
                                      |         |
  | launch_services()       | ✅                          | ❌
                                    | 🔴 缺失   |
  | stop_services()         | ✅                          | ❌
                                    | 🔴 缺失   |
  | 工厂方法                    | ✅ 2个                       | ⚠️
  2个（不同）                                     | 🟡 部分   |

  ---
  🎯 总结

  严重缺失 (Critical - 必须实现):

  1. ❌ native_launcher.js - 整个文件缺失（340行功能）
  2. ❌ LauncherConfig - 缺少10+个核心参数
  3. ❌ 动态服务注册系统 - 没有 SERVICE_STARTERS
  4. ❌ THREAD_BUS 集成 - 所有信号和状态管理
  5. ❌ force_launch/shutdown_existing - 单例逻辑不完整

  重要缺失 (Important - 建议实现):

  6. ❌ Tray/Heartbeat/Speech/UI - 配置和启动
  7. ❌ Legacy API 支持 - 向后兼容
  8. ❌ 便捷函数 - launch_services/stop_services
  9. ❌ 强制关闭机制 - SIGTERM/SIGKILL

  次要差异 (Minor - 可选):

  10. ⚠️ 文档完整度
  11. ⚠️ 日志详细程度
  12. ⚠️ 错误处理细节

  结论：ncore/launcher 只实现了 pycore/pylauncher 约 30-40% 的功能！



看了还有很金金金金多没有完成,但没时间告诉你是那些,自己再去扫描.确认.
同时对应pycore的 native ui 
,pycore将实现一个electron的同样的端,但都是通过luanchre.js来启动. 

直接完成,所有 app_qy_v1 都要实现民    BACKEND_FRONTEND_GAP_ANALYSIS.md  继续完成. 同时确保后端qy qpps v1 的所有端点. 每个端点在前端是否能正常操作和操控后端.必须一 个端点一个端点的检测,确保UI,可用性.

现在在前端,设置中 http://192.168.50.3:10029/settings_lang 
选的选项,根据选择的语言保,在首页更新词库,注意首页有推荐词库,以肿登陆后的
根据选择语言更新的个性记词库. 

  查看首页为什么没有推荐词同库,注意是词库,根据选择的语言推荐的,并不是书库或课
  程.所有的推荐初始化不要直接改数据库找到后 laravel main qy app v1 
  ,使用artisan sys:init 注册.


现在我们来重新设计，技术端发布一个APP，上传APP下载地址，就会显示一个加密的字符串，作为本项目的  http://192.168.50.3:10000/#/${加密字符串} 的URL，发送APP的时候可以填一个绝对URL作为第二个访问URL，以及APP封面。访问该URL进入APP下载连接，同时生成一个推广码二维码，扫描后会访问 访问  http://192.168.50.3:10000/#/${加密字符串}，所有发布的APP在技术端和管理端都能看得见列表，点击后会显示 推广二给码，URL, 第二个访问URL，以及APP封面。
目前以此APPmodel 为数据 之一，与其他数据 互相绑定交互，比如与客服等。先内置一条APP 数据 。对model mock-model分别设计和放置。

构建 一个推广人员和客服人员的的数组model， 在管理端可以查看有多少推广人员和客服人员。之后将该数据与  推广轨迹 关联，推广轨迹 改为一个一个的推广包，列表显示 每个推广集合，数据 为 从xxx到xxx点结束 ，推广人，有效值 ，单价，总价，扣单，结算算，审批人，是否结算，收款信息（加密货币地址），视频记录，手机定位记录，细节。点开显示上面的信息，以及细节列表，细节列表就是现在的轨迹。并能显示 视频，


在推广人员列表中（管理端可查看），推广人信息，总有效值 ，单价，总价，总扣单，总结算价，审批人，已结算价格，未结价格，收款信息（加密货币地址），照片，联系方式，加盟时长，负责区域（比如北京大兴）
在客服人员列表中（管理端可查看），客服信息，业务金额 ，提成金额，提成%比，总价，总扣单，总结算价，审批人，已结算价格，未结价格，收款信息（加密货币地址），照片，联系方式，加盟时长，客服级别


管理端有添加推广人、客服的功能，添加后更新。

http://192.168.50.3:9000/api/app_qy_v1/query_all_groups 
这个是指登陆以后显示的,登陆以可以将一个词库加入一个分组,也可以将多个词库加入
一个分组学作为一个背单词组,也就是本系统不以词库为单位,而是以学习分级为单位,现
在1:你要查看后端是否有就对应的实现,2你要查看多个词库加入一个分组时后面的储是
否合理,每个分组只存单词的ID,不存,以免造成数据过大,同时建立每个语言的对应分组
表,因为一个语言的分组表会存多个用户的分组,3,分组还有其他信息,总体是 
语言库EN:[{词ID,读的时间,复习时间,复习次数,读的次数,权重(初次计算方式为单词的
长度),下次复习时间,熟练度}],4:是否有添一个词库内联移到分组的方法,以及将一个单
词组\加入到分组. 


注意,音频并不是实时生成,因为生成音频需要时间,所以音频如果没有查找到立即返回
null,之后前间在收到列表后会将没有音频的放入缓存,并重试请求.1:现在前端有一个单
词库,根据前端的切换,装载\补充\xei载单词库,这个库是全局的,由很多类库去处理,2:
前端当单词库有单词时,触发词库处理(钩子一就是请求后端补充语音)  ,3:后端有一个
队列(查看现在后端的队列逻辑),当请求一级单词时,如果发现没有音频立即加入队列,则
后端由跳系统生成音频,等前端请求单独音频接口时返回,.4,后端队列与全局的任务系统
联动方便第三方客户端请求协助处理,比如音频.你现在处理前端,我让别一个AI处理后端
. 

对推荐词库给便当合布局,并预留一个背景浅变色,以及缩略图.稍候就让后端传递,如
果后端没有传递,则默认显示默认图.之后,在每个词库上有一个加号(未登陆时点击会显
示登陆界面) ,登陆时直接提示清加到分组,弹出一个居中窗口,显示添加到那个分组,默
认显示默认,当点击创建分组时,跳转到分级页面(要创建分组页面.)

查看所有公共注册,是否有类似的机制,将注册方式扩展到公共,之后qyapp也是引用公
共类库,同时查看公共注册,现在的注册是否先写入到公共用户表,再定入子APP表,任何
注册都先写到公共用户表.只有在公共表中存用户名密码,子表只是扩展子APP的扩展信
息,和用户名映射. 

查要看公共用户表和子APP用户的对应关系,以及artisan sys:init中是不处理好了子APP和主用户表的关系. 

看前端的要求,同时 找到现在laravel中的公共代码中的,生成占位圉,以及生成图片的
类库,对所有要求需要cover 
image的生成对应的图标,但要进行大小等比例的裁箭,同时你设置一些 
常量,对每个类别的缩略图进行一个设置,同时,要使用php path 
map中的站外目录存放图片,同时要使用file system map来读取站外图标并给出url. 


 http://192.168.50.3:9000/api/app_qy_v1/vocabulary/libraries/6/words?per_pag
e=2000 
前端只是不停的请求这个页,并没有首次请求就在本地建立缓存,之后只轮询没有音频的
啊.同时本地缓存是动态的,因为可能切换换页面了,也就是只轮询激活的词段的音频. 

确保后端的可以批量添加，批查查询，比如批量添加多个单词、文章、句子（俣格式要保持），批量查询，均返回一个任务ID数组。如果任务已经完成，则同时返回结果 ，比如文章要返回多个句子的MD5映射文件。
同时，任务系统 可以直接穿透查询文件，比如add任务时已经有了音频文件，将立即 更新数据 库，以及返回结果 。
同时核对以下下：
···
继续 添加，后端有自动装载功能（每分钟装载一次），后端扩展出自动将没有语音文件的词库文件装入到队列（队列 内部判断不重复），在查询的时候要跳过队列 中的，减少数据 库查询量，
之后，在artisan sys:init 确保有各个语言的文章类库，和詡库类似，有添加时间、来源、内容、所有人（默认系统 ），对应语音是否存在（注意这个是为了给查询数据库优化用的，实际上还是要以语音文件是否存在）
词库中也要扩展一个是否有语音的字段，便于扫描数据库。
 表格初始化要写在 artisan sys:init
,现在查找所有文件,找到TTS在OCTANEK 
的代码并抽象为一个整体,之后,提供API接口,查询正在队列中的所有单词\文章\句子,
添加一个任务单词\文件\句子到TTS,扩展出TTS翻译单词\文章(改为句子,映射多个句子
)\句子的处理类库，都要使用现在的缓存，API接口提供查询队列详情、已处理（返回
队列中的所有类型），查询单个任务，添加任务（类型可选，后端自动识别），添加任
务时如果队列中已经存在，只是提到队列首优先处理。给出前端API文档。 
···

整体查看一致性,并应用laravel的能力,当你需要重启系统时查看文档developm
ent-guides/LARAVEL_GUIDE.md 如何重启.数据库在 artisn sys:init中初始化 

同时支持使用任务ID和单词,句子,文章直接查询.具有自动适配的能力,因为本
  身就有文件穿透,以及如果不存在文件将立即创建任务.同时任务不重复的功能.
  代码全英文.

将刚才的所有API写到文档,同时合并文档中的旧内容.edge的超时间为5分钟,每
两次调用之间隔时间为2秒,如果报错说明频繁也会报告,则将时间延长为5秒间隔
时间重试,当正常后又恢复为2秒.建立这个完整的机制. 

再次修正edge-tts的调用链,只能由一个队列调用,而不要多处调用而用锁\与其
这样不如只使用tts一个队列.同样装备入队列后只能查询结果.同时调用队列不重
复.整合现在的所有代码和所有调用处,重构这一点. 

development-guides/LARAVEL_GUIDE.md 根据规范调整代码.http://192.168.
50.3:9000/api/app_qy_v1/ai_tools/tts/queue/stats 没有看到处理,只有 
pending一直在增加,但是compileted没有变化. 
 其中返回最近100条日志, 
http://192.168.50.3:9000/api/app_qy_v1/ai_tools/tts/queue/batch/add 
似乎也没有优先处理,同时 
http://192.168.50.3:9000/api/app_qy_v1/ai_tools/tts/queue/batch/get 
也没有变化,同时现返回日志.之后,处理失改的重架添加回开头,对队列给出广泛
,从开头添加,从结尾add,以及从中间添加. 


laravel_dashboard/OCTANE_SERVICE_ANALYSIS.md

