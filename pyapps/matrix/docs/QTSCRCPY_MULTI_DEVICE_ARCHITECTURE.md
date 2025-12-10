# QtScrcpy 多设备管理架构 - 深度分析

## 核心发现

### ⚠️ **关键事实**

**scrcpy 本身不支持多设备管理**

- scrcpy 是轻量级的、设计用于单设备镜像的工具
- 一个 scrcpy 实例只能连接一台设备
- scrcpy 本身没有设备列表管理、切换、或同步控制功能

**QtScrcpy 如何克服这个限制**

- QtScrcpy **为每个连接的设备启动一个独立的 scrcpy 服务器进程**
- 通过 C++/Qt 框架层面实现多设备管理
- 通过 GroupController 实现多设备同步控制

---

## 1️⃣ scrcpy 官方设计

### 单设备模型

```bash
# scrcpy 命令行界面
scrcpy --serial <device_serial>    # 连接指定设备
scrcpy -s <device_serial>          # 简写

# 一次只能连接一台设备
scrcpy -s ABC123
scrcpy -s XYZ789  # 必须是另一个 scrcpy 进程
```

### 不支持的功能

❌ 单个 scrcpy 实例管理多台设备
❌ 内置设备列表/选择 UI
❌ 设备热插拔检测
❌ 多设备同步控制
❌ 设备队列管理

---

## 2️⃣ QtScrcpy 如何实现多设备

### 架构模式

```
┌─────────────────────────────────────────────────────────────┐
│                    QtScrcpy 主应用                            │
│              (C++ Qt Framework Layer)                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Device List UI                  GroupController             │
│  (Dialog::serialBox)             (Singleton)                 │
│      ↓                                ↓                      │
│   Devices:                       Host Device Selection       │
│   • ABC123 (USB)                 Multi-Device Input Sync     │
│   • 192.168.1.100:5555 (WiFi)   Broadcast to All Slaves    │
│   • 192.168.1.101:5555 (WiFi)                               │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│              IDeviceManage (Device Process Manager)           │
│                      ↓       ↓        ↓                       │
│         ┌──────────┴─────┬──────────┴──────┬──────────┐       │
│         │                │                 │          │       │
│    Device 1          Device 2          Device 3    ...     │
│    (ABC123)       (192.168.1.100)    (192.168.1.101)       │
│         │                │                 │          │       │
│         ↓                ↓                 ↓          ↓       │
│    ┌─────────────────────────────────────────────────────┐   │
│    │   每个设备的 scrcpy 服务器进程（运行在 Android 设备上）   │
│    │   (独立的、互不影响)                                   │
│    │                                                       │
│    │   scrcpy-server → ADB 推送到设备 → app_process 启动 │
│    └─────────────────────────────────────────────────────┘   │
│                                                               │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│    │VideoForm1│  │VideoForm2│  │VideoForm3│ ...           │
│    │(Window)  │  │(Window)  │  │(Window)  │                │
│    │H.264解码 │  │H.264解码 │  │H.264解码 │                │
│    └──────────┘  └──────────┘  └──────────┘                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 核心机制

#### 1. 设备发现与启动 (dialog.cpp)

```cpp
// 步骤1: 列出所有连接的设备
void Dialog::on_updateDevice_clicked() {
    m_adb.execute("", QStringList() << "devices");
}

// 步骤2: 为每个设备启动独立的 scrcpy 服务器
void Dialog::on_startServerBtn_clicked() {
    qsc::DeviceParams params;
    params.serial = ui->serialBox->currentText();  // 选中的设备
    params.serverLocalPath = getServerPath();      // scrcpy-server.jar
    params.serverRemotePath = "/data/local/tmp/scrcpy-server.jar";

    // 这里启动一个新的 scrcpy 进程（针对此设备）
    qsc::IDeviceManage::getInstance().connectDevice(params);
}
```

**关键点**：每次调用 `connectDevice(params)` 都会：
1. 获取选定设备的序列号
2. 推送 `scrcpy-server.jar` 到设备
3. 在设备上启动 scrcpy 服务器
4. 通过 TCP 连接接收 H.264 视频流
5. 创建 VideoForm 窗口显示视频

#### 2. 设备连接回调 (dialog.cpp)

```cpp
// 当一个设备的 scrcpy 连接成功时调用
void Dialog::onDeviceConnected(bool success, const QString &serial,
                               const QString &deviceName, const QSize &size) {
    if (!success) return;

    // 为这个设备创建一个新的 UI 窗口
    auto videoForm = new VideoForm(...);
    videoForm->setSerial(serial);

    // 这个设备变成一个观察者，可以接收该设备的输入事件
    qsc::IDeviceManage::getInstance()
        .getDevice(serial)
        ->registerDeviceObserver(videoForm);

    // 将此设备添加到组控制器（用于多设备同步）
    GroupController::instance().addDevice(serial);
}
```

#### 3. 多设备进程列表

```
运行的进程：
├── QtScrcpy 主应用 (1 个)
│   ├── ADB 客户端
│   ├── 设备 UI 列表
│   └── GroupController
│
├── scrcpy 进程 #1 (对应设备 ABC123)
│   ├── 连接到 ABC123 的 scrcpy-server
│   ├── 接收 H.264 视频流
│   └── 转发输入事件
│
├── scrcpy 进程 #2 (对应设备 192.168.1.100:5555)
│   ├── 连接到该 WiFi 设备的 scrcpy-server
│   ├── 接收 H.264 视频流
│   └── 转发输入事件
│
└── scrcpy 进程 #3 (对应设备 192.168.1.101:5555)
    ├── 连接到该 WiFi 设备的 scrcpy-server
    ├── 接收 H.264 视频流
    └── 转发输入事件
