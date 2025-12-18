# Backend-Frontend API Gap Analysis
**Date: 2025-12-18**
**Backend Routes Scanned: 114 endpoints**
**Frontend APIs Implemented: 31 endpoints**

---

## 🔴 Critical Issue: 83 Backend Endpoints NOT Implemented in Frontend

您是对的！后端实际有 **114个API端点**，而前端只实现了 **31个**，还有 **83个端点**前端没有对应的实现。

---

## Complete Backend Endpoint Inventory

### ✅ Authentication Endpoints (5 endpoints - 100% implemented)

| Method | Endpoint | Frontend API | Status |
|--------|----------|--------------|--------|
| POST | `/app_qy_v1/register` | ✅ ApiCenter.auth.register | IMPLEMENTED |
| POST | `/app_qy_v1/login` | ✅ ApiCenter.auth.login | IMPLEMENTED |
| POST | `/app_qy_v1/logout` | ✅ ApiCenter.auth.logout | IMPLEMENTED |
| POST | `/app_qy_v1/forgot-password` | ✅ ApiCenter.auth.forgotPassword | IMPLEMENTED |
| POST | `/app_qy_v1/reset-password` | ✅ ApiCenter.auth.resetPassword | IMPLEMENTED |

---

### 🟨 Learning Endpoints (11 endpoints - 64% implemented)

| Method | Endpoint | Frontend API | Status |
|--------|----------|--------------|--------|
| GET | `/app_qy_v1/learning/languages` | ❌ Missing | **NOT IMPLEMENTED** |
| POST | `/app_qy_v1/learning/languages` | ❌ Missing | **NOT IMPLEMENTED** |
| GET | `/app_qy_v1/learning/libraries` | ✅ ApiCenter.learning.getLibraries | IMPLEMENTED |
| POST | `/app_qy_v1/learning/libraries/select` | ✅ ApiCenter.learning.selectLibrary | IMPLEMENTED |
| GET | `/app_qy_v1/learning/recommendations` | ✅ ApiCenter.learning.getRecommendations | IMPLEMENTED |
| POST | `/app_qy_v1/learning/collections/select` | ✅ ApiCenter.learning.selectCollection | IMPLEMENTED |
| GET | `/app_qy_v1/learning/collections/selected` | ✅ ApiCenter.learning.getSelectedCollections | IMPLEMENTED |
| GET | `/app_qy_v1/learning/words` | ✅ ApiCenter.learning.getWordCards | IMPLEMENTED |
| POST | `/app_qy_v1/learning/progress` | ✅ ApiCenter.learning.updateProgress | IMPLEMENTED |
| GET | `/app_qy_v1/learning/stats` | ✅ ApiCenter.learning.getStats | IMPLEMENTED |
| POST | `/app_qy_v1/learning/upload` | ✅ ApiCenter.documents.upload | IMPLEMENTED |
| DELETE | `/app_qy_v1/learning/libraries/{library_id}` | ❌ Missing | **NOT IMPLEMENTED** |

---

### 🔴 Words Endpoints (11 endpoints - 55% implemented)

| Method | Endpoint | Frontend API | Status |
|--------|----------|--------------|--------|
| GET | `/words/daily` | ✅ ApiCenter.words.getDailyWords | IMPLEMENTED |
| GET | `/words/{id}` | ✅ ApiCenter.words.getDetail | IMPLEMENTED |
| POST | `/words/{id}/learn` | ✅ ApiCenter.learning.markWordAsLearned | IMPLEMENTED |
| POST | `/words/{id}/review` | ✅ ApiCenter.learning.markWordAsReviewed | IMPLEMENTED |
| POST | `/words/{id}/favorite` | ✅ ApiCenter.learning.toggleWordFavorite | IMPLEMENTED |
| GET | `/words/search/{query}` | ✅ ApiCenter.words.search | IMPLEMENTED |
| GET | `/words/public/{word}` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/word_exists` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/qurey_word` | ❌ Missing | **NOT IMPLEMENTED** |
| GET | `/app_qy_v1/word/{word}` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/qurey_words` | ❌ Missing | **NOT IMPLEMENTED** |

---

### 🔴 Word Groups Endpoints (13 endpoints - 38% implemented)

| Method | Endpoint | Frontend API | Status |
|--------|----------|--------------|--------|
| ANY | `/app_qy_v1/create_group` | ✅ ApiCenter.wordGroups.create | IMPLEMENTED |
| ANY | `/app_qy_v1/query_all_groups` | ✅ ApiCenter.wordGroups.getAll | IMPLEMENTED |
| ANY | `/app_qy_v1/query_group_by_name` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/query_group_by_gid` | ✅ ApiCenter.wordGroups.getById | IMPLEMENTED |
| ANY | `/app_qy_v1/query_gwords` | ✅ ApiCenter.wordGroups.getWords | IMPLEMENTED |
| ANY | `/app_qy_v1/query_gcontent` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/query_gfrequency` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/delete_group_by_name` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/delete_group_by_gid` | ✅ ApiCenter.wordGroups.delete | IMPLEMENTED |
| ANY | `/app_qy_v1/dictionary/tasks/create-explanation` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/dictionary/tasks/untranslated-words` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/add_dictionary` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/find_non_existing_dictionary` | ❌ Missing | **NOT IMPLEMENTED** |

