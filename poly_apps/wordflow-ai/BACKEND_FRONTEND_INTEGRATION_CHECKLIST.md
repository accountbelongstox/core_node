# 前后端集成检查清单

**创建时间**: 2025-12-20
**目的**: 提供明确的集成步骤和验证清单

---

## 📊 当前状态总览

### ✅ 已完成的工作

**后端 (Backend)**:
- [x] 数据库迁移 - 添加 `language` 和 `is_language_default` 字段
- [x] 新增API: `POST /api/study_groups/create_for_language`
- [x] 新增API: `GET /api/study_groups/by_language/{language}`
- [x] 额外API: `POST /api/study_groups/ensure_language_groups`
- [x] 支持9种语言 (en, zh, ja, ko, fr, de, es, vi, lo)
- [x] 自动封面图生成
- [x] 单元测试通过

**前端 (Frontend)**:
- [x] 类型定义更新 - `types.ts`
- [x] 数据中心实现 - `services/StudyGroupsCenter.ts`
- [x] 语言设置页面集成 - `pages/Settings/Language.tsx`
- [x] 自动创建分组逻辑
- [x] 编译成功 (804.05 kB bundle)

---

## ⚠️ 待验证的工作

### 后端需要确认的4个修改API

| API | 需要验证的点 | 优先级 |
|-----|-------------|--------|
| `POST /api/study_groups/create` | language字段是否必填？是否验证有效性？ | 🔴 P0 |
| `GET /api/study_groups/list` | 是否返回language和is_language_default字段？ | 🔴 P0 |
| `POST /api/user/update_learning_languages` | 是否自动创建分组？ | 🔴 P0 |
| `POST /api/study_groups/{id}/add_word_group` | 是否验证语言匹配？错误码是什么？ | 🔴 P0 |

### 前端需要实现的UI组件

| 组件 | 说明 | 优先级 |
|------|------|--------|
| `AddWordGroupToStudyGroupDialog.tsx` | 添加词组到分组的对话框（支持语言过滤） | 🟡 P1 |
| `pages/StudyGroups/Index.tsx` | 分组列表页面 | 🟡 P1 |
| `pages/StudyGroups/Detail.tsx` | 分组详情页面 | 🟢 P2 |

---

## 🔍 关键问题清单

### 🔴 P0 - 必须立即确认

#### Q1: word_groups 表是否有 language 字段？
**为什么重要**: 没有这个字段，无法验证语言匹配

**验证方法**:
```sql
DESCRIBE word_groups;
-- 应该包含: language VARCHAR(10) NOT NULL
```

**如果没有，建议执行**:
```sql
ALTER TABLE word_groups
ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en',
ADD INDEX idx_language (language);
```

---

#### Q2: POST /api/study_groups/create 是否要求 language 为必填字段？
**为什么重要**: 前端需要知道是否必须提供此字段

**测试用例**:
```bash
# 测试1: 不提供language字段
curl -X POST /api/study_groups/create \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "Test Group"}'

# 预期A: 返回错误 {"code": "LANGUAGE_REQUIRED"}
# 预期B: 使用默认值 'en' 创建成功
```

**前端需要的答案**: 必填 or 可选（默认值='en'）？

---

#### Q3: POST /api/user/update_learning_languages 是否自动创建分组？
**为什么重要**: 这是语言设置页面的核心功能

**测试用例**:
```bash
# 前置条件: 用户当前只有英语分组
# 测试: 添加日语和韩语
curl -X POST /api/user/update_learning_languages \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"learning_languages": ["en", "ja", "ko"]}'

# 验证: 查询分组列表
curl -X GET /api/study_groups/list \
  -H "Authorization: Bearer $TOKEN"

# 预期: 应该看到3个默认分组（en, ja, ko）
```

**前端需要的答案**: 是否自动创建？还是需要前端手动调用 `create_for_language`？

**当前前端实现**: 前端主动调用 `createLanguageGroup()`，但如果后端也自动创建，会导致重复调用

**建议**:
- **方案A**: 后端自动创建 → 前端删除手动调用代码
- **方案B**: 后端不自动创建 → 保持前端当前实现

---

#### Q4: POST /api/study_groups/{id}/add_word_group 的错误码是什么？
**为什么重要**: 前端需要正确显示错误提示

**测试用例**:
```bash
# 测试: 添加日语词组到英语分组
curl -X POST /api/study_groups/{EN_GROUP_ID}/add_word_group \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"word_group_id": "{JA_WORD_GROUP_ID}"}'

# 预期响应:
{
  "success": false,
  "error": {
    "code": "LANGUAGE_MISMATCH",  # 错误码是什么？
    "message": "词组语言(ja)与分组语言(en)不匹配"
  }
}
```

**前端需要的答案**:
- 错误码: `LANGUAGE_MISMATCH` or 其他？
- HTTP状态码: 400 or 409 or 422？

---

### 🟡 P1 - 影响用户体验

#### Q5: 用户注册时是否自动创建默认分组？
**当前行为**: ❓ 未知

