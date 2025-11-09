# Scrcpy Web Test

基于官方scrcpy的Web界面测试工具。

## 功能

1. **设备扫描** - 自动扫描所有连接的Android设备
2. **Web界面** - 简洁美观的设备管理界面
3. **视频流** - 通过WebSocket传输视频流（待实现）
4. **实时日志** - 显示操作日志和状态

## 安装

```bash
# 安装依赖
pip install -r requirements.txt
```

## 使用

### 方法1: 使用 pymain.py 启动器（推荐）

```bash
# 从项目根目录启动
python pymain.py app=scrcpy_web_test
```

### 方法2: 直接运行服务器

```bash
# 直接运行server.py
python server.py
```

然后在浏览器中打开: http://localhost:27880

## 端口

- HTTP/WebSocket: 27880

## 架构

```
scrcpy_web_test/
├── main.py            # 应用入口点（pymain.py启动器）
├── server.py          # 主服务器（HTTP + WebSocket）
├── index.html         # 前端页面
├── test_server.py     # 服务器功能测试
├── test_stream.py     # 视频流测试
├── requirements.txt   # Python依赖
├── README.md          # 本文件
└── TEST_REPORT.md     # 完整测试报告
```

## 特性

- ✅ ADB设备扫描
- ✅ 设备信息展示
- ✅ WebSocket连接
- ✅ 简洁UI界面
- ✅ Scrcpy视频流集成
- ✅ 自动重连机制
- ✅ **FFmpeg MP4录制（新增）**
- ⏳ H.264视频解码（需要前端解码器）

## 技术栈

- **后端**: Python + aiohttp + pycore ScrcpyDevice
- **前端**: HTML + CSS + JavaScript
- **通信**: WebSocket (binary frames)
- **设备管理**: ADB
- **视频流**: Scrcpy (H.264/H.265)

### scrcpy-server.jar 说明

- 服务器在启动视频流前会自动将 `pyapps/pyMatrix/resources/scrcpy-server.jar` 推送到目标设备的 `/data/local/tmp/`。
- 请确保该文件存在（可通过 `push_scrcpy_server.py` 或运行官方 `scrcpy` 预热）。
- 如果推送失败，WebSocket 会返回错误提示。

## 视频流说明

服务器已集成scrcpy视频流，会通过WebSocket发送原始H.264视频数据。前端需要H.264解码器来显示视频：

### 解码方案选择

1. **MediaSource API** (推荐，需要浏览器支持)
   - 使用`MediaSource`和`SourceBuffer`
   - 需要将H.264流封装为fMP4格式
   - 延迟低，性能好

2. **Broadway.js** (纯JavaScript解码器)
   - 纯JS实现的H.264解码器
   - 兼容性好，但CPU占用较高
   - 适合快速原型

3. **FFmpeg.wasm**
   - WebAssembly版FFmpeg
   - 功能强大，但体积较大

当前版本服务器已完成视频流传输，浏览器会收到二进制帧数据。

## MP4录制功能（新增）

### 功能说明

服务器在视频流传输时，同步使用FFmpeg将H.264流录制为MP4文件：

- **自动录制**：启动视频流时自动开始录制
- **同步处理**：一份H.264数据同时服务 WebSocket 和 FFmpeg
- **零重编码**：FFmpeg使用 `-c:v copy`，无CPU开销
- **优化格式**：`-movflags +faststart` 优化web播放

### 录制文件位置

```
pyapps/scrcpy_web_test/recordings/
├── R4RCHEKBRWFEEYB6_20251108_210530.mp4
├── R4RCHEKBRWFEEYB6_20251108_211045.mp4
└── ...
```

### 独立录制测试

```bash
# 测试15秒录制（无需Web界面）
cd D:/programing/core_node/pyapps/scrcpy_web_test
python test_recording.py
```

### 技术详情

参见完整技术说明文档：
```
pyapps/scrcpy_web_test/VIDEO_STREAMING_EXPLAINED.md
```

## 下一步

1. ✅ 集成scrcpy视频流
2. ✅ **添加FFmpeg MP4录制功能**
3. ⏳ 添加H.264前端解码器（MediaSource API / WebCodecs）
4. ⏳ 实现设备控制功能
