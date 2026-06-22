# AppDataCenter 使用文档

## 概述

`AppDataCenterAppCodemart` 是 app_codemart 的统一数据中心，负责管理应用的全局状态，包括用户认证、用户资料和 Debug 模式。

## 核心功能

### 1. 统一数据管理
- 用户认证状态
- 用户资料（开发者/客户）
- 全局配置
- Debug 模式控制

### 2. Debug 模式

Debug 模式允许开发者在不连接后端 API 的情况下测试应用功能。

#### 配置 Debug 模式

编辑 `config_app_codemart/debug_config_app_codemart.dart`:

```dart
class DebugConfigAppCodemart {
  /// 全局 debug 模式开关
  /// 生产环境设置为 false
  static const bool isDebugMode = true;

  /// 其他配置...
}
```

#### Debug 模式特性

当 `isDebugMode = true` 时：
- ✅ 登录绕过 API 调用
- ✅ 使用模拟数据填充用户信息
- ✅ 显示 Debug 模式指示器
- ✅ 支持选择用户模式（开发者/客户端）
- ✅ 任何账号密码都能登录成功

### 3. 用户模式

支持两种用户模式：
- **Developer（开发者版）**: 以开发者身份登录，获得开发者相关功能
- **Client（客户端）**: 以客户身份登录，获得客户相关功能

## 使用方法

### 基础使用

#### 1. 获取 AppDataCenter 实例

```dart
// 方式 1: 使用 Provider（推荐）
final dataCenter = context.read<AppDataCenterAppCodemart>();

// 方式 2: 直接获取单例
final dataCenter = AppDataCenterAppCodemart();
```

#### 2. 访问用户数据

```dart
final dataCenter = AppDataCenterAppCodemart();

// 检查登录状态
if (dataCenter.isLoggedIn) {
  // 获取用户信息
  final userProfile = dataCenter.userProfile;
  print('用户名: ${userProfile?.username}');

  // 检查用户角色
  if (dataCenter.isDeveloper) {
    final devProfile = dataCenter.developerProfile;
    print('开发者等级: ${devProfile?.level}');
  }

  if (dataCenter.isClient) {
    final clientProfile = dataCenter.clientProfile;
    print('客户公司: ${clientProfile?.companyName}');
  }
}
```

#### 3. 登录操作

**Debug 模式登录**：
```dart
final dataCenter = AppDataCenterAppCodemart();

// Debug 登录（任意账号密码）
await dataCenter.debugLogin(
  'developer@test.com',
  '123456',
  UserModeType.developer, // 或 UserModeType.client
);
```

**生产模式登录**：
```dart
final dataCenter = AppDataCenterAppCodemart();

// 使用 API 返回的数据登录
await dataCenter.login(
  userData,        // Map<String, dynamic>
  token,           // String
  developerData,   // Map<String, dynamic>?
  clientData,      // Map<String, dynamic>?
);
```

#### 4. 登出操作

```dart
final dataCenter = AppDataCenterAppCodemart();
await dataCenter.logout();
```

### 高级使用

#### 1. 监听数据变化

```dart
class MyWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<AppDataCenterAppCodemart>(
      builder: (context, dataCenter, child) {
        if (dataCenter.isLoggedIn) {
          return Text('欢迎, ${dataCenter.userProfile?.name}');
        }
        return Text('未登录');
      },
    );
  }
}
```

#### 2. 更新用户资料

```dart
final dataCenter = AppDataCenterAppCodemart();

// 更新开发者资料
dataCenter.updateDeveloperProfile(newDeveloperProfile);

// 更新客户资料
dataCenter.updateClientProfile(newClientProfile);
```

#### 3. 切换用户模式

```dart
final dataCenter = AppDataCenterAppCodemart();

// 切换到开发者模式
dataCenter.setUserMode(UserModeType.developer);

// 切换到客户模式
dataCenter.setUserMode(UserModeType.client);
```

#### 4. Debug 信息

