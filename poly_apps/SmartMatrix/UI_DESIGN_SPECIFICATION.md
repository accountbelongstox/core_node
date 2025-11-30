# SmartMatrix 项目功能分析与UI设计规范
## 第一步：完整功能分析

---

## 📱 项目核心功能分析

### **项目定位**
SmartMatrix 是一个**Android设备群控管理平台**，基于 scrcpy 技术，提供：
- **实时屏幕镜像**：将Android设备屏幕实时投射到PC
- **远程控制**：通过键盘/鼠标控制Android设备
- **批量管理**：同时管理和控制多个Android设备
- **设备分组**：按项目、测试场景等维度组织设备
- **专业功能**：录屏、截图、文件传输、ADB命令执行

---

## 🎯 核心功能体系

### **1. 设备连接管理**
```
连接方式：
├─ USB连接
│  ├─ 自动检测USB设备
│  ├─ 显示设备序列号
│  └─ 一键连接
└─ WIFI连接
   ├─ IP地址连接
   ├─ 自动获取设备IP
   ├─ ADB无线调试
   └─ 局域网扫描
```

**技术实现：**
- 使用 ADB (Android Debug Bridge) 通信
- 支持 `adb devices` 检测USB设备
- 支持 `adb tcpip 5555` 启用无线ADB
- 支持 `adb connect IP:PORT` 无线连接

### **2. 设备分组管理系统**
```
组织结构：
TcAllDevicesGroup (顶层根组)
├─ DevicesGroup1 (项目A测试组)
│  ├─ Device 0 (小米11)
│  ├─ Device 1 (华为P40)
│  └─ Device 2 (OPPO Find X3)
├─ DevicesGroup2 (项目B测试组)
│  ├─ Device 3 (vivo X60)
│  └─ Device 4 (一加9)
├─ DevicesGroup3 (性能测试组)
└─ DevicesGroup4 (兼容性测试组)
```

**功能特性：**
- ✅ 创建/删除/重命名设备组
- ✅ 设备拖拽移动到不同组
- ✅ 组级别批量操作
- ✅ 组颜色标识（紫、绿、蓝、红等）
- ✅ 复选框选择机制
- ✅ 组配置保存和恢复

### **3. 单设备控制功能**
```
基础控制：
├─ 屏幕显示
│  ├─ 实时视频流（H.264解码）
│  ├─ 分辨率调整（720p/1080p/原生）
│  ├─ 码率设置（2Mbps/4Mbps/8Mbps）
│  └─ 帧率显示（FPS counter）
├─ 输入控制
│  ├─ 鼠标点击/滑动
│  ├─ 键盘输入
│  ├─ 多点触控模拟
│  └─ 游戏手柄映射
├─ 截图录制
│  ├─ 即时截图（PNG格式）
│  ├─ 屏幕录制（MP4/MKV）
│  ├─ 录制设置（格式/路径/质量）
│  └─ 背景录制模式
├─ 文件传输
│  ├─ 拖拽文件到设备
│  ├─ APK拖拽安装
│  ├─ 文件管理器
│  └─ 剪贴板同步
└─ 系统控制
   ├─ 电源键（开/关屏）
   ├─ 音量键（+/-）
   ├─ Home键
   ├─ Back键
   ├─ Recent键
   └─ 通知栏展开/收起
```

### **4. 组控制功能**
```
批量操作：
├─ 全部连接/断开
├─ 全部启动服务器
├─ 全部停止服务器
├─ 组内设备全选/取消
├─ 批量截图
├─ 批量录制
├─ 批量ADB命令
└─ 同步控制（所有设备同步操作）
```

