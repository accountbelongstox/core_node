# SmartMatrix QT技术架构分析文档

## 项目概述
SmartMatrix 是一个基于 Qt 开发的 Android 设备投屏与控制软件,支持通过 USB 和 WiFi 连接显示和控制 Android 设备。该项目基于 Genymobile 的 scrcpy 项目改造而来,使用 Qt/C++ 技术栈重构。

---

## 一、核心技术栈

### 1.1 技术框架对比

| 技术点 | scrcpy 原版 | SmartMatrix |
|--------|------------|-------------|
| UI框架 | SDL | **Qt** |
| 视频编码 | FFmpeg | **FFmpeg** |
| 视频渲染 | SDL | **OpenGL** |
| 跨平台方案 | 自实现 | **Qt提供** |
| 开发语言 | C | **C++** |
| 编程风格 | 同步 | **异步(Qt信号槽)** |
| 按键映射 | 不支持 | **支持自定义** |
| 构建系统 | meson+gradle | **CMake/qmake** |

### 1.2 主要依赖库
- **Qt 5.12+** (跨平台GUI框架)
- **FFmpeg** (视频编解码 - libavcodec, libavformat, libavutil, libswscale)
- **ADB (Android Debug Bridge)** (设备通信)
- **OpenGL** (硬件加速渲染)
- **scrcpy-server** (Android端服务JAR包)

---

## 二、投屏技术方案

### 2.1 ADB连接机制

#### 2.1.1 ADB核心类结构
```cpp
// adbprocess.h:14-21
class AdbProcess {
    enum ADB_EXEC_RESULT {
        AER_SUCCESS_START,        // 启动成功
        AER_ERROR_START,          // 启动失败
        AER_SUCCESS_EXEC,         // 执行成功
        AER_ERROR_EXEC,           // 执行失败
        AER_ERROR_MISSING_BINARY, // 找不到ADB文件
    };
};
```

#### 2.1.2 ADB可执行文件路径查找
```cpp
// adbprocessimpl.cpp:28-54
const QString &AdbProcessImpl::getAdbPath() {
    if (s_adbPath.isEmpty()) {
        QStringList potentialPaths;
        potentialPaths
            << QString::fromLocal8Bit(qgetenv("SmartMatrix_ADB_PATH"))
            << g_adbPath
#ifdef Q_OS_WIN32
            << QCoreApplication::applicationDirPath() + "/adb.exe";
#else
            << QCoreApplication::applicationDirPath() + "/adb";
#endif
        // 遍历路径查找有效的ADB文件
    }
    return s_adbPath;
}
```

**技术要点**:
- 支持环境变量 `SmartMatrix_ADB_PATH`
- 自动检测应用目录下的 adb 可执行文件
- 跨平台路径适配 (Windows用.exe后缀)

#### 2.1.3 核心ADB命令封装

**1. 设备发现**
```cpp
// adbprocessimpl.cpp:131-147
QStringList AdbProcessImpl::getDevicesSerialFromStdOut() {
    QStringList serials;
    QRegularExpression lineExp("\r\n|\n");
    QRegularExpression tExp("\t");
    QStringList devicesInfoList = m_standardOutput.split(lineExp);
    for (QString deviceInfo : devicesInfoList) {
        QStringList deviceInfos = deviceInfo.split(tExp);
        if (2 == deviceInfos.count() &&
            0 == deviceInfos[1].compare("device")) {
            serials << deviceInfos[0];
        }
    }
    return serials;
}
```
**执行命令**: `adb devices`

**2. 文件推送**
```cpp
// adbprocessimpl.cpp:234-241
void AdbProcessImpl::push(const QString &serial,
                          const QString &local,
                          const QString &remote) {
    QStringList adbArgs;
    adbArgs << "push" << local << remote;
    execute(serial, adbArgs);
}
```
**执行命令**: `adb -s <serial> push <local> <remote>`

**3. 端口转发 (Forward)**
```cpp
// adbprocessimpl.cpp:198-205
void AdbProcessImpl::forward(const QString &serial,
                             quint16 localPort,
                             const QString &deviceSocketName) {
    QStringList adbArgs;
    adbArgs << "forward";
    adbArgs << QString("tcp:%1").arg(localPort);
    adbArgs << QString("localabstract:%1").arg(deviceSocketName);
    execute(serial, adbArgs);
}
```
**执行命令**: `adb -s <serial> forward tcp:<localPort> localabstract:<socketName>`