---

### 🔴 Word Lookup Endpoints (2 endpoints - 0% implemented)

| Method | Endpoint | Frontend API | Status |
|--------|----------|--------------|--------|
| GET | `/app_qy_v1/lookup` | ❌ Missing | **NOT IMPLEMENTED** |
| POST | `/app_qy_v1/lookup/batch` | ❌ Missing | **NOT IMPLEMENTED** |

---

### 🔴 User Endpoints (5 endpoints - 60% implemented)

| Method | Endpoint | Frontend API | Status |
|--------|----------|--------------|--------|
| GET | `/app_qy_v1/user` | ✅ ApiCenter.auth.getProfile | IMPLEMENTED |
| GET | `/app_qy_v1/user/initialization-status` | ❌ Missing | **NOT IMPLEMENTED** |
| POST | `/app_qy_v1/user/initialize` | ❌ Missing | **NOT IMPLEMENTED** |
| GET | `/app_qy_v1/user/progress` | ❌ Mock data only | MOCK |
| GET | `/app_qy_v1/user/stats` | ❌ Mock data only | MOCK |
| GET | `/app_qy_v1/user/profile` | ✅ ApiCenter.user.getProfile | IMPLEMENTED |
| PUT | `/app_qy_v1/user/profile` | ✅ ApiCenter.user.updateProfile | IMPLEMENTED |
| POST | `/app_qy_v1/user/profile` | ✅ ApiCenter.user.updateProfile | IMPLEMENTED |

---

### 🔴 Personal Dictionary Endpoints (5 endpoints - 0% implemented)