### **5. 高级功能**
```
专业工具：
├─ 按键映射（KeyMap）
│  ├─ 自定义按键脚本
│  ├─ 游戏手柄映射
│  ├─ PUBG/和平精英预设
│  ├─ 抖音/快手预设
│  └─ 实时切换映射
├─ ADB命令工具
│  ├─ 命令输入框
│  ├─ 常用命令快捷按钮
│  ├─ 命令输出显示
│  └─ 命令历史记录
├─ 音频转发
│  ├─ 设备音频播放到PC
│  ├─ 基于sndcpy（Android 10+）
│  └─ 音质设置
└─ 性能监控
   ├─ FPS显示
   ├─ 延迟监测
   ├─ CPU/内存使用率
   └─ 网络流量统计
```

---

## 🎨 完整UI设计规范

### **布局架构**

```
┌────────────────────────────────────────────────────────────┐
│  SmartMatrix - 0/0 devices connected           [_][□][×]   │ ← 标题栏
├────────────────────────────────────────────────────────────┤
│ File  Group  Device  View  Tools  Help                     │ ← 菜单栏
├────────────────────────────────────────────────────────────┤
│ [New Group] [Refresh] [Connect] [Disconnect] [Screenshot]  │ ← 工具栏
├──────────┬────────────────────────────────────┬────────────┤
│          │                                    │            │
│  左侧面板 │         中间显示区域                │  右侧面板   │
│  (设备树) │      (设备卡片网格布局)             │ (操作面板)  │
│          │                                    │            │
│  200-300px│         可变宽度                   │  200-250px │
│          │                                    │            │
├──────────┴────────────────────────────────────┴────────────┤
│ Group Mode: ON | Devices: 0/5 connected | FPS: 60 | 0%    │ ← 状态栏
└────────────────────────────────────────────────────────────┘
```

---

## 📊 三级管理设计

### **1. 全局管理（Global Management）**

#### **1.1 全局工具栏**
```
位置：主窗口顶部
功能：
├─ [New Group]         - 创建新设备组
├─ [Refresh Devices]   - 刷新所有USB/WIFI设备
├─ [Connect All]       - 连接所有已选设备
├─ [Disconnect All]    - 断开所有连接
├─ [Screenshot All]    - 批量截图所有设备
├─ [Record All]        - 批量录制所有设备
├─ [Stop All Services] - 停止所有设备服务
└─ [Settings]          - 全局设置
```

#### **1.2 全局菜单**
```
File 菜单：
├─ Open Configuration...      - 打开配置文件
├─ Save Configuration...      - 保存当前配置
├─ Import Devices...          - 导入设备列表
├─ Export Devices...          - 导出设备列表
├─ ─────────────────
├─ Preferences...             - 全局偏好设置
├─ ─────────────────
└─ Exit                       - 退出程序

Group 菜单：
├─ New Group              Ctrl+G
├─ Delete Group           Del
├─ Rename Group           F2
├─ ─────────────────
├─ Expand All Groups
├─ Collapse All Groups
├─ ─────────────────
├─ Start All Servers
├─ Stop All Servers
├─ ─────────────────
└─ Group Settings...

Device 菜单：
├─ Refresh Devices        F5
├─ Connect Device...      Ctrl+D
├─ Disconnect Device
├─ ─────────────────
├─ Select All             Ctrl+A
├─ Deselect All           Ctrl+Shift+A
├─ Invert Selection
├─ ─────────────────
├─ Screenshot All         Ctrl+S
├─ Record All             Ctrl+R
├─ ─────────────────
└─ Device Settings...     Ctrl+,

View 菜单：
├─ Toggle Fullscreen      F11
├─ Toggle Group Mode      Ctrl+M
├─ ─────────────────
├─ Show Left Panel        ☑
├─ Show Right Panel       ☑
├─ Show Status Bar        ☑
├─ ─────────────────
├─ Zoom In                Ctrl++
├─ Zoom Out               Ctrl+-
├─ Reset Zoom             Ctrl+0
├─ ─────────────────
├─ Grid Layout
│  ├─ 2 Columns
│  ├─ 4 Columns
│  ├─ 6 Columns
│  └─ Auto
├─ ─────────────────
└─ Theme
   ├─ Light
   ├─ Dark
   └─ System

Tools 菜单：
├─ ADB Command Shell...
├─ File Manager...
├─ KeyMap Editor...
├─ ─────────────────
├─ Performance Monitor
├─ Network Monitor
├─ ─────────────────
└─ Export Logs...

Help 菜单：
├─ Documentation          F1
├─ Keyboard Shortcuts
├─ ─────────────────
├─ Check for Updates...
├─ ─────────────────
├─ About SmartMatrix...
└─ About Qt...
```

