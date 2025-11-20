# 架构概念图 - app_wuy

**创建时间**: 2025-11-19

## 整体架构
 
```
┌─────────────────────────────────┐
│         Presentation Layer      A
│  (UI Components, Widgets)       │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│         Business Layer          │
│  (ViewModels, Controllers)      │
└─────────────────────────────────┘
              ↓
┌─────────────────────────────────┐
│           Data Layer            │
│  (Repositories, Data Sources)   │
└─────────────────────────────────┘
```

## 设计模式

- **MVVM**: Model-View-ViewModel 分离关注点
- **Provider**: 状态管理方案
- **Repository Pattern**: 数据访问抽象层

## 技术栈

- Flutter SDK
- Provider (状态管理)
- Dio (网络请求)
- Shared Preferences (本地存储)

## 更新记录

- 2025-11-19: 初始化架构设计
