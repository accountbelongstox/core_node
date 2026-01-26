# 应用授权注册系统设计文档

## 1. 系统概述

应用授权注册系统（License Registration System）是一个基于设备绑定的授权管理机制，用于控制应用的使用权限。系统通过设备唯一标识符生成注册码，结合互联网时间验证，确保授权在指定期限内有效。

### 1.1 核心特性

- **设备绑定**：基于设备特征生成唯一机器码，实现设备级别的授权绑定
- **时间验证**：结合互联网时间和本地时间，智能检测授权过期
- **自动清理**：授权过期时自动清除所有应用数据并退出登录
- **生命周期集成**：与应用生命周期深度集成，在启动、切换等关键节点进行检测
- **离线支持**：支持离线环境下的授权验证，使用缓存时间策略

### 1.2 设计目标

1. **安全性**：防止授权被复制或篡改
2. **可靠性**：确保授权检测的准确性和及时性
3. **性能**：最小化网络请求，优化用户体验
4. **跨平台**：支持 Android、iOS、Web、Desktop 等平台

## 2. 架构设计

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────┐
│              LicenseRegistrationManager                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │  - 注册状态管理                                    │  │
│  │  - 授权验证                                        │  │
│  │  - 时间检测                                        │  │
│  │  - 生命周期监听                                    │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
│ DeviceUtils  │ │ NetworkUtils │ │ PrefsAppBank│
│              │ │              │ │            │
│ - 机器码生成  │ │ - 网络检测   │ │ - 数据持久化│
│ - 注册码生成  │ │ - 时间获取   │ │ - 状态存储 │
│ - 注册码验证  │ │              │ │            │
└──────────────┘ └──────────────┘ └────────────┘
```

### 2.2 核心组件

#### 2.2.1 LicenseRegistrationManager

**职责**：
- 管理注册状态
- 执行授权验证
- 处理授权过期
- 监听应用生命周期

**设计模式**：单例模式（Singleton）

**生命周期集成**：实现 `WidgetsBindingObserver`，监听应用生命周期变化

#### 2.2.2 DeviceUtils

**职责**：
- 生成设备唯一机器码
- 生成注册码
- 验证注册码有效性

**特性**：
- 跨平台设备信息收集
- 机器码持久化存储
- 多层哈希加密

#### 2.2.3 时间检测机制

**职责**：
- 智能获取当前时间（互联网时间或本地时间）
- 缓存互联网时间，减少网络请求
- 时间对比策略

## 3. 设备识别机制

### 3.1 机器码生成

机器码基于设备特征信息生成，确保：
- **唯一性**：每个设备生成唯一的机器码
- **持久性**：机器码持久化存储，应用重装后保持不变
- **稳定性**：基于设备硬件和系统信息，不易变化

#### 3.1.1 设备信息收集策略

**Android 平台**：
```
platform|version|locale|hostname|processors|pathSeparator|executableHash|environmentLength
```

**iOS 平台**：
```
platform|version|locale|hostname|processors|executableHash
```

**Desktop 平台（Windows/macOS/Linux）**：
```
platform|version|hostname|processors|locale|executableHash|pathSeparator
```

**Web 平台**：
```
web_platform_version_locale_timezone
```

#### 3.1.2 机器码生成算法

```dart
1. 收集设备信息字符串
2. 使用 SHA-256 哈希算法处理
3. 取前 16 位字符并转为大写
4. 持久化存储到 UnifiedStorage
```

**示例**：
```
设备信息: "android|13|zh_CN|device123|8|/|123456|50"
SHA-256: "a1b2c3d4e5f6..."
机器码: "A1B2C3D4E5F6G7H8"
```

### 3.2 注册码生成

注册码基于机器码生成，使用多层哈希加密：

```dart
1. 使用机器码 + AppId 生成 Salt1
2. 使用机器码 + AppVersion 生成 Salt2
3. 组合：machineCode + Salt1 + Salt2
4. SHA-256 哈希处理
5. 格式化：XXXX-XXXX-XXXX-XXXX
```

**安全性**：
- 多层哈希增加破解难度
- 应用特定 Salt 防止跨应用使用
- 版本绑定防止版本回退攻击

### 3.3 注册码验证

验证流程：
```dart
1. 获取当前设备机器码
2. 使用相同算法生成期望注册码
3. 与输入注册码对比（忽略大小写）
4. 返回验证结果
```

## 4. 时间检测机制

### 4.1 时间获取策略

系统采用智能时间获取策略，平衡准确性和性能：

#### 4.1.1 互联网时间请求规则

- **请求间隔**：距离上次请求超过 10 分钟才允许再次请求
- **请求超时**：5 秒超时限制
- **失败处理**：请求失败时使用本地时间并缓存

#### 4.1.2 时间对比策略

**场景 1：可以请求互联网时间（超过 10 分钟）**
```
1. 检查网络连接
2. 如果在线，请求互联网时间
   - 成功：使用互联网时间，更新缓存
   - 失败：使用本地时间，更新缓存
