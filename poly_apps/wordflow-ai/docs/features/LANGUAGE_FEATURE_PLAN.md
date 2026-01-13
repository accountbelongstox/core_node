# 多语言选择与首页词库动态更新 - 完整实现方案

## 📋 需求总结

1. **Settings 语言页面改进**:
   - Grid 布局展示所有语言
   - 每个语言卡片显示图标（国旗 emoji）
   - 支持多选语言（复选框形式）

2. **后端图标传递**:
   - 后端返回每种语言的图标数据
   - 前端解析并显示

3. **首页词库动态更新**:
   - 根据用户选中的学习语言
   - 实时过滤和显示对应语言的词库

---

## 🎯 当前状态分析

### ✅ 已完成
1. **前端 Grid 布局** - `Language.tsx` 已有 grid 布局
2. **多选功能** - 已实现复选框多选逻辑
3. **图标显示** - 前端 mockData 使用 emoji 国旗

### ❌ 需要完成
1. **后端添加 icon 字段** - 目前后端只返回 `code`, `name`, `native_name`, `voice_id`
2. **首页词库过滤** - 首页未根据选中语言过滤词库
3. **用户偏好持久化** - 需要保存到后端用户设置

---

## 🏗️ 前后端实现方案

### 第一部分：后端添加图标字段

#### 1.1 修改后端 Controller

**文件**: `/poly_apps/laravel_main/app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1System/AppQyV1SupportedLanguagesController.php`

**修改点**:
```php
private static $languages = [
    'af' => [
        'name' => 'Afrikaans',
        'native_name' => 'Afrikaans',
        'voice_id' => 'af-ZA-AdriNeural',
        'icon' => '🇿🇦',  // ← 添加国旗 emoji
    ],
    'am' => [
        'name' => 'Amharic',
        'native_name' => 'አማርኛ',
        'voice_id' => 'am-ET-MekdesNeural',
        'icon' => '🇪🇹',
    ],
    'ar' => [..., 'icon' => '🇸🇦'],
    'zh' => [..., 'icon' => '🇨🇳'],
    'en' => [..., 'icon' => '🇺🇸'],
    'ja' => [..., 'icon' => '🇯🇵'],
    'ko' => [..., 'icon' => '🇰🇷'],
    'es' => [..., 'icon' => '🇪🇸'],
    'fr' => [..., 'icon' => '🇫🇷'],
    'de' => [..., 'icon' => '🇩🇪'],
    // ... 其他语言
];

// 修改返回数据
public function getSupportedLanguages(Request $request): JsonResponse
{
    $languages = [];

    foreach (self::$languages as $code => $info) {
        $languages[] = [
            'code' => $code,
            'name' => $info['name'],
            'native_name' => $info['native_name'],
            'voice_id' => $info['voice_id'],
            'has_tts' => true,
            'icon' => $info['icon'] ?? '🌐',  // ← 添加图标字段，默认地球
        ];
    }

    return response()->json([
        'success' => true,
        'data' => $languages,
        'total' => count($languages),
    ]);
}
```

**所有语言的国旗映射**:
```php
'af' => '🇿🇦',  // Afrikaans - South Africa
'am' => '🇪🇹',  // Amharic - Ethiopia
'ar' => '🇸🇦',  // Arabic - Saudi Arabia
'as' => '🇮🇳',  // Assamese - India
'az' => '🇦🇿',  // Azerbaijani
'bg' => '🇧🇬',  // Bulgarian
'bn' => '🇧🇩',  // Bengali - Bangladesh
'bs' => '🇧🇦',  // Bosnian
'ca' => '🇪🇸',  // Catalan - Spain
'cs' => '🇨🇿',  // Czech
'cy' => '🏴󠁧󠁢󠁷󠁬󠁳󠁿',  // Welsh - Wales
'da' => '🇩🇰',  // Danish
'de' => '🇩🇪',  // German
'el' => '🇬🇷',  // Greek
'en' => '🇺🇸',  // English - USA
'es' => '🇪🇸',  // Spanish
'et' => '🇪🇪',  // Estonian
'eu' => '🇪🇸',  // Basque - Spain
'fa' => '🇮🇷',  // Persian - Iran
'fi' => '🇫🇮',  // Finnish
'fil' => '🇵🇭', // Filipino
'fr' => '🇫🇷',  // French
'ga' => '🇮🇪',  // Irish
'gl' => '🇪🇸',  // Galician - Spain
'gu' => '🇮🇳',  // Gujarati - India
'he' => '🇮🇱',  // Hebrew
'hi' => '🇮🇳',  // Hindi - India
'hr' => '🇭🇷',  // Croatian
'hu' => '🇭🇺',  // Hungarian
'hy' => '🇦🇲',  // Armenian
'id' => '🇮🇩',  // Indonesian
'is' => '🇮🇸',  // Icelandic
'it' => '🇮🇹',  // Italian
'ja' => '🇯🇵',  // Japanese
'jv' => '🇮🇩',  // Javanese - Indonesia
'ka' => '🇬🇪',  // Georgian
'kk' => '🇰🇿',  // Kazakh
'km' => '🇰🇭',  // Khmer - Cambodia
'kn' => '🇮🇳',  // Kannada - India
'ko' => '🇰🇷',  // Korean
'lo' => '🇱🇦',  // Lao
'lt' => '🇱🇹',  // Lithuanian
'lv' => '🇱🇻',  // Latvian
'mk' => '🇲🇰',  // Macedonian
'ml' => '🇮🇳',  // Malayalam - India
'mn' => '🇲🇳',  // Mongolian
'mr' => '🇮🇳',  // Marathi - India
'ms' => '🇲🇾',  // Malay - Malaysia
'mt' => '🇲🇹',  // Maltese
'my' => '🇲🇲',  // Myanmar
'nb' => '🇳🇴',  // Norwegian Bokmål
'ne' => '🇳🇵',  // Nepali
'nl' => '🇳🇱',  // Dutch
'or' => '🇮🇳',  // Odia - India
'pa' => '🇮🇳',  // Punjabi - India
'pl' => '🇵🇱',  // Polish
'ps' => '🇦🇫',  // Pashto - Afghanistan
'pt' => '🇧🇷',  // Portuguese - Brazil
'ro' => '🇷🇴',  // Romanian
'ru' => '🇷🇺',  // Russian
'si' => '🇱🇰',  // Sinhala - Sri Lanka
'sk' => '🇸🇰',  // Slovak
'sl' => '🇸🇮',  // Slovenian
'so' => '🇸🇴',  // Somali
'sq' => '🇦🇱',  // Albanian
'sr' => '🇷🇸',  // Serbian
'su' => '🇮🇩',  // Sundanese - Indonesia
'sv' => '🇸🇪',  // Swedish
'sw' => '🇹🇿',  // Swahili - Tanzania
'ta' => '🇮🇳',  // Tamil - India
'te' => '🇮🇳',  // Telugu - India
'th' => '🇹🇭',  // Thai
'tr' => '🇹🇷',  // Turkish
'uk' => '🇺🇦',  // Ukrainian
'ur' => '🇵🇰',  // Urdu - Pakistan
'uz' => '🇺🇿',  // Uzbek
'vi' => '🇻🇳',  // Vietnamese
'wuu' => '🇨🇳', // Wu Chinese - China
'yue' => '🇨🇳', // Cantonese - China
'zh' => '🇨🇳',  // Chinese
'zu' => '🇿🇦',  // Zulu - South Africa
```

---

### 第二部分：前端更新类型定义

#### 2.1 更新 TypeScript 类型

**文件**: `/poly_apps/wordflow-ai/types.ts`

```typescript
export interface SupportedLanguage {
  code: string;
  name: string;
  native_name: string;
  voice_id: string;
  has_tts: boolean;
  icon?: string;  // ← 添加可选图标字段
}
```

#### 2.2 更新前端 mockData

**文件**: `/poly_apps/wordflow-ai/services/mockData.ts`

```typescript
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {
    code: 'en',
    name: 'English',
    native_name: 'English',
    voice_id: 'en-US-JennyNeural',
    has_tts: true,
    icon: '🇺🇸'  // ← 添加图标
  },
  { code: 'zh', name: 'Chinese', native_name: '中文', voice_id: 'zh-CN-XiaoxiaoNeural', has_tts: true, icon: '🇨🇳' },
  { code: 'ja', name: 'Japanese', native_name: '日本語', voice_id: 'ja-JP-NanamiNeural', has_tts: true, icon: '🇯🇵' },
  // ... 其他语言
];
```

---

### 第三部分：前端语言选择页面

#### 3.1 更新 Language Settings 页面

**文件**: `/poly_apps/wordflow-ai/pages/Settings/Language.tsx`

**当前状态**: 已有 grid 布局和多选功能

**需要确认的点**:
- ✅ 使用后端返回的 `icon` 字段
- ✅ 保存到后端用户设置

```typescript
// 当前实现已经很好，只需确保使用 l.icon
<span className="text-2xl">{l.icon || '🌐'}</span>
```

---

### 第四部分：首页词库动态过滤