**4. 反向代理 (Reverse)**
```cpp
// adbprocessimpl.cpp:216-223
void AdbProcessImpl::reverse(const QString &serial,
                             const QString &deviceSocketName,
                             quint16 localPort) {
    QStringList adbArgs;
    adbArgs << "reverse";
    adbArgs << QString("localabstract:%1").arg(deviceSocketName);
    adbArgs << QString("tcp:%1").arg(localPort);
    execute(serial, adbArgs);
}
```
**执行命令**: `adb -s <serial> reverse localabstract:<socketName> tcp:<localPort>`

**5. 显示触摸点**
```cpp
// adbprocessimpl.cpp:119-129
void AdbProcessImpl::setShowTouchesEnabled(const QString &serial,
                                           bool enabled) {
    QStringList adbArgs;
    adbArgs << "shell"
            << "settings"
            << "put"
            << "system"
            << "show_touches";
    adbArgs << (enabled ? "1" : "0");
    execute(serial, adbArgs);
}
```
**执行命令**: `adb -s <serial> shell settings put system show_touches <0|1>`

**6. 应用安装**
```cpp
// adbprocessimpl.cpp:243-250
void AdbProcessImpl::install(const QString &serial,
                             const QString &local) {
    QStringList adbArgs;
    adbArgs << "install" << "-r" << local;
    execute(serial, adbArgs);
}
```
**执行命令**: `adb -s <serial> install -r <apk_path>`

---

### 2.2 服务端启动流程

#### 2.2.1 服务启动步骤枚举
```cpp
// server.h:16-24
enum SERVER_START_STEP {
    SSS_NULL,
    SSS_PUSH,                      // 推送服务端JAR
    SSS_ENABLE_TUNNEL_REVERSE,     // 启用反向代理
    SSS_ENABLE_TUNNEL_FORWARD,     // 启用端口转发
    SSS_EXECUTE_SERVER,            // 执行服务端
    SSS_RUNNING,                   // 运行中
};
```

#### 2.2.2 服务器参数配置
```cpp
// server.h:27-56
struct ServerParams {
    // 必需参数
    QString serial = "";              // 设备序列号
    QString serverLocalPath = "";     // 本地server路径

    // 可选参数
    QString serverRemotePath = "/data/local/tmp/scrcpy-server.jar";
    quint16 localPort = 27183;       // 本地监听端口
    quint16 maxSize = 720;           // 视频分辨率
    quint32 bitRate = 8000000;       // 视频比特率
    quint32 maxFps = 0;              // 最大帧率
    bool useReverse = true;          // 使用反向代理
    int captureOrientationLock = 0;  // 采集方向锁定
    int captureOrientation = 0;      // 采集方向
    bool stayAwake = false;          // 保持唤醒
    QString serverVersion = "3.3.1"; // server版本
    QString logLevel = "debug";      // 日志级别
    QString codecOptions = "";       // 编码选项
    QString codecName = "";          // 编码器名称
    QString crop = "";               // 视频裁剪
    bool control = true;             // 是否接收控制
    qint32 scid = -1;               // socket名字后缀
};
```

#### 2.2.3 推送服务端JAR到设备
```cpp
// server.cpp:55-62
bool Server::pushServer() {
    if (m_workProcess.isRuning()) {
        m_workProcess.kill();
    }
    m_workProcess.push(m_params.serial,
                       m_params.serverLocalPath,
                       m_params.serverRemotePath);
    return true;
}
```

#### 2.2.4 建立隧道连接

**方式1: 反向代理 (Reverse) - 优先使用**
```cpp
// server.cpp:64-71
bool Server::enableTunnelReverse() {
    if (m_workProcess.isRuning()) {
        m_workProcess.kill();
    }
    m_workProcess.reverse(m_params.serial,
        QString(SOCKET_NAME_PREFIX "_%1").arg(m_params.scid, 8, 16, QChar('0')),
        m_params.localPort);
    return true;
}
```
**原理**: 让Android设备的socket监听PC端的TCP端口
- PC监听本地端口 (默认27183)
- Android连接到 `localabstract:scrcpy_<scid>`
- 数据流: Android → PC