| Method | Endpoint | Frontend API | Status |
|--------|----------|--------------|--------|
| ANY | `/app_qy_v1/create_personal_dictionary` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/query_personal_dictionary` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/query_personal_dictionary_by_words` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/delete_personal_dictionary_by_id` | ❌ Missing | **NOT IMPLEMENTED** |
| ANY | `/app_qy_v1/delete_personal_all_dictionary` | ❌ Missing | **NOT IMPLEMENTED** |

---

### 🔴 Vocabulary Endpoints (3 endpoints - 0% implemented)

| Method | Endpoint | Frontend API | Status |
|--------|----------|--------------|--------|
| GET | `/app_qy_v1/vocabulary/statistics` | ❌ Missing | **NOT IMPLEMENTED** |
| GET | `/app_qy_v1/vocabulary/libraries/recommended` | ❌ Missing | **NOT IMPLEMENTED** |
| GET | `/app_qy_v1/vocabulary/libraries` | ❌ Missing | **NOT IMPLEMENTED** |

---

### 🔴 System Endpoints (13 endpoints - 8% implemented)

| Method | Endpoint | Frontend API | Status |
|--------|----------|--------------|--------|
| POST | `/app_qy_v1/system/initialize` | ❌ Missing | **NOT IMPLEMENTED** |
| GET | `/app_qy_v1/system/initialization-status` | ❌ Missing | **NOT IMPLEMENTED** |
| POST | `/app_qy_v1/system/process-vocabulary` | ❌ Missing | **NOT IMPLEMENTED** |
| GET | `/app_qy_v1/system/vocabulary-status` | ❌ Missing | **NOT IMPLEMENTED** |
| GET | `/app_qy_v1/system/dictionary-statistics` | ❌ Missing | **NOT IMPLEMENTED** |
| GET | `/app_qy_v1/system/supported-languages` | ✅ ApiCenter.dictionary.getSupportedLanguages | IMPLEMENTED |
| GET | `/app_qy_v1/system/supported-languages/{code}` | ❌ Missing | **NOT IMPLEMENTED** |
| GET | `/app_qy_v1/word/{word}/enhanced` | ❌ Missing | **NOT IMPLEMENTED** |
| POST | `/app_qy_v1/word/{word}/enhanced` | ❌ Missing | **NOT IMPLEMENTED** |
| GET | `/app_qy_v1/untranslated` | ❌ Missing | **NOT IMPLEMENTED** |
| GET | `/app_qy_v1/untranslated/priority` | ❌ Missing | **NOT IMPLEMENTED** |
| POST | `/app_qy_v1/word/{word}/translation` | ❌ Missing | **NOT IMPLEMENTED** |
| POST | `/app_qy_v1/word/{word}/audio` | ❌ Missing | **NOT IMPLEMENTED** |
| POST | `/app_qy_v1/word/{word}/images` | ❌ Missing | **NOT IMPLEMENTED** |
| POST | `/app_qy_v1/word/{word}/complete` | ❌ Missing | **NOT IMPLEMENTED** |
| POST | `/app_qy_v1/system/reinitialize` | ❌ Missing | **NOT IMPLEMENTED** |

---

## Summary Statistics

| Category | Total | Implemented | Missing | Percentage |
|----------|-------|-------------|---------|------------|
| **Authentication** | 5 | 5 | 0 | 100% ✅ |
| **Learning** | 12 | 10 | 2 | 83% 🟨 |
| **Words** | 11 | 6 | 5 | 55% 🔴 |
| **Word Groups** | 13 | 5 | 8 | 38% 🔴 |
| **Word Lookup** | 2 | 0 | 2 | 0% 🔴 |
| **User** | 5 | 3 | 2 | 60% 🟨 |
| **Personal Dictionary** | 5 | 0 | 5 | 0% 🔴 |
| **Vocabulary** | 3 | 0 | 3 | 0% 🔴 |
| **System** | 16 | 1 | 15 | 6% 🔴 |
| **TOTAL** | **72** | **30** | **42** | **42%** ❌ |

**Note**: This counts unique functional endpoints, not including duplicates like `/user/profile` POST/PUT variants.

---

## Priority Implementation Recommendations

### 🔴 HIGH PRIORITY (Core Features Missing)

1. **Word Lookup System**
   - `GET /app_qy_v1/lookup`
   - `POST /app_qy_v1/lookup/batch`
   - Needed for basic dictionary functionality

2. **Word Query Enhancement**
   - `ANY /app_qy_v1/qurey_word`
   - `ANY /app_qy_v1/word_exists`
   - `ANY /app_qy_v1/qurey_words`
   - Essential for word existence checks

3. **Learning Language Management**
   - `GET /app_qy_v1/learning/languages`
   - `POST /app_qy_v1/learning/languages`
   - Currently using global settings instead

4. **Library Deletion**
   - `DELETE /app_qy_v1/learning/libraries/{library_id}`
   - Uploaded libraries cannot be deleted

### 🟡 MEDIUM PRIORITY (Enhanced Features)

5. **Word Group Enhanced Queries**
   - `ANY /app_qy_v1/query_group_by_name`
   - `ANY /app_qy_v1/query_gcontent`
   - `ANY /app_qy_v1/query_gfrequency`
   - `ANY /app_qy_v1/delete_group_by_name`

6. **Dictionary Task Management**
   - `ANY /app_qy_v1/dictionary/tasks/create-explanation`
   - `ANY /app_qy_v1/dictionary/tasks/untranslated-words`

7. **Vocabulary Libraries**
   - `GET /app_qy_v1/vocabulary/statistics`
   - `GET /app_qy_v1/vocabulary/libraries/recommended`
   - `GET /app_qy_v1/vocabulary/libraries`

8. **Word Data Submission**
   - `POST /app_qy_v1/word/{word}/translation`
   - `POST /app_qy_v1/word/{word}/audio`
   - `POST /app_qy_v1/word/{word}/images`
   - `POST /app_qy_v1/word/{word}/complete`

### 🟢 LOW PRIORITY (Future Features)

9. **Personal Dictionary** (5 endpoints)
   - Complete personal dictionary CRUD system

10. **System Administration** (15 endpoints)
    - System initialization and management
    - Untranslated words management
    - Enhanced word queries

---

## Next Steps

### Immediate Action Required:

1. **Implement Word Lookup APIs** (2 endpoints)
   - Critical for dictionary functionality
   - Location: Add to `ApiCenter.words` section

2. **Implement Word Query APIs** (4 endpoints)
   - Essential for word existence checks
   - Location: Add to `ApiCenter.words` section

3. **Implement Learning Languages APIs** (2 endpoints)
   - Replace global settings approach
   - Location: Add to `ApiCenter.learning` section

4. **Implement Library Deletion** (1 endpoint)
   - Complete CRUD operations
   - Location: Add to `ApiCenter.documents` section

5. **Implement Word Group Extended APIs** (4 endpoints)
   - Enhanced query capabilities
   - Location: Add to `ApiCenter.wordGroups` section

---

## Conclusion

**实际情况：**
- 后端定义了 **72个独特的功能端点**（去重后）
- 前端只实现了 **30个端点** (42%)
- 还有 **42个端点**需要前端实现 (58%)

**主要问题：**
1. ❌ 单词查询系统完全缺失（2个端点）
2. ❌ 单词存在性检查缺失（4个端点）
3. ❌ 词组扩展查询功能缺失（4个端点）
4. ❌ 个人词典系统完全缺失（5个端点）
5. ❌ 词汇库统计功能缺失（3个端点）
6. ❌ 系统管理功能大部分缺失（15个端点）

**建议：**
优先实现标记为🔴 HIGH PRIORITY的10个核心端点，这些是应用完整功能所必需的。
