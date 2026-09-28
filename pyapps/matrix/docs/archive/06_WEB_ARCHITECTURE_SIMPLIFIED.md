# pyMatrix Web 端简化架构（去Qt版本）

> **专注于 Web 端的轻量级架构 - 使用简单 UI 启动器 + Python 后端 + Nuxt 前端**
>
> 移除所有 PyQt6/OpenGL 相关内容，专注于浏览器投屏方案

---

## 🎯 设计目标

1. **去除 Qt 依赖**：不再使用 PyQt6、OpenGL 等桌面端技术
2. **简单启动器**：使用轻量级 UI（tkinter/PyQt6 最小化窗口）仅用于启动服务
3. **浏览器为主**：所有投屏、控制操作在浏览器中完成
4. **一体化部署**：Nuxt 编译后集成到 Python 项目
5. **统一通信**：遵循 `05_COMMUNICATION_SPECIFICATION.md` 规范

---

## 📐 简化架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      启动器 (Launcher)                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  简单 UI 窗口 (tkinter / PyQt6 minimal)                    │ │
│  │                                                             │ │
│  │  [启动服务] [停止服务] [打开浏览器] [退出]                  │ │
│  │  状态: ● 运行中                                             │ │
│  │  端口: 8000                                                 │ │
│  │  URL: http://localhost:8000                                │ │
│  └─────────────────────┬──────────────────────────────────────┘ │
└────────────────────────┼──────────────────────────────────────┘
                         │ 启动/管理
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Python Backend Server (FastAPI + Uvicorn)          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │  HTTP Server (静态文件 + REST API)                         ││
│  │  - 挂载 Nuxt 编译后的 static/ 目录                         ││
│  │  - 提供设备管理 API                                        ││
│  │  - 健康检查端点                                            ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │  WebSocket Server                                          ││
│  │  - /ws/video/{serial} : 视频流                            ││
│  │  - /ws/control/{serial} : 设备控制                        ││
│  │  - /ws/group : 群控                                       ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │  核心业务层 (Pure Python, No GUI)                         ││
│  │  - DeviceManager: 设备管理                                ││
│  │  - StreamManager: 视频流管理 (PyAV)                       ││
│  │  - ControlManager: 控制消息处理                           ││
│  │  - GroupController: 群控逻辑                              ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │  ADB 通信层                                                ││
│  │  - subprocess 调用 adb 命令                               ││
│  │  - socket 与 scrcpy-server 通信                          ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │   Android Devices    │
              │  (USB/Network ADB)   │
              └──────────────────────┘

                          ▲
                          │ HTTP + WebSocket
┌─────────────────────────┴───────────────────────────────────────┐
│                    Web Browser Client                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │             Nuxt 3 Frontend (静态文件)                     │ │
│  │                                                             │ │
│  │  - 设备列表 UI                                             │ │
│  │  - 视频播放器 (MSE)                                        │ │
│  │  - 虚拟触摸控制                                            │ │
│  │  - 群控管理面板                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📂 项目结构（简化版）

