# Qt 6.10 运行时DLL部署清单

## 已复制的DLL文件

### Qt 6 核心DLL (6个)
输出目录: `TcUi/output/win/x64/release/`

1. **Qt6Core.dll** - Qt核心库（必需）
2. **Qt6Gui.dll** - GUI基础库（必需）
3. **Qt6Widgets.dll** - 控件库（必需）
4. **Qt6Network.dll** - 网络库
5. **Qt6OpenGL.dll** - OpenGL支持
6. **Qt6OpenGLWidgets.dll** - OpenGL控件支持

### FFmpeg DLL (5个)
1. **avcodec-58.dll** - 音视频编解码
2. **avformat-58.dll** - 格式处理
3. **avutil-56.dll** - 工具库
4. **swresample-3.dll** - 音频重采样
5. **swscale-5.dll** - 视频缩放

### Qt 平台插件
输出目录: `TcUi/output/win/x64/release/platforms/`

1. **qwindows.dll** - Windows平台插件（必需，否则程序无法启动）

### 应用程序资源文件

#### ADB工具 (3个文件)
输出目录: `TcUi/output/win/x64/release/adb/`

1. **adb.exe** - Android Debug Bridge主程序
2. **AdbWinApi.dll** - ADB Windows API库
3. **AdbWinUsbApi.dll** - ADB Windows USB API库

#### scrcpy服务器 (1个文件)
输出目录: `TcUi/output/win/x64/release/scrcpy-server/`

1. **scrcpy-server-v3.3.3** - scrcpy服务器程序

#### 配置文件 (1个文件)
输出目录: `TcUi/output/win/x64/release/config/`

1. **config.ini** - 应用程序配置文件

## 总计
- 主目录DLL：11个
- 平台插件：1个
- ADB工具：3个文件
- scrcpy服务器：1个文件
- 配置文件：1个文件
- **总共：17个文件**

## 自动部署配置

### 方式1: 编译时复制 (qmake)
在 `17_TcUi.pro` 的 QMAKE_POST_LINK 中配置：
- **FFmpeg DLLs**
  - 来源：`third_party/ffmpeg/bin/x64/`
  - 目标：`output/win/x64/release/`
  - 时机：编译链接完成后立即复制

### 方式2: 构建脚本复制 (推荐)
在 `scripts/build-windows.bat` 中配置：
- **Qt 6 DLLs** (6个文件)
  - 来源：自动检测的Qt安装目录 `bin/`
  - 目标：`output/win/x64/release/`
  - 文件：Qt6Core.dll, Qt6Gui.dll, Qt6Widgets.dll, Qt6Network.dll, Qt6OpenGL.dll, Qt6OpenGLWidgets.dll

- **Qt平台插件** (1个文件)
  - 来源：Qt安装目录 `plugins/platforms/`
  - 目标：`output/win/x64/release/platforms/`
  - 文件：qwindows.dll

- **ADB工具** (3个文件)
  - 来源：`third_party/adb/win/`
  - 目标：`output/win/x64/release/adb/`
  - 文件：adb.exe, AdbWinApi.dll, AdbWinUsbApi.dll

- **scrcpy服务器** (1个文件)
  - 来源：`third_party/scrcpy-server/`
  - 目标：`output/win/x64/release/scrcpy-server/`
  - 文件：scrcpy-server-v3.3.3

- **配置文件** (1个文件)
  - 来源：`config/`
  - 目标：`output/win/x64/release/config/`
  - 文件：config.ini

运行 `scripts\build-windows.bat` 会自动完成所有DLL和资源文件的复制。
无需手动复制任何文件！

## 可能需要的其他DLL（如果程序报错）

如果程序启动时提示缺少其他DLL，可能需要添加：

### MSVC运行时
- vcruntime140.dll
- vcruntime140_1.dll  
- msvcp140.dll

这些通常已经安装在系统中。如果缺少，可以：
1. 安装 Visual C++ Redistributable 2022
2. 或从 `C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Redist\MSVC\` 复制

### Qt图像格式插件（可选）
如果需要支持更多图片格式：
```
platforms/
imageformats/
  qjpeg.dll
  qgif.dll
  qico.dll
  qsvg.dll
```

## 验证部署

运行以下命令检查所有DLL是否存在：
```bash
cd TcUi/output/win/x64/release
ls -la *.dll
ls -la platforms/
```

## 程序启动测试

直接运行：
```bash
cd TcUi/output/win/x64/release
./17_TcUi.exe
```

如果程序能正常启动，说明所有必需的DLL都已正确部署。

---

日期: 2025-12-19
Qt版本: 6.10.1
状态: ✅ 部署完成
