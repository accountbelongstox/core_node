# Laravel 头像 API - 多提供商系统

## 概述

一个统一的头像缓存和分发系统，支持多个头像提供商，具有智能缓存、实时调整大小和提供商选择功能。

## 架构

### 核心组件

```
app/Http/Common/
├── CommonAvatarService.php          # 统一服务层
└── AvatarProviders/
    ├── AvatarProviderInterface.php  # 提供商接口
    ├── AbstractAvatarProvider.php   # 基础实现
    ├── AvatarProviderRegistry.php   # 提供商管理
    ├── PravatarProvider.php         # 真实人物照片
    ├── DicebearProvider.php         # 卡通头像 (avataaars)
    ├── DicebearbotttsProvider.php   # 机器人头像
    ├── DicebearpixelProvider.php    # 像素艺术头像
    ├── UiavatarsProvider.php        # 基于首字母的头像
    ├── RobohashProvider.php         # 机器人/怪物头像
    └── GravatarProvider.php         # WordPress 头像服务
```

### 设计模式

- **策略模式**: 每个提供商实现 `AvatarProviderInterface`
- **注册表模式**: `AvatarProviderRegistry` 管理提供商实例
- **单例模式**: 提供商实例被缓存
- **模板方法**: `AbstractAvatarProvider` 提供通用 HTTP 逻辑

## 支持的提供商

| 索引 | 短代码 | 提供商名称 | 最大尺寸 | 确定性 | 特性 |
|------|--------|-----------|---------|--------|------|
| 0 | pravatar | Pravatar | 512px | 否 | 真实人物照片，随机 |
| 1 | dicebear | DiceBear (Avataaars) | 512px | 是 | 卡通风格，基于种子 |
| 2 | uiavatars | UI Avatars | 512px | 是 | 首字母带颜色背景 |
| 3 | robohash | RoboHash | 512px | 是 | 机器人和怪物 |
| 4 | gravatar | Gravatar | 2048px | 是 | WordPress 生态系统 |
| 5 | dicebear-bottts | DiceBear (Bottts) | 512px | 是 | 机器人风格 |
| 6 | dicebear-pixel | DiceBear (Pixel Art) | 512px | 是 | 复古 8 位风格 |

**确定性**: 相同的种子总是生成相同的头像

## 缓存策略

### 关键特性

1. **最大分辨率缓存**: 所有头像以 512x512 缓存（或提供商最大值）
2. **基于关键词**: 仅按用户名缓存，不按尺寸
3. **提供商隔离**: 每个提供商单独缓存
4. **实时调整大小**: PHP GD 库从缓存中调整大小
5. **尺寸限制**: 超出范围的尺寸自动限制到有效范围
6. **自动降级**: 提供商选择被视为"首选"，如果请求的提供商失败，自动降级到其他提供商

### 提供商降级策略

系统实现了多层降级机制以确保头像可用性：

**优先级顺序：**
1. **请求的提供商缓存**: 检查指定提供商是否有缓存的头像
2. **请求的提供商 API**: 尝试从指定提供商的 API 获取
3. **其他提供商的缓存**: 如果请求失败，检查所有其他提供商的缓存
4. **其他提供商的 API**: 作为最后手段，尝试从其他提供商的 API 获取

**关键行为：**
- 提供商参数被视为"首选"而非"必需"
- 如果首选提供商失败，系统自动尝试替代方案
- 任何提供商的缓存头像优先于新的 API 调用
- 系统持续尝试直到找到有效头像或所有提供商都失败

**降级响应头：**
- `X-Requested-Provider`: 用户最初请求的提供商
- `X-Provider`: 实际提供头像的提供商
- `X-Fallback-Used: true`: 指示触发了降级（仅在发生降级时出现）

### 缓存文件命名

```
avatar_{哈希值}_{种子}_{提供商}.png
```

示例:
```
avatar_0285d564246ddd99f2da748c7541e7b2_testuser_dicebear.png
avatar_02f67f1cca660b6766c64e3a922fea9c_testuser_pravatar.png
avatar_a86a6353f4925d98ec267e31b7ca9961_testuser_robohash.png
```

### 缓存目录

默认: `/www/wwwroot/laravel_db/cache/avatars/`

通过 `PathMapper::getLaravelCacheDir()` 配置

## API 端点

### 1. 获取头像

```http
GET /api/public/avatar/{name}?size={size}&provider={provider}
```