```

---

## 3️⃣ 多设备同步控制 (GroupController)

### 关键类 (groupcontroller.h)

```cpp
class GroupController : public QObject, public qsc::DeviceObserver {
private:
    QVector<QString> m_devices;  // 所有连接设备的序列号列表

public:
    void addDevice(const QString& serial);      // 新设备连接
    void removeDevice(const QString& serial);   // 设备断开
    void updateDeviceState(const QString& serial);  // 更新Host/Slave状态

    // 多设备同步输入
    void mouseEvent(const QMouseEvent *from, const QSize &frameSize, const QSize &showSize) override;
    void keyEvent(const QKeyEvent *from, const QSize &frameSize, const QSize &showSize) override;
    void wheelEvent(const QWheelEvent *from, const QSize &frameSize, const QSize &showSize) override;

    // 多设备同步控制命令
    void postGoBack() override;
    void postGoHome() override;
    void postPower() override;
    void screenshot() override;
    void postTextInput(QString &text) override;
    // ... 共20+ 个控制方法
};
```

### Host/Slave 模式 (groupcontroller.cpp)

```cpp
// 一个"Host"设备是输入源
// 多个"Slave"设备接收同步的输入

void GroupController::mouseEvent(const QMouseEvent *from,
                                 const QSize &frameSize,
                                 const QSize &showSize) {
    // 循环遍历所有设备
    for (const auto& serial : m_devices) {
        // 跳过发送输入的主设备
        if (isHost(serial)) {
            continue;
        }

        // 获取这个设备的对象
        auto device = qsc::IDeviceManage::getInstance().getDevice(serial);
        if (!device) continue;

        // 向这个从设备发送相同的鼠标事件
        device->mouseEvent(from, getFrameSize(serial), showSize);
    }
}

// 所有其他控制方法都遵循相同的模式
void GroupController::postGoBack() {
    for (const auto& serial : m_devices) {
        if (isHost(serial)) continue;
        auto device = qsc::IDeviceManage::getInstance().getDevice(serial);
        if (device) device->postGoBack();
    }
}
```

### Host 选择 (ToolForm)

```cpp
// 每个设备都有一个 ToolForm（工具面板）
class ToolForm {
private:
    bool m_isHost = false;  // 这个设备是否是 Host?

public:
    void on_groupControlBtn_clicked() {
        // 点击切换按钮切换 Host/Slave 状态
        m_isHost = !m_isHost;

        // 更新 GroupController
        GroupController::instance().updateDeviceState(m_serial);

        // 视觉指示：红色=Host，绿色=Slave
        ui->groupControlBtn->setStyleSheet(
            m_isHost ? "color: red" : "color: green"
        );
    }
};
```

---

## 4️⃣ 设备刷新机制

### 实时设备检测

```cpp
// 在主 Dialog 中
Dialog::Dialog(...) {
    // 启用自动刷新定时器
    connect(&m_autoUpdatetimer, &QTimer::timeout,
            this, &Dialog::on_updateDevice_clicked);

    if (ui->autoUpdatecheckBox->isChecked()) {
        m_autoUpdatetimer.start(5000);  // 每 5 秒刷新一次
    }
}

void Dialog::on_updateDevice_clicked() {
    // 执行 adb devices 获取当前连接的设备
    m_adb.execute("", QStringList() << "devices");
}

// 处理 ADB 结果
case qsc::AdbProcess::AER_SUCCESS_EXEC:
    if (args.contains("devices")) {
        // 清空旧的设备列表
        ui->serialBox->clear();
        ui->connectedPhoneList->clear();

        // 获取新的设备列表
        QStringList devices = m_adb.getDevicesSerialFromStdOut();

        // 添加到 UI
        for (auto &item : devices) {
            ui->serialBox->addItem(item);  // 添加到下拉框
            ui->connectedPhoneList->addItem(
                Config::getInstance().getNickName(item) + "-" + item
            );
        }
    }
    break;
```

### 新设备自动启动流程

```
用户连接新 USB 设备
        ↓
点击"刷新设备"按钮（或自动定时器触发）
        ↓
执行 adb devices
        ↓
新设备显示在设备列表中
        ↓
用户选择该设备，点击"启动服务"
        ↓
为该设备推送 scrcpy-server.jar
        ↓
启动 scrcpy 服务器进程
        ↓
创建 VideoForm 窗口显示视频
        ↓
将设备添加到 GroupController
        ↓