#### 4.1 首页添加词库过滤逻辑

**文件**: `/poly_apps/wordflow-ai/pages/Dashboard/Home.tsx`

**实现逻辑**:

```typescript
import { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';

const DashboardPage = () => {
  const { user } = useContext(AppContext);
  const [wordGroups, setWordGroups] = useState<WordGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<WordGroup[]>([]);

  // 获取词库列表
  useEffect(() => {
    api.getWordGroups().then(setWordGroups);
  }, []);

  // 根据选中语言过滤词库
  useEffect(() => {
    if (!wordGroups.length) return;

    const learningLangs = user?.learningLanguages || [];

    if (learningLangs.length === 0) {
      // 未选择语言，显示所有
      setFilteredGroups(wordGroups);
    } else {
      // 根据选中的语言过滤
      const filtered = wordGroups.filter(group =>
        learningLangs.includes(group.language)
      );
      setFilteredGroups(filtered);
    }
  }, [wordGroups, user?.learningLanguages]);

  // 渲染过滤后的词库
  return (
    <div>
      <h2>词库列表 ({filteredGroups.length})</h2>
      {filteredGroups.map(group => (
        <WordGroupCard key={group.id} group={group} />
      ))}
    </div>
  );
};
```

---

## 📊 数据流向图

```
┌─────────────────────────────────────────────────────────┐
│                  后端：Laravel API                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ GET /api/app_qy_v1/system/supported-languages
                     │ Response:
                     │ {
                     │   success: true,
                     │   data: [
                     │     {
                     │       code: 'en',
                     │       name: 'English',
                     │       native_name: 'English',
                     │       icon: '🇺🇸',  ← 新增
                     │       voice_id: '...',
                     │       has_tts: true
                     │     },
                     │     ...
                     │   ]
                     │ }
                     ▼
┌─────────────────────────────────────────────────────────┐
│              前端：Settings/Language.tsx                 │
│                                                          │
│  ┌─────────────────────────────────────┐               │
│  │  Grid 布局展示所有语言              │               │
│  │  ┌──────┐ ┌──────┐ ┌──────┐        │               │
│  │  │ 🇺🇸  │ │ 🇨🇳  │ │ 🇯🇵  │        │               │
│  │  │English│ │中文   │ │日本語│        │               │
│  │  │  ✓   │ │  ✓   │ │      │        │               │
│  │  └──────┘ └──────┘ └──────┘        │               │
│  │                                      │               │
│  │  用户点击 → toggleLearningLang()    │               │
│  │          → setUser({ learning       │               │
│  │             Languages: ['en','zh']})│               │
│  │          → API.updateProfile()      │               │
│  └─────────────────────────────────────┘               │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ PUT /api/app_qy_v1/user/profile
                     │ Body: { learning_languages: ['en','zh'] }
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              后端：保存用户偏好                          │
│              users.learning_languages = JSON            │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ 用户状态更新
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              前端：Dashboard/Home.tsx                    │
│                                                          │
│  user.learningLanguages = ['en', 'zh']                  │
│              ↓                                           │
│  wordGroups (所有词库)                                   │
│              ↓                                           │
│  filter by language                                      │
│              ↓                                           │
│  filteredGroups (仅显示英语和中文词库)                  │
│              ↓                                           │
│  渲染词库卡片                                            │
│  ┌──────────────┐  ┌──────────────┐                   │
│  │ IELTS 3000   │  │ 商务英语      │                   │
│  │ English 📚   │  │ English 💼    │                   │
│  └──────────────┘  └──────────────┘                   │
│  ┌──────────────┐  ┌──────────────┐                   │
│  │ HSK 4000     │  │ 旅游中文      │                   │
│  │ Chinese 🇨🇳  │  │ Chinese 🗺️   │                   │
│  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 实现步骤清单

### 后端

- [ ] **步骤 1**: 修改 `AppQyV1SupportedLanguagesController.php`
  - [ ] 为每种语言添加 `icon` 字段（国旗 emoji）
  - [ ] 修改 `getSupportedLanguages()` 返回 icon

- [ ] **步骤 2**: 确认用户表支持 `learning_languages` 字段
  - [ ] 检查 `users` 表是否有 `learning_languages` JSON 字段
  - [ ] 如无，创建迁移添加该字段

- [ ] **步骤 3**: 实现用户设置更新 API
  - [ ] `PUT /api/app_qy_v1/user/profile`
  - [ ] 支持更新 `learning_languages` 数组

### 前端

- [ ] **步骤 4**: 更新类型定义
  - [ ] `types.ts` - 添加 `icon?: string` 到 `SupportedLanguage`

- [ ] **步骤 5**: 确认语言选择页面
  - [ ] `pages/Settings/Language.tsx` - 已有 grid 布局 ✅
  - [ ] 使用 `l.icon` 显示国旗
  - [ ] 调用 `ApiCenter.user.updateProfile()` 保存

- [ ] **步骤 6**: 实现首页词库过滤
  - [ ] `pages/Dashboard/Home.tsx` - 添加过滤逻辑
  - [ ] 根据 `user.learningLanguages` 过滤 `wordGroups`
  - [ ] 显示过滤后的词库列表

- [ ] **步骤 7**: 实时更新
  - [ ] 确保 `AppContext` 的 `user` 状态更新
  - [ ] 首页监听 `user.learningLanguages` 变化
  - [ ] 自动重新过滤词库

---

## 🎨 UI 效果图

### 语言选择页面 (Settings/Language)

```
┌─────────────────────────────────────────┐
│  ← Language & Audio                     │
├─────────────────────────────────────────┤
│                                          │
│  APP INTERFACE                           │
│  ┌─────────────────────────────────┐   │
│  │ 🇺🇸 English          ○          │   │
│  ├─────────────────────────────────┤   │
│  │ 🇨🇳 中文             ●          │   │
│  └─────────────────────────────────┘   │
│                                          │
│  LANGUAGES TO LEARN (多选)              │
│  ┌──────────┐ ┌──────────┐             │
│  │  🇺🇸      │ │  🇨🇳      │             │
│  │ English  │ │ Chinese  │             │
│  │    ✓     │ │    ✓     │             │
│  └──────────┘ └──────────┘             │
│  ┌──────────┐ ┌──────────┐             │
│  │  🇯🇵      │ │  🇰🇷      │             │
│  │ Japanese │ │ Korean   │             │
│  │          │ │          │             │
│  └──────────┘ └──────────┘             │
│                                          │
│  AUDIO ENGINE                            │
│  Voice: Jenny Neural                     │
│  Speed: 1.0x                             │
│  Volume: 80%                             │
│  Auto Play: ON                           │
└─────────────────────────────────────────┘
```

### 首页词库 (Dashboard/Home)

**未选择语言时** - 显示所有词库

**选择 English + Chinese 后** - 仅显示这两种语言的词库

```
┌─────────────────────────────────────────┐
│  📚 My Word Libraries (4)                │
├─────────────────────────────────────────┤
│  ┌─────────────────────┐                │
│  │ 📚 IELTS Core 3000  │                │
│  │ English • 3000 words│  ← English     │
│  │ Progress: 15%        │                │
│  └─────────────────────┘                │
│  ┌─────────────────────┐                │
│  │ 💼 Business English │                │
│  │ English • 500 words │  ← English     │
│  │ Progress: 80%        │                │
│  └─────────────────────┘                │
│  ┌─────────────────────┐                │
│  │ 🇨🇳 HSK 4000        │                │
│  │ Chinese • 4000 words│  ← Chinese     │
│  │ Progress: 5%         │                │
│  └─────────────────────┘                │
│  ┌─────────────────────┐                │
│  │ 🗺️ Travel Chinese   │                │
│  │ Chinese • 500 words │  ← Chinese     │
│  │ Progress: 0%         │                │
│  └─────────────────────┘                │
│                                          │
│  ❌ 隐藏了：                             │
│     - JLPT N5 (Japanese)                │
│     - Korean Basics (Korean)            │
│     - Travel French (French)            │
└─────────────────────────────────────────┘
```

---

## ⚡ 优化建议

1. **缓存优化**: 语言列表可缓存到 localStorage，减少 API 调用
2. **加载状态**: 添加 loading 状态，避免闪烁
3. **空状态**: 未选择语言时，显示引导提示
4. **动画效果**: 词库列表切换时添加淡入淡出动画
5. **统计显示**: 在语言卡片上显示该语言的词库数量

---

## 📝 总结

**前端核心逻辑**:
1. 从后端获取支持的语言列表（包含 icon）
2. Grid 布局展示，支持多选
3. 保存到 `user.learningLanguages` 并同步到后端
4. 首页根据 `user.learningLanguages` 过滤词库

**后端核心逻辑**:
1. 为每种语言添加 `icon` 字段（国旗 emoji）
2. API 返回完整语言信息
3. 保存用户的 `learning_languages` 偏好
4. 词库 API 可选支持按语言过滤

**数据流**:
```
用户选择语言 → 保存到 user.learningLanguages →
同步到后端 → 首页监听变化 → 过滤词库 → 实时更新显示
```
