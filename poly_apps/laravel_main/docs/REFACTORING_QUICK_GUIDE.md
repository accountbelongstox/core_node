# 重构快速指南 - 5分钟上手

**目标**: 快速将旧代码重构为新标准
**阅读时间**: 5分钟
**适用范围**: AppQyV1 所有控制器

---

## 🎯 重构检查清单

重构一个控制器方法时,依次检查以下项目:

- [ ] 1. 替换手动验证为 FormRequest
- [ ] 2. 替换 `supported_params` (自动提取)
- [ ] 3. 替换硬编码错误消息为错误码方法
- [ ] 4. 替换 `response()->json()` 为 ApiResponse 方法
- [ ] 5. 优化事务处理 (使用 `DB::transaction()`)
- [ ] 6. 考虑添加缓存 (如果是高频查询)

---

## ⚡ 5个常用重构模式

### 模式1: 验证 → FormRequest

```php
// ❌ 旧代码
$supported_params = ['gid', 'library_id'];
$validator = Validator::make($request->all(), [
    'gid' => 'required|string',
    'library_id' => 'required|integer',
]);
if ($validator->fails()) {
    return $this->error($validator->errors()->first(), 400, [
        'supported_params' => $supported_params,
    ]);
}

// ✅ 新代码 (步骤)
// 1. 创建 FormRequest (一次性)
class AppQyV1YourRequest extends AppQyV1BaseRequest {
    public function rules(): array {
        return [
            'gid' => 'required|string',
            'library_id' => 'required|integer',
        ];
    }
}

// 2. 修改方法签名
public function yourMethod(AppQyV1YourRequest $request): JsonResponse
{
    // 验证已自动完成
    // supported_params 已自动提取
}
```

---

### 模式2: 硬编码错误 → 错误码方法

```php
// ❌ 旧代码
if (!$group) {
    return $this->error('Group not found', 404, [
        'supported_params' => $supported_params,
    ]);
}
if (!$library) {
    return $this->error('Library not found', 404, [
        'supported_params' => $supported_params,
    ]);
}

// ✅ 新代码
if (!$group) {
    return $this->groupNotFound();
}
if (!$library) {
    return $this->libraryNotFound();
}
```

**常用快捷方法**:
```php
$this->groupNotFound()
$this->libraryNotFound()
$this->wordNotFound()
$this->languageMismatch($libLang, $groupLang)
$this->libraryAlreadyAdded()
$this->libraryNotLinked()
$this->unauthorized()
```

---

### 模式3: response()->json() → ApiResponse

```php
// ❌ 旧代码
return response()->json([
    'success' => true,
    'data' => $data,
    'message' => 'Success',
], 200);

// ✅ 新代码
return $this->success($data, 'Success');

// 其他响应类型
return $this->created($data);      // 201
return $this->noContent();         // 204
return $this->paginated($items);   // 分页
```

---

### 模式4: 手动事务 → DB::transaction()

```php
// ❌ 旧代码
DB::connection('appqyv1')->beginTransaction();
try {
    // 业务逻辑
    $result = performOperation();
    DB::connection('appqyv1')->commit();
    return $this->success($result);
} catch (\Exception $e) {
    DB::connection('appqyv1')->rollback();
    throw $e;
}

// ✅ 新代码
return DB::connection('appqyv1')->transaction(function () {
    $result = performOperation();
    return $this->success($result);
});
```

---

### 模式5: 无缓存 → 添加缓存

```php
// ❌ 旧代码
public function getLanguages(): JsonResponse
{
    $languages = ExpensiveQuery::all();
    return $this->success($languages);
}

// ✅ 新代码
use Illuminate\Support\Facades\Cache;

public function getLanguages(): JsonResponse
{
    $languages = Cache::remember('languages', now()->addHours(24), function () {
        return ExpensiveQuery::all();
    });
    return $this->success($languages);
}
```

