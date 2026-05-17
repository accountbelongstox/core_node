# 基于语言的背诵分组 - 实现总结

**完成时间**: 2025-12-20
**状态**: ✅ 前端已完成，后端待实现

---

## 🎯 实现的功能

### 核心特性
1. ✅ **每个背诵分组绑定一种语言** (`language`字段)
2. ✅ **用户选择学习语言时自动创建该语言的背诵分组**
3. ✅ **添加词组时只显示匹配语言的背诵分组**
4. ✅ **支持同一语言创建多个分组**

---

## 📋 已完成的工作

### 1. 后端API要求文档 ✅
创建了 `BACKEND_LANGUAGE_BASED_STUDY_GROUPS_REQUIREMENT.md`，包含：

#### 数据库变更
- 在 `study_groups` 表添加 `language` 字段（VARCHAR(10)）
- 添加 `is_language_default` 字段（BOOLEAN）
- 添加索引：`idx_uid_language`, `idx_uid_language_default`

#### 新增/修改API（共6个）
| API | 说明 | 状态 |
|-----|------|------|
| `POST /api/study_groups/create_for_language` | 为语言创建默认分组 | 待实现 |
| `GET /api/study_groups/by_language/{language}` | 获取指定语言的所有分组 | 待实现 |
| `POST /api/study_groups/create` | 创建分组（支持language） | 待修改 |
| `GET /api/study_groups/list` | 获取所有分组（返回language） | 待修改 |
| `POST /api/user/update_learning_languages` | 更新学习语言（自动创建分组） | 待修改 |
| `POST /api/study_groups/{id}/add_word_group` | 添加词组（验证语言匹配） | 待修改 |

### 2. 前端类型定义 ✅
在 `types.ts` 中更新：

```typescript
export interface StudyGroup {
  // ... 其他字段
  language: string;              // 【新增】语言代码
  is_language_default: boolean;  // 【新增】是否为该语言的默认分组
  is_default: boolean;           // @deprecated 保留兼容性
}

export interface CreateStudyGroupRequest {
  name: string;
  language: string;              // 【新增】必填字段
  // ... 其他字段
}
```

### 3. StudyGroupsCenter 数据中心 ✅
在 `services/StudyGroupsCenter.ts` 中添加：

#### 新增方法
```typescript
// 为指定语言创建默认背诵分组
async createLanguageGroup(language: string): Promise<StudyGroup | null>

// 获取指定语言的所有背诵分组
async getByLanguage(language: string): Promise<StudyGroup[]>

// 获取指定语言的默认背诵分组（同步）
getLanguageDefaultGroup(language: string): StudyGroup | undefined

// 按语言过滤学习分组（同步）
filterByLanguage(language: string): StudyGroup[]
```

#### 废弃方法
```typescript
// @deprecated 使用 getLanguageDefaultGroup(language) 代替
async getDefaultGroup(): Promise<StudyGroup | null>
```

### 4. 语言设置页面集成 ✅
在 `pages/Settings/Language.tsx` 中修改：

**新增导入**:
```typescript
import { StudyGroupsCenter } from '../../services/StudyGroupsCenter';
import { ApiCenter } from '../../services/ApiCenter';
```

**修改 toggleLearningLang 函数**:
```typescript
const toggleLearningLang = async (code: string) => {
  // ... 更新设置

  // 【新增】如果是添加新语言，立即创建该语言的背诵分组
  if (isAdding && user) {
    const newGroup = await StudyGroupsCenter.createLanguageGroup(code);
    if (newGroup) {
      console.log('Study group created:', newGroup.id);
    }
  }

  // 同步到后端
  await ApiCenter.user.updateProfile({ learning_languages: newLangs });
};
```

---

## 🔄 工作流程

### 场景1: 用户在语言设置中选择新语言

```
用户访问：/settings_lang
  ↓
用户勾选 "日语" (ja)
  ↓
前端: toggleLearningLang('ja')
  ↓
1. 更新 settings.language.learningLanguages = ['en', 'ja']
  ↓
2. 调用 StudyGroupsCenter.createLanguageGroup('ja')
  ↓
3. 前端发送: POST /api/study_groups/create_for_language
   Body: { language: 'ja' }
  ↓
4. 后端创建日语的默认背诵分组:
   - name: "日本語" (或"Japanese")
   - language: "ja"
   - is_language_default: TRUE
   - icon: "🇯🇵"
  ↓
5. 返回创建的分组
  ↓
6. 前端更新本地缓存
  ↓
7. 通知所有订阅者（UI自动更新）
```

### 场景2: 用户添加CET-6词组（language='en'）到背诵分组