**参数:**
- `name` (必需): 用户名或种子字符串
- `size` (可选): 期望的像素大小 (1-512)，默认: 512
- `provider` (可选): 提供商索引 (0-6) 或短代码，默认: 'pravatar'

**示例:**

```bash
# 默认提供商 (pravatar)，尺寸 512x512
curl http://localhost:9000/api/public/avatar/alice

# 自定义尺寸
curl http://localhost:9000/api/public/avatar/alice?size=100

# 通过索引选择提供商
curl http://localhost:9000/api/public/avatar/alice?size=100&provider=1

# 通过短代码选择提供商
curl http://localhost:9000/api/public/avatar/alice?size=100&provider=dicebear

# 组合使用
curl http://localhost:9000/api/public/avatar/alice?size=200&provider=robohash
```

**响应头:**

```http
HTTP/1.1 200 OK
Content-Type: image/png
Cache-Control: public, max-age=86400
X-From-Cache: true
X-Provider: dicebear
X-Requested-Provider: dicebear
X-Cached-Resolution: 512x512
X-Returned-Size: 100x100
```

**尺寸限制响应头（当尺寸超出范围时）:**

```http
X-Size-Clamped: true
X-Requested-Size: 1000x1000
X-Returned-Size: 512x512
```

**降级响应头（当发生提供商降级时）:**

```http
X-Requested-Provider: pravatar
X-Provider: dicebear
X-Fallback-Used: true
X-From-Cache: true
```

这表示用户请求了 `pravatar`，但它失败或没有缓存，因此系统降级到有缓存头像的 `dicebear`。

### 2. 列出所有提供商

```http
GET /api/public/avatar-providers/list
```

**响应:**

```json
{
  "success": true,
  "providers": [
    {
      "short_code": "pravatar",
      "name": "Pravatar",
      "max_size": 512,
      "supports_size": true,
      "deterministic": false
    },
    {
      "short_code": "dicebear",
      "name": "DiceBear (Avataaars)",
      "max_size": 512,
      "supports_size": true,
      "deterministic": true
    }
  ],
  "default": "pravatar"
}
```

### 3. 获取缓存统计

```http
GET /api/public/avatar-cache/stats
```

**响应:**

```json
{
  "cache_dir": "/www/wwwroot/laravel_db/cache/avatars",
  "total_files": 19,
  "total_size": 204440,
  "total_size_mb": 0.19
}
```

### 4. 清除特定用户缓存

```http
DELETE /api/public/avatar-cache/{name}?provider={provider}
```

**参数:**
- `name` (必需): 要清除的用户名
- `provider` (可选): 指定要清除的提供商，未指定则使用默认

**响应:**

```json
{
  "success": true,
  "message": "Cache cleared"
}
```

### 5. 清除所有缓存

```http
DELETE /api/public/avatar-cache
```

**响应:**

```json
{
  "success": true,
  "deleted_count": 19
}
```

## 使用示例

### 前端集成 (HTML)

```html
<!-- 默认提供商 -->
<img src="http://localhost:9000/api/public/avatar/alice?size=100" alt="Alice">

<!-- DiceBear 提供商 -->
<img src="http://localhost:9000/api/public/avatar/bob?size=150&provider=dicebear" alt="Bob">

<!-- RoboHash 提供商 -->
<img src="http://localhost:9000/api/public/avatar/charlie?size=200&provider=3" alt="Charlie">
```

### JavaScript/React

```javascript
const AvatarComponent = ({ username, size = 100, provider = 'pravatar' }) => {
  const url = `http://localhost:9000/api/public/avatar/${username}?size=${size}&provider=${provider}`;
  return <img src={url} alt={username} />;
};

// 使用方式
<AvatarComponent username="alice" size={150} provider="dicebear" />
```

### Vue.js

```vue
<template>
  <img :src="avatarUrl" :alt="username" />
</template>

<script>
export default {
  props: {
    username: String,
    size: { type: Number, default: 100 },
    provider: { type: String, default: 'pravatar' }
  },
  computed: {
    avatarUrl() {
      return `http://localhost:9000/api/public/avatar/${this.username}?size=${this.size}&provider=${this.provider}`;
    }
  }
}
</script>
```

### 提供商选择下拉框

```html
<select id="provider">
  <option value="0">Pravatar (真实照片)</option>
  <option value="1">DiceBear (卡通)</option>
  <option value="2">UI Avatars (首字母)</option>
  <option value="3">RoboHash (机器人)</option>
  <option value="4">Gravatar</option>
  <option value="5">DiceBear Bottts (机器人)</option>
  <option value="6">DiceBear Pixel Art (像素艺术)</option>