#### **1.3 全局设置对话框**
```
General 选项卡：
├─ Language (语言)
├─ Theme (主题)
├─ Auto-connect on startup
├─ Minimize to tray
└─ Check updates automatically

Video 选项卡：
├─ Default Bit Rate
├─ Default Max Size
├─ Default FPS
├─ Video Codec (H.264/H.265)
└─ Hardware Acceleration

Recording 选项卡：
├─ Default Record Format
├─ Default Save Path
├─ Auto-save screenshots
└─ Screenshot naming pattern

Connection 选项卡：
├─ ADB Path
├─ Connection Timeout
├─ Auto-reconnect
└─ Max parallel connections

Advanced 选项卡：
├─ Log Level (Debug/Info/Warning/Error)
├─ Log File Path
├─ Performance Mode
└─ GPU Rendering
```

#### **1.4 全局状态栏**
```
显示信息：
├─ Group Mode: ON/OFF           - 群控模式状态
├─ Devices: 3/10 connected      - 已连接/总设备数
├─ Selected: 5 devices          - 已选中设备数
├─ Connection: USB/WIFI         - 连接方式
├─ FPS: 60                      - 平均帧率
├─ Latency: 35ms                - 平均延迟
└─ CPU: 15%  Memory: 2.1GB      - 系统资源占用
```

---

### **2. 单组管理（Group Management）**

#### **2.1 设备组树节点**
```
UI结构：
📁 DevicesGroup1 🟣 ☑️
├─ [展开/折叠图标]
├─ [组颜色圆点]
├─ [复选框]
├─ [组名称标签]
└─ [右键菜单按钮]
```

#### **2.2 组右键菜单**
```
DevicesGroup1 右键菜单：
├─ Rename Group (重命名组)
├─ Delete Group (删除组)
├─ Duplicate Group (复制组)
├─ ─────────────────
├─ Change Color (修改颜色)
│  ├─ 🟣 Purple
│  ├─ 🟢 Green
│  ├─ 🔵 Blue
│  ├─ 🔴 Red
│  ├─ 🟡 Yellow
│  └─ Custom...
├─ ─────────────────
├─ New Subgroup (新建子组)
├─ Add Device... (添加设备)
├─ ─────────────────
├─ Select All Devices (全选组内设备)
├─ Deselect All Devices (取消全选)
├─ ─────────────────
├─ Connect All (连接全部)
├─ Disconnect All (断开全部)
├─ Start All Servers (启动全部服务)
├─ Stop All Servers (停止全部服务)
├─ ─────────────────
├─ Screenshot All (全部截图)
├─ Record All (全部录制)
├─ ─────────────────
├─ Group Settings... (组设置)
└─ Export Group Config... (导出组配置)
```

#### **2.3 组设置对话框**
```
┌────────────────────────────────────┐
│ Group Settings - DevicesGroup1     │
├────────────────────────────────────┤
│ Basic 选项卡：                      │
│  Group Name: [DevicesGroup1______] │
│  Group Color: [🟣▼]                │
│  Description: [__________________] │
│                                    │
│ Devices 选项卡：                    │
│  ┌──────────────────────────────┐ │
│  │ ☑ Device 0 (小米11)          │ │
│  │ ☑ Device 1 (华为P40)         │ │
│  │ ☐ Device 2 (OPPO Find X3)    │ │
│  └──────────────────────────────┘ │
│  [Add Device...] [Remove Device]  │
│                                    │
│ Script 选项卡：                     │
│  ☑ Enable Group Script             │
│  Script File: [select_script.txt]  │
│  [Browse...] [Edit Script]        │
│                                    │
│ Connection 选项卡：                 │
│  Default Bit Rate: [4Mbps    ▼]   │
│  Default Max Size: [1080p    ▼]   │
│  Auto-connect on startup: ☑        │
│  Auto-reconnect on disconnect: ☑   │
│                                    │
│           [OK] [Cancel] [Apply]    │
└────────────────────────────────────┘
```

