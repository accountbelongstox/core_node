# Common 组件架构设计

## 📋 **设计原则**

### **核心约束**
1. **隔离性**：`lib/common/` 目录不能引入非common文件
2. **通用性**：所有组件必须适用于多个应用
3. **可配置性**：通过配置适应不同应用需求
4. **向下兼容**：保持API稳定性

### **依赖方向**
```
Apps (app_achat, app_bank, etc.)
    ↓ 可以引用
Common Components
    ↓ 只能引用
External Packages & Dart Core
```

## 🏗️ **组件架构**

### **目录结构**
```
lib/common/
├── network/                 # 网络框架
│   ├── core/               # 核心组件
│   ├── auth/               # 认证管理
│   ├── models/             # 数据模型
│   ├── client/             # 网络客户端
│   ├── cache/              # 缓存（已迁移）
│   ├── interceptors/       # 拦截器
│   ├── security/           # 安全组件
│   └── widgets/            # UI组件
├── cache_manager/          # 缓存管理（统一位置）
├── storage/                # 存储组件
├── utils/                  # 工具类
└── widgets/                # 通用UI组件
```

## 🔧 **核心组件详解**

### **1. 网络框架 (network/)**

#### **核心类**
- **NetworkFramework**：全局网络框架管理器
- **BaseNetworkConfig**：抽象网络配置基类
- **UnifiedAuthManager**：统一认证管理器
- **SimpleNetworkClient**：简化网络客户端

#### **设计模式**
- **单例模式**：NetworkFramework, UnifiedAuthManager
- **工厂模式**：NetworkClient创建
- **策略模式**：不同认证策略
- **观察者模式**：网络状态监听

#### **配置机制**
```dart
// 抽象基类 - 定义接口
abstract class BaseNetworkConfig {
  String get baseUrl;
  AuthConfig get authConfig;
  bool get enableCache;
  // ...
}

// 应用特定实现
class ApiConfigAchat extends BaseNetworkConfig {
  @override
  String get baseUrl => 'https://api.si.12gm.com';
  // ...
}
```

### **2. 认证管理 (network/auth/)**

#### **UnifiedAuthManager**
- **职责**：统一管理所有应用的认证状态
- **特性**：支持多种认证类型（Bearer, API Key, Custom）
- **存储**：使用SecureStorage安全存储认证信息

#### **认证流程**
```
初始化 → 配置认证类型 → 设置用户提供者 → 处理认证请求
```

#### **支持的认证类型**
- **None**：无认证（如app_achat）
- **Bearer**：JWT Token认证
- **ApiKey**：API密钥认证
- **Custom**：自定义认证头

### **3. 缓存管理 (cache_manager/)**

#### **CacheManager**
- **位置**：`lib/common/cache_manager/cache_manager.dart`
- **职责**：统一管理所有类型的缓存
- **特性**：内存缓存 + 持久化缓存

#### **缓存策略**
- **网络优先**：优先使用网络数据
- **缓存优先**：优先使用缓存数据
- **仅缓存**：只使用缓存数据
- **仅网络**：只使用网络数据

### **4. 数据模型 (network/models/)**

#### **核心模型**
- **NetworkResponse<T>**：统一网络响应格式
- **ApiResponse<T>**：API响应包装
- **NetworkRequest**：网络请求配置

#### **类型安全**
```dart
// 泛型支持
NetworkResponse<UserProfile> response = await apiClient.getProfile();
if (response.isSuccess) {
  UserProfile profile = response.data!;
}
```

## 🔄 **数据流设计**

### **请求流程**
```
1. App调用Service
2. Service构建NetworkRequest
3. NetworkClient处理请求
4. 认证拦截器添加认证头
5. 缓存拦截器检查缓存
6. HTTP请求发送
7. 响应处理和缓存
8. 返回统一格式数据
```

### **错误处理**
```
网络错误 → 错误拦截器 → 统一错误格式 → 应用层处理
```

### **加载状态**
```
请求开始 → 显示加载 → 请求完成 → 隐藏加载
```

## 🎯 **应用集成模式**

### **配置注入**
```dart
// 应用启动时
await NetworkFramework.initialize(
  config: ApiConfigAchat(), // 应用特定配置
);
```

### **服务层集成**
```dart
class AChatService {
  final AChatApiClient _apiClient = AChatApiClient();
  
  Future<void> sendHeartbeat() async {
    final response = await _apiClient.heartbeat();
    // 处理响应
  }
}
```

### **UI层集成**
```dart
class ProfilePage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder<UserProfile>(
      future: AChatService().getProfile(),
      builder: (context, snapshot) {
        // UI构建
      },
    );
  }
}
```

## 🔧 **扩展机制**

### **添加新应用**
1. 创建应用特定配置类
2. 实现BaseNetworkConfig接口
3. 创建应用特定ApiClient
4. 配置认证策略

### **添加新认证类型**
1. 扩展AuthType枚举
2. 在UnifiedAuthManager中添加处理逻辑
3. 更新认证拦截器

### **添加新缓存策略**
1. 扩展CacheStrategy枚举
2. 在CacheManager中实现策略
3. 更新缓存拦截器

## 📊 **性能优化**

### **缓存优化**
- **智能缓存**：根据数据类型自动选择缓存策略
- **缓存预热**：应用启动时预加载常用数据
- **缓存清理**：定期清理过期缓存

### **网络优化**
- **请求合并**：合并相似请求
- **连接复用**：HTTP连接池
- **压缩传输**：Gzip压缩

### **内存优化**
- **弱引用**：避免内存泄漏
- **对象池**：复用网络对象
- **懒加载**：按需初始化组件

## 🔍 **监控和调试**

### **日志系统**
- **分级日志**：Debug, Info, Warning, Error
- **结构化日志**：JSON格式便于分析
- **性能日志**：请求耗时统计

### **调试工具**
- **网络监控**：请求/响应详情
- **缓存查看器**：缓存内容检查
- **认证状态**：认证信息查看

## 🚀 **未来规划**

### **短期目标**
1. 修复当前编译错误
2. 完善类型定义
3. 统一配置系统

### **中期目标**
1. 添加更多认证类型
2. 优化缓存策略
3. 完善错误处理

### **长期目标**
1. 支持离线模式
2. 添加数据同步
3. 实现智能重试