```dart
final dataCenter = AppDataCenterAppCodemart();

// 获取 Debug 信息
print(dataCenter.getDebugInfo());

// 输出示例:
// Debug Mode: true
// Current User Mode: developer
// Is Logged In: true
// User Email: dev@codemart.com
// Is Developer: true
// Is Client: false
// Token: mock_token_123456...
```

## 登录界面功能

### Debug 模式下的登录界面

当 Debug 模式启用时，登录界面会显示：

1. **Debug 模式指示器**（橙色提示框）
   - 显示 "DEBUG MODE" 标识
   - 提示可以使用任意账号密码登录

2. **用户模式选择器**
   - Developer（开发者版）按钮
   - Client（客户端）按钮
   - 点击选择登录身份

3. **登录流程**
   - 输入任意邮箱和密码
   - 选择用户模式
   - 点击登录
   - 自动填充模拟数据并登录成功

### 生产模式下的登录界面

当 Debug 模式关闭时：
- 不显示 Debug 指示器
- 不显示用户模式选择器
- 使用真实 API 进行登录验证

## 文件结构

```
lib/apps/app_codemart/
├── config_app_codemart/
│   ├── api_config_app_codemart.dart
│   └── debug_config_app_codemart.dart          # Debug 配置
├── models_app_codemart/
│   ├── app_data_center_app_codemart.dart       # 统一数据中心
│   ├── user_model_app_codemart.dart
│   ├── codemart_types.dart
│   └── codemart_enums.dart
├── views_app_codemart/
│   └── login_view_app_codemart.dart            # 登录界面（已更新）
└── main_app_codemart.dart                      # 主入口（已更新）
```

## 最佳实践

### 1. 生产环境配置

发布应用前，务必关闭 Debug 模式：

```dart
// debug_config_app_codemart.dart
class DebugConfigAppCodemart {
  static const bool isDebugMode = false; // ← 设置为 false
}
```

### 2. 使用 Provider

推荐使用 Provider 访问 AppDataCenter，而不是直接调用单例：

```dart
// ✅ 推荐
final dataCenter = context.read<AppDataCenterAppCodemart>();

// ⚠️ 不推荐（但可用）
final dataCenter = AppDataCenterAppCodemart();
```

### 3. 监听变化

需要响应数据变化时，使用 Consumer 或 context.watch：

```dart
// 使用 Consumer
Consumer<AppDataCenterAppCodemart>(
  builder: (context, dataCenter, child) {
    return Text(dataCenter.userProfile?.name ?? 'Guest');
  },
)

// 或使用 watch
final dataCenter = context.watch<AppDataCenterAppCodemart>();
```

### 4. 错误处理

登录操作应该添加错误处理：

```dart
try {
  await dataCenter.debugLogin(email, password, mode);
  // 登录成功
} catch (e) {
  // 处理错误
  print('登录失败: $e');
}
```

## 常见问题

### Q1: Debug 模式下能使用真实 API 吗？

不能。当 `isDebugMode = true` 时，所有登录请求都会绕过 API，使用模拟数据。如果需要测试真实 API，请设置 `isDebugMode = false`。

### Q2: 如何在运行时切换 Debug 模式？

可以使用 `setDebugMode` 方法：

```dart
dataCenter.setDebugMode(true);  // 启用 Debug 模式
dataCenter.setDebugMode(false); // 禁用 Debug 模式
```

但建议在配置文件中设置，避免运行时更改。

### Q3: 用户数据保存在哪里？

当前版本用户数据仅保存在内存中。如需持久化，可以结合 `storage` 模块实现。

### Q4: 如何自定义 Debug 模式的模拟数据？

修改 `app_data_center_app_codemart.dart` 中的以下方法：
- `_createMockUserData()` - 用户基础数据
- `_createMockDeveloperData()` - 开发者数据
- `_createMockClientData()` - 客户数据

## 更新日志

### v1.0.0 (2025-11-07)
- ✨ 首次发布
- ✨ 支持统一数据中心
- ✨ 支持 Debug 模式
- ✨ 支持用户模式切换（开发者/客户）
- ✨ 更新登录界面支持 Debug 功能

## 贡献者

- Claude AI Assistant

## 许可证

MIT License
