# Flutter Bloom 网络架构当前状态

## 📋 **项目概述**

### **项目结构**
```
poly_apps/
├── flutter_bloom/           # Flutter 多应用前端
│   ├── lib/
│   │   ├── common/         # 公共组件库（不能引入非common文件）
│   │   │   ├── network/    # 网络框架
│   │   │   └── cache_manager/ # 缓存管理
│   │   └── apps/           # 各个应用
│   │       ├── app_achat/  # 测试应用（无需登录）
│   │       ├── app_bank/   # 银行应用
│   │       ├── app_example/
│   │       ├── app_main/
│   │       └── app_wuy/
└── laravel_main/           # Laravel 多应用后端
    └── app/Apps/           # 应用聚合结构
        ├── BankV1/         # 银行应用V1
        ├── AwyV0/          # Awy应用V0
        └── DictV1/         # 字典应用V1
```

## 🏗️ **架构设计原则**

### **前端架构（Flutter）**
1. **多应用单体架构**：一个Flutter项目包含多个独立应用
2. **公共组件隔离**：`lib/common/` 目录不能引入非common文件
3. **应用独立配置**：每个app有自己的配置、服务、模型
4. **统一网络框架**：所有app共享网络基础设施

### **后端架构（Laravel）**
1. **多应用聚合**：单个Laravel项目支持多个业务应用
2. **版本化管理**：每个应用有版本后缀（如BankV1, AwyV0）
3. **共享数据库**：使用表前缀区分不同应用的数据
4. **统一API路由**：`/api/{appname}/` 路径模式

## 🔄 **当前数据流程**

### **1. 应用初始化流程**
```
App启动 → 加载App配置 → 初始化网络框架 → 注册服务 → 启动UI
```

### **2. 网络请求流程**
```
UI组件 → Service层 → ApiClient → NetworkFramework → HTTP请求 → 后端API
```

### **3. 数据缓存流程**
```
网络响应 → CacheManager → 本地存储 → 下次请求优先使用缓存
```

## 📡 **网络层架构**

### **核心组件**
- **NetworkFramework**：全局网络框架管理器
- **UnifiedAuthManager**：统一认证管理器
- **CacheManager**：缓存管理器
- **SimpleNetworkClient**：简化的网络客户端

### **配置层次**
1. **BaseNetworkConfig**：抽象基础配置
2. **App特定配置**：每个app的API配置（如ApiConfigAchat）
3. **运行时配置**：动态调整的网络参数

### **认证机制**
- **无登录应用**：app_achat（测试应用）
- **设备认证**：使用设备ID和应用签名
- **请求头**：X-Device-ID, X-App-Signature, X-Timestamp, X-Platform

## 🎯 **app_achat 特殊设计**

### **功能定位**
- **测试应用**：用于验证后端集成
- **无登录设计**：不需要用户认证
- **BankV1后端**：连接到 `https://api.si.12gm.com`

### **核心功能**
1. **心跳API**：定期向后端发送应用生命周期信息
2. **信息上传**：修改用户信息后上传到API
3. **数据生成**：前端生成测试数据

### **API端点**
- `POST /api/bank/app/open` - 应用启动
- `POST /api/bank/app/close` - 应用关闭  
- `POST /api/bank/app/heartbeat` - 心跳监控
- `GET /api/bank/user/profile` - 获取用户资料
- `PUT /api/bank/user/profile/update` - 更新用户资料

## 🔧 **当前技术状态**

### **已实现功能**
- ✅ 基础网络框架结构
- ✅ 统一认证管理器
- ✅ 缓存管理系统
- ✅ app_achat基础配置
- ✅ BankV1 API集成配置

### **存在的问题**
- ❌ 类型定义冲突（NetworkResponse, NetworkRequest等）
- ❌ 缺失核心类型（RequestPriority, LoadingType等）
- ❌ 方法签名不匹配
- ❌ 多版本网络层混用
- ❌ 177个编译错误待修复

### **架构债务**
1. **重复定义**：同一类型在多个文件中定义
2. **依赖混乱**：引用不存在的类和方法
3. **配置不统一**：全局配置与app配置冲突
4. **版本管理**：network/, network_v1/, network_v2/并存

## 📈 **下一步计划**

### **短期目标（修复编译）**
1. 统一类型定义，解决冲突
2. 补全缺失的方法和类型
3. 简化网络层，只保留一个版本
4. 修复app_achat编译错误

### **中期目标（功能完善）**
1. 完善app_achat的后端集成
2. 实现心跳和数据上传功能
3. 添加错误处理和重试机制
4. 优化缓存策略

### **长期目标（架构优化）**
1. 重构网络层架构
2. 统一配置管理系统
3. 完善文档和测试
4. 支持更多应用接入

## 🔗 **相关文档**
- [Flutter开发指南](./FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md)
- [Laravel开发指南](../../laravel_main/development-guides/LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md)
- [Common组件架构](./COMMON_COMPONENTS_ARCHITECTURE.md)
- [Laravel多应用架构](../../laravel_main/development-guides/MULTI_APP_ARCHITECTURE.md)
- [跨应用数据一致性](../../CROSS_APP_DATA_CONSISTENCY.md)
- [项目文件树](../lib_tree.md)
- [Laravel文件树](../../laravel_main/laravel_main_tree.md)

## 📝 **更新日志**
- **2025-01-07**：创建网络架构当前状态文档
- **2025-01-07**：记录177个编译错误和修复计划
- **2025-01-07**：完成app_achat与BankV1的集成设计