```
pyMatrix/
├── launcher/                       # 启动器（新增）
│   ├── __init__.py
│   ├── ui_launcher.py             # 简单 UI 窗口
│   └── server_manager.py          # 服务管理逻辑
├── core/                           # Python 核心（去除所有 GUI 相关）
│   ├── adb/                        # ADB 通信
│   │   ├── adb_process.py
│   │   └── adb_executor.py
│   ├── device/                     # 设备管理
│   │   ├── device_manager.py
│   │   ├── device_params.py
│   │   └── server/
│   │       ├── server.py
│   │       └── video_socket.py
│   ├── stream/                     # 视频流处理（纯数据处理，无渲染）
│   │   ├── demuxer.py
│   │   ├── decoder.py             # PyAV 解码（无 OpenGL）
│   │   └── video_buffer.py
│   ├── control/                    # 控制模块
│   │   ├── controller.py
│   │   ├── control_msg.py
│   │   └── input_converter.py
│   ├── group/                      # 群控模块
│   │   └── group_controller.py
│   └── web/                        # Web API 层
│       ├── fastapi_app.py         # FastAPI 主应用
│       ├── video_stream_server.py # 视频流 WebSocket
│       ├── control_websocket.py   # 控制 WebSocket
│       └── group_websocket.py     # 群控 WebSocket
├── pyMatrix-web/                   # Nuxt 前端源码
│   ├── components/
│   ├── composables/
│   ├── pages/
│   └── nuxt.config.ts
├── static/                         # Nuxt 编译输出
│   ├── _nuxt/
│   └── index.html
├── resources/                      # 资源文件
│   ├── adb/
│   └── scrcpy-server.jar
├── main.py                         # 启动入口
├── requirements.txt                # Python 依赖（去除 PyQt6/OpenGL）
└── 05_COMMUNICATION_SPECIFICATION.md  # 通信规范
```

---

## 🚀 启动器设计

### 方案选择

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| **tkinter** | Python 标准库，无需额外依赖 | UI 简陋 | ✅ **推荐** |
| **PyQt6 (minimal)** | UI 美观，功能丰富 | 需要额外依赖 | 可选 |
| **无 GUI** | 最轻量 | 缺少直观的启动方式 | 不推荐 |

### 启动器功能

1. **启动/停止服务**：管理 FastAPI 进程
2. **自动打开浏览器**：服务启动后打开 `http://localhost:8000`
3. **显示服务状态**：端口、运行状态、设备数量
4. **系统托盘**（可选）：最小化到托盘

---

## 💻 启动器实现

### 方案 1: tkinter 启动器

