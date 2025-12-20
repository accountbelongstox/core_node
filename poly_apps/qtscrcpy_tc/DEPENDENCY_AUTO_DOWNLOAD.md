# 自动下载依赖 - 使用指南

本项目实现了ADB和scrcpy-server的自动下载功能，支持两种方式：

## 方案1：编译时自动下载 (PowerShell脚本)

### 功能
- 在编译时自动检查并下载缺失的ADB和scrcpy-server
- 集成在`scripts/build-windows.bat`中，无需手动操作

### 使用方法
直接运行编译脚本即可：
```batch
scripts\build-windows.bat
```

### 单独运行下载脚本
```powershell
# 下载所有依赖
powershell -ExecutionPolicy Bypass -File scripts\download-dependencies.ps1

# 强制重新下载（即使已存在）
powershell -ExecutionPolicy Bypass -File scripts\download-dependencies.ps1 -Force
```

### 下载内容
1. **ADB Platform Tools**
   - 来源：Google官方 (https://dl.google.com/android/repository/platform-tools-latest-windows.zip)
   - 目标：`third_party/adb/win/`
   - 文件：
     - adb.exe
     - AdbWinApi.dll
     - AdbWinUsbApi.dll

2. **scrcpy-server**
   - 来源：GitHub Releases (https://github.com/Genymobile/scrcpy/releases)
   - 版本：v3.3.3
   - 目标：`third_party/scrcpy-server/`
   - 文件：scrcpy-server-v3.3.3

---

## 方案2：运行时自动下载 (C++ Qt Network)

### 功能
- 程序启动时检查依赖
- 如果缺失，自动使用Qt Network下载
- 带进度提示和错误处理

### 在main.cpp中使用

```cpp
#include <QApplication>
#include "mainwindow.h"
#include "dependencydownloader.h"

int main(int argc, char *argv[])
{
    QApplication app(argc, argv);

    // 创建依赖下载器
    DependencyDownloader *downloader = new DependencyDownloader(&app);

    // 连接信号槽
    QObject::connect(downloader, &DependencyDownloader::downloadProgress,
        [](const QString &dep, qint64 received, qint64 total) {
            qInfo() << "下载中:" << dep << received << "/" << total;
        });

    QObject::connect(downloader, &DependencyDownloader::downloadCompleted,
        [](const QString &dep, bool success) {
            if (success) {
                qInfo() << "下载完成:" << dep;
            } else {
                qWarning() << "下载失败:" << dep;
            }
        });

    QObject::connect(downloader, &DependencyDownloader::allDependenciesReady,
        []() {
            qInfo() << "所有依赖已就绪，启动主窗口...";
            // 启动主窗口
            MainWindow *mainWindow = new MainWindow();
            mainWindow->show();
        });

    QObject::connect(downloader, &DependencyDownloader::downloadError,
        [](const QString &dep, const QString &error) {
            qCritical() << "下载错误:" << dep << "-" << error;
        });

    // 开始检查和下载
    downloader->checkAndDownloadDependencies();

    return app.exec();
}
```

### API说明

#### 类：`DependencyDownloader`

**公共方法**

```cpp
// 检查并下载所有依赖
void checkAndDownloadDependencies();

// 检查单个依赖是否存在
bool isAdbPresent();
bool isScrcpyServerPresent();
```

**信号（Signals）**

```cpp
// 下载进度更新
void downloadProgress(const QString &dependency, qint64 bytesReceived, qint64 bytesTotal);

// 单个依赖下载完成
void downloadCompleted(const QString &dependency, bool success);

// 所有依赖准备就绪
void allDependenciesReady();

// 下载错误
void downloadError(const QString &dependency, const QString &errorMessage);
```

---

## 工作流程

### 编译时
```
1. 运行 build-windows.bat
2. 脚本检测Qt和MSVC环境
3. 调用 download-dependencies.ps1
4. 检查 third_party/adb/win/adb.exe
5. 如不存在 → 下载并解压 ADB Platform Tools
6. 检查 third_party/scrcpy-server/scrcpy-server-*
7. 如不存在 → 下载 scrcpy-server
8. 继续编译流程
9. 复制依赖到 output目录
```

### 运行时
```
1. 程序启动
2. 创建 DependencyDownloader 实例
3. 调用 checkAndDownloadDependencies()
4. 检查 applicationDirPath()/adb/adb.exe
5. 检查 applicationDirPath()/scrcpy-server/scrcpy-server-*
6. 如有缺失 → 使用Qt Network下载
7. 下载完成后发出 allDependenciesReady() 信号
8. 启动主窗口
```

---

## 目录结构

```
qtscrcpy_tc/
├── scripts/
│   ├── build-windows.bat          # 编译脚本（已集成自动下载）
│   └── download-dependencies.ps1   # PowerShell下载脚本
├── TcUi/
│   ├── util/
│   │   ├── dependencydownloader.h  # C++下载器头文件
│   │   └── dependencydownloader.cpp # C++下载器实现
│   ├── third_party/                # 源码中的依赖（编译时下载）
│   │   ├── adb/win/
│   │   │   ├── adb.exe
│   │   │   ├── AdbWinApi.dll
│   │   │   └── AdbWinUsbApi.dll
│   │   └── scrcpy-server/
│   │       └── scrcpy-server-v3.3.3
│   └── output/win/x64/release/     # 运行时程序目录
│       ├── 17_TcUi.exe
│       ├── adb/                    # 运行时依赖（从third_party复制）
│       │   ├── adb.exe
│       │   ├── AdbWinApi.dll
│       │   └── AdbWinUsbApi.dll
│       └── scrcpy-server/
│           └── scrcpy-server-v3.3.3
```

---

## 注意事项

1. **网络要求**：需要能访问 Google 和 GitHub
2. **权限要求**：PowerShell脚本需要执行权限
3. **磁盘空间**：ADB约5MB，scrcpy-server约90KB
4. **自动更新**：修改脚本中的版本号即可更新下载的版本

---

## 故障排除

### PowerShell脚本执行失败
```powershell
# 检查执行策略
Get-ExecutionPolicy

# 临时允许脚本执行
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

### Qt Network下载失败
- 检查网络连接
- 检查防火墙设置
- 查看日志输出（qInfo/qWarning/qCritical）
- 使用代理：在代码中设置 `QNetworkProxy`

### 依赖缺失
```batch
# 手动运行下载脚本
cd scripts
powershell -ExecutionPolicy Bypass -File download-dependencies.ps1 -Force
```

---

## 版本信息

- ADB Platform Tools: latest (动态获取最新版)
- scrcpy-server: v3.3.3
- 文档更新日期: 2025-12-19
