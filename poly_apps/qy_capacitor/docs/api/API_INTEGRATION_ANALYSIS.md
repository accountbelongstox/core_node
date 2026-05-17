# API Integration Analysis Report

## 后端 API 扫描结果 (AppQyV1)

### 1. 认证相关 API (AppQyV1Auth.php)
**后端端点:**
- ✅ `/api/app_qy_v1/login` - POST - 已集成
- ✅ `/api/app_qy_v1/register` - POST - 已集成
- ✅ `/api/app_qy_v1/forgot-password` - POST - 已集成
- ✅ `/api/app_qy_v1/reset-password` - POST - 已集成
- ✅ `/api/app_qy_v1/logout` - POST - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/user` - GET - 需要认证 - 已集成
- ⚠️ `/api/app_qy_v1/verify-email/{id}/{hash}` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/email/verification-notification` - POST - 需要认证 - **未集成**

### 2. 用户相关 API (AppQyV1User.php)
**后端端点:**
- ✅ `/api/app_qy_v1/user/profile` - GET/PUT/POST - 需要认证 - 已集成
- ⚠️ `/api/app_qy_v1/user/initialization-status` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/user/initialize` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/user/progress` - GET - 需要认证 - **未集成** (返回模拟数据)
- ⚠️ `/api/app_qy_v1/user/stats` - GET - 需要认证 - **未集成** (返回模拟数据)

### 3. 单词组管理 API (AppQyV1Dict.php)
**后端端点:**
- ✅ `/api/app_qy_v1/query_all_groups` - GET - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/create_group` - POST - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/query_group_by_name` - GET - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/query_group_by_gid` - GET - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/query_gwords` - GET - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/query_gcontent` - GET - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/query_gfrequency` - GET - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/delete_group_by_name` - POST - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/delete_group_by_gid` - POST - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/manager/get_all_groups_by_manager` - GET - 需要认证 - 已集成
- ⚠️ `/api/app_qy_v1/study_groups/create_for_language` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/study_groups/by_language/{language}` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/study_groups/ensure_language_groups` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/group/add_library` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/group/remove_library` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/group/get_libraries` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/group/add_word` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/group/remove_word` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/group/get_words` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/group/update_progress` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/group/get_review_words` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/group/get_progress_stats` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/dictionary/tasks/create-explanation` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/dictionary/tasks/untranslated-words` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/covers/categories` - GET - 需要认证 - **未集成**
- ✅ `/api/app_qy_v1/covers/{filename}` - GET - 公开 - 已集成

### 4. 单词查询 API (AppQyV1Wordqurey.php)
**后端端点:**
- ✅ `/api/app_qy_v1/lookup` - GET - 公开 - 已集成
- ✅ `/api/app_qy_v1/lookup/batch` - POST - 公开 - 已集成
- ✅ `/api/app_qy_v1/word_exists` - POST - client.token - 已集成
- ✅ `/api/app_qy_v1/qurey_word` - POST - client.token - 已集成
- ✅ `/api/app_qy_v1/qurey_words` - POST - client.token - 已集成
- ✅ `/api/app_qy_v1/word/{word}` - GET - client.token - 已集成

### 5. 单词操作 API (AppQyV1Words.php, AppQyV1WordOperate.php)
**后端端点:**
- ✅ `/api/app_qy_v1/words/daily` - GET - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/words/{id}` - GET - 需要认证 - 已集成
- ⚠️ `/api/app_qy_v1/words/{id}/learn` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/words/{id}/review` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/words/{id}/favorite` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/words/search/{query}` - GET - 需要认证 - **未集成**
- ✅ `/api/app_qy_v1/words/public/{word}` - GET - 公开 - 已集成
- ⚠️ `/api/app_qy_v1/up_learned` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/up_read` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/up_weight` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/up_reviewed` - POST - 需要认证 - **未集成**

### 6. 学习相关 API (AppQyV1Learning.php)
**后端端点:**
- ⚠️ `/api/app_qy_v1/learning/languages` - GET/POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/learning/libraries` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/learning/libraries/select` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/learning/recommendations` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/learning/collections/select` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/learning/collections/selected` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/learning/words` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/learning/review-queue` - GET - 需要认证 - **部分集成** (前端有调用但可能不完整)
- ⚠️ `/api/app_qy_v1/learning/progress` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/learning/stats` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/learning/upload` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/learning/libraries/{library_id}` - DELETE - 需要认证 - **未集成**

### 7. 词汇库 API (AppQyV1Vocabulary.php)
**后端端点:**
- ✅ `/api/app_qy_v1/vocabulary/statistics` - GET - 公开 - 已集成
- ✅ `/api/app_qy_v1/vocabulary/libraries/recommended` - GET - 公开 - 已集成
- ✅ `/api/app_qy_v1/vocabulary/libraries` - GET - 公开 - 已集成
- ✅ `/api/app_qy_v1/vocabulary/libraries/{libraryId}/words` - GET - 公开 - 已集成

