# pycore 完整模块参考

## 1. pyfoundations (核心基础 - 仅标准库)

### 1.1 规范中已记录
- `color_print.py` - ColorPrint 彩色输出
- `encyclopedia.py` - Encyclopedia 全局缓存
- `event_bus.py` - EventBus 事件系统
- `thread_bus.py` - ThreadBus 线程通信
- `secret_manager.py` - SecretManager 密钥管理
- `pybasecommon/commander.py` - Commander 命令执行器

### 1.2 规范中未记录
- `app_launcher.py` - AppLauncher pyapps/目录发现、模糊匹配、动态加载
- `database_base.py` - 数据库基类
- `file_lock_manager.py` - FileLockManager 多进程文件锁
- `global_task_queue.py` - GlobalTaskQueue 线程安全优先队列
- `split_file_store.py` - SplitFileStore 分离文件存储
- `stdio_utils.py` - STDIO流规范化(MCP用)
- `system_info.py` - SystemInfo 屏幕/内存/磁盘/CPU信息
- `system_paths.py` - SystemPaths 跨平台路径 (Windows: ~/.core_node, Linux: /var/_core_node)
- `task_models.py` - Task, TaskState, TaskPriority 模型

---

## 2. pyutils (工具类 - 允许第三方包)

### 2.1 规范中已记录
- `ocr/` - OCR CnOCR引擎
- `rpc/` - UnifiedRpcServer HTTP+WebSocket

### 2.2 规范中未记录

#### 音频/语音
- `audio_utils/` - SilenceDetector 静音检测
- `azure_speech/` - AzureSpeechClient, SpeechRecognizer
- `edge_tts/` - EdgeTTSClient, TTSProcessor, TTSTranslator, TTSThreadManager
- `whisper_stt/` - WhisperSTTProvider (文件/麦克风/系统音频)

#### 设备/ADB
- `device/` - DeviceInfo, ServerParams, AndroidDevice, ScrcpyDevice, ADBManager, ADBDevice
- `adb/` - ADB工具

#### UI
- `native_ui/` - NativeUIConfig, launch_native_app, TimerManager, I18nManager, ShutdownManager, PySide6Framework

#### 浏览器
- `pybrowser/` - SpiderEngine, SessionManager, ChromeBrowser, EdgeBrowser, FirefoxBrowser, 插件

#### RPC v2
- `rpc_v2/` - FastAPIRPCServer, RPCDiscovery, NetworkScanner, RPCProtocolClient
- `wsrpc/` - WsRpcServer, WsRpcClient, SingletonBackendDetector, SingletonRpcBackend

#### 翻译
- `translator/` - GoogleTranslator MD5缓存

#### AI/ML
- `ultralytics/` - ClassificationTrainer, DetectionTrainer, YOLODatasetGenerator
- `openrouter_sdk/` - OpenRouter API

#### 剪贴板
- `clipboard/` - clipboard_manager, ClipboardHistory, ClipboardMonitor

#### 控制
- `control/` - TouchEvent, KeyEvent, CoordinateMapper

#### 图像
- `image_tools.py` - 图像工具
- `image_annotator.py` - 图像标注
- `image_comparator.py` - 图像比较
- `image_crop.py` - 图像裁剪
- `image_enhancer.py` - 图像增强
- `image_matcher.py` - 图像匹配
- `unified_detector.py` - 统一检测

#### 窗口
- `window_activator.py` - 窗口激活
- `window_analyzer.py` - 窗口分析
- `window_ops.py` - 窗口操作
- `window_screenshot.py` - 窗口截图
- `ui_analyzer.py` - UI分析

#### 其他
- `common/` - TTS/STT开关、语音配置
- `group/` - GroupController, SyncEvent
- `hotkey/` - HotkeyListener 热键监听
- `launcher/` - device_sync, config_manager
- `video_stream/` - 视频流
- `nodejs_bridge/` - Node.js桥接
- `flutter_dev_tools/` - Flutter开发工具
- `process_manager.py` - 进程管理
- `media_compressor.py` - 媒体压缩

---

## 3. pyctl (控制层)

### 规范中未记录
- `speech/` - 语音管理 (TTS + STT + RPC + AI)
- `pybrowserauto/` - 离线网页下载
- `mcpctl/` - MCP控制

---

## 4. 顶级模块 (规范中未记录)

### pyheartbeat/
全局任务调度和线程管理:
- `HeartbeatSystem` - 中央协调器
- `HeartbeatPusher` - 1秒心跳循环
- `UnifiedTaskAPI` - 任务提交接口

### pylauncher/
应用启动器(带单例检测):
- `LauncherConfig` - 统一配置
- `ServiceLauncher` - 主服务启动器
- `SingletonDetector` - 跨进程单例检测

### pythreadpool/
线程池和服务注册:
- `GlobalThreadPool` - 集中线程注册
- `THREAD_REGISTRY` - 服务元数据
- `SERVICE_STARTERS` - 服务启动函数

---

## 5. 统计

| 模块 | 已记录 | 未记录 |
|------|--------|--------|
| pyfoundations | 6 | 9 |
| pyutils | 2 | 40+ |
| pyctl | 0 | 3 |
| pygvar | 1 | 3 |
| 顶级模块 | 1 | 3 |
| **总计** | **10** | **58+** |