**方式2: 端口转发 (Forward) - 备用方案**
```cpp
// server.cpp:88-95
bool Server::enableTunnelForward() {
    if (m_workProcess.isRuning()) {
        m_workProcess.kill();
    }
    m_workProcess.forward(m_params.serial,
        m_params.localPort,
        QString(SOCKET_NAME_PREFIX "_%1").arg(m_params.scid, 8, 16, QChar('0')));
    return true;
}
```
**原理**: 将PC端口转发到Android设备socket
- PC转发本地端口到设备
- PC主动连接本地端口
- 数据流: PC → ADB → Android socket

**技术说明**:
- **优先使用Reverse**: 连接更稳定,Android端主动连接
- **Reverse失败时降级到Forward**: 某些设备ADB有bug导致reverse报错
- **区别**: Reverse是被动监听,Forward是主动连接

#### 2.2.5 启动Android服务端
```cpp
// server.cpp:111-223
bool Server::execute() {
    QStringList args;
    args << "shell";
    args << QString("CLASSPATH=%1").arg(m_params.serverRemotePath);
    args << "app_process";
    args << "/";  // unused
    args << "com.genymobile.scrcpy.Server";
    args << m_params.serverVersion;

    // 视频参数
    args << QString("video_bit_rate=%1").arg(QString::number(m_params.bitRate));
    args << QString("max_size=%1").arg(QString::number(m_params.maxSize));
    args << QString("max_fps=%1").arg(QString::number(m_params.maxFps));
    args << QString("log_level=%1").arg(m_params.logLevel);

    // 采集方向控制
    if (1 == m_params.captureOrientationLock) {
        args << QString("capture_orientation=@%1").arg(m_params.captureOrientation);
    }

    if (m_tunnelForward) {
        args << QString("tunnel_forward=true");
    }

    if (!m_params.control) {
        args << QString("control=false");
    }

    if (m_params.stayAwake) {
        args << QString("stay_awake=true");
    }

    // 编码配置
    if (!m_params.codecOptions.isEmpty()) {
        args << QString("codec_options=%1").arg(m_params.codecOptions);
    }
    if (!m_params.codecName.isEmpty()) {
        args << QString("encoder_name=%1").arg(m_params.codecName);
    }

    args << "audio=false";

    if (-1 != m_params.scid) {
        args << QString("scid=%1").arg(m_params.scid, 8, 16, QChar('0'));
    }

    // 执行阻塞命令
    m_serverProcess.execute(m_params.serial, args);
    return true;
}
```

**完整命令示例**:
```bash
adb -s <serial> shell CLASSPATH=/data/local/tmp/scrcpy-server.jar \
    app_process / com.genymobile.scrcpy.Server 3.3.1 \
    video_bit_rate=8000000 \
    max_size=720 \
    max_fps=60 \
    log_level=debug \
    capture_orientation=0 \
    control=true \
    stay_awake=true \
    audio=false \
    scid=00000001
```

**技术要点**:
- 使用 `app_process` 运行JAR包中的Java类
- 参数通过命令行参数传递给Server
- 该命令会阻塞运行,进程不会退出

---

### 2.3 视频流传输架构

#### 2.3.1 网络连接建立

**Reverse模式下的连接流程**:
```cpp
// server.cpp:26-50
connect(&m_serverSocket, &QTcpServer::newConnection, this, [this]() {
    QTcpSocket *tmp = m_serverSocket.nextPendingConnection();
    if (dynamic_cast<VideoSocket *>(tmp)) {
        m_videoSocket = dynamic_cast<VideoSocket *>(tmp);
        if (!m_videoSocket->isValid() ||
            !readInfo(m_videoSocket, m_deviceName, m_deviceSize)) {
            stop();
            emit serverStarted(false);
        }
    } else {
        m_controlSocket = tmp;
        if (m_controlSocket && m_controlSocket->isValid()) {
            // 关闭服务器socket
            m_serverSocket.close();
            // 关闭ADB隧道
            disableTunnelReverse();
            m_tunnelEnabled = false;
            emit serverStarted(true, m_deviceName, m_deviceSize);
        }
    }
});
```