可进行多设备同步控制
```

---

## 5️⃣ 对比：scrcpy vs QtScrcpy

| 特性 | scrcpy | QtScrcpy |
|------|--------|----------|
| **设计目标** | 轻量级单设备镜像 | 专业多设备控制 |
| **多设备支持** | ❌ 不支持 | ✅ 完全支持 |
| **设备启动方式** | 命令行参数 | UI 界面点击 |
| **设备管理** | ❌ 无 | ✅ 完整的设备表 |
| **UI 界面** | ❌ 无（纯镜像） | ✅ 完整的 Qt UI |
| **多设备输入同步** | ❌ 无 | ✅ Host/Slave 模式 |
| **设备切换** | 需要启动新进程 | ✅ 即时切换 |
| **自动刷新** | ❌ 无 | ✅ 自动检测新设备 |
| **独立/同步控制** | - | ✅ 支持两种模式 |

---

## 6️⃣ 实际启动流程

### 示例：启动 3 台设备

```cpp
// 步骤1: 刷新设备列表
on_updateDevice_clicked();
// 输出: [ABC123, 192.168.1.100:5555, 192.168.1.101:5555]

// 步骤2: 选择第一台设备
ui->serialBox->setCurrentIndex(0);  // ABC123

// 步骤3: 启动服务
on_startServerBtn_clicked();
// → 为 ABC123 启动 scrcpy 进程 #1

// 步骤4: 创建 UI（onDeviceConnected 回调）
// → VideoForm 窗口1
// → ToolForm 控制面板1
// → GroupController.addDevice("ABC123")

// 步骤5: 选择第二台设备
ui->serialBox->setCurrentIndex(1);  // 192.168.1.100:5555

// 步骤6: 启动服务
on_startServerBtn_clicked();
// → 为 192.168.1.100:5555 启动 scrcpy 进程 #2

// 步骤7: 创建 UI
// → VideoForm 窗口2
// → ToolForm 控制面板2
// → GroupController.addDevice("192.168.1.100:5555")

// 步骤8: 选择第三台设备
ui->serialBox->setCurrentIndex(2);  // 192.168.1.101:5555

// 步骤9: 启动服务
on_startServerBtn_clicked();
// → 为 192.168.1.101:5555 启动 scrcpy 进程 #3

// 现在有 3 个 scrcpy 进程运行，各自独立
```

---

## 7️⃣ 设备状态管理

### DeviceObserver 模式

```cpp
// 每个 VideoForm 是一个观察者
class VideoForm : public qsc::DeviceObserver {
public:
    // 当用户在这个设备窗口上进行输入时，调用这些方法
    void mouseEvent(...) override;
    void keyEvent(...) override;
    void wheelEvent(...) override;
};

// 注册流程
void Dialog::onDeviceConnected(...) {
    qsc::IDeviceManage::getInstance()
        .getDevice(serial)
        ->registerDeviceObserver(videoForm);
}

// 断开流程
void Dialog::onDeviceDisconnected(QString serial) {
    auto device = qsc::IDeviceManage::getInstance().getDevice(serial);
    if (device) {
        device->deRegisterDeviceObserver(videoForm);
        videoForm->close();
    }
    GroupController::instance().removeDevice(serial);
}
```

---

## 8️⃣ 关键代码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| 设备列表刷新 | dialog.cpp | 322-329 |
| 启动单个设备服务 | dialog.cpp | 331-365 |
| 设备连接回调 | dialog.cpp | 499-550 |
| 设备断开回调 | dialog.cpp | 551-575 |
| GroupController 实现 | groupcontroller.cpp | 全文 |
| Host/Slave 逻辑 | groupcontroller.cpp | 多个位置 |
| 多设备同步输入 | groupcontroller.cpp | 鼠标、键盘、滚轮方法 |
| ToolForm Host 切换 | toolform.cpp | 按钮点击处理 |

---

## 9️⃣ Matrix 应用的优势

基于此理解，Matrix 的 ADB Device Manager 增加了：

✅ **自动设备发现** - scrcpy/QtScrcpy 都需手动启动
✅ **网络扫描** - 自动找到 WiFi 设备
✅ **USB 自动转换** - 自动从 USB 转为 WiFi
✅ **设备表维护** - 持久化设备状态
✅ **心跳监控** - 检测设备断线
✅ **集成设备推送** - WebSocket 实时推送设备列表到前端

---

## 🔟 总结

### scrcpy 本身
- **轻量级** - 单设备、无 UI、最小依赖
- **高效** - 低延迟、低资源占用
- **简单** - 命令行接口

### QtScrcpy
- **扩展** - 将 scrcpy 进程池化管理
- **UI 驱动** - 完整的 Qt 图形界面
- **多设备** - 通过多进程实现
- **同步控制** - Host/Slave 模式

### Matrix ADB Device Manager
- **自动化** - 0 手动操作
- **网络感知** - 自动发现和连接
- **持久化** - 保存设备历史
- **实时推送** - WebSocket 双向通信
- **智能转换** - USB 自动转 WiFi