**建议测试**:
```bash
# 1. 注册新用户
curl -X POST /api/auth/register \
  -d '{"username": "testuser", "email": "test@example.com", "password": "xxx"}'

# 2. 立即查询分组
curl -X GET /api/study_groups/list \
  -H "Authorization: Bearer $NEW_USER_TOKEN"

# 预期: 是否有1个默认分组？
```

---

#### Q6: 删除学习语言时，分组如何处理？
**场景**: 用户取消勾选"日语"

**选项**:
- A. 删除日语分组
- B. 归档日语分组（is_archived=TRUE）
- C. 保留日语分组（不做任何操作）

**前端需要的答案**: 使用哪个策略？是否需要显示提示？

---

#### Q7: 是否允许删除语言的默认分组？
**场景**: 用户尝试删除 `is_language_default=TRUE` 的分组

**选项**:
- A. 禁止删除（返回错误）
- B. 允许删除，自动指定其他分组为默认
- C. 允许删除，该语言将没有默认分组

**前端需要的答案**: 使用哪个策略？

---

### 🟢 P2 - 优化和增强

#### Q8: 列表API是否支持分页？
**当前**: `GET /api/study_groups/list` 返回所有分组

**建议**: 添加分页支持
```
GET /api/study_groups/list?page=1&page_size=20
```

---

#### Q9: 默认分组名称如何国际化？
**当前**: 后端存储中文或英文名称（如"English"或"英语"）

**建议**:
- 后端只存储语言代码作为name
- 前端根据用户界面语言动态翻译

---

## 📋 集成测试步骤

### 阶段1: API联调测试 (30分钟)

**准备工作**:
1. 后端提供测试环境URL和测试账号token
2. 前端准备Postman集合或curl脚本

**测试清单**:

```bash
# 设置环境变量
export API_BASE="http://192.168.50.3:10029/api/app_qy_v1"
export TOKEN="your_test_token"

# ===== 测试1: 创建语言分组 =====
echo "测试1: 创建日语分组"
curl -X POST "$API_BASE/study_groups/create_for_language" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language": "ja"}' | jq

# 验证点:
# ✓ success = true
# ✓ data.language = "ja"
# ✓ data.is_language_default = true
# ✓ data.name 是日语名称（如"日本語"或"Japanese"）

# ===== 测试2: 获取指定语言的分组 =====
echo "测试2: 获取日语分组"
curl -X GET "$API_BASE/study_groups/by_language/ja" \
  -H "Authorization: Bearer $TOKEN" | jq

# 验证点:
# ✓ data.language = "ja"
# ✓ data.study_groups 包含刚创建的分组
# ✓ 按 is_language_default DESC 排序

# ===== 测试3: 获取所有分组（检查language字段） =====
echo "测试3: 获取所有分组"
curl -X GET "$API_BASE/study_groups/list" \
  -H "Authorization: Bearer $TOKEN" | jq

# 验证点:
# ✓ 每个分组都有 language 字段
# ✓ 每个分组都有 is_language_default 字段

# ===== 测试4: 创建分组（验证language必填） =====
echo "测试4: 创建分组（不提供language）"
curl -X POST "$API_BASE/study_groups/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Group"}' | jq

# 验证点:
# ✓ 返回错误 or 使用默认值创建成功？

# ===== 测试5: 更新学习语言（验证自动创建） =====
echo "测试5: 添加韩语到学习语言"
curl -X POST "$API_BASE/user/update_learning_languages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"learning_languages": ["en", "ja", "ko"]}' | jq

# 验证: 查询是否自动创建韩语分组
curl -X GET "$API_BASE/study_groups/by_language/ko" \
  -H "Authorization: Bearer $TOKEN" | jq

# 验证点:
# ✓ 韩语分组已自动创建 or 需要手动调用create_for_language？

# ===== 测试6: 语言匹配验证 =====
echo "测试6: 添加日语词组到英语分组（应该失败）"
# 假设有以下数据:
# - 英语分组ID: sg_en_xxx
# - 日语词组ID: wg_ja_xxx

curl -X POST "$API_BASE/study_groups/sg_en_xxx/add_word_group" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"word_group_id": "wg_ja_xxx"}' | jq

# 验证点:
# ✓ success = false
# ✓ error.code = "LANGUAGE_MISMATCH"
# ✓ HTTP状态码 = 400 or 422？

# ===== 测试7: 幂等性测试 =====
echo "测试7: 重复创建日语分组"
curl -X POST "$API_BASE/study_groups/create_for_language" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"language": "ja"}' | jq

# 验证点:
# ✓ 不会创建重复分组
# ✓ 返回现有的日语默认分组
```

---

### 阶段2: 前端页面测试 (30分钟)

**测试环境**: http://192.168.50.3:10029

#### 测试1: 语言设置页面
```
1. 访问: /settings_lang
2. 打开浏览器控制台（F12）
3. 勾选"日语"
4. 观察控制台日志:
   ✓ 应该看到 "[LanguageSettings] Creating study group for language: ja"
   ✓ 应该看到 "[LanguageSettings] Study group created successfully: sg_xxx"
5. 检查网络请求:
   ✓ 应该发送 POST /api/study_groups/create_for_language
   ✓ 请求体: {"language": "ja"}
   ✓ 响应成功
6. 刷新页面，验证:
   ✓ "日语"仍然勾选
   ✓ 日语分组已创建
```

#### 测试2: 数据中心缓存
```
1. 在浏览器控制台输入:
   StudyGroupsCenter.getAll()

2. 验证返回的数组:
   ✓ 每个分组都有 language 字段
   ✓ 每个分组都有 is_language_default 字段

3. 测试语言过滤:
   StudyGroupsCenter.filterByLanguage('ja')

4. 验证:
   ✓ 只返回 language='ja' 的分组
```

#### 测试3: 获取默认分组
```
1. 在浏览器控制台输入:
   StudyGroupsCenter.getLanguageDefaultGroup('ja')

2. 验证:
   ✓ 返回日语的默认分组
   ✓ is_language_default = true
```

---

### 阶段3: 边缘案例测试 (30分钟)

#### 边缘案例1: 快速双击
```
1. 访问 /settings_lang
2. 快速双击"韩语"（勾选 → 取消 → 勾选）
3. 验证:
   ✓ 不会创建重复的韩语分组
   ✓ 最终状态正确
```

#### 边缘案例2: 网络失败
```
1. 打开浏览器开发工具 → Network → Offline
2. 勾选"法语"
3. 验证:
   ✓ 显示错误提示
   ✓ 设置未保存
4. 恢复网络，重试
5. 验证:
   ✓ 成功创建分组
```

#### 边缘案例3: 同时选择多种语言
```
1. 同时勾选"法语"、"德语"、"西班牙语"
2. 验证:
   ✓ 为每种语言都创建了默认分组
   ✓ 控制台日志显示3次创建成功
```

---

## 🎯 验收标准

### 后端验收标准
- [ ] 所有7个API端点已实现并通过测试
- [ ] `word_groups` 表有 `language` 字段
- [ ] 语言匹配验证正常工作，错误码为 `LANGUAGE_MISMATCH`
- [ ] 幂等性保证：重复调用 `create_for_language` 不会创建重复分组
- [ ] 权限验证：用户只能访问自己的分组
- [ ] 提供API文档（Swagger/OpenAPI）

### 前端验收标准
- [ ] 语言设置页面：选择语言时自动创建分组
- [ ] StudyGroupsCenter：所有方法正常工作
- [ ] 数据缓存：3分钟缓存 + 15秒防抖正常
- [ ] 错误处理：网络失败时显示友好提示
- [ ] 类型安全：无 TypeScript 错误

---

## 📞 后续行动

### 立即行动（今天）
**后端团队**:
1. 填写"待验证的4个修改API"清单
2. 执行数据库验证SQL（检查language字段）
3. 提供测试账号token给前端

**前端团队**:
1. 使用测试账号执行"阶段1: API联调测试"
2. 记录所有发现的问题
3. 更新前端代码（如果后端行为与预期不同）

### 本周完成
**后端团队**:
1. 修复发现的问题
2. 补充业务规则文档
3. 补充错误码文档

**前端团队**:
1. 实现 `AddWordGroupToStudyGroupDialog.tsx`
2. 实现 `pages/StudyGroups/Index.tsx`
3. 端到端测试完整流程

### 下周计划
1. 集成测试和性能测试
2. 用户验收测试（UAT）
3. 准备上线

---

## 📊 问题跟踪

使用以下表格跟踪集成过程中发现的问题：

| # | 问题描述 | 严重性 | 负责人 | 状态 | 备注 |
|---|---------|--------|--------|------|------|
| 1 | word_groups表是否有language字段？ | 🔴 P0 | 后端 | ⏳ 待确认 | - |
| 2 | create API是否要求language必填？ | 🔴 P0 | 后端 | ⏳ 待确认 | - |
| 3 | update_learning_languages是否自动创建分组？ | 🔴 P0 | 后端 | ⏳ 待确认 | - |
| 4 | add_word_group的错误码是什么？ | 🔴 P0 | 后端 | ⏳ 待确认 | - |
| 5 | ... | ... | ... | ... | ... |

**状态说明**:
- ⏳ 待确认
- 🏗️ 进行中
- ✅ 已完成
- ❌ 已取消

---

## 🔗 相关文档

1. [后端API要求 - 基于语言的背诵分组](./BACKEND_LANGUAGE_BASED_STUDY_GROUPS_REQUIREMENT.md)
2. [API端点验证报告](./API_ENDPOINT_VERIFICATION_REPORT.md)
3. [缺失的考虑点和边缘案例](./MISSING_CONSIDERATIONS_AND_EDGE_CASES.md)
4. [语言分组实现总结](./LANGUAGE_BASED_STUDY_GROUPS_IMPLEMENTATION.md)

---

**文档维护**: 前后端团队共同维护
**最后更新**: 2025-12-20
**下次评审**: 2025-12-21

*Generated on 2025-12-20 | WordFlow AI Development Team*