**Forward模式下的连接流程**:
```cpp
// server.cpp:394-454
void Server::onConnectTimer() {
    VideoSocket *videoSocket = new VideoSocket();
    QTcpSocket *controlSocket = new QTcpSocket();

    // 连接视频socket
    videoSocket->connectToHost(QHostAddress::LocalHost, m_params.localPort);
    if (!videoSocket->waitForConnected(1000)) {
        qWarning("video socket connect to server failed");
        goto result;
    }

    // 连接控制socket
    controlSocket->connectToHost(QHostAddress::LocalHost, m_params.localPort);
    if (!controlSocket->waitForConnected(1000)) {
        qWarning("control socket connect to server failed");
        goto result;
    }

    // 读取首字节
    videoSocket->waitForReadyRead(1000);
    QByteArray data = videoSocket->read(1);
    if (!data.isEmpty() && readInfo(videoSocket, deviceName, deviceSize)) {
        success = true;
    }

    // ...重试逻辑,最多MAX_CONNECT_COUNT次
}
```

**技术说明**:
- **双Socket架构**: 一个用于视频流(VideoSocket),一个用于控制命令(ControlSocket)
- **Reverse模式**: 被动等待Android连接
- **Forward模式**: 主动连接到本地端口,通过ADB转发到设备
- **首字节协议**: Forward模式下设备先发送1字节标识

#### 2.3.2 设备信息读取
```cpp
// server.cpp:336-363
bool Server::readInfo(VideoSocket *videoSocket,
                     QString &deviceName,
                     QSize &size) {
    unsigned char buf[DEVICE_NAME_FIELD_LENGTH + 12];

    // 等待数据就绪,超时3秒
    while (videoSocket->bytesAvailable() <= (DEVICE_NAME_FIELD_LENGTH + 12)) {
        videoSocket->waitForReadyRead(300);
        if (timer.elapsed() > 3000) {
            qInfo("readInfo timeout");
            return false;
        }
    }

    qint64 len = videoSocket->read((char *)buf, sizeof(buf));
    if (len < DEVICE_NAME_FIELD_LENGTH + 12) {
        return false;
    }

    // 解析设备名称 (64字节)
    buf[DEVICE_NAME_FIELD_LENGTH - 1] = '\0';
    deviceName = QString::fromUtf8((const char *)buf);

    // 解析视频尺寸
    // 前4字节: AVCodecID (当前只支持H264,暂不解析)
    size.setWidth(bufferRead32be(&buf[DEVICE_NAME_FIELD_LENGTH + 4]));
    size.setHeight(bufferRead32be(&buf[DEVICE_NAME_FIELD_LENGTH + 8]));

    return true;
}

static quint32 bufferRead32be(quint8 *buf) {
    return (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3];
}
```

**数据包格式** (76字节):
```
| 设备名称 (64字节) | AVCodecID (4字节) | 宽度 (4字节) | 高度 (4字节) |
```

#### 2.3.3 视频流解复用 (Demuxer)
```cpp
// demuxer.h:15-54
class Demuxer : public QThread {
    Q_OBJECT
public:
    void installVideoSocket(VideoSocket* videoSocket);
    void setFrameSize(const QSize &frameSize);
    bool startDecode();
    void stopDecode();

signals:
    void getFrame(AVPacket* packet);        // 普通帧
    void getConfigFrame(AVPacket* packet);   // 配置帧

protected:
    void run();  // 线程主循环
    bool recvPacket(AVPacket *packet);
    bool processConfigPacket(AVPacket *packet);
    bool processFrame(AVPacket *packet);

private:
    VideoSocket *m_videoSocket;
    AVCodecContext *m_codecCtx;
    AVCodecParserContext *m_parser;
    AVPacket* m_pending;  // 待处理数据包
};
```

**技术要点**:
- 运行在独立线程,避免阻塞UI
- 使用FFmpeg的AVCodecParserContext解析H.264流
- 分离配置帧(SPS/PPS)和普通视频帧
- 通过Qt信号发送解析后的AVPacket

#### 2.3.4 视频解码 (Decoder)
```cpp
// decoder.h:14-44
class Decoder : public QObject {
    Q_OBJECT
public:
    Decoder(std::function<void(int width, int height,
                              uint8_t* dataY, uint8_t* dataU, uint8_t* dataV,
                              int linesizeY, int linesizeU, int linesizeV)> onFrame);

    bool open();
    void close();
    bool push(const AVPacket *packet);
    void peekFrame(std::function<void(int width, int height,
                                     uint8_t* dataRGB32)> onFrame);

signals:
    void updateFPS(quint32 fps);
    void newFrame();

private:
    VideoBuffer *m_vb;
    AVCodecContext *m_codecCtx;
    std::function<void(int, int, uint8_t*, uint8_t*, uint8_t*,
                      int, int, int)> m_onFrame;
};
```