**推荐缓存时长**:
- 语言列表: 24小时
- 词库元数据: 1小时
- 字典查询: 24小时
- 用户词组列表: 10分钟

---

## 🔍 实战示例

### 示例: 完整重构一个方法 (3分钟)

#### 原始代码
```php
public function addWords(Request $request): JsonResponse
{
    $supported_params = ['gid', 'word_ids'];

    $validator = Validator::make($request->all(), [
        'gid' => 'required|string',
        'word_ids' => 'required|array',
    ]);

    if ($validator->fails()) {
        return $this->error($validator->errors()->first(), 400, [
            'supported_params' => $supported_params,
        ]);
    }

    $user = Auth::user();
    if (!$user) {
        return $this->unauthorized('Authentication required');
    }

    $group = AppQyV1WordGroupModel::where('gid', $request->gid)
        ->where('uid', $user->id)
        ->first();

    if (!$group) {
        return $this->error('Group not found', 404, [
            'supported_params' => $supported_params,
        ]);
    }

    DB::connection('appqyv1')->beginTransaction();
    try {
        foreach ($request->word_ids as $wordId) {
            // 添加单词逻辑
        }
        DB::connection('appqyv1')->commit();
        return response()->json([
            'success' => true,
            'data' => ['added' => count($request->word_ids)],
        ]);
    } catch (\Exception $e) {
        DB::connection('appqyv1')->rollback();
        throw $e;
    }
}
```

#### 重构后代码
```php
// 1. 创建 FormRequest (只需一次)
class AppQyV1AddWordsRequest extends AppQyV1BaseRequest {
    public function rules(): array {
        return [
            'gid' => 'required|string',
            'word_ids' => 'required|array',
        ];
    }
}

// 2. 重构方法
public function addWords(AppQyV1AddWordsRequest $request): JsonResponse
{
    $user = Auth::user();
    if (!$user) {
        return $this->unauthorized();
    }

    $group = AppQyV1WordGroupModel::where('gid', $request->gid)
        ->where('uid', $user->id)
        ->first();

    if (!$group) {
        return $this->groupNotFound();
    }

    return DB::connection('appqyv1')->transaction(function () use ($request) {
        foreach ($request->word_ids as $wordId) {
            // 添加单词逻辑
        }

        return $this->success([
            'added' => count($request->word_ids),
        ]);
    });
}
```

**改进**:
- ✅ 代码从 ~45行 → ~25行 (-44%)
- ✅ 移除 `supported_params`
- ✅ 使用 FormRequest 验证
- ✅ 使用错误码方法
- ✅ 使用 `DB::transaction()`
- ✅ 使用 ApiResponse trait

---

## 📚 常用方法速查

### ApiResponse Trait 方法

| 方法 | 用途 | HTTP状态码 |
|------|------|-----------|
| `$this->success($data, $message)` | 成功响应 | 200 |
| `$this->created($data)` | 创建成功 | 201 |
| `$this->noContent()` | 无内容 | 204 |
| `$this->unauthorized()` | 未认证 | 401 |
| `$this->forbidden()` | 禁止访问 | 403 |
| `$this->notFound($message)` | 未找到 | 404 |
| `$this->conflict($message)` | 冲突 | 409 |
| `$this->groupNotFound()` | 分组未找到 | 404 |
| `$this->libraryNotFound()` | 词库未找到 | 404 |
| `$this->wordNotFound()` | 单词未找到 | 404 |
| `$this->libraryAlreadyAdded()` | 词库已添加 | 400 |
| `$this->languageMismatch($lib, $grp)` | 语言不匹配 | 400 |

### LanguageConfigService 方法