#### **2.4 组级别工具栏（可选）**
```
当选中组节点时显示：
[Connect Group] [Disconnect Group] [Screenshot Group] [Record Group]
```

---

### **3. 单设备管理（Single Device Management）**

#### **3.1 设备树节点**
```
UI结构：
📱 device 0 (小米11) 🟢 ☑️
├─ [设备图标]
├─ [设备名称]
├─ [状态指示圆点]
│  ├─ 🟢 绿色：已连接
│  ├─ 🔴 红色：未连接
│  ├─ 🟡 黄色：连接中
│  └─ ⚠️ 橙色：错误
├─ [复选框]
└─ [右键菜单]
```

#### **3.2 设备右键菜单**
```
device 0 右键菜单：
├─ Connect (连接)
├─ Disconnect (断开)
├─ Reconnect (重新连接)
├─ ─────────────────
├─ Start Server (启动服务)
├─ Stop Server (停止服务)
├─ Restart Server (重启服务)
├─ ─────────────────
├─ Screenshot (截图)
├─ Start Recording (开始录制)
├─ Stop Recording (停止录制)
├─ ─────────────────
├─ Fullscreen (全屏显示)
├─ Always on Top (置顶显示)
├─ Close Screen (关闭屏幕)
├─ ─────────────────
├─ File Transfer... (文件传输)
├─ Install APK... (安装APK)
├─ KeyMap Settings... (按键映射)
├─ ─────────────────
├─ Move to Group (移动到组)
│  ├─ DevicesGroup1
│  ├─ DevicesGroup2
│  └─ New Group...
├─ Remove from Group (从组移除)
├─ ─────────────────
├─ Rename Device (重命名设备)
├─ Delete Device (删除设备)
├─ ─────────────────
├─ Copy Device Serial (复制序列号)
├─ Copy Device Info (复制设备信息)
├─ ─────────────────
└─ Device Settings... (设备设置)
```

#### **3.3 设备卡片视图**
```
┌─────────────────────────┐
│   LPS25 (小米11) 🟢     │ ← 设备名称和状态
├─────────────────────────┤
│                         │
│                         │
│   [设备屏幕实时显示]      │ ← 视频流区域
│                         │
│                         │
├─────────────────────────┤
│  FPS: 60  Latency: 35ms │ ← 性能信息
│  双击全屏 | 右键设置      │ ← 操作提示
└─────────────────────────┘
```