**解码流程**:
1. 接收 AVPacket (H.264编码数据)
2. 使用 FFmpeg avcodec 解码为 AVFrame
3. 提取 YUV420 平面数据 (dataY, dataU, dataV)
4. 通过回调函数传递给渲染模块

---

### 2.4 视频渲染技术

#### 2.4.1 OpenGL YUV渲染
```cpp
// qyuvopenglwidget.h (推测)
class QYUVOpenGLWidget : public QOpenGLWidget {
    // 使用OpenGL着色器渲染YUV数据
    // YUV→RGB转换在GPU完成,提高性能
};
```

**渲染流程**:
1. Decoder解码得到YUV420数据
2. 上传YUV三个平面到OpenGL纹理
3. 使用Fragment Shader进行YUV→RGB转换
4. 渲染到屏幕

**性能优势**:
- GPU硬件加速
- 避免CPU进行颜色空间转换
- 支持高分辨率(1920×1080+)
- 低延迟(35~70ms)

---

## 三、设备控制技术

### 3.1 控制消息协议

#### 3.1.1 控制消息类型
```cpp
// controlmsg.h:30-45
enum ControlMsgType {
    CMT_NULL = -1,
    CMT_INJECT_KEYCODE = 0,        // 按键注入
    CMT_INJECT_TEXT,               // 文本注入
    CMT_INJECT_TOUCH,              // 触摸注入
    CMT_INJECT_SCROLL,             // 滚动注入
    CMT_BACK_OR_SCREEN_ON,         // 返回键/点亮屏幕
    CMT_EXPAND_NOTIFICATION_PANEL,  // 展开通知栏
    CMT_EXPAND_SETTINGS_PANEL,     // 展开设置面板
    CMT_COLLAPSE_PANELS,           // 折叠面板
    CMT_GET_CLIPBOARD,             // 获取剪贴板
    CMT_SET_CLIPBOARD,             // 设置剪贴板
    CMT_SET_DISPLAY_POWER,         // 设置屏幕电源
    CMT_ROTATE_DEVICE              // 旋转设备
};
```

#### 3.1.2 按键注入
```cpp
// controlmsg.h:88-93
struct {
    AndroidKeyeventAction action;  // ACTION_DOWN/UP
    AndroidKeycode keycode;        // 按键码
    quint32 repeat;                // 重复次数
    AndroidMetastate metastate;    // 修饰键状态(Ctrl/Shift等)
} injectKeycode;
```

#### 3.1.3 触摸注入
```cpp
// controlmsg.h:98-106
struct {
    quint64 id;                           // 触摸点ID [0-9]
    AndroidMotioneventAction action;       // DOWN/UP/MOVE
    AndroidMotioneventButtons actionButtons;
    AndroidMotioneventButtons buttons;
    QRect position;                       // 触摸位置
    float pressure;                       // 压力值
} injectTouch;
```

**技术特性**:
- **多点触控支持**: 最多10个触摸点 (id: 0-9)
- **虚拟触摸点**: 支持双指缩放的虚拟指针
  - `POINTER_ID_MOUSE = -1`
  - `POINTER_ID_GENERIC_FINGER = -2`
  - `POINTER_ID_VIRTUAL_MOUSE = -3`
  - `POINTER_ID_VIRTUAL_FINGER = -4`

#### 3.1.4 滚动注入
```cpp
// controlmsg.h:107-113
struct {
    QRect position;                // 滚动位置
    float hScroll;                 // 水平滚动量
    float vScroll;                 // 垂直滚动量
    AndroidMotioneventButtons buttons;
} injectScroll;
```

### 3.2 控制器架构