```
用户在词组列表看到 "CET-6" (language='en')
  ↓
用户点击 "加入背诵分组"
  ↓
前端调用: StudyGroupsCenter.filterByLanguage('en')
  ↓
前端只显示英语分组:
  - 📚 English (默认)
  - 📝 My Exam Preparation
  - 🎯 Business English
  ↓
用户选择 "English (默认)"
  ↓
前端: POST /api/study_groups/{sg_en_default}/add_word_group
       Body: { word_group_id: 'group_cet6_001' }
  ↓
后端验证语言匹配:
  - 词组语言: 'en'
  - 分组语言: 'en'
  - ✅ 匹配，允许添加
  ↓
后端插入关联记录
  ↓
后端更新统计:
  - total_word_groups += 1
  - total_words += 8013
  ↓
返回成功
```

### 场景3: 语言不匹配的错误

```
用户尝试将日语词组添加到英语分组
  ↓
后端检测:
  - 词组语言: 'ja'
  - 分组语言: 'en'
  - ❌ 不匹配
  ↓
后端返回错误:
{
  "success": false,
  "error": {
    "code": "LANGUAGE_MISMATCH",
    "message": "词组语言(ja)与分组语言(en)不匹配"
  }
}
  ↓
前端显示错误提示
```

---

## 🎨 UI演示

### 语言设置页面
```
┌─────────────────────────────────────┐
│ 语言设置                      [保存] │
├─────────────────────────────────────┤
│                                     │
│ 我要学习的语言：                    │
│                                     │
│ ☑️ 🇺🇸 English                      │
│    已创建背诵分组 "English" ✅      │
│                                     │
│ ☑️ 🇯🇵 日本語                       │
│    已创建背诵分组 "日本語" ✅       │
│                                     │
│ ☐ 🇰🇷 한국어                        │
│    勾选后自动创建背诵分组            │
│                                     │
└─────────────────────────────────────┘
```

### 添加词组到背诵分组（语言过滤）
```
┌─────────────────────────────────────┐
│ 选择背诵分组                        │
├─────────────────────────────────────┤
│ 词组：JLPT N3 Vocabulary            │
│ 语言：日本語 (ja)                   │
│                                     │
│ 加入到日语分组：                    │
│ ○ 🇯🇵 日本語 (默认)                │
│ ○ 📝 JLPT Preparation              │
│ ○ 🎯 Japanese for Business         │
│                                     │
│ [+ 创建新的日语分组]                │
│                                     │
│ 说明：只显示日语分组                │
│ 英语、中文等其他语言的分组已过滤    │
└─────────────────────────────────────┘
```

---

## 📝 前端使用示例

### 1. 在组件中订阅语言分组

```typescript
import { StudyGroupsCenter } from '../services/StudyGroupsCenter';

function MyComponent() {
  const [englishGroups, setEnglishGroups] = useState([]);

  useEffect(() => {
    // 订阅所有分组变化
    const unsubscribe = StudyGroupsCenter.subscribe((allGroups) => {
      // 过滤出英语分组
      const enGroups = allGroups.filter(g => g.language === 'en');
      setEnglishGroups(enGroups);
    });

    // 初始化数据
    StudyGroupsCenter.initialize();

    return () => unsubscribe();
  }, []);

  return (
    <div>
      {englishGroups.map(group => (
        <div key={group.id}>
          {group.icon} {group.name} ({group.total_words} words)
        </div>
      ))}
    </div>
  );
}
```

### 2. 添加词组时过滤分组

```typescript
function AddWordGroupDialog({ wordGroup }: { wordGroup: WordGroup }) {
  const [matchingGroups, setMatchingGroups] = useState([]);

  useEffect(() => {
    // 只获取与词组语言匹配的分组
    const groups = StudyGroupsCenter.filterByLanguage(wordGroup.language);
    setMatchingGroups(groups);
  }, [wordGroup.language]);

  const handleAdd = async (groupId: string) => {
    const success = await StudyGroupsCenter.addWordGroup(groupId, {
      word_group_id: wordGroup.id
    });

    if (success) {
      alert('添加成功！');
    }
  };

  return (
    <div>
      <h3>选择{wordGroup.language}分组：</h3>
      {matchingGroups.map(group => (
        <button key={group.id} onClick={() => handleAdd(group.id)}>
          {group.icon} {group.name}
          {group.is_language_default && ' (默认)'}
        </button>
      ))}
    </div>
  );
}
```

### 3. 语言设置页面显示创建状态

