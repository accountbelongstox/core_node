# IT Tools 多应用实现 - 快速开始指南

## 🎯 当前状态

**核心框架**: ✅ 完成
- Nuxt 前端应用结构完整
- Laravel 后端应用结构完整
- Crypto 和 Converter 工具已实现
- API 架构和通信完成
- 状态管理和数据流完成

**待实现**: 组件、其他工具端点、数据库

---

## 📂 快速定位

### 前端文件
```
D:\programing\core_node\poly_apps\nuxt_main\
├── apps\app_ittools\               # IT Tools 应用
├── app-entry.ts                    # 应用注册 ✅
└── configs\ittools.config.ts       # [可选] 添加全局配置
```

### 后端文件
```
D:\programing\core_node\poly_apps\laravel_main\
├── app\Apps\ItToolsV1\             # IT Tools 应用
├── routes\ItToolsV1Router\api.php  # API 路由 ✅
└── routes\api.php                  # 添加路由加载
```

---

## 🚀 快速开发步骤

### Step 1: 完成前端组件

**位置**: `D:\programing\core_node\poly_apps\nuxt_main\apps\app_ittools\components_app_ittools\`

创建缺失的组件:
1. **ToolModal.vue** - 工具执行模态框
2. **SettingsModal.vue** - 设置面板
3. **ToolCard.vue** - 工具卡片（如需要）

**模板示例**:
```vue
<template>
  <div class="modal">
    <!-- Modal content -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useItToolsStore } from '../../stores_app_ittools/ittools-store'

defineProps<{ tool: Tool }>()
defineEmits<{ close: [], execute: [toolId: string, params: Record<string, any>] }>()
</script>
```

### Step 2: 实现 Web 工具

**位置**: `D:\programing\core_node\poly_apps\laravel_main\app\Apps\ItToolsV1\ItToolsV1Utils\`

创建 `WebService.php`:
```php
namespace App\Apps\ItToolsV1\ItToolsV1Utils;

class WebService
{
    public static function jsonPrettify(string $json, int $indent = 2): array {
        // 实现逻辑
    }

    public static function jsonMinify(string $json): array {
        // 实现逻辑
    }

    // ... 其他方法
}
```

### Step 3: 实现 Text 工具

**位置**: 同上

创建 `TextService.php`:
```php
namespace App\Apps\ItToolsV1\ItToolsV1Utils;

class TextService
{
    public static function textStatistics(string $text): array {
        // 实现逻辑
    }

    public static function regexTest(string $pattern, string $text, string $flags = ''): array {
        // 实现逻辑
    }

    // ... 其他方法
}
```

### Step 4: 添加控制器方法

**位置**: `D:\programing\core_node\poly_apps\laravel_main\app\Apps\ItToolsV1\ItToolsV1Controllers\ItToolsMainCtl.php`

添加新的公共方法:
```php
public function jsonPrettify(Request $request): JsonResponse
{
    try {
        $validated = $request->validate(['json' => 'required|string']);
        $result = WebService::jsonPrettify($validated['json']);
        return response()->json(['success' => true, 'data' => $result]);
    } catch (\Exception $e) {
        return response()->json(['success' => false, 'error' => $e->getMessage()], 400);
    }
}
```

### Step 5: 更新路由

**位置**: `D:\programing\core_node\poly_apps\laravel_main\routes\ItToolsV1Router\api.php`

添加路由映射:
```php
Route::post('/web/json/prettify', [ItToolsMainCtl::class, 'jsonPrettify']);
Route::post('/web/json/minify', [ItToolsMainCtl::class, 'jsonMinify']);
// ... 其他路由
```

### Step 6: 在主路由注册

**位置**: `D:\programing\core_node\poly_apps\laravel_main\routes\api.php`

确保包含 ItTools 路由:
```php
Route::prefix('ittools/v1')->group(function () {
    require base_path('routes/ItToolsV1Router/api.php');
});
```

---

## 💡 常见任务

### 添加新工具

#### 前端
1. 在 `constants_app_ittools/tools.ts` 中添加工具定义
2. 在 `ittools-main-api.ts` 中添加对应的 API 方法
3. 工具会自动出现在工具列表中

#### 后端
1. 在相应的 Service 类中添加实现方法
2. 在控制器中添加公共方法
3. 在路由中添加映射

#### 完整示例

**前端 - 添加新工具定义**:
```typescript
// constants_app_ittools/tools.ts
{
  id: 'my_tool',
  name: 'My Tool',
  description: 'Tool description',
  category: 'web',
  icon: '<i class="fas fa-icon"></i>',
  endpoint: '/api/ittools/category/my-endpoint',
  method: 'POST',
  params: {
    param1: { type: 'string', required: true }
  },
  keywords: ['keyword1', 'keyword2']
}
```

**后端 - 添加实现**:
```php
// Service.php
public static function myTool(string $param1): array {
    return [
        'param' => $param1,
        'result' => '...'
    ];
}

// Controller.php
public function myTool(Request $request): JsonResponse {
    $result = Service::myTool($request->input('param1'));
    return response()->json(['success' => true, 'data' => $result]);
}

// routes/ItToolsV1Router/api.php
Route::post('/category/my-endpoint', [ItToolsMainCtl::class, 'myTool']);
```

---

## 🧪 测试方式

### 使用 Laravel 内置工具进行测试

```bash
cd D:\programing\core_node\poly_apps\laravel_main

# 测试 API
php artisan tinker

# 或使用 curl
curl -X POST http://localhost:8000/api/ittools/v1/crypto/hash \
  -H "Content-Type: application/json" \
  -d '{"text":"hello","algorithm":"sha256"}'
```

### 使用 Postman/Insomnia

1. 导入 API 端点
2. 设置请求头: `X-App-Namespace: ittools`
3. 发送请求测试

### 前端测试

```typescript
// 在浏览器控制台测试
import { ItToolsMainAPI } from 'path-to-api'
const api = new ItToolsMainAPI()
const result = await api.hashText('hello', 'sha256')
console.log(result)
```

---

## 📋 开发检查清单

### 添加新工具时
- [ ] 工具定义包含所有必要字段
- [ ] 参数验证完整
- [ ] 返回格式统一
- [ ] 错误处理合理
- [ ] 测试通过
- [ ] ApiInfo 已更新

### 完成新模块时
- [ ] 命名规范正确
- [ ] 代码注释完整
- [ ] 类型定义完整
- [ ] 错误处理完善
- [ ] 集成测试通过
- [ ] API 文档更新

---

## 🔗 重要文件参考

| 文件 | 用途 | 路径 |
|------|------|------|
| app-entry.ts | 应用注册 | nuxt_main/ |
| ittools.config.ts | 全局配置 | apps/app_ittools/config_app_ittools/ |
| ittools-main-api.ts | API 服务 | apps/app_ittools/services_app_ittools/ |
| ittools-store.ts | 状态管理 | apps/app_ittools/stores_app_ittools/ |
| ItToolsMainCtl.php | 主控制器 | laravel_main/app/Apps/ItToolsV1/ |
| CryptoService.php | Crypto 工具 | laravel_main/app/Apps/ItToolsV1/ItToolsV1Utils/ |
| ConverterService.php | Converter 工具 | laravel_main/app/Apps/ItToolsV1/ItToolsV1Utils/ |
| api.php (ItTools) | API 路由 | laravel_main/routes/ItToolsV1Router/ |

---

## 📚 进一步阅读

1. **完整实现总结**: `IT_TOOLS_IMPLEMENTATION_SUMMARY.md`
2. **Nuxt 多应用架构**: `development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md`
3. **Laravel 开发规范**: `poly_apps/laravel_main/development-guides/LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md`
4. **原 IT Tools 文档**: `poly_apps/it-tools-html/README.md`

---

## 🚨 常见问题

### Q: API 返回 404 错误
**A**: 检查:
1. 路由是否在 `routes/api.php` 中加载
2. 前缀是否正确 (`/api/ittools/v1`)
3. 方法名是否匹配

### Q: 前端无法连接后端
**A**: 检查:
1. API 基址是否正确 (`/api/ittools`)
2. 请求头是否包含 `X-App-Namespace: ittools`
3. CORS 配置是否允许

### Q: 状态不保存
**A**: 检查:
1. localStorage 是否被禁用
2. 浏览器是否处于隐私模式
3. 代码中是否调用了 `saveFavorites()` 等方法

---

## 📞 获取帮助

1. 查看代码注释
2. 参考现有应用实现
3. 检查项目规范文档
4. 阅读完整的实现总结

---

**最后更新**: 2025-10-21
**版本**: 1.0
**维护者**: Core Node Team