```cpp
// controller.h:14-69
class Controller : public QObject {
    Q_OBJECT
public:
    Controller(std::function<qint64(const QByteArray&)> sendData,
               QString gameScript = "");

    // 基础控制
    void postGoBack();
    void postGoHome();
    void postGoMenu();
    void postAppSwitch();
    void postPower();
    void postVolumeUp();
    void postVolumeDown();

    // 剪贴板操作
    void copy();
    void cut();
    void requestDeviceClipboard();
    void setDeviceClipboard(bool pause = true);
    void clipboardPaste();

    // 面板控制
    void expandNotificationPanel();
    void collapsePanel();
    void setDisplayPower(bool on);

    // 输入转换
    void mouseEvent(const QMouseEvent *from,
                   const QSize &frameSize,
                   const QSize &showSize);
    void wheelEvent(const QWheelEvent *from,
                   const QSize &frameSize,
                   const QSize &showSize);
    void keyEvent(const QKeyEvent *from,
                 const QSize &frameSize,
                 const QSize &showSize);

signals:
    void grabCursor(bool grab);

private:
    QPointer<Receiver> m_receiver;           // 设备消息接收器
    QPointer<InputConvertBase> m_inputConvert;  // 输入转换器
    std::function<qint64(const QByteArray&)> m_sendData;
};
```

### 3.3 输入转换系统

**输入转换基类**:
```cpp
// inputconvertbase.h (推测)
class InputConvertBase {
    // 将PC的鼠标键盘事件转换为Android触摸事件
    virtual void mouseEvent(...);
    virtual void wheelEvent(...);
    virtual void keyEvent(...);
};
```

**派生类**:
- **InputConvertNormal**: 普通模式,直接映射
- **InputConvertGame**: 游戏模式,支持自定义按键映射

**坐标转换**:
```
PC屏幕坐标 → 视频显示坐标 → Android设备坐标
考虑因素:
- 窗口缩放比例
- 视频分辨率
- 设备方向(横屏/竖屏)
```

---

## 四、连接方式详解

### 4.1 USB连接

#### 4.1.1 连接流程
1. **开启USB调试**: 在Android设备的开发者选项中开启
2. **USB连接**: 通过USB线将设备连接到电脑
3. **ADB授权**: 设备弹出调试授权对话框,点击允许
4. **设备发现**: SmartMatrix通过 `adb devices` 获取设备序列号
5. **启动服务**: 推送server JAR,建立隧道,启动服务

#### 4.1.2 技术优势
- **低延迟**: 直接USB通信,延迟最低(~30ms)
- **稳定性**: 不受网络环境影响
- **高带宽**: 支持高分辨率高帧率传输

---

### 4.2 WiFi连接

#### 4.2.1 无线连接步骤
```markdown
1. 开启USB调试
2. USB连接设备到电脑
3. 点击"更新设备"获取设备序列号
4. 点击"获取设备IP"
5. 点击"启动adbd"
6. 点击"无线连接"
7. 点击"更新设备"看到IP地址的设备
8. 点击"启动服务"
9. 此后可拔掉USB线
```

#### 4.2.2 技术实现

**获取设备IP**:
```cpp
// adbprocessimpl.cpp:168-186
QString AdbProcessImpl::getDeviceIPByIpFromStdOut() {
    QString ip = "";
    QString strIPExp = "wlan0    inet [\\d.]*";
    QRegularExpression ipRegExp(strIPExp,
                                QRegularExpression::CaseInsensitiveOption);
    QRegularExpressionMatch match = ipRegExp.match(m_standardOutput);
    if (match.hasMatch()) {
        ip = match.captured(0);
        ip = ip.right(ip.size() - 14);  // 提取IP部分
    }
    return ip;
}
```
**执行命令**: `adb -s <serial> shell ip addr show wlan0`

**启动网络ADB服务**:
```bash
adb -s <serial> tcpip 5555
```

**无线连接**:
```bash
adb connect <device_ip>:5555
```

**断开连接**:
```bash
adb disconnect <device_ip>:5555
```

#### 4.2.3 技术要点
- **前提**: 设备和PC必须在同一局域网
- **端口**: 默认使用5555端口
- **首次启动需USB**: 必须先通过USB开启网络调试
- **延迟**: 比USB略高,受WiFi质量影响

---

## 五、音频投屏技术

### 5.1 音频传输方案 (sndcpy)

**技术实现**:
```bash
# sndcpy/sndcpy.sh
# 基于 sndcpy 项目: https://github.com/rom1v/sndcpy
```

**原理**:
1. 在Android设备上安装音频捕获应用
2. 使用 `adb forward` 转发音频流
3. PC端使用VLC或其他播放器接收音频流

**限制**:
- **仅支持 Android 10+**
- 需要额外安装APK
- 音视频不同步(独立传输)

---

## 六、高级功能

### 6.1 群控功能

**技术架构**:
```cpp
// groupcontroller.h (推测)
class GroupController {
    // 管理多个设备
    QList<Device*> m_devices;

    // 同步控制所有设备
    void broadcastControl(ControlMsg* msg);
};
```

**功能特性**:
- 同时连接多台设备
- 批量操作(安装APK、文件传输)
- 同步控制(同时发送相同指令)

### 6.2 按键映射 (KeyMap)

**脚本格式** (JSON):
```json
{
  "keymap": [
    {
      "key": "W",
      "type": "tap",
      "pos": {"x": 0.5, "y": 0.3}
    },
    {
      "key": "A",
      "type": "tap",
      "pos": {"x": 0.4, "y": 0.4}
    }
  ],
  "switchKey": "~"
}
```

**技术实现**:
```cpp
// keymap.h (推测)
class KeyMap {
    // 加载JSON脚本
    void loadScript(QString scriptPath);

    // 转换PC按键到Android触摸
    ControlMsg* convertKeyToTouch(QKeyEvent* event);
};
```

**应用场景**:
- 游戏键鼠映射(如PUBG Mobile)
- 自动化脚本
- 提升操作效率

### 6.3 录屏与截图

**技术方案**:
- **录屏**: 使用FFmpeg将视频流编码保存为MP4/MKV
- **截图**: 从解码后的帧数据保存为PNG

---

## 七、性能优化技术

### 7.1 异步架构

**Qt信号槽机制**:
```cpp
// 示例: ADB进程完成时触发信号
connect(&m_workProcess, &AdbProcess::adbProcessResult,
        this, &Server::onWorkProcessResult);
```

**多线程设计**:
- **主线程**: UI渲染
- **Demuxer线程**: 视频流解复用
- **Decoder线程**: 视频解码
- **Network线程**: Socket通信

### 7.2 硬件加速

**OpenGL渲染**:
- GPU执行YUV→RGB转换
- 减轻CPU负担
- 提高帧率和流畅度

**FFmpeg硬件解码** (可选):
- 支持硬件解码器(如QSV、VAAPI、D3D11VA)
- 进一步降低CPU使用率

### 7.3 低延迟优化

**关键技术**:
1. **最小缓冲**: VideoBuffer设计最小化延迟
2. **直接渲染**: 解码后直接上传GPU,无中间拷贝
3. **优化编码参数**:
   - 使用较低的编码延迟设置
   - 关闭B帧减少编码延迟
4. **高优先级线程**: 视频处理线程提高优先级

---

## 八、与原版scrcpy的技术对比

| 技术点 | scrcpy (C/SDL) | SmartMatrix (C++/Qt) |
|--------|----------------|---------------------|
| **事件循环** | SDL_PollEvent | Qt事件循环 |
| **线程模型** | pthread/条件变量 | QThread/信号槽 |
| **UI框架** | SDL窗口 | Qt Widget/QML |
| **渲染** | SDL_Renderer (OpenGL后端) | QOpenGLWidget |
| **网络** | 原生socket | QTcpSocket/QTcpServer |
| **异步编程** | 手动线程同步 | 信号槽自动调度 |
| **跨平台** | 手动处理差异 | Qt自动适配 |
| **扩展性** | 需修改核心代码 | 通过信号槽解耦 |

---

## 九、完整技术流程图

```
┌─────────────────────────────────────────────────────────────┐
│                        用户操作                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    SmartMatrix GUI (Qt)                      │
│  - 设备管理 (DeviceManage)                                   │
│  - 配置界面 (Dialog)                                         │
│  - 视频显示 (VideoForm + QYUVOpenGLWidget)                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│   ADB Process    │          │    Controller    │
│                  │          │                  │
│  - 设备发现      │          │  - 输入转换      │
│  - 端口转发/反向 │          │  - 控制消息      │
│  - 推送JAR       │          │  - 按键映射      │
│  - 启动服务端    │          │                  │
└────────┬─────────┘          └────────┬─────────┘
         │                             │
         │ USB/WiFi                    │ ControlSocket
         ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Android 设备                             │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │        scrcpy-server.jar (Java)                        │ │
│  │                                                        │ │
│  │  - 屏幕捕获 (MediaCodec)                               │ │
│  │  - H.264编码                                           │ │
│  │  - Socket服务                                          │ │
│  │  - 输入注入 (InputManager)                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
         │                             ▲
         │ VideoSocket                 │ 控制指令
         ▼                             │
┌──────────────────┐          ┌──────────────────┐
│     Demuxer      │          │   ControlMsg     │
│  (独立线程)       │          │  序列化/发送      │
│                  │          └──────────────────┘
│  - 接收H.264流   │
│  - 解析AVPacket  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│     Decoder      │
│                  │
│  - FFmpeg解码    │
│  - 输出YUV420    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  OpenGL渲染器    │
│                  │
│  - YUV→RGB着色器 │
│  - GPU渲染       │
│  - 显示到屏幕     │
└──────────────────┘
```

