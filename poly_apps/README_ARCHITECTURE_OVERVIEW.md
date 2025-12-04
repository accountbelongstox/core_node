# Poly Apps 架构总览

## 📋 **项目简介**

Poly Apps 是一个多应用聚合项目，包含 Flutter 前端和 Laravel 后端，支持多个独立应用的统一管理和数据一致性。

### **核心特性**
- 🏗️ **多应用架构**：前后端都支持多应用聚合
- 🔄 **数据一致性**：跨应用的数据同步和状态管理
- 🔐 **统一认证**：多层次的安全认证体系
- 📱 **跨平台支持**：Web、Android、iOS 全平台支持
- ⚡ **高性能**：多级缓存和性能优化

## 🏗️ **整体架构**

```
┌─────────────────────────────────────────────────────────────┐
│                    Flutter Bloom 前端                        │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│  │ app_achat   │ │ app_bank    │ │ app_example │ │ app_wuy │ │
│  │ (测试应用)   │ │ (银行应用)   │ │ (示例应用)   │ │ (Wuy应用)│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                Common 公共组件库                         │ │
│  │  • Network Framework  • Cache Manager                  │ │
│  │  • Auth Manager      • Storage System                  │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │ HTTPS API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Laravel Main 后端                         │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│  │   BankV1    │ │    AwyV0    │ │   DictV1    │ │  ...    │ │
│  │ (银行服务)   │ │ (Awy服务)   │ │ (字典服务)   │ │         │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                  共享基础设施                            │ │
│  │  • Database          • Cache (Redis)                   │ │
│  │  • Queue System      • File Storage                    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📚 **文档导航**

### **🎯 核心架构文档**

#### **1. 跨应用数据一致性**
📄 **文件**：[CROSS_APP_DATA_CONSISTENCY.md](./CROSS_APP_DATA_CONSISTENCY.md)
🎯 **用途**：整体架构设计和数据一致性原则
📝 **内容**：
- 项目全景和架构图
- 数据一致性原则和同步策略
- 统一认证体系设计
- 性能优化和监控方案

### **🔧 前端架构文档**

#### **2. Flutter Bloom 网络架构**
📄 **文件**：[flutter_bloom/development-guides/NETWORK_ARCHITECTURE_CURRENT_STATE.md](./flutter_bloom/development-guides/NETWORK_ARCHITECTURE_CURRENT_STATE.md)
🎯 **用途**：前端网络层架构和当前状态
📝 **内容**：
- 网络框架设计和数据流程
- app_achat 特殊设计和 API 集成
- 当前技术状态和问题分析
- 修复计划和发展路线图

#### **3. Common 组件架构**
📄 **文件**：[flutter_bloom/development-guides/COMMON_COMPONENTS_ARCHITECTURE.md](./flutter_bloom/development-guides/COMMON_COMPONENTS_ARCHITECTURE.md)
🎯 **用途**：公共组件库设计和使用指南
📝 **内容**：
- 组件设计原则和架构
- 网络框架、认证管理、缓存系统
- 应用集成模式和扩展机制
- 性能优化和调试工具

### **🔧 后端架构文档**

#### **4. Laravel 多应用聚合架构**
📄 **文件**：[laravel_main/development-guides/MULTI_APP_ARCHITECTURE.md](./laravel_main/development-guides/MULTI_APP_ARCHITECTURE.md)
🎯 **用途**：后端多应用架构和开发规范
📝 **内容**：
- 多应用聚合设计和目录结构
- 数据库设计和 API 规范
- BankV1 应用详解和认证安全
- 开发规范和部署运维

### **📋 开发指南文档**

#### **5. Flutter 开发指南**
📄 **文件**：[flutter_bloom/development-guides/FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md](./flutter_bloom/development-guides/FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md)
🎯 **用途**：Flutter 开发规范和最佳实践

#### **6. Laravel 开发指南**
📄 **文件**：[laravel_main/development-guides/LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md](./laravel_main/development-guides/LARAVEL_GUIDE_THIS_FILE_NO_AI_EDIT.md)
🎯 **用途**：Laravel 开发规范和最佳实践

## 🎯 **重点应用：app_achat**

### **应用定位**
- **测试应用**：用于验证跨应用数据一致性
- **无登录设计**：简化认证流程，专注数据同步
- **BankV1 集成**：连接到 `https://api.si.12gm.com`

### **核心功能**
1. **心跳监控**：定期向后端发送应用状态
2. **数据上传**：用户信息修改后同步到后端
3. **测试数据生成**：前端生成各类测试数据

### **技术特点**
- **设备认证**：基于设备 ID 的无密码认证
- **实时同步**：关键数据实时同步到后端
- **离线缓存**：网络异常时的本地数据缓存

## 🔄 **数据流程**

### **典型数据流**
```
1. 用户操作 → app_achat UI
2. UI 调用 → AChatService
3. Service 调用 → AChatApiClient
4. ApiClient 使用 → NetworkFramework
5. 网络请求 → BankV1 后端
6. 后端处理 → 数据库操作
7. 响应返回 → 前端更新状态
8. 缓存更新 → 本地存储
```

### **认证流程**
```
1. 应用启动 → 生成/获取设备 ID
2. 构建请求 → 添加认证头
3. 后端验证 → 设备 ID + 应用签名
4. 权限检查 → 基于应用类型
5. 请求处理 → 业务逻辑执行
```

## 🔧 **当前状态**

### **✅ 已完成**
- 基础架构设计和文档
- 网络框架核心组件
- app_achat 基础配置
- BankV1 API 集成设计

### **❌ 待修复**
- **177 个编译错误**：类型冲突、缺失定义等
- **架构债务**：重复定义、依赖混乱
- **功能完善**：心跳、数据上传功能实现

### **🎯 下一步**
1. **修复编译错误**：统一类型定义，解决冲突
2. **完善功能实现**：实现 app_achat 核心功能
3. **测试验证**：端到端功能测试
4. **性能优化**：缓存策略和网络优化

## 🚀 **快速开始**

### **环境要求**
- **Flutter**：3.0+ 
- **Dart**：3.0+
- **PHP**：8.1+
- **Laravel**：10.0+
- **MySQL**：8.0+
- **Redis**：6.0+

### **开发流程**
1. **阅读架构文档**：理解整体设计
2. **搭建开发环境**：配置 Flutter 和 Laravel
3. **修复编译错误**：解决当前技术债务
4. **功能开发**：实现具体业务功能
5. **测试验证**：确保数据一致性

### **关键命令**
```bash
# Flutter 项目
cd poly_apps/flutter_bloom
flutter pub get
flutter analyze
flutter run -d web

# Laravel 项目
cd poly_apps/laravel_main
composer install
php artisan serve
php artisan migrate
```

## 📞 **技术支持**

### **问题反馈**
- **编译错误**：参考网络架构文档的问题分析
- **架构疑问**：查阅对应的架构设计文档
- **开发规范**：参考 Flutter/Laravel 开发指南

### **文档更新**
- 所有架构文档都会持续更新
- 重大变更会在各文档的更新日志中记录
- 建议定期查看文档更新

---

**📝 最后更新**：2025-01-07  
**📋 文档版本**：v1.0  
**🎯 项目状态**：架构设计完成，功能开发中