**交互效果：**
- 鼠标悬停：边框高亮 (#4A90E2)
- 单击选中：边框加粗
- 双击：进入全屏模式
- 右键：弹出设备快捷菜单
- 拖拽：可移动到其他组

#### **3.4 设备配置对话框（详细版）**
```
┌──────────────────────────────────────────────────┐
│ Device Settings - device 0 (小米11)         [?][×]│
├──────────────────────────────────────────────────┤
│ [General] [Connection] [Video] [Control] [Advanced] │ ← 选项卡
├──────────────────────────────────────────────────┤
│                                                  │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ General 选项卡                              ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                  │
│  Device Information:                             │
│  ┌────────────────────────────────────────────┐ │
│  │ Device Name:  小米11                        │ │
│  │ Serial Number: ab89e9k6                    │ │
│  │ Model:        M2011K2C                     │ │
│  │ Android Ver:  Android 11                   │ │
│  │ Resolution:   1080x2400                    │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  Display Settings:                               │
│  Custom Name: [小米11_____________________]      │
│  Device Color: [🔵▼]                             │
│  Notes: [测试设备_________________________]      │
│                                                  │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Connection 选项卡                           ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                  │
│  Connection Type:                                │
│  ◉ USB Connection                                │
│  ○ WIFI Connection                               │
│                                                  │
│  USB Settings:                                   │
│  Serial Number: [ab89e9k6__________] [Refresh]  │
│  ☑ Auto-connect on USB plugin                   │
│  ☑ Auto-reconnect on disconnect                 │
│                                                  │
│  WIFI Settings:                                  │
│  IP Address: [192.168.1.100___]                  │
│  Port:       [5555____]                          │
│  [Get Device IP] [Test Connection]              │
│  ☑ Remember this IP                              │
│                                                  │
│  ADB Settings:                                   │
│  [Start ADB Server] [Restart ADB Server]         │
│  ADB Path: [C:\platform-tools\adb.exe] [Browse] │
│                                                  │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Video 选项卡                                ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                  │
│  Video Quality:                                  │
│  Bit Rate:       [4 Mbps        ▼]              │
│  Max Resolution: [1080p (1920x1080) ▼]          │
│  FPS Limit:      [60 fps        ▼]              │
│  Video Codec:    [H.264         ▼]              │
│                                                  │
│  Display Options:                                │
│  ☑ Show FPS counter                              │
│  ☑ Show latency indicator                        │
│  ☐ Show performance stats                        │
│  ☑ Hardware acceleration (GPU)                   │
│                                                  │
│  Window Options:                                 │
│  ☐ Always on top                                 │
│  ☐ Frameless window                              │
│  ☐ Close device screen when mirroring            │
│  ☐ Stay awake (prevent screen sleep)             │
│                                                  │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Control 选项卡                              ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                  │
│  Input Settings:                                 │
│  ☑ Enable touch input                            │
│  ☑ Enable keyboard input                         │
│  ☑ Enable gamepad input                          │
│  ☑ Enable multi-touch (max 10 points)            │
│                                                  │
│  KeyMap Settings:                                │
│  ☑ Enable custom keymap                          │
│  KeyMap File: [pubg_mobile.txt   ] [Browse]     │
│  Switch Key:  [~ (Tilde)          ▼]            │
│  [Edit KeyMap...] [Test KeyMap]                 │
│                                                  │
│  Clipboard:                                      │
│  ☑ Auto-sync clipboard (PC ↔ Device)            │
│  ☑ Paste on Ctrl+V                               │
│                                                  │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ │
│ ┃ Advanced 选项卡                             ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                  │
│  Recording Settings:                             │
│  Format:     [MP4            ▼]                 │
│  Quality:    [High           ▼]                 │
│  Save Path:  [D:\Recordings\______] [Browse]    │
│  ☑ Auto-filename with timestamp                  │
│  ☐ Record in background (no display)             │
│                                                  │
│  Screenshot Settings:                            │
│  Format:     [PNG            ▼]                 │
│  Save Path:  [D:\Screenshots\____] [Browse]      │
│  ☑ Auto-filename with timestamp                  │
│                                                  │
│  Audio Settings:                                 │
│  ☑ Forward device audio to PC (Android 10+)     │
│  Audio Quality: [High          ▼]               │
│                                                  │
│  Performance:                                    │
│  Rendering Mode: [OpenGL      ▼]                │
│  Decoder Threads: [4           ▼]               │
│  ☑ Low latency mode                              │
│                                                  │
│         [OK] [Cancel] [Apply] [Reset Defaults]  │
└──────────────────────────────────────────────────┘
```

#### **3.5 设备快速操作面板（右侧面板）**
```
当选中单个设备时显示：

┌─────────────────────┐
│  Selected Device    │
│  device 0 (小米11)  │
├─────────────────────┤
│                     │
│  📱 Device Info     │
│  Serial: ab89e9k6   │
│  Status: Connected  │
│  FPS: 60            │
│  Latency: 35ms      │
│                     │
├─────────────────────┤
│                     │
│  Quick Actions:     │
│                     │
│  [Connect]          │
│  [Disconnect]       │
│  [Screenshot]       │
│  [Start Record]     │
│  [File Transfer]    │
│  [Install APK]      │
│  [Device Settings]  │
│                     │
├─────────────────────┤
│                     │
│  ADB Commands:      │
│  [▼ ab89e9k6      ]│ ← 设备选择
│  [adb shell ls    ]│ ← 命令输入
│  [Execute]          │
│  ┌───────────────┐ │
│  │ (命令输出区)   │ │
│  │               │ │
│  └───────────────┘ │
│  [Clear]            │
│                     │
└─────────────────────┘
```

---

## 🔧 实现技术要点

### **数据结构设计**
```cpp
// 设备组数据结构
struct DeviceGroup {
    QString id;                  // 组ID
    QString name;                // 组名称
    QColor color;                // 组颜色
    QList<QString> deviceIds;    // 设备ID列表
    bool selected;               // 是否选中
    bool expanded;               // 是否展开
};

// 设备数据结构
struct Device {
    QString id;                  // 设备ID (序列号)
    QString name;                // 自定义名称
    QString serial;              // 序列号
    QString model;               // 型号
    QString androidVersion;      // Android版本
    QSize resolution;            // 分辨率
    DeviceStatus status;         // 连接状态
    bool selected;               // 是否选中
    QString groupId;             // 所属组ID

    // 连接配置
    ConnectionType connectionType;  // USB/WIFI
    QString ipAddress;              // IP地址
    int port;                       // 端口

    // 视频配置
    int bitRate;                    // 码率
    QSize maxSize;                  // 最大分辨率
    int fps;                        // 帧率
};

// 设备状态枚举
enum class DeviceStatus {
    Disconnected,    // 未连接
    Connecting,      // 连接中
    Connected,       // 已连接
    Error            // 错误
};
```

### **配置文件格式**
```json
{
  "version": "2.0",
  "groups": [
    {
      "id": "group1",
      "name": "DevicesGroup1",
      "color": "#9B59B6",
      "expanded": true,
      "selected": false,
      "devices": ["ab89e9k6", "cf7d8e2a"]
    }
  ],
  "devices": [
    {
      "id": "ab89e9k6",
      "name": "小米11",
      "serial": "ab89e9k6",
      "groupId": "group1",
      "connectionType": "USB",
      "bitRate": 4000000,
      "maxSize": { "width": 1080, "height": 1920 },
      "autoConnect": true
    }
  ],
  "preferences": {
    "theme": "dark",
    "language": "zh_CN",
    "gridColumns": 4
  }
}
```

---

## ✅ 第一步完成总结

已完成：
1. ✅ **项目功能完整分析** - 深入理解SmartMatrix是什么、能做什么
2. ✅ **核心功能体系梳理** - 设备连接、分组、控制、录制等所有功能
3. ✅ **UI布局架构设计** - 三栏式布局（设备树+卡片网格+操作面板）
4. ✅ **三级管理体系设计** - 全局管理、单组管理、单设备管理
5. ✅ **详细交互规范** - 菜单、工具栏、右键菜单、快捷键等
6. ✅ **数据结构设计** - 设备、组、配置的数据模型
7. ✅ **配置文件规范** - JSON格式的持久化方案

---

## 🚀 下一步行动

准备好进入**第2步：开始实现左侧设备树视图**。

需要实现的核心组件：
1. `ModernDeviceTreeWidget` - 设备树控件
2. `DeviceTreeItem` - 树节点项
3. `DeviceGroupManager` - 组管理器
4. 树状结构、复选框、颜色标识、右键菜单等

**准备开始实施了吗？请告诉我是否继续第2步的实现！** 💪