</select>

<script>
  const username = 'alice';
  const provider = document.getElementById('provider').value;
  const avatarUrl = `/api/public/avatar/${username}?size=150&provider=${provider}`;
</script>
```

## 添加新提供商

### 步骤 1: 创建提供商类

在 `app/Http/Common/AvatarProviders/` 中创建新文件:

```php
<?php

namespace App\Http\Common\AvatarProviders;

class MyNewProvider extends AbstractAvatarProvider
{
    protected string $name = 'My New Provider';
    protected string $shortCode = 'mynew';
    protected int $maxSize = 512;
    protected bool $supportsSize = true;
    protected bool $isDeterministic = true;

    public function getAvatarUrl(string $seed, int $size = 512): string
    {
        $size = min($size, $this->maxSize);
        return "https://api.example.com/avatar?seed=" . urlencode($seed) . "&size={$size}";
    }
}
```

### 步骤 2: 注册提供商

编辑 `app/Http/Common/AvatarProviders/AvatarProviderRegistry.php`:

```php
private static array $providers = [
    'pravatar' => PravatarProvider::class,
    'dicebear' => DicebearProvider::class,
    // ... 现有提供商
    'mynew' => MyNewProvider::class,  // 添加新提供商
];

private static array $indexMap = [
    0 => 'pravatar',
    1 => 'dicebear',
    // ... 现有映射
    7 => 'mynew',  // 添加新索引
];
```

### 步骤 3: 测试

```bash
# 测试新提供商
curl http://localhost:9000/api/public/avatar/test?provider=mynew

# 或通过索引
curl http://localhost:9000/api/public/avatar/test?provider=7
```

## 性能特性

### 缓存性能

- **首次请求**: 从外部 API 获取，以 512x512 缓存
- **后续请求（相同尺寸）**: ~5ms（直接缓存命中）
- **后续请求（不同尺寸）**: ~17ms（缓存 + 调整大小）

### 响应时间（测试数据）

| 提供商 | 首次请求 | 缓存请求 |
|--------|---------|---------|
| Pravatar | ~250ms | ~5ms |
| DiceBear | ~960ms | ~5ms |
| UI Avatars | ~374ms | ~5ms |
| RoboHash | ~1082ms | ~5ms |
| Gravatar | ~957ms | ~5ms |

### 存储效率

传统方法（缓存所有尺寸）:
- 5 用户 × 3 提供商 × 5 尺寸 = **75 个缓存文件**

新方法（缓存最大尺寸，按需调整）:
- 5 用户 × 3 提供商 × 1 尺寸 = **15 个缓存文件**
- **减少 80%** 缓存文件

## 错误处理

### 无效提供商

```json
{
  "error": "Invalid provider"
}
```

### 网络故障

```json
{
  "success": true,
  "data": "...",
  "from_cache": false,
  "cache_failed": true,
  "provider": "pravatar"
}
```

仍返回头像，但记录缓存写入失败。

### 尺寸验证

超出范围的尺寸自动限制:
- `size < 1` → 限制为 1
- `size > 512` → 限制为 512（或提供商最大值）

响应头指示发生了限制:
```
X-Size-Clamped: true
X-Requested-Size: 1000x1000
X-Returned-Size: 512x512
```

## 日志记录

所有操作都带上下文记录:

```php
Log::info('[CommonAvatarService] Avatar fetched and cached', [
    'seed' => 'alice',
    'provider' => 'dicebear',
    'path' => '/cache/avatars/avatar_xxx_alice_dicebear.png',
    'size' => 45678,
    'resolution' => '512x512',
]);
```

日志类别:
- 缓存命中/未命中
- 提供商选择
- 图像调整大小操作
- 缓存清除
- 错误条件

## 安全考虑

1. **种子清理**: 种子被清理以确保文件系统安全
2. **尺寸验证**: 尺寸被限制以防止资源耗尽
3. **提供商验证**: 无效提供商返回错误，不会崩溃
4. **URL 编码**: 所有外部 API 参数都正确编码
5. **文件权限**: 缓存目录以 0755 权限创建

## 配置

### 缓存目录

编辑 `app/Providers/PathMapper.php` 更改缓存位置:

```php
public static function getLaravelCacheDir(): string
{
    return '/your/custom/cache/path';
}
```

### 默认设置

在 `app/Http/Common/CommonAvatarService.php` 中:

```php
private const CACHE_SUBDIR = 'avatars';        // 缓存子目录
private const DEFAULT_SIZE = 512;              // 未指定时的默认尺寸
private const MAX_CACHE_SIZE = 512;            // 最大缓存分辨率
```

### 默认提供商

在 `app/Http/Common/AvatarProviders/AvatarProviderRegistry.php` 中:

```php
private const DEFAULT_PROVIDER = 'pravatar';  // 更改默认提供商
```

## 维护

### 清除旧缓存

```bash
# 通过 API
curl -X DELETE http://localhost:9000/api/public/avatar-cache

