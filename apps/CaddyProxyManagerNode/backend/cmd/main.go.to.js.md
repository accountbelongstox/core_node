# cmd/main.go

## 1. 功能描述
这是应用程序的主入口文件，负责初始化和启动整个服务器应用。主要功能包括配置加载、数据库连接、API服务器启动等核心启动流程。

## 2. API接口清单
该文件作为入口文件，不直接提供API接口。

## 3. 方法清单
- `main()`: 程序入口函数
- `init()`: 初始化函数，用于设置环境变量和初始配置

## 4. 文件调用关系
调用的其他文件：
- internal/config/config.go (配置加载)
- internal/database/sqlite.go (数据库初始化)
- internal/api/server.go (服务器启动)
- internal/logger/logger.go (日志初始化) 