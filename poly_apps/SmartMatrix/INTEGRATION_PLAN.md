# SmartMatrix UI 完整集成计划
# 10步渐进式实施方案

## 📊 当前状态 vs 预期状态对比

### 当前实现 (new.png)
- ❌ 左侧面板：空白
- ❌ 中间区域：空白灰色区域
- ❌ 右侧面板：不存在
- ✅ 菜单栏：基础框架存在
- ✅ 工具栏：部分按钮存在
- ✅ 状态栏：基础信息显示

### 预期效果 (预期.png)
- ✅ 左侧面板：完整的设备组树状视图，带复选框和颜色标识
- ✅ 中间区域：设备屏幕网格显示，实时镜像
- ✅ 右侧面板：快捷操作列表，设备管理工具
- ✅ 设置对话框：完整的设备配置界面
- ✅ 工具栏图标：丰富的操作按钮
- ✅ 右键菜单：设备和组的上下文菜单

---

## 🎯 10步集成计划

### **第1步：左侧设备树视图完整实现** ⭐⭐⭐⭐⭐
**优先级：最高** | **预计时间：2-3小时**

**目标：**
- 实现完整的树状设备组结构
- 添加复选框支持（组级别和设备级别）
- 为每个组添加颜色圆点标识
- 实现展开/折叠功能
- 添加设备图标和状态指示

**文件修改：**
```
QtSmartMatrix/ui/moderndevicetreewidget.h
QtSmartMatrix/ui/moderndevicetreewidget.cpp
```

**关键功能：**
1. **树状结构**：
   - TcAllDevicesGroup (顶层组)
   - DevicesGroup1-5 (子组，可动态添加)
   - device 0-3 (设备节点)

2. **复选框逻辑**：
   - 组复选框：控制所有子设备
   - 设备复选框：独立选择
   - 三态复选框支持（全选、部分选择、未选）

3. **颜色标识**：
   - 紫色、绿色、蓝色、红色等圆点
   - 用于区分不同组

4. **图标系统**：
   - 组图标（文件夹展开/折叠）
   - 设备图标（手机、平板）
   - 状态图标（连接、断开、错误）

**预期效果：**
```
📁 TcAllDevicesGroup ☑️
├─ 📁 DevicesGroup1 🟣 ☑️
│  ├─ 📱 device 0 ☑️
│  └─ 📱 device 1 ☑️
├─ 📁 DevicesGroup2 🟢 ☑️
│  ├─ 📱 device 2 ☑️
│  └─ 📱 device 3 ☑️
└─ 📁 DevicesGroup3 🔵 ☐
```

---

### **第2步：右侧操作面板实现** ⭐⭐⭐⭐
**优先级：高** | **预计时间：2小时**

**目标：**
- 创建右侧垂直面板
- 添加顶部工具栏图标（返回、主页、截图、设置）
- 实现操作列表（更新、诊断、ADB运行等）
- 添加设备选择下拉框

**新建文件：**
```
QtSmartMatrix/ui/modernrightpanel.h
QtSmartMatrix/ui/modernrightpanel.cpp
```

**关键功能：**
1. **顶部工具栏**：
   - 返回按钮
   - 主页按钮
   - 截图按钮
   - 其他工具按钮
   - 设置按钮（右上角）

2. **操作列表**：
   - "更新(测试用)" 按钮
   - "诊断(测试用)" 按钮
   - 设备选择下拉框 (ab89e9k6)
   - "update devices..." 按钮
   - "adb run" 按钮
   - 多个 "start server..." 按钮
   - "test phone" 按钮

3. **布局结构**：
```
┌─────────────────────┐
│  [←] [⌂] [📷] [⚙️] │ ← 顶部工具栏
├─────────────────────┤
│                     │
│  [更新(测试用)]      │
│  [诊断(测试用)]      │
│  [ab89e9k6 ▼]       │ ← 设备下拉框
│  [update devices...] │
│  [adb run]          │
│  [start server...]  │
│  [test phone]       │
│  ...                │
│                     │
└─────────────────────┘
```

---

### **第3步：设备卡片视图增强** ⭐⭐⭐⭐⭐
**优先级：最高** | **预计时间：3-4小时**

**目标：**
- 在中间网格区域显示设备屏幕镜像
- 为每个设备添加名称标签（LPS25, LPS26等）
- 实现设备卡片悬停效果
- 添加右键菜单（全屏、设置）
- 显示底部提示文字："双击全屏右键设置"

**文件修改：**
```
QtSmartMatrix/ui/devicevideowidget.h
QtSmartMatrix/ui/devicevideowidget.cpp
QtSmartMatrix/ui/moderngridlayoutmanager.cpp
```

**关键功能：**
1. **设备卡片组件**：
   - 顶部：设备名称标签
   - 中间：设备屏幕实时显示区域
   - 底部：提示文字或状态信息

2. **交互效果**：
   - 鼠标悬停：边框高亮
   - 单击：选中设备
   - 双击：全屏显示
   - 右键：弹出菜单

3. **卡片布局**：
```
┌─────────────────┐
│   LPS25         │ ← 设备名称
├─────────────────┤
│                 │
│   [设备屏幕]     │ ← 实时镜像
│                 │
├─────────────────┤
│ 双击全屏右键设置 │ ← 提示文字
└─────────────────┘
```

---

### **第4步：设备设置对话框集成** ⭐⭐⭐⭐⭐
**优先级：最高** | **预计时间：4-5小时**

**目标：**
- 从旧版 Dialog 移植完整配置界面
- 实现 WIFI/USB 连接选项卡
- 添加录制设置、无线连接、ADB命令工具
- 集成到 ModernMainWindow

**新建文件：**
```
QtSmartMatrix/ui/deviceconfigdialog.h
QtSmartMatrix/ui/deviceconfigdialog.cpp
QtSmartMatrix/ui/deviceconfigdialog.ui
```

**关键功能：**
1. **选项卡结构**：
   - WIFI Connect
   - USB Connect

2. **配置项目**：
   - **Start Config**:
     - bit rate (码率)
     - max size (最大分辨率)
     - record format (录制格式)
     - look orientation (屏幕方向)
     - record save path (保存路径)

   - **复选框选项**:
     - record screen (录制屏幕)
     - background record (后台录制)
     - reverse connection (反向连接)
     - show fps (显示帧率)
     - always on top (始终置顶)
     - screen-off (息屏)
     - frameless (无边框)
     - stay awake (保持唤醒)

   - **USB Line**:
     - device name (设备名称)
     - device serial (设备序列号)
     - start server / stop server 按钮

   - **Wireless**:
     - IP地址输入 (192.168.0.1)
     - 端口输入 (5555)
     - wireless connect / wireless disconnect 按钮

   - **ADB Command**:
     - adb command 输入框
     - devices / execute / terminate / clear 按钮
     - 命令输出文本区域