3. 使用获取的时间进行对比
```

**场景 2：不需要请求互联网时间（未超过 10 分钟）**
```
1. 获取本地时间
2. 获取缓存时间
3. 对比时间 = max(本地时间, 缓存时间)
4. 使用对比时间进行授权验证
```

**设计原理**：
- 使用最大值确保时间不会回退（防止用户修改系统时间）
- 缓存机制减少网络请求，提升性能
- 10 分钟间隔平衡准确性和资源消耗

### 4.2 时间缓存机制

#### 4.2.1 缓存数据结构

```dart
_cachedNetworkTime: DateTime?        // 缓存的互联网时间
_lastNetworkTimeRequest: DateTime?   // 上次请求时间的时间戳
```

#### 4.2.2 缓存存储

- **存储位置**：`PrefsAppBank`（SharedPreferences）
- **存储键**：
  - `license_cached_network_time`
  - `license_last_network_time_request`
- **序列化格式**：ISO 8601 字符串

#### 4.2.3 缓存更新时机

1. 成功获取互联网时间后
2. 请求失败时（使用本地时间更新）
3. 应用启动时从存储加载

## 5. 注册流程

### 5.1 注册状态

系统默认处于**未注册**状态，需要用户输入注册码完成注册。

### 5.2 注册流程

```
用户输入注册码
    │
    ▼
获取设备机器码
    │
    ▼
验证注册码有效性
    │
    ├─ 无效 → 返回错误
    │
    └─ 有效 → 计算过期时间（当前时间 + 365 天）
            │
            ▼
        保存注册信息
            │
            - isRegistered: true
            - registrationCode: 注册码
            - registrationTime: 注册时间
            - expirationTime: 过期时间
            │
            ▼
        更新内存状态
            │
            ▼
        返回成功
```

### 5.3 注册信息存储

**存储键**：
- `license_is_registered`: bool
- `license_registration_code`: String
- `license_registration_time`: String (ISO 8601)
- `license_expiration_time`: String (ISO 8601)

## 6. 授权验证流程

### 6.1 验证触发时机

1. **应用启动**：`BankAppInitializer.initialize()` 调用
2. **应用恢复**：`AppLifecycleState.resumed`
3. **应用分离**：`AppLifecycleState.detached`
4. **周期性检查**：每 5 分钟自动检查一次
5. **登录时**：用户登录前验证

### 6.2 验证流程

```
checkLicenseValidity()
    │
    ├─ 未注册 → 返回 false
    │
    └─ 已注册
        │
        ▼
    验证设备机器码
        │
        ├─ 机器码不匹配 → 触发过期处理
        │
        └─ 机器码匹配
            │
            ▼
        获取当前时间（智能策略）
            │
            ▼
        对比过期时间
            │
            ├─ 已过期 → 触发过期处理
            │
            └─ 未过期 → 返回 true
```

### 6.3 设备变更检测

系统会验证当前设备机器码是否与注册时的机器码匹配：

- **匹配**：继续验证时间
- **不匹配**：视为设备变更或注册码无效，触发过期处理

**应用场景**：
- 设备硬件更换
- 系统重装
- 注册码被复制到其他设备

## 7. 授权过期处理

### 7.1 过期检测

过期条件：
1. 当前时间 > 过期时间
2. 设备机器码与注册时不一致

### 7.2 过期处理流程

```
检测到过期
    │
    ▼