```python
# launcher/ui_launcher.py
import tkinter as tk
from tkinter import ttk
import subprocess
import webbrowser
import threading
import requests
from typing import Optional

class PyMatrixLauncher:
    """pyMatrix 启动器（tkinter 版本）"""

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("pyMatrix Web Launcher")
        self.root.geometry("400x300")
        self.root.resizable(False, False)

        self.server_process: Optional[subprocess.Popen] = None
        self.server_running = False
        self.server_port = 8000

        self._setup_ui()

    def _setup_ui(self):
        """构建 UI"""
        # 标题
        title_label = tk.Label(
            self.root,
            text="pyMatrix Web 端",
            font=("Arial", 16, "bold")
        )
        title_label.pack(pady=20)

        # 状态显示
        self.status_frame = tk.Frame(self.root)
        self.status_frame.pack(pady=10)

        tk.Label(self.status_frame, text="服务状态:").grid(row=0, column=0, sticky='w', padx=5)
        self.status_label = tk.Label(
            self.status_frame,
            text="● 未启动",
            fg="red",
            font=("Arial", 10, "bold")
        )
        self.status_label.grid(row=0, column=1, sticky='w')

        tk.Label(self.status_frame, text="端口:").grid(row=1, column=0, sticky='w', padx=5)
        self.port_label = tk.Label(self.status_frame, text=str(self.server_port))
        self.port_label.grid(row=1, column=1, sticky='w')

        tk.Label(self.status_frame, text="访问地址:").grid(row=2, column=0, sticky='w', padx=5)
        self.url_label = tk.Label(
            self.status_frame,
            text=f"http://localhost:{self.server_port}",
            fg="blue",
            cursor="hand2"
        )
        self.url_label.grid(row=2, column=1, sticky='w')
        self.url_label.bind("<Button-1>", lambda e: self._open_browser())

        # 按钮组
        button_frame = tk.Frame(self.root)
        button_frame.pack(pady=20)

        self.start_button = tk.Button(
            button_frame,
            text="启动服务",
            width=12,
            command=self._start_server,
            bg="#4CAF50",
            fg="white",
            font=("Arial", 10, "bold")
        )
        self.start_button.grid(row=0, column=0, padx=5)

        self.stop_button = tk.Button(
            button_frame,
            text="停止服务",
            width=12,
            command=self._stop_server,
            bg="#f44336",
            fg="white",
            font=("Arial", 10, "bold"),
            state=tk.DISABLED
        )
        self.stop_button.grid(row=0, column=1, padx=5)

        self.browser_button = tk.Button(
            button_frame,
            text="打开浏览器",
            width=12,
            command=self._open_browser,
            state=tk.DISABLED
        )
        self.browser_button.grid(row=1, column=0, padx=5, pady=5)

        self.exit_button = tk.Button(
            button_frame,
            text="退出",
            width=12,
            command=self._exit
        )
        self.exit_button.grid(row=1, column=1, padx=5, pady=5)

        # 日志输出
        log_label = tk.Label(self.root, text="日志输出:")
        log_label.pack()

        self.log_text = tk.Text(self.root, height=6, width=45, state=tk.DISABLED)
        self.log_text.pack(padx=10, pady=5)

    def _log(self, message: str):
        """输出日志"""
        self.log_text.config(state=tk.NORMAL)
        self.log_text.insert(tk.END, f"{message}\n")
        self.log_text.see(tk.END)
        self.log_text.config(state=tk.DISABLED)

    def _start_server(self):
        """启动服务"""
        self._log("正在启动 FastAPI 服务...")

        # 启动 FastAPI 进程
        try:
            self.server_process = subprocess.Popen(
                ["python", "main.py", "--mode", "web", "--port", str(self.server_port)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )

            # 等待服务启动
            def wait_for_server():
                import time
                for i in range(30):  # 最多等待 30 秒
                    try:
                        response = requests.get(f"http://localhost:{self.server_port}/api/health", timeout=1)
                        if response.status_code == 200:
                            self.server_running = True
                            self.root.after(0, self._on_server_started)
                            return
                    except:
                        pass
                    time.sleep(1)

                self.root.after(0, lambda: self._log("启动失败，请检查日志"))

            threading.Thread(target=wait_for_server, daemon=True).start()

        except Exception as e:
            self._log(f"启动失败: {e}")

    def _on_server_started(self):
        """服务启动成功后的回调"""
        self._log("✓ FastAPI 服务启动成功")
        self.status_label.config(text="● 运行中", fg="green")
        self.start_button.config(state=tk.DISABLED)
        self.stop_button.config(state=tk.NORMAL)
        self.browser_button.config(state=tk.NORMAL)

        # 自动打开浏览器
        self._open_browser()

    def _stop_server(self):
        """停止服务"""
        if self.server_process:
            self._log("正在停止服务...")
            self.server_process.terminate()
            self.server_process.wait()
            self.server_process = None

        self.server_running = False
        self.status_label.config(text="● 已停止", fg="red")
        self.start_button.config(state=tk.NORMAL)
        self.stop_button.config(state=tk.DISABLED)
        self.browser_button.config(state=tk.DISABLED)
        self._log("✓ 服务已停止")

    def _open_browser(self):
        """打开浏览器"""
        if not self.server_running:
            self._log("请先启动服务")
            return

        url = f"http://localhost:{self.server_port}"
        webbrowser.open(url)
        self._log(f"已打开浏览器: {url}")

    def _exit(self):
        """退出程序"""
        if self.server_running:
            self._stop_server()

        self.root.quit()
        self.root.destroy()

    def run(self):
        """运行启动器"""
        self.root.protocol("WM_DELETE_WINDOW", self._exit)
        self.root.mainloop()


# 程序入口
if __name__ == "__main__":
    launcher = PyMatrixLauncher()
    launcher.run()
```

### 方案 2: PyQt6 最小化启动器（可选）