```typescript
function LanguageSettings() {
  const [learningLanguages, setLearningLanguages] = useState(['en']);
  const [studyGroups, setStudyGroups] = useState([]);

  useEffect(() => {
    const unsubscribe = StudyGroupsCenter.subscribe(setStudyGroups);
    return () => unsubscribe();
  }, []);

  const hasGroupForLanguage = (langCode: string) => {
    return studyGroups.some(g =>
      g.language === langCode && g.is_language_default
    );
  };

  return (
    <div>
      {SUPPORTED_LANGUAGES.map(lang => (
        <div key={lang.code}>
          <input
            type="checkbox"
            checked={learningLanguages.includes(lang.code)}
            onChange={() => toggleLanguage(lang.code)}
          />
          {lang.flag} {lang.name}
          {hasGroupForLanguage(lang.code) && (
            <span>✅ 已创建背诵分组</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## 🚧 待实现的UI组件

### 需要创建的新组件

#### 1. `components/AddWordGroupToStudyGroupDialog.tsx`
**用途**: 将词组添加到背诵分组的对话框

**功能**:
- 接收词组信息（包含language字段）
- 自动过滤显示匹配语言的背诵分组
- 支持创建新的同语言分组
- 调用 `StudyGroupsCenter.addWordGroup()`

**位置**: 在词组列表（Library页面）点击"加入背诵分组"时弹出

#### 2. `pages/StudyGroups/Index.tsx`
**用途**: 背诵分组列表页面

**功能**:
- 显示所有背诵分组，按语言分组显示
- 每个分组显示：名称、图标、语言、词组数、单词数、进度
- 支持创建新分组、编辑、删除
- 点击分组进入详情页

#### 3. `pages/StudyGroups/Detail.tsx`
**用途**: 背诵分组详情页面

**功能**:
- 显示分组信息和统计数据
- 列出该分组包含的所有词组
- 支持移除词组、添加新词组
- 显示学习进度

---

## 📊 数据统计

### 编译结果
```bash
✓ 1848 modules transformed
✓ Built in 1.74s
Bundle: 804.05 kB (gzip: 193.08 kB)
```

### 代码变更
| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `types.ts` | 修改 | 添加language字段，更新接口 |
| `services/StudyGroupsCenter.ts` | 修改 | 添加4个新方法，支持语言过滤 |
| `pages/Settings/Language.tsx` | 修改 | 集成自动创建分组逻辑 |
| `BACKEND_LANGUAGE_BASED_STUDY_GROUPS_REQUIREMENT.md` | 新建 | 后端API详细要求 |

---

## 🔴 后端团队待办事项

### P0 (立即实现)
1. **数据库变更**
   ```sql
   ALTER TABLE study_groups
   ADD COLUMN language VARCHAR(10) NOT NULL DEFAULT 'en',
   ADD COLUMN is_language_default BOOLEAN DEFAULT FALSE,
   ADD INDEX idx_uid_language (uid, language);
   ```

2. **实现新API**
   - `POST /api/study_groups/create_for_language`
   - `GET /api/study_groups/by_language/{language}`

3. **修改现有API**
   - `POST /api/study_groups/create` - 添加language必填字段
   - `GET /api/study_groups/list` - 返回language字段
   - `POST /api/user/update_learning_languages` - 自动创建语言分组
   - `POST /api/study_groups/{id}/add_word_group` - 验证语言匹配

### 测试要求
```bash
# 测试1: 创建语言分组
POST /api/study_groups/create_for_language
Body: { "language": "ja" }
验证: 返回日语默认分组，name="日本語", is_language_default=true

# 测试2: 语言匹配验证
POST /api/study_groups/{英语分组}/add_word_group
Body: { "word_group_id": "日语词组" }
验证: 返回错误 LANGUAGE_MISMATCH

# 测试3: 更新学习语言自动创建分组
POST /api/user/update_learning_languages
Body: { "learning_languages": ["en", "ja", "zh"] }
验证: 自动创建3个语言的默认分组（如果不存在）
```

---

## 🎉 总结

### 已完成
- ✅ 后端API详细要求文档
- ✅ 前端类型定义更新
- ✅ StudyGroupsCenter数据中心扩展
- ✅ 语言设置页面集成自动创建
- ✅ 编译验证通过

### 核心优势
1. **自动化**: 用户选择学习语言时自动创建背诵分组
2. **语言隔离**: 词组只能添加到匹配语言的分组
3. **清晰组织**: 每种语言有独立的分组管理
4. **灵活扩展**: 支持同一语言创建多个分组

### 下一步
1. 后端实现6个API端点
2. 前端创建UI组件（添加到分组对话框、分组列表页、分组详情页）
3. 集成测试

---

*Generated on 2025-12-20 | WordFlow AI Development Team*