### 8. 个人词典 API (AppQyV1PersonDict.php)
**后端端点:**
- ✅ `/api/app_qy_v1/create_personal_dictionary` - POST - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/query_personal_dictionary` - GET - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/query_personal_dictionary_by_words` - POST - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/delete_personal_dictionary_by_id` - POST - 需要认证 - 已集成
- ✅ `/api/app_qy_v1/delete_personal_all_dictionary` - POST - 需要认证 - 已集成

### 9. 系统 API (AppQyV1System.php)
**后端端点:**
- ✅ `/api/app_qy_v1/system/supported-languages` - GET - 公开 - 已集成
- ⚠️ `/api/app_qy_v1/system/initialize` - POST - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/system/initialization-status` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/system/process-vocabulary` - POST - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/system/vocabulary-status` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/system/dictionary-statistics` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/system/supported-languages/{code}` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/word/{word}/enhanced` - GET/POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/untranslated` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/untranslated/priority` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/word/{word}/translation` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/word/{word}/audio` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/word/{word}/images` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/word/{word}/complete` - POST - 需要认证 - **未集成**

### 10. AI工具 API (AppQyV1AITools.php)
**后端端点 (公开):**
- ⚠️ `/api/app_qy_v1/invitation-code` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/translation/languages` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/translation/types` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/translation/models` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/translation/templates` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/languages` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/voices` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/options` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/stats` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/metrics` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/performance` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/logs` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/audio/{language}/{type}/{speed}/{filename}` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/audio/{language}/{type}/{filename}` - GET - 公开 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/article/task/{taskId}` - GET - 公开 - **未集成**

**后端端点 (需要认证):**
- ⚠️ `/api/app_qy_v1/ai_tools/translation/translate` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/translation/batch` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/translation/simple/google` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/translation/learning` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/translation/task/{taskId}` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/translation/process-next` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/generate` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/batch-generate` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue_batch` - POST - 需要认证 - **未集成** (Legacy)
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/status` - GET - 需要认证 - **未集成** (Legacy)
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/check_batch` - POST - 需要认证 - **未集成** (Legacy)
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/add` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/batch/add` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/batch/get` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/batch/query` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/summary` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/completed` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/task/{taskId}` - GET - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/requeue-failed` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/tts/queue/add-at-position` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/article/submit` - POST - 需要认证 - **未集成**
- ⚠️ `/api/app_qy_v1/ai_tools/article/preview` - POST - 需要认证 - **未集成**

## API 合理性分析

### 问题 1: 认证不一致
- **问题**: 部分API使用 `auth:sanctum`，部分使用 `custom.authenticate`
- **影响**: 可能导致认证逻辑不一致
- **建议**: 统一使用 `auth:sanctum` 或 `custom.authenticate`

### 问题 2: 路由命名不一致
- **问题**: 
  - `/api/app_qy_v1/query_all_groups` (snake_case)
  - `/api/app_qy_v1/words/daily` (RESTful)
  - `/api/app_qy_v1/learning/review-queue` (kebab-case)
- **影响**: API风格不统一，增加维护成本
- **建议**: 统一使用 RESTful 风格或 snake_case

### 问题 3: 模拟数据端点
- `/api/app_qy_v1/user/progress` - 返回硬编码的模拟数据
- `/api/app_qy_v1/user/stats` - 返回硬编码的模拟数据
- **建议**: 实现真实的数据查询逻辑

### 问题 4: 重复的路由定义
- `/api/app_qy_v1/word/{word}/enhanced` 同时支持 GET 和 POST
- **建议**: 明确使用场景，避免混淆

### 问题 5: 缺少版本控制
- 部分路由使用 `/v1/auth`，部分使用 `/app_qy_v1`
- **建议**: 统一版本控制策略

### 问题 6: 中间件使用不一致
- `client.token` 中间件用于某些公开API
- `auth:sanctum` 用于需要用户认证的API
- `custom.authenticate` 用于某些需要认证的API
- **建议**: 明确各中间件的使用场景

## 集成优先级建议

### 高优先级 (核心功能)
1. `/api/app_qy_v1/learning/review-queue` - 复习队列
2. `/api/app_qy_v1/learning/progress` - 学习进度更新
3. `/api/app_qy_v1/learning/stats` - 学习统计
4. `/api/app_qy_v1/words/{id}/learn` - 标记单词为已学
5. `/api/app_qy_v1/words/{id}/review` - 标记单词为已复习

### 中优先级 (增强功能)
1. `/api/app_qy_v1/group/*` - 单词组管理增强功能
2. `/api/app_qy_v1/learning/languages` - 学习语言设置
3. `/api/app_qy_v1/ai_tools/translation/*` - 翻译功能
4. `/api/app_qy_v1/ai_tools/tts/*` - TTS功能

### 低优先级 (辅助功能)
1. `/api/app_qy_v1/system/initialize` - 系统初始化
2. `/api/app_qy_v1/verify-email` - 邮箱验证
3. `/api/app_qy_v1/invitation-code` - 邀请码查询

## 统计摘要

- **总API数量**: ~120+
- **已集成**: ~35 (约29%)
- **未集成**: ~85+ (约71%)
- **需要认证**: ~80+
- **公开API**: ~40+

