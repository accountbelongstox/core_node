# Matrix Application - Startup Flow

## 概述

Matrix 应用已升级为使用 **启动窗口 (Python原生tkinter) + PySide6主应用** 的架构。

---

## 🚀 启动命令

```bash
python pymain.py app=matrix
```

---

## 📋 启动流程详解

### 阶段 1: 启动窗口（Python原生 - tkinter）

**特点**:
- Python原生（tkinter）- 无外部依赖
- 实时显示日志和进度
- 最小显示时间: 2秒

**功能**:
1. 显示应用名称
2. 检查并安装依赖
3. 捕获ColorPrint输出

### 阶段 2: 启动服务

**启动的服务**:
- Frontend (Nuxt dev server)
- Backend (FastAPI server)

### 阶段 3: PySide6 主UI（带loading页面）

**特点**:
- PySide6框架
- 无边框窗口 + 自定义标题栏
- Loading动画（14种样式）
- WebView加载前端
- 系统托盘集成

---

## 🔧 技术架构

### 线程模型

- Main Thread (Qt Event Loop)
- Tick Thread (后台定时器，1秒间隔)

### 组件架构

```
pymain.py → matrix_main.py::start() → launch_app_with_startup()
    ├─ 显示启动窗口 (tkinter)
    ├─ 检查依赖
    └─ 调用 main_app_entry()
        ├─ 启动 Matrix Services
        ├─ 创建 PySide6Framework
        └─ app.start()
```

---

**更新日期**: 2025-11-10
**版本**: v2.0 (PySide6 + 启动窗口)