# 通过文件系统（超过 30 天）
find /www/wwwroot/laravel_db/cache/avatars -name "avatar_*.png" -mtime +30 -delete
```

### 监控缓存大小

```bash
# 获取统计信息
curl http://localhost:9000/api/public/avatar-cache/stats

# 手动检查
du -sh /www/wwwroot/laravel_db/cache/avatars
```

### 重启服务

```bash
curl -X POST http://localhost:9000/api/server-manager/restart
```

## 从旧系统迁移

如果从单提供商系统迁移:

1. 旧缓存文件保持兼容（按名称模式检查）
2. 新请求使用新的提供商特定命名
3. 随着用户请求新头像，旧缓存逐渐被替换
4. 手动清理: `DELETE /api/public/avatar-cache` 强制刷新

## 测试

### 测试脚本

综合测试脚本位于:
`/www/programing/core_node/poly_apps/laravel_main/test_avatar_providers.php`

运行方式:
```bash
php test_avatar_providers.php
```

### 手动测试

```bash
# 测试所有提供商
for i in {0..6}; do
  echo "测试提供商 $i"
  curl -I "http://localhost:9000/api/public/avatar/test?provider=$i" 2>&1 | grep X-Provider
done

# 测试尺寸限制
curl -I "http://localhost:9000/api/public/avatar/test?size=9999" 2>&1 | grep X-Size-Clamped

# 测试缓存命中
curl -I "http://localhost:9000/api/public/avatar/test" 2>&1 | grep X-From-Cache
curl -I "http://localhost:9000/api/public/avatar/test" 2>&1 | grep X-From-Cache
```

## 故障排除

### 问题: 头像无法加载

**检查:**
1. 服务正在运行: `systemctl status laravel-octane`
2. 缓存目录可写: `ls -ld /www/wwwroot/laravel_db/cache/avatars`
3. 外部 API 网络访问
4. 日志: `/www/wwwroot/laravel_db/logs/laravel.log`

### 问题: 返回了错误的头像

**检查:**
1. 提供商参数指定正确
2. 缓存可能有旧版本: 清除该用户的缓存
3. 检查提供商是否确定性（pravatar 是随机的）

### 问题: 响应缓慢

**检查:**
1. 首次请求总是较慢（从外部 API 获取）
2. 后续请求应该是 ~5-17ms
3. 外部提供商的网络问题
4. 大缓存导致文件系统变慢

### 问题: 缓存无法清除

**检查:**
1. 缓存目录的文件权限
2. 提供商参数与缓存文件匹配
3. 检查日志中的权限错误

## 参考资料

### 提供商文档

- **Pravatar**: https://pravatar.cc/
- **DiceBear**: https://www.dicebear.com/
- **UI Avatars**: https://ui-avatars.com/
- **RoboHash**: https://robohash.org/
- **Gravatar**: https://gravatar.com/

### 相关文件

- 路由: `/www/programing/core_node/poly_apps/laravel_main/routes/api/public_api.php`
- 服务: `/www/programing/core_node/poly_apps/laravel_main/app/Http/Common/CommonAvatarService.php`
- 提供商: `/www/programing/core_node/poly_apps/laravel_main/app/Http/Common/AvatarProviders/`

## 更新日志

### 版本 2.0.0 (2026-01-05)

- 添加多提供商支持（7 个提供商）
- 实现提供商注册和选择
- 提供商隔离缓存
- 保持向后兼容性

### 版本 1.0.0 (之前)

- 单一提供商（仅 Pravatar）
- 基本缓存，包含尺寸变体
