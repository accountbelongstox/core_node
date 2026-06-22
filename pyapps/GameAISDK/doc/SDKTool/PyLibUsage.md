# GameAISDK 作为 Python 类库引用

GameAISDK 的 Python 模块支持被宿主进程（如 d3-check）通过 `sys.path` 直接 import，以类库形式调用，无需子进程或 HTTP。

## 1. action_sampler 录制库

### 1.1 路径与入口

- 模块目录：`GameAISDK/tools/SDKTool/src/modules/action_sampler/`
- 类库入口：`embedded` 模块（无 HTTP、无 `logging.config`，可被宿主直接引用）

### 1.2 使用方式

在宿主中设置路径并导入：

```python
import sys
import os

ACTION_SAMPLER_PATH = "..."  # 指向 action_sampler 目录的绝对路径
if ACTION_SAMPLER_PATH not in sys.path:
    sys.path.insert(0, ACTION_SAMPLER_PATH)

from embedded import RecordSession
```

### 1.3 创建会话（内存传参）

```python
config_dict = {
    "GameName": "output",
    "SavePath": "D:/path/to/project/",   # 以 / 结尾
    "FrameFPS": 10,
    "FrameHeight": 360,
    "FrameWidth": 640,
    "Debug": True,
    "OutputAsVideo": False,
    "LogTimestamp": False,
}
action_cfg_path_abs = "D:/.../action_sampler/cfg/action.json"  # 绝对路径

session = RecordSession.create(hwnd, "Windows", config_dict, action_cfg_path_abs)
if session is None:
    # 初始化失败
    pass
```

### 1.4 控制（内存调用，无 HTTP）

```python
session.start_segment()   # 开始本段
session.end_segment()     # 结束本段并落盘
session.stop()            # 结束段 + 退出循环并 join 线程
session.is_running()      # 是否仍在运行
```

## 2. 录制输出规范（与后续标记衔接）

- 段目录：`SavePath/output/<timestamp>/`，例如 `.../d3_game/output/2026-02-20_20_41_01/`
- 段内文件：`data.csv` + 每帧 `.jpg`，或 `video.avi`（由 `OutputAsVideo` 决定）
- 得到最新段路径后，可：
  1. 将段内视频/图片导出为帧图（如 `frames/` 子目录）
  2. 使用 labelImg / SDKTool 标注 或 宿主自带标注界面，对该帧图目录进行标注

## 3. 其他 Py 模块

SDKTool 下其他 Python 模块（如 UI 相关）多数依赖 PyQt5 与界面线程，按需在宿主中增加对应目录到 `sys.path` 后 import 使用；入口与依赖以各模块说明为准。action_sampler 的 `embedded` 为当前官方提供的无界面、可被直接引用的类库入口。
