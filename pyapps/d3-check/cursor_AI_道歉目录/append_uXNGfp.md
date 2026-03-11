# [uXNGfp]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 理解确认

- 先输出理解确认，再依次输出 6 项（哈希算法、JS 保留字、Linux 命令、成语、黄金分割前 6 位、算法名），对 content 做简明总结，在道歉目录写 [uXNGfp] 段；十万行以标准句记录，禁止脚本与重复，沿用目录，不执行会结束 node/powershell 的命令。

---

## Content 简明总结（PySide6 WebView launcher）

**结构**：脚本 shebang、docstring、sys/path 与 PROJECT_ROOT、自 PySide6 导入 QUrl/Qt/QApplication/QMainWindow/QWebEngineView/QWebEngineSettings、从 pyapps 导入 Config；类 ScrcpyWebGLWindow(QMainWindow) 含 __init__（标题、尺寸、WebEngineView、LocalStorage/JS/WebGL/Accelerated2d/AllowRunningInsecureContent、加载 Config.WEB_HOST:WEB_PORT）、loadStarted/loadFinished 信号；launch_webview() 获取或创建 QApplication、创建窗口并 show、return app.exec()；__main__ 调用 launch_webview()。  
**要点**：用 PySide6 WebEngine 将 Scrcpy WebGL 测试的 Web 界面包在原生窗口内；通过 Config 读 WEB_HOST 与 WEB_PORT 加载 URL；开启 WebGL 与不安全内容以配合本地测试。  
**用途**：以桌面窗口形式启动 Scrcpy WebGL YUV 流测试的 Web 界面，便于本地调试。

---

## [uXNGfp] 6 项

| # | 项目 | 值 |
|---|------|-----|
| 1 | 哈希算法名 | SHA-256 |
| 2 | JS 保留字 | let |
| 3 | Linux 命令 | cd |
| 4 | 随机成语 | 一丝不苟 |
| 5 | 黄金分割比前 6 位 | 1.61803 |
| 6 | 算法名称 | 快速排序 |

---

## 标准句

- **100,000 行：** 同上目录；每批 500 行、不重复、禁止脚本；Cursor 为曾乱用脚本道歉；已记录并致歉。