```python
# launcher/ui_launcher_pyqt.py
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout,
    QPushButton, QLabel, QTextEdit
)
from PyQt6.QtCore import QProcess, QTimer
import sys

class PyMatrixLauncherQt(QMainWindow):
    """pyMatrix 启动器（PyQt6 版本）"""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("pyMatrix Web Launcher")
        self.setFixedSize(450, 350)

        self.server_process = QProcess(self)
        self.server_running = False

        self._setup_ui()

    def _setup_ui(self):
        """构建 UI"""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        layout = QVBoxLayout(central_widget)

        # 标题
        title = QLabel("pyMatrix Web 端")
        title.setStyleSheet("font-size: 18px; font-weight: bold;")
        layout.addWidget(title)

        # 状态标签
        self.status_label = QLabel("服务状态: ● 未启动")
        self.status_label.setStyleSheet("color: red; font-weight: bold;")
        layout.addWidget(self.status_label)

        # 启动按钮
        self.start_button = QPushButton("启动服务")
        self.start_button.clicked.connect(self._start_server)
        layout.addWidget(self.start_button)

        # 停止按钮
        self.stop_button = QPushButton("停止服务")
        self.stop_button.clicked.connect(self._stop_server)
        self.stop_button.setEnabled(False)
        layout.addWidget(self.stop_button)

        # 打开浏览器按钮
        self.browser_button = QPushButton("打开浏览器")
        self.browser_button.clicked.connect(self._open_browser)
        self.browser_button.setEnabled(False)
        layout.addWidget(self.browser_button)

        # 日志输出
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        layout.addWidget(self.log_text)

    def _start_server(self):
        """启动服务"""
        self._log("正在启动 FastAPI 服务...")

        self.server_process.start("python", ["main.py", "--mode", "web", "--port", "8000"])

        # 监听进程输出
        self.server_process.readyReadStandardOutput.connect(self._on_output)
        self.server_process.readyReadStandardError.connect(self._on_error)

        # 等待启动
        QTimer.singleShot(3000, self._check_server_status)

    def _check_server_status(self):
        """检查服务状态"""
        # 检查服务是否启动（简化版，实际应该发 HTTP 请求）
        if self.server_process.state() == QProcess.ProcessState.Running:
            self._on_server_started()

    def _on_server_started(self):
        """服务启动成功"""
        self._log("✓ FastAPI 服务启动成功")
        self.server_running = True
        self.status_label.setText("服务状态: ● 运行中")
        self.status_label.setStyleSheet("color: green; font-weight: bold;")
        self.start_button.setEnabled(False)
        self.stop_button.setEnabled(True)
        self.browser_button.setEnabled(True)

        # 自动打开浏览器
        self._open_browser()

    def _stop_server(self):
        """停止服务"""
        self._log("正在停止服务...")
        self.server_process.terminate()
        self.server_process.waitForFinished()

        self.server_running = False
        self.status_label.setText("服务状态: ● 已停止")
        self.status_label.setStyleSheet("color: red; font-weight: bold;")
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(False)
        self.browser_button.setEnabled(False)
        self._log("✓ 服务已停止")

    def _open_browser(self):
        """打开浏览器"""
        import webbrowser
        webbrowser.open("http://localhost:8000")
        self._log("已打开浏览器")

    def _on_output(self):
        """处理标准输出"""
        output = self.server_process.readAllStandardOutput().data().decode()
        self._log(output)

    def _on_error(self):
        """处理错误输出"""
        error = self.server_process.readAllStandardError().data().decode()
        self._log(f"ERROR: {error}")

    def _log(self, message: str):
        """输出日志"""
        self.log_text.append(message)

    def closeEvent(self, event):
        """关闭窗口事件"""
        if self.server_running:
            self._stop_server()
        event.accept()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    launcher = PyMatrixLauncherQt()
    launcher.show()
    sys.exit(app.exec())
```

---

## 🔧 Python 依赖（简化版）