清除所有存储数据
    │
    ├─ PrefsAppBank: 清除所有键值
    │
    └─ UnifiedStorage:
        - 清除 'bank_app' 存储
        - 清除 'bank_app_user' 存储
        - 清除缓存
    │
    ▼
重置内存状态
    │
    - isRegistered: false
    - registrationCode: null
    - expirationTime: null
    - cachedNetworkTime: null
    - lastNetworkTimeRequest: null
    │
    ▼
触发过期回调
    │
    ▼
跳转到登录页面
```

### 7.3 数据清理范围

**完全清理**：
- 所有应用配置
- 用户数据
- 缓存数据
- 注册信息
- 时间缓存

**设计目的**：确保过期后应用回到初始状态，防止数据泄露。

## 8. 生命周期集成

### 8.1 初始化

**位置**：`BankAppInitializer.initialize()`

**流程**：
```dart
1. 创建 LicenseRegistrationManager 实例
2. 注册过期回调（跳转到登录页）
3. 加载注册状态
4. 添加生命周期观察者
5. 启动周期性检查
6. 立即执行一次验证
```

### 8.2 生命周期监听

**实现**：`WidgetsBindingObserver.didChangeAppLifecycleState()`

**监听事件**：
- `AppLifecycleState.resumed`：应用恢复前台
- `AppLifecycleState.detached`：应用分离

**处理逻辑**：
- 调用 `checkLicenseValidity()` 检测授权
- **注意**：不主动请求时间，由内部逻辑根据 10 分钟间隔决定

### 8.3 周期性检查

**间隔**：每 5 分钟

**实现**：`Timer.periodic(Duration(minutes: 5))`

**作用**：定期检测授权状态，及时发现过期情况

## 9. 数据存储

### 9.1 存储位置

- **主要存储**：`PrefsAppBank` (SharedPreferences)
- **辅助存储**：`UnifiedStorage` (机器码持久化)

### 9.2 存储键定义

| 键名 | 类型 | 说明 |
|------|------|------|
| `license_is_registered` | bool | 是否已注册 |
| `license_registration_code` | String | 注册码 |
| `license_registration_time` | String | 注册时间（ISO 8601） |
| `license_expiration_time` | String | 过期时间（ISO 8601） |
| `license_cached_network_time` | String | 缓存的互联网时间（ISO 8601） |
| `license_last_network_time_request` | String | 上次请求时间的时间戳（ISO 8601） |

### 9.3 数据加载

**时机**：`_loadRegistrationState()`

**流程**：
1. 初始化 `PrefsAppBank`
2. 加载所有注册相关键值
3. 解析时间字符串为 `DateTime`
4. 更新内存状态

## 10. API 接口

### 10.1 LicenseRegistrationManager

#### 10.1.1 initialize()

```dart
Future<void> initialize({Function()? onLicenseExpired})
```

**功能**：初始化管理器

**参数**：
- `onLicenseExpired`：授权过期时的回调函数

**调用时机**：应用启动时

#### 10.1.2 register()

```dart
Future<bool> register(String registrationCode)
```

**功能**：注册设备

**参数**：
- `registrationCode`：用户输入的注册码

**返回值**：
- `true`：注册成功
- `false`：注册失败（注册码无效）

#### 10.1.3 checkLicenseValidity()

```dart
Future<bool> checkLicenseValidity()
```

**功能**：检查授权有效性

**返回值**：
- `true`：授权有效
- `false`：授权无效或已过期

**副作用**：如果检测到过期，会自动触发过期处理流程

#### 10.1.4 属性访问器

```dart
bool get isRegistered           // 是否已注册
String? get registrationCode    // 注册码
DateTime? get expirationTime    // 过期时间
```

### 10.2 DeviceUtils

#### 10.2.1 getMachineCode()

```dart
static Future<String> getMachineCode()
```

**功能**：获取设备唯一机器码

**返回值**：16 位大写十六进制字符串

**特性**：
- 首次调用会生成并持久化
- 后续调用直接返回缓存值

#### 10.2.2 generateRegistrationCode()

```dart
static String generateRegistrationCode(String machineCode)
```

**功能**：根据机器码生成注册码

**参数**：
- `machineCode`：设备机器码

**返回值**：格式化的注册码（XXXX-XXXX-XXXX-XXXX）

#### 10.2.3 validateRegistrationCode()

```dart
static bool validateRegistrationCode(String machineCode, String registrationCode)
```

**功能**：验证注册码是否有效

**参数**：
- `machineCode`：设备机器码
- `registrationCode`：待验证的注册码

**返回值**：
- `true`：有效
- `false`：无效

## 11. 安全考虑

### 11.1 设备绑定安全

- **机器码生成**：基于设备硬件特征，难以伪造
- **注册码加密**：多层哈希加密，防止逆向
- **设备验证**：每次验证都检查设备机器码

### 11.2 时间安全

- **互联网时间**：使用权威时间服务器，防止时间篡改
- **时间对比策略**：使用最大值，防止时间回退攻击
- **缓存机制**：减少网络请求，但保持时间准确性

### 11.3 数据安全

- **过期清理**：过期后完全清除数据，防止信息泄露
- **存储加密**：使用系统提供的安全存储机制
- **状态验证**：多重验证确保授权有效性

## 12. 性能优化

### 12.1 网络请求优化

- **请求间隔**：10 分钟间隔，避免频繁请求
- **超时控制**：5 秒超时，快速失败
- **缓存策略**：缓存互联网时间，减少网络依赖

### 12.2 存储优化

- **机器码缓存**：内存缓存，避免重复计算
- **状态加载**：启动时一次性加载所有状态
- **延迟初始化**：按需初始化存储组件

### 12.3 检测优化

- **周期性检查**：5 分钟间隔，平衡及时性和性能
- **生命周期触发**：关键节点检测，避免遗漏
- **异步处理**：所有 I/O 操作异步执行，不阻塞 UI

## 13. 错误处理

### 13.1 网络错误

- **连接失败**：使用本地时间作为后备
- **请求超时**：5 秒超时，使用本地时间
- **解析错误**：记录日志，使用本地时间

### 13.2 存储错误

- **初始化失败**：记录日志，使用默认值
- **读写失败**：记录日志，尝试恢复
- **数据损坏**：清除损坏数据，重新初始化

### 13.3 设备信息错误

- **获取失败**：使用后备方案生成随机机器码
- **平台不支持**：使用通用后备方案
- **权限不足**：使用可用信息，降级处理

## 14. 测试建议

### 14.1 单元测试

- 机器码生成算法
- 注册码生成和验证
- 时间对比逻辑
- 缓存机制

### 14.2 集成测试

- 完整注册流程
- 授权验证流程
- 过期处理流程
- 生命周期集成

### 14.3 场景测试

- 网络断开场景
- 时间修改场景
- 设备变更场景
- 应用重装场景

## 15. 未来改进

### 15.1 功能增强

- 支持多设备授权
- 支持授权延期
- 支持授权撤销
- 支持授权统计

### 15.2 安全增强

- 增加授权签名验证
- 增加服务器端验证
- 增加授权日志记录
- 增加异常行为检测

### 15.3 性能优化

- 优化时间服务器选择
- 增加时间服务器容错
- 优化缓存策略
- 减少存储读写次数

## 16. 相关文件

### 16.1 核心文件

- `lib/apps/app_bank/managers_app_bank/license_registration_manager.dart`
- `lib/common/utils/device_utils.dart`
- `lib/apps/app_bank/helpers/bank_app_initializer.dart`

### 16.2 配置文件

- `lib/apps/app_bank/config_app_bank/prefs_app_bank.dart`
- `lib/common/storage/unified_storage.dart`
- `lib/common/network/utils/network_utils.dart`

### 16.3 UI 文件

- `lib/apps/app_bank/features_app_bank/authentication/views/authentication_screen.dart`

## 17. 版本历史

### v1.0.0 (2026-01-24)

- 初始版本
- 实现基础注册和验证功能
- 实现时间检测机制
- 实现生命周期集成
- 实现智能时间缓存策略

---

**文档版本**：1.0.0  
**最后更新**：2026-01-24  
**维护者**：开发团队