**对话框界面布局**：
```
┌──────────────────────────────────────┐
│ QtScrcpy                          [?][×]│
├──────────────────────────────────────┤
│ [☑] Use Simple Mode                  │
│  Simple Mode                          │
│                                       │
│ [WIFI Connect] [USB Connect]         │ ← 选项卡
├──────────────────────────────────────┤
│ Double click to connect:              │
│ ┌────────────────────────────────┐  │
│ │                                 │  │
│ │  (设备列表)                      │  │
│ │                                 │  │
│ └────────────────────────────────┘  │
│                                       │
│ Start Config:                         │
│  bit rate: [____▼] max size: [____▼] │
│  record format: [____▼]              │
│  look orientation: [____▼]           │
│  record save path: [____________]    │
│                    [select path]      │
│                                       │
│ ☐ record screen  ☐ background record │
│ ☑ reverse connection  ☐ show fps     │
│ ☐ always on top  ☐ screen-off        │
│ ☐ frameless      ☐ stay awake        │
│                                       │
│ USB line:                             │
│  device name: [_______________]       │
│  device serial: [______▼]            │
│  [start server] [stop server]        │
│  [stop all server] [refresh devices] │
│  [get device IP] [start adb]         │
│                                       │
│ Wireless:                             │
│  [192.168.0.1] : [5555]              │
│  [wireless connect][wireless disconn.│
│                                       │
│ adb:                                  │
│  adb command: [devices___________]   │
│  [execute] [terminate] [clear]       │
│ ┌────────────────────────────────┐  │
│ │ (命令输出区域)                   │  │
│ └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

---

### **第5步：组管理功能完善** ⭐⭐⭐⭐
**优先级：高** | **预计时间：2-3小时**

**目标：**
- 完善新建/删除/重命名组功能
- 实现组的批量操作（全选、启动服务器等）
- 支持设备在组之间拖拽
- 组配置保存和加载

**文件修改：**
```
QtSmartMatrix/ui/moderndevicegroupmanager.h
QtSmartMatrix/ui/moderndevicegroupmanager.cpp
```

**关键功能：**
1. **组操作菜单**：
   - 右键组节点弹出菜单：
     - 新建子组
     - 重命名组
     - 删除组
     - 修改颜色
     - 全选组内设备
     - 批量启动设备服务器
     - 批量停止设备服务器

2. **拖拽功能**：
   - 设备可在组之间拖拽移动
   - 拖拽时显示目标组高亮
   - 支持多选设备批量移动

3. **数据持久化**：
   - 保存组结构到配置文件 (groups.json)
   - 保存设备分配关系
   - 恢复上次会话状态

**配置文件格式 (groups.json)**：
```json
{
  "groups": [
    {
      "id": "group1",
      "name": "DevicesGroup1",
      "color": "#9B59B6",
      "devices": ["device0", "device1"]
    },
    {
      "id": "group2",
      "name": "DevicesGroup2",
      "color": "#2ECC71",
      "devices": ["device2", "device3"]
    }
  ]
}
```

---

### **第6步：设备单体操作** ⭐⭐⭐⭐
**优先级：高** | **预计时间：2小时**

**目标：**
- 实现双击设备全屏显示
- 添加设备右键菜单
- 实现设备状态指示（连接、断开、错误）
- 单设备配置快速访问

**文件修改：**
```
QtSmartMatrix/ui/devicevideowidget.cpp
QtSmartMatrix/ui/modernmainwindow.cpp
```

**关键功能：**
1. **设备右键菜单**：
   - 连接设备
   - 断开设备
   - 设备设置
   - 全屏显示
   - 截图
   - 录制屏幕
   - 文件传输
   - 移动到组...
   - 从组移除

2. **设备状态指示**：
   - 🟢 绿色：已连接
   - 🔴 红色：未连接
   - 🟡 黄色：连接中
   - ⚠️ 橙色：错误

3. **全屏模式**：
   - 双击设备卡片进入全屏
   - 全屏工具栏（返回、截图、录制）
   - 按 ESC 退出全屏

---

### **第7步：工具栏和菜单增强** ⭐⭐⭐
**优先级：中** | **预计时间：1-2小时**

**目标：**
- 添加更多工具栏图标
- 完善菜单项功能
- 实现快捷键绑定
- 添加主题切换功能

**文件修改：**
```
QtSmartMatrix/ui/modernmainwindow.cpp
```

**关键功能：**
1. **完整菜单结构**：
   ```
   File
   ├─ Open Configuration...
   ├─ Save Configuration...
   ├─ Import Devices...
   ├─ Export Devices...
   ├─ ────────────
   ├─ Preferences...
   ├─ ────────────
   └─ Exit

   Group
   ├─ New Group              Ctrl+G
   ├─ Delete Group           Del
   ├─ Rename Group           F2
   ├─ ────────────
   ├─ Start All Servers
   ├─ Stop All Servers
   ├─ ────────────
   └─ Group Settings...

   Device
   ├─ Refresh Devices        F5
   ├─ Connect Device...      Ctrl+D
   ├─ Disconnect Device
   ├─ ────────────
   ├─ Select All             Ctrl+A
   ├─ Deselect All           Ctrl+Shift+A
   ├─ ────────────
   └─ Device Settings...     Ctrl+,

   View
   ├─ Toggle Fullscreen      F11
   ├─ Toggle Group Mode      Ctrl+M
   ├─ ────────────
   ├─ Show Left Panel
   ├─ Show Right Panel
   ├─ ────────────
   ├─ Zoom In                Ctrl++
   ├─ Zoom Out               Ctrl+-
   ├─ Reset Zoom             Ctrl+0
   ├─ ────────────
   └─ Theme
       ├─ Light
       ├─ Dark
       └─ System

   Help
   ├─ Documentation          F1
   ├─ Check for Updates...
   ├─ ────────────
   └─ About SmartMatrix...
   ```

2. **工具栏图标**：
   - 刷新设备 🔄
   - 新建组 📁+
   - 连接设备 🔗
   - 断开设备 ⛓️‍💥
   - 截图 📷
   - 录制 ⏺️
   - 设置 ⚙️

---

### **第8步：设备连接管理** ⭐⭐⭐⭐⭐
**优先级：最高** | **预计时间：3-4小时**

**目标：**
- USB 自动检测和连接
- WIFI 连接支持
- 多设备并发连接
- 连接状态监控和错误处理

**文件修改：**
```
QtSmartMatrix/ui/modernmainwindow.cpp
QtSmartMatrix/QtSmartMatrixCore/src/device/devicemanage.cpp
```

**关键功能：**
1. **USB 连接**：
   - 自动检测 USB 设备插入
   - 自动连接新设备
   - 显示设备序列号和型号

2. **WIFI 连接**：
   - 通过 IP:端口连接
   - 自动扫描局域网设备
   - 保存常用设备列表

3. **并发连接**：
   - 支持同时连接多个设备
   - 连接队列管理
   - 连接失败重试机制

4. **状态监控**：
   - 实时连接状态更新
   - 断线自动重连
   - 错误提示和日志记录

---

### **第9步：视频流和控制功能** ⭐⭐⭐⭐⭐
**优先级：最高** | **预计时间：4-5小时**

**目标：**
- 设备屏幕实时显示
- 鼠标/键盘输入转发到设备
- 屏幕录制功能
- 截图功能

**文件修改：**
```
QtSmartMatrix/ui/devicevideowidget.cpp
QtSmartMatrix/QtSmartMatrixCore/src/device/decoder.cpp
QtSmartMatrix/QtSmartMatrixCore/src/device/controller.cpp
```

**关键功能：**
1. **视频流显示**：
   - H.264 解码
   - OpenGL 渲染
   - 自适应分辨率
   - 帧率显示（可选）

2. **输入控制**：
   - 鼠标点击/滑动
   - 键盘输入
   - 触摸手势模拟
   - 游戏手柄支持

3. **录制功能**：
   - 开始/停止录制
   - 选择录制格式（MP4, MKV）
   - 选择保存路径
   - 录制状态指示

4. **截图功能**：
   - 单击截图
   - 保存到指定目录
   - 截图预览

---

### **第10步：数据持久化和配置** ⭐⭐⭐
**优先级：中** | **预计时间：2小时**

**目标：**
- 保存组和设备配置
- 恢复上次会话
- 导入/导出配置
- 用户偏好设置

**新建文件：**
```
QtSmartMatrix/util/configmanager.h
QtSmartMatrix/util/configmanager.cpp
```

**关键功能：**
1. **配置文件**：
   - `config/groups.json` - 组结构
   - `config/devices.json` - 设备列表
   - `config/preferences.json` - 用户偏好
   - `config/window_state.json` - 窗口状态

2. **会话恢复**：
   - 恢复上次窗口大小和位置
   - 恢复上次组结构
   - 恢复上次连接的设备

3. **导入/导出**：
   - 导出当前配置为 JSON 文件
   - 导入配置文件
   - 配置文件加密（可选）

---

## 📝 实施建议

### **推荐实施顺序**：
1. 第1步 → 第3步 → 第4步 → 第8步 → 第9步 （核心功能）
2. 第2步 → 第6步 → 第5步 （UI增强）
3. 第7步 → 第10步 （完善和优化）

### **每步验收标准**：
- ✅ 功能完整实现
- ✅ UI 与预期截图一致
- ✅ 代码编译通过
- ✅ 基本测试通过
- ✅ 无明显崩溃或错误

### **关键里程碑**：
- **里程碑1**：完成第1-3步，UI 框架搭建完成
- **里程碑2**：完成第4-6步，设备管理功能完整
- **里程碑3**：完成第7-9步，所有核心功能可用
- **里程碑4**：完成第10步，产品级完成度

---

## 🚀 开始实施

**请告诉我从哪一步开始：**
- 输入 `1` 开始第1步：左侧设备树视图完整实现
- 输入 `2` 开始第2步：右侧操作面板实现
- 输入 `3` 开始第3步：设备卡片视图增强
- ...或者告诉我您希望先实现哪个功能

**准备好了吗？让我们开始这个激进的集成工作！** 💪