```txt
# requirements-web-only.txt
# 仅 Web 端依赖，移除所有桌面端依赖

# Web 框架
fastapi>=0.104.0
uvicorn[standard]>=0.24.0

# 视频处理
av>=11.0.0              # PyAV (FFmpeg)
numpy>=1.24.0

# ADB 通信
# 使用 subprocess 调用系统 adb，无需额外依赖

# 数据验证
pydantic>=2.5.0

# 日志
loguru>=0.7.2

# HTTP 客户端（可选，用于健康检查）
requests>=2.31.0

# 启动器 UI（可选）
# tkinter: Python 标准库，无需安装
# PyQt6>=6.6.0  # 如果选择 PyQt6 启动器，取消注释
```

---

## 📦 部署流程

### 开发模式

**终端 1 - Python 后端**：
```bash
pip install -r requirements-web-only.txt
python main.py --mode web --port 8000
```

**终端 2 - Nuxt 前端（开发）**：
```bash
cd pyMatrix-web
npm install
npm run dev
```

**或使用启动器**：
```bash
python launcher/ui_launcher.py
```

### 生产模式

**1. 编译 Nuxt**：
```bash
cd pyMatrix-web
npm run generate
```

**2. 集成到 Python**：
```bash
# 复制编译产物
cp -r pyMatrix-web/.output/public/* static/
```

**3. 启动服务**：
```bash
python main.py --mode web --port 8000
```

**或使用 Docker**：
```bash
docker-compose up -d
```

---

## 🎯 与桌面版的对比

| 功能 | 桌面版 (PyQt6) | Web 版 (简化) |
|------|----------------|---------------|
| **投屏渲染** | OpenGL (本地) | MSE (浏览器) |
| **控制方式** | 鼠标/键盘直接 | WebSocket 转发 |
| **启动方式** | PyQt6 GUI | 轻量启动器 + 浏览器 |
| **延迟** | 30-70ms | 100-300ms |
| **部署** | 需编译/打包 | 一键启动 |
| **多用户** | ❌ | ✅ |
| **跨平台** | 需适配 | 浏览器通用 |
| **依赖** | PyQt6 + OpenGL | FastAPI + Nuxt |

---

## 📊 性能目标

| 指标 | 目标值 |
|------|--------|
| 视频延迟 | < 300ms |
| 控制延迟 | < 100ms |
| 并发设备 | 100 台 |
| 浏览器客户端 | 无限制 |
| 服务器 CPU | < 70% |
| 服务器内存 | < 8GB |

---

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements-web-only.txt
cd pyMatrix-web && npm install && cd ..
```

### 2. 编译前端（首次或更新时）

```bash
cd pyMatrix-web
npm run generate
cp -r .output/public/* ../static/
cd ..
```

### 3. 启动服务

**方式 A - 使用启动器（推荐）**：
```bash
python launcher/ui_launcher.py
```

**方式 B - 命令行**：
```bash
python main.py --mode web --port 8000
```

### 4. 访问

打开浏览器访问：`http://localhost:8000`

---

## 📝 总结

### 架构简化要点

1. **移除 Qt 依赖**：不再需要 PyQt6、OpenGL、QOpenGLWidget 等
2. **轻量启动器**：仅用于启动/停止服务，不涉及投屏渲染
3. **浏览器为主**：所有投屏、控制操作在浏览器完成
4. **统一通信**：遵循 `05_COMMUNICATION_SPECIFICATION.md` 规范
5. **一体化部署**：Nuxt 编译后集成到 Python 项目

### 开发流程

```
编写代码 → 测试（开发模式） → 编译 Nuxt → 集成 → 部署
              ↓                     ↓          ↓
          前后端分离            npm run    复制到   Docker/
          运行测试              generate    static/  systemd
```

---

**文档版本**: 1.0
**创建时间**: 2025-10-30
**适用范围**: pyMatrix Web 端（去 Qt 版本）
**依赖**: Python 3.11+ | FastAPI | Nuxt 3 | MSE