---

## 十、核心技术总结

### 10.1 投屏技术核心
1. **ADB通信**: 所有操作基于ADB协议
2. **双隧道模式**: Reverse(优先) + Forward(备用)
3. **双Socket架构**: 视频流 + 控制流分离
4. **H.264编码**: Android MediaCodec硬编码
5. **FFmpeg解码**: libavcodec软解或硬解
6. **OpenGL渲染**: GPU加速YUV渲染

### 10.2 控制技术核心
1. **二进制协议**: 自定义控制消息格式
2. **输入注入**: 通过Android InputManager
3. **坐标映射**: PC→设备坐标系转换
4. **多点触控**: 支持10点触摸模拟
5. **按键映射**: JSON脚本驱动的自定义映射

### 10.3 连接方式核心
1. **USB连接**:
   - 协议: ADB over USB
   - 优势: 低延迟(~30ms)、高带宽
   - 限制: 需物理连接

2. **WiFi连接**:
   - 协议: ADB over TCP/IP
   - 命令: `adb tcpip 5555` → `adb connect <ip>:5555`
   - 优势: 无线自由
   - 限制: 需同一局域网、延迟稍高

### 10.4 技术优势
- **跨平台**: Qt框架自动适配Windows/macOS/Linux
- **高性能**: 异步架构+GPU渲染,30~60fps
- **低延迟**: 35~70ms端到端延迟
- **可扩展**: 信号槽解耦,易于添加新功能
- **免ROOT**: 仅需ADB调试权限

---

## 十一、代码片段索引

### 关键文件路径
```
QtSmartMatrix/
├── SmartMatrixCore/
│   ├── src/
│   │   ├── adb/
│   │   │   ├── adbprocess.cpp          # ADB命令封装
│   │   │   └── adbprocessimpl.cpp      # ADB实现
│   │   ├── device/
│   │   │   ├── server/
│   │   │   │   ├── server.cpp          # 服务启动流程
│   │   │   │   ├── tcpserver.cpp       # TCP服务器
│   │   │   │   └── videosocket.cpp     # 视频Socket
│   │   │   ├── controller/
│   │   │   │   ├── controller.cpp      # 控制器
│   │   │   │   └── inputconvert/
│   │   │   │       ├── controlmsg.cpp  # 控制消息
│   │   │   │       └── keymap.cpp      # 按键映射
│   │   │   ├── decoder/
│   │   │   │   └── decoder.cpp         # FFmpeg解码
│   │   │   └── demuxer/
│   │   │       └── demuxer.cpp         # 流解复用
│   │   └── third_party/
│   │       ├── adb/                    # ADB可执行文件
│   │       ├── ffmpeg/                 # FFmpeg库
│   │       └── scrcpy-server           # Android服务端JAR
│   └── render/
│       └── qyuvopenglwidget.cpp        # OpenGL渲染
└── ui/
    ├── dialog.cpp                      # 主界面
    └── videoform.cpp                   # 视频窗口
```

---

## 十二、技术参考资料

### 官方文档
- [scrcpy原版项目](https://github.com/Genymobile/scrcpy)
- [Qt官方文档](https://doc.qt.io/)
- [FFmpeg文档](https://ffmpeg.org/documentation.html)
- [Android Debug Bridge (ADB)](https://developer.android.com/studio/command-line/adb)

### 相关技术
- Android MediaCodec API
- H.264视频编码标准
- OpenGL ES着色器编程
- Qt多线程编程
- TCP/IP Socket编程

---

**文档版本**: 1.0
**生成时间**: 2025-10-21
**分析对象**: SmartMatrix Qt 投屏软件
**技术栈**: C++ / Qt / FFmpeg / ADB / OpenGL