```php
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1LanguageConfigService;

// 获取语言信息
AppQyV1LanguageConfigService::getLanguageInfo('en')
AppQyV1LanguageConfigService::getLanguageName('en', 'zh')  // "英语"
AppQyV1LanguageConfigService::getLanguageIcon('ja')        // "🇯🇵"
AppQyV1LanguageConfigService::getLanguageColor('ko')       // "#8B5CF6"
AppQyV1LanguageConfigService::getVoiceId('en')             // "en-US-JennyNeural"

// 验证
AppQyV1LanguageConfigService::isValidLanguage('en')
AppQyV1LanguageConfigService::isValidStudyLanguage('en')

// 获取列表
AppQyV1LanguageConfigService::getStudyLanguages()      // 9种学习语言
AppQyV1LanguageConfigService::getTTSLanguages()        // 80+种TTS语言
```

**⚠️ 重要提示**:
- 语言列表与 **Microsoft Edge-TTS** 保持严格一致
- `voice_id` 字段遵循 Edge-TTS 官方规范，格式: `{locale}-{region}-{voiceName}Neural`
- 虽然是硬编码，但请勿随意修改，否则会导致 TTS 服务调用失败
- 更新语言时需参考: https://github.com/rany2/edge-tts

---

## 🚨 常见错误

### 错误1: 忘记修改方法签名
```php
// ❌ 错误 - 创建了FormRequest但没用
class AppQyV1MyRequest extends AppQyV1BaseRequest { ... }

public function method(Request $request) {  // 仍使用 Request
    // ...
}

// ✅ 正确
public function method(AppQyV1MyRequest $request) {  // 使用 FormRequest
    // ...
}
```

### 错误2: 缓存键重复
```php
// ❌ 错误 - 所有用户共享同一缓存
Cache::remember('user_groups', now()->addMinutes(10), function () use ($userId) {
    return getUserGroups($userId);
});

// ✅ 正确 - 为每个用户使用唯一键
Cache::remember("user_groups:{$userId}", now()->addMinutes(10), function () use ($userId) {
    return getUserGroups($userId);
});
```

### 错误3: 在事务中返回响应
```php
// ❌ 错误 - 事务中直接返回
DB::transaction(function () {
    $result = doSomething();
    return $this->success($result);  // 这会提交事务
});

// ✅ 正确 - 事务外返回
return DB::transaction(function () {
    $result = doSomething();
    return $result;  // 返回数据
});
// 或者
return DB::transaction(function () {
    $result = doSomething();
    return $this->success($result);  // 直接返回JsonResponse也可以
});
```

---

## 🎓 进阶技巧

### 技巧1: 批量清除缓存标签
```php
use Illuminate\Support\Facades\Cache;

// 使用缓存标签
Cache::tags(['languages', 'vocabulary'])->put('key', $value, $seconds);

// 清除特定标签的所有缓存
Cache::tags(['languages'])->flush();
```

### 技巧2: FormRequest 中使用自定义验证
```php
class AppQyV1CustomRequest extends AppQyV1BaseRequest
{
    public function rules(): array
    {
        return [
            'language' => ['required', 'string', new ValidStudyLanguage()],
        ];
    }
}

// 自定义验证规则
class ValidStudyLanguage implements \Illuminate\Contracts\Validation\Rule
{
    public function passes($attribute, $value)
    {
        return AppQyV1LanguageConfigService::isValidStudyLanguage($value);
    }

    public function message()
    {
        return 'The :attribute must be a valid study language.';
    }
}
```

### 技巧3: 条件缓存
```php
public function getData(Request $request): JsonResponse
{
    $useCache = $request->input('cache', true);

    if ($useCache) {
        $data = Cache::remember('key', now()->addHours(1), fn() => expensiveQuery());
    } else {
        $data = expensiveQuery();
    }

    return $this->success($data);
}
```

---

## 📞 需要帮助?

1. **查看完整示例**: `AppQyV1WordGroupLibraryController.php`
2. **查看详细文档**: `REFACTORING_SUMMARY.md`
3. **查看原始分析**: `CODE_REUSABILITY_ANALYSIS_REPORT.md`

---

**快速上手**: 选择一个简单的控制器方法,按照5个模式依次重构,15分钟完成你的第一次重构！

*Generated on 2025-12-20 | Quick Reference Guide*
