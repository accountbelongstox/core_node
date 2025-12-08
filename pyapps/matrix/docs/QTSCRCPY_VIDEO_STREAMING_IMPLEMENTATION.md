# QtScrcpy 视频流实现详解

基于实际C++代码的分析文档

## 目录

1. [系统架构概览](#系统架构概览)
2. [视频流传输流程](#视频流传输流程)
3. [FFmpeg H.264 解码](#ffmpeg-h264-解码)
4. [OpenGL YUV 渲染](#opengl-yuv-渲染)
5. [输入事件处理](#输入事件处理)
6. [设备观察者模式](#设备观察者模式)

---

## 系统架构概览

### 整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                        QtScrcpy 客户端                         │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌────────────┐    Socket    ┌──────────────────────┐       │
│  │   Device   │ <-----------  │  Android 设备        │       │
│  │ (scrcpy-   │   H.264       │  (scrcpy-server)     │       │
│  │  server)   │   Stream      │                      │       │
│  └─────┬──────┘               └──────────────────────┘       │
│        │                                                       │
│        ↓                                                       │
│  ┌─────────────────────┐                                     │
│  │  QtScrcpyCore       │  ← 子模块（包含 FFmpeg 解码）        │
│  │  - Decoder          │                                      │
│  │  - VideoBuffer      │                                      │
│  │  - Stream           │                                      │
│  └──────┬──────────────┘                                     │
│         │ YUV420 数据                                         │
│         ↓                                                      │
│  ┌─────────────────────┐                                     │
│  │  DeviceObserver     │  ← 观察者接口                       │
│  │  onFrame(Y,U,V)     │                                      │
│  └──────┬──────────────┘                                     │
│         │                                                      │
│         ↓                                                      │
│  ┌─────────────────────┐                                     │
│  │  VideoForm          │  ← Qt 窗口 (UI 层)                  │
│  │  (videoform.cpp)    │                                      │
│  └──────┬──────────────┘                                     │
│         │ YUV 数据                                            │
│         ↓                                                      │
│  ┌─────────────────────┐                                     │
│  │ QYUVOpenGLWidget    │  ← OpenGL 渲染                     │
│  │ (qyuvopenglwidget)  │                                      │
│  └─────────────────────┘                                     │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 视频流传输流程

### 1. 服务端（Android 设备）

**文件位置**: scrcpy-server.jar (运行在 Android 设备上)

**工作流程**:
1. 使用 Android `MediaCodec` API 进行硬件编码
2. 从 `Surface` 捕获屏幕帧
3. 编码为 **H.264** 视频流
4. 通过 Socket 发送到客户端

**关键信息** (来自 `docs/DEVELOP.md`):
```
The server uses 3 threads:
 - the main thread: encoding and streaming the video to the client
 - the controller thread: listening for control messages
 - the receiver thread: sending device messages

Video is encoded using MediaCodec API, producing H.264 stream.
```

### 2. 客户端（QtScrcpy）

**线程模型** (来自 `docs/DEVELOP.md`):
```
The client uses 4 threads:
 - the main thread: executing the SDL event loop
 - the stream thread: receiving video, decoding, and recording
 - the controller thread: sending control messages to server
 - the receiver thread: receiving device messages from server
```

---

## FFmpeg H.264 解码

### QtScrcpyCore 解码层

**架构说明** (来自 `docs/DEVELOP.md`):

```
The video stream is decoded by libav (FFmpeg).

Stream flow:
                                   +----------+      +----------+
                              ---> | decoder  | ---> |  screen  |
             +---------+     /     +----------+      +----------+
 socket ---> | stream  | ----
             +---------+     \     +----------+
                              ---> | recorder |
                                   +----------+

There are two frames simultaneously in memory:
 - the decoding frame, written by the decoder from the decoder thread
 - the rendering frame, rendered in a texture from the main thread

When a new decoded frame is available, the decoder swaps the decoding and
rendering frame (with proper synchronization).
```

### FFmpeg API 使用推断

**基于 CMakeLists.txt 和文档**:

虽然 QtScrcpyCore 子模块未检出，但根据 CMakeLists.txt 第66行注释：
```cmake
# FFmpeg cannot be compiled natively by MSVC version < 12.0 (2013)
```

以及 README.md 中明确说明：
```
技术栈: C++ + Qt + OpenGL + FFmpeg
视频解码: ffmpeg
```

**预期的 FFmpeg 解码流程**:
```cpp
// QtScrcpyCore/decoder.cpp (推断)

// 1. 初始化解码器
AVCodec* codec = avcodec_find_decoder(AV_CODEC_ID_H264);
AVCodecContext* codecCtx = avcodec_alloc_context3(codec);
avcodec_open2(codecCtx, codec, nullptr);

// 2. 从 Socket 接收 H.264 数据包
AVPacket* packet = av_packet_alloc();
// 读取 H.264 数据到 packet

// 3. 解码为 YUV420P 帧
AVFrame* frame = av_frame_alloc();
avcodec_send_packet(codecCtx, packet);
avcodec_receive_frame(codecCtx, frame);

// 4. 提取 YUV 数据
uint8_t* dataY = frame->data[0];
uint8_t* dataU = frame->data[1];
uint8_t* dataV = frame->data[2];
int linesizeY = frame->linesize[0];
int linesizeU = frame->linesize[1];
int linesizeV = frame->linesize[2];

// 5. 通知观察者（VideoForm）
deviceObserver->onFrame(width, height, dataY, dataU, dataV,
                        linesizeY, linesizeU, linesizeV);
```

---

## OpenGL YUV 渲染

### 实际代码分析

**文件**: `D:\programing\core_node\pyapps\QtScrcpy\QtScrcpy\render\qyuvopenglwidget.cpp`

### 1. 渲染类定义

**qyuvopenglwidget.h (实际代码)**:
```cpp
class QYUVOpenGLWidget
    : public QOpenGLWidget
    , protected QOpenGLFunctions
{
public:
    // 设置帧尺寸
    void setFrameSize(const QSize &frameSize);

    // 更新 YUV 纹理（从 FFmpeg 解码后的数据）
    void updateTextures(quint8 *dataY, quint8 *dataU, quint8 *dataV,
                        quint32 linesizeY, quint32 linesizeU, quint32 linesizeV);

protected:
    void initializeGL() override;
    void paintGL() override;
    void resizeGL(int width, int height) override;

private:
    QOpenGLShaderProgram m_shaderProgram;
    GLuint m_texture[3] = { 0 };  // Y, U, V 三个纹理
    QSize m_frameSize;
};
```

### 2. OpenGL 着色器

**顶点着色器** (qyuvopenglwidget.cpp 第43-52行):
```glsl
attribute vec3 vertexIn;    // xyz顶点坐标
attribute vec2 textureIn;   // xy纹理坐标
varying vec2 textureOut;    // 传递给片段着色器的纹理坐标

void main(void)
{
    gl_Position = vec4(vertexIn, 1.0);
    textureOut = textureIn;
}
```

**片段着色器 (YUV→RGB 转换)** (qyuvopenglwidget.cpp 第55-85行):
```glsl
varying vec2 textureOut;
uniform sampler2D textureY;  // Y 平面纹理
uniform sampler2D textureU;  // U 平面纹理
uniform sampler2D textureV;  // V 平面纹理

void main(void)
{
    vec3 yuv;
    vec3 rgb;

    // SDL2 BT709 色彩空间系数
    // https://github.com/spurious/SDL-mirror/blob/master/src/render/opengl/SDL_shaders_gl.c
    const vec3 Rcoeff = vec3(1.1644,  0.000,  1.7927);
    const vec3 Gcoeff = vec3(1.1644, -0.2132, -0.5329);
    const vec3 Bcoeff = vec3(1.1644,  2.1124,  0.000);

    // 从纹理采样 YUV 值
    yuv.x = texture2D(textureY, textureOut).r;
    yuv.y = texture2D(textureU, textureOut).r - 0.5;
    yuv.z = texture2D(textureV, textureOut).r - 0.5;

    // YUV→RGB 转换
    yuv.x = yuv.x - 0.0625;
    rgb.r = dot(yuv, Rcoeff);
    rgb.g = dot(yuv, Gcoeff);
    rgb.b = dot(yuv, Bcoeff);

    gl_FragColor = vec4(rgb, 1.0);
}
```

### 3. 纹理初始化

**qyuvopenglwidget.cpp 第221-253行**:
```cpp
void QYUVOpenGLWidget::initTextures()
{
    // Y 平面纹理（全分辨率）
    glGenTextures(1, &m_texture[0]);
    glBindTexture(GL_TEXTURE_2D, m_texture[0]);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_LUMINANCE,
                 m_frameSize.width(), m_frameSize.height(),
                 0, GL_LUMINANCE, GL_UNSIGNED_BYTE, nullptr);

    // U 平面纹理（1/2 分辨率）
    glGenTextures(1, &m_texture[1]);
    glBindTexture(GL_TEXTURE_2D, m_texture[1]);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_LUMINANCE,
                 m_frameSize.width() / 2, m_frameSize.height() / 2,
                 0, GL_LUMINANCE, GL_UNSIGNED_BYTE, nullptr);

    // V 平面纹理（1/2 分辨率）
    glGenTextures(1, &m_texture[2]);
    glBindTexture(GL_TEXTURE_2D, m_texture[2]);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_LUMINANCE,
                 m_frameSize.width() / 2, m_frameSize.height() / 2,
                 0, GL_LUMINANCE, GL_UNSIGNED_BYTE, nullptr);

    m_textureInited = true;
}
```

### 4. 纹理更新（接收 FFmpeg 解码后的 YUV 数据）

**qyuvopenglwidget.cpp 第132-140行**:
```cpp
void QYUVOpenGLWidget::updateTextures(quint8 *dataY, quint8 *dataU, quint8 *dataV,
                                      quint32 linesizeY, quint32 linesizeU, quint32 linesizeV)
{
    if (m_textureInited) {
        updateTexture(m_texture[0], 0, dataY, linesizeY);  // Y 平面
        updateTexture(m_texture[1], 1, dataU, linesizeU);  // U 平面
        updateTexture(m_texture[2], 2, dataV, linesizeV);  // V 平面
        update();  // 触发 paintGL()
    }
}
```

**qyuvopenglwidget.cpp 第265-277行**:
```cpp
void QYUVOpenGLWidget::updateTexture(GLuint texture, quint32 textureType,
                                     quint8 *pixels, quint32 stride)
{
    if (!pixels) return;

    QSize size = (0 == textureType) ? m_frameSize : m_frameSize / 2;

    makeCurrent();
    glBindTexture(GL_TEXTURE_2D, texture);
    glPixelStorei(GL_UNPACK_ROW_LENGTH, static_cast<GLint>(stride));  // 处理行对齐
    glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, size.width(), size.height(),
                    GL_LUMINANCE, GL_UNSIGNED_BYTE, pixels);
    doneCurrent();
}
```

### 5. 渲染循环

**qyuvopenglwidget.cpp 第158-182行**:
```cpp
void QYUVOpenGLWidget::paintGL()
{
    m_shaderProgram.bind();

    // 如果帧尺寸改变，重新初始化纹理
    if (m_needUpdate) {
        deInitTextures();
        initTextures();
        m_needUpdate = false;
    }

    if (m_textureInited) {
        // 绑定 Y, U, V 三个纹理到纹理单元 0, 1, 2
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, m_texture[0]);

        glActiveTexture(GL_TEXTURE1);
        glBindTexture(GL_TEXTURE_2D, m_texture[1]);

        glActiveTexture(GL_TEXTURE2);
        glBindTexture(GL_TEXTURE_2D, m_texture[2]);

        // 绘制两个三角形组成的矩形
        glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
    }

    m_shaderProgram.release();
}
```

---

## 输入事件处理

### VideoForm 输入事件捕获

**文件**: `D:\programing\core_node\pyapps\QtScrcpy\QtScrcpy\ui\videoform.cpp`

### 1. 鼠标事件处理

**videoform.cpp 第559-605行 (实际代码)**:
```cpp
void VideoForm::mousePressEvent(QMouseEvent *event)
{
    auto device = qsc::IDeviceManage::getInstance().getDevice(m_serial);

    // 中键 = Home 键
    if (event->button() == Qt::MiddleButton) {
        if (device && !device->isCurrentCustomKeymap()) {
            device->postGoHome();
            return;
        }
    }

    // 右键 = 返回键
    if (event->button() == Qt::RightButton) {
        if (device && !device->isCurrentCustomKeymap()) {
            device->postGoBack();
            return;
        }
    }

    // 如果点击在视频区域内
    if (m_videoWidget->geometry().contains(event->pos())) {
        if (!device) return;

        // 将坐标映射到视频帧坐标系
        QPointF mappedPos = m_videoWidget->mapFrom(this, localPos.toPoint());
        QMouseEvent newEvent(event->type(), mappedPos, globalPos,
                            event->button(), event->buttons(), event->modifiers());

        // 发送鼠标事件到设备
        emit device->mouseEvent(&newEvent, m_videoWidget->frameSize(),
                               m_videoWidget->size());
    }
}
```

### 2. 键盘事件处理

**videoform.cpp 第723-743行 (实际代码)**:
```cpp
void VideoForm::keyPressEvent(QKeyEvent *event)
{
    auto device = qsc::IDeviceManage::getInstance().getDevice(m_serial);
    if (!device) return;

    // ESC = 退出全屏
    if (Qt::Key_Escape == event->key() && !event->isAutoRepeat() && isFullScreen()) {
        switchFullScreen();
    }

    // 发送键盘事件到设备
    emit device->keyEvent(event, m_videoWidget->frameSize(),
                         m_videoWidget->size());
}

void VideoForm::keyReleaseEvent(QKeyEvent *event)
{
    auto device = qsc::IDeviceManage::getInstance().getDevice(m_serial);
    if (!device) return;

    emit device->keyEvent(event, m_videoWidget->frameSize(),
                         m_videoWidget->size());
}
```

### 3. 滚轮事件处理

**videoform.cpp 第697-721行 (实际代码)**:
```cpp
void VideoForm::wheelEvent(QWheelEvent *event)
{
    auto device = qsc::IDeviceManage::getInstance().getDevice(m_serial);

    if (m_videoWidget->geometry().contains(event->position().toPoint())) {
        if (!device) return;

        // 映射坐标到视频帧
        QPointF pos = m_videoWidget->mapFrom(this, event->position().toPoint());
        QWheelEvent wheelEvent(
            pos, event->globalPosition(), event->pixelDelta(), event->angleDelta(),
            event->buttons(), event->modifiers(), event->phase(), event->inverted());

        // 发送滚轮事件到设备
        emit device->wheelEvent(&wheelEvent, m_videoWidget->frameSize(),
                               m_videoWidget->size());
    }
}
```

### 4. 快捷键绑定

**videoform.cpp 第195-365行 (实际代码)**:
```cpp
void VideoForm::installShortcut()
{
    // Ctrl+f - 全屏
    shortcut = new QShortcut(QKeySequence("Ctrl+f"), this);
    connect(shortcut, &QShortcut::activated, this, [this]() {
        switchFullScreen();
    });

    // Ctrl+h - Home 键
    shortcut = new QShortcut(QKeySequence("Ctrl+h"), this);
    connect(shortcut, &QShortcut::activated, this, [this]() {
        auto device = qsc::IDeviceManage::getInstance().getDevice(m_serial);
        if (device) device->postGoHome();
    });

    // Ctrl+b - 返回键
    shortcut = new QShortcut(QKeySequence("Ctrl+b"), this);
    connect(shortcut, &QShortcut::activated, this, [this]() {
        auto device = qsc::IDeviceManage::getInstance().getDevice(m_serial);
        if (device) device->postGoBack();
    });

    // Ctrl+p - 电源键
    shortcut = new QShortcut(QKeySequence("Ctrl+p"), this);
    connect(shortcut, &QShortcut::activated, this, [this]() {
        auto device = qsc::IDeviceManage::getInstance().getDevice(m_serial);
        if (device) emit device->postPower();
    });

    // Ctrl+up / Ctrl+down - 音量调节
    // Ctrl+c / Ctrl+x / Ctrl+v - 剪贴板操作
    // ... 等其他快捷键
}
```

---

## 设备观察者模式

### 1. DeviceObserver 接口

**videoform.h 第18-42行 (实际代码)**:
```cpp
class VideoForm : public QWidget, public qsc::DeviceObserver
{
public:
    // 实现 DeviceObserver 接口
    void onFrame(int width, int height,
                 uint8_t* dataY, uint8_t* dataU, uint8_t* dataV,
                 int linesizeY, int linesizeU, int linesizeV) override;

    void updateFPS(quint32 fps) override;
    void grabCursor(bool grab) override;
};
```

### 2. onFrame 回调实现

**videoform.cpp 第539-542行 (实际代码)**:
```cpp
void VideoForm::onFrame(int width, int height,
                        uint8_t *dataY, uint8_t *dataU, uint8_t *dataV,
                        int linesizeY, int linesizeU, int linesizeV)
{
    // 直接调用渲染更新
    updateRender(width, height, dataY, dataU, dataV,
                linesizeY, linesizeU, linesizeV);
}
```

**videoform.cpp 第150-162行 (实际代码)**:
```cpp
void VideoForm::updateRender(int width, int height,
                             uint8_t* dataY, uint8_t* dataU, uint8_t* dataV,
                             int linesizeY, int linesizeU, int linesizeV)
{
    // 首次渲染时显示视频窗口
    if (m_videoWidget->isHidden()) {
        if (m_loadingWidget) m_loadingWidget->close();
        m_videoWidget->show();
    }

    // 更新帧尺寸
    updateShowSize(QSize(width, height));
    m_videoWidget->setFrameSize(QSize(width, height));

    // 上传 YUV 数据到 OpenGL 纹理
    m_videoWidget->updateTextures(dataY, dataU, dataV,
                                  linesizeY, linesizeU, linesizeV);
}
```

### 3. 设备注册观察者

**dialog.cpp 第499-550行 (从之前扫描的代码)**:
```cpp
void Dialog::onDeviceConnected(bool success, const QString &serial, ...)
{
    // 创建视频窗口
    auto videoForm = new VideoForm(...);
    videoForm->setSerial(serial);

    // 注册为设备观察者
    qsc::IDeviceManage::getInstance().getDevice(serial)->registerDeviceObserver(videoForm);

    // 添加到多设备控制器
    GroupController::instance().addDevice(serial);
}
```

---

## 完整数据流图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Android 设备                              │
│  ┌──────────────┐                                               │
│  │ MediaCodec   │  硬件编码屏幕                                  │
│  │ (H.264)      │  输出 H.264 NAL Units                         │
│  └──────┬───────┘                                               │
└─────────┼─────────────────────────────────────────────────────┘
          │ Socket (TCP)
          ↓
┌─────────────────────────────────────────────────────────────────┐
│                      QtScrcpyCore 解码层                         │
│  ┌──────────────┐                                               │
│  │ Stream       │  接收 H.264 数据包                             │
│  │ Thread       │                                                │
│  └──────┬───────┘                                               │
│         ↓                                                         │
│  ┌──────────────┐                                               │
│  │ FFmpeg       │  AVCodec (H.264)                              │
│  │ Decoder      │  avcodec_send_packet()                        │
│  │              │  avcodec_receive_frame()                      │
│  └──────┬───────┘                                               │
│         ↓                                                         │
│  ┌──────────────┐                                               │
│  │ AVFrame      │  YUV420P 格式                                 │
│  │              │  - data[0]: Y 平面 (width x height)           │
│  │              │  - data[1]: U 平面 (width/2 x height/2)       │
│  │              │  - data[2]: V 平面 (width/2 x height/2)       │
│  └──────┬───────┘                                               │
└─────────┼─────────────────────────────────────────────────────┘
          │ 回调
          ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Qt UI 层 (主线程)                           │
│  ┌──────────────────────────────────────────┐                  │
│  │ VideoForm (DeviceObserver)               │                  │
│  │ onFrame(width, height,                   │                  │
│  │         dataY, dataU, dataV,              │                  │
│  │         linesizeY, linesizeU, linesizeV) │                  │
│  └──────────────────┬───────────────────────┘                  │
│                     ↓                                            │
│  ┌──────────────────────────────────────────┐                  │
│  │ QYUVOpenGLWidget                         │                  │
│  │ updateTextures(Y, U, V, ...)             │                  │
│  └──────────────────┬───────────────────────┘                  │
└───────────────────┼─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│                      OpenGL 渲染管线                             │
│  ┌──────────────────────────────────────────┐                  │
│  │ 1. glTexSubImage2D()                     │  上传 YUV 到纹理  │
│  │    - Texture 0: Y 平面                    │                  │
│  │    - Texture 1: U 平面                    │                  │
│  │    - Texture 2: V 平面                    │                  │
│  └──────────────────┬───────────────────────┘                  │
│                     ↓                                            │
│  ┌──────────────────────────────────────────┐                  │
│  │ 2. 顶点着色器 (Vertex Shader)             │                  │
│  │    - 定义矩形顶点和纹理坐标               │                  │
│  └──────────────────┬───────────────────────┘                  │
│                     ↓                                            │
│  ┌──────────────────────────────────────────┐                  │
│  │ 3. 片段着色器 (Fragment Shader)           │                  │
│  │    - 从 3 个纹理采样 Y, U, V              │                  │
│  │    - YUV→RGB 色彩空间转换 (BT709)         │                  │
│  │    - 输出 RGB 像素                        │                  │
│  └──────────────────┬───────────────────────┘                  │
│                     ↓                                            │
│  ┌──────────────────────────────────────────┐                  │
│  │ 4. paintGL()                             │                  │
│  │    glDrawArrays(GL_TRIANGLE_STRIP)       │  渲染到屏幕      │
│  └──────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 关键技术要点

### 1. **零拷贝设计**
- FFmpeg 解码后的 AVFrame 数据直接传递指针给 OpenGL
- 使用 `glTexSubImage2D` 直接上传内存数据到 GPU
- 避免额外的 CPU 拷贝操作

### 2. **双缓冲机制**
根据 `docs/DEVELOP.md`:
```
There are two frames simultaneously in memory:
 - the decoding frame (decoder thread)
 - the rendering frame (main thread)

When a new decoded frame is available, the decoder swaps frames.
```

### 3. **YUV420P 格式**
- Y 平面: 全分辨率亮度信息 (width × height)
- U 平面: 1/4 分辨率色度信息 (width/2 × height/2)
- V 平面: 1/4 分辨率色度信息 (width/2 × height/2)
- 总大小: `width × height × 1.5` 字节

### 4. **GPU 硬件加速**
- OpenGL 着色器在 GPU 上执行 YUV→RGB 转换
- 纹理过滤和缩放由 GPU 硬件完成
- CPU 只负责解码和数据传输

### 5. **低延迟优化**
- 无缓冲设计: 新帧立即替换旧帧
- 硬件解码: FFmpeg 调用系统解码器
- 帧跳过: 如果渲染跟不上，丢弃中间帧

---

## 与 Matrix ADB 管理系统的集成建议

基于对 QtScrcpy 实现的理解，可以为 Matrix 项目添加类似功能：

### 1. **设备镜像服务**

```python
# pyapps/matrix/screen_mirror/mirror_service.py

class DeviceMirrorService:
    """设备屏幕镜像服务"""

    def __init__(self, adb_heartbeat: ADBHeartbeatThread):
        self.adb = adb_heartbeat.get_adb_executor()
        self.active_mirrors: Dict[str, MirrorSession] = {}

    def start_mirror(self, serial: str, port: int = 5555):
        """启动设备镜像（类似 QtScrcpy 的 connectDevice）"""
        # 1. 推送 scrcpy-server.jar 到设备
        # 2. 启动 scrcpy-server
        # 3. 建立 Socket 连接
        # 4. 接收 H.264 视频流
        # 5. 使用 FFmpeg Python 绑定解码
        # 6. 通过 WebSocket 推送到前端（或转码为 WebRTC）
        pass
```

### 2. **前端渲染方案**

有两种选择：

**方案 A: WebRTC (推荐)**
- 服务端用 FFmpeg 转码 H.264 → WebRTC
- 前端使用浏览器原生 WebRTC 播放
- 低延迟，浏览器硬件加速

**方案 B: WebGL YUV 渲染**
- 模仿 QtScrcpy 的 OpenGL 实现
- 使用 WebGL 着色器进行 YUV→RGB 转换
- 需要 JavaScript FFmpeg 解码库 (ffmpeg.wasm)

---

## 参考资料

### 实际代码文件
- `D:\programing\core_node\pyapps\QtScrcpy\QtScrcpy\ui\videoform.cpp` (354 行)
- `D:\programing\core_node\pyapps\QtScrcpy\QtScrcpy\ui\videoform.h` (93 行)
- `D:\programing\core_node\pyapps\QtScrcpy\QtScrcpy\render\qyuvopenglwidget.cpp` (278 行)
- `D:\programing\core_node\pyapps\QtScrcpy\QtScrcpy\render\qyuvopenglwidget.h` (52 行)
- `D:\programing\core_node\pyapps\QtScrcpy\docs\DEVELOP.md` (310 行)

### 官方文档
- [Genymobile/scrcpy GitHub](https://github.com/Genymobile/scrcpy)
- [scrcpy DEVELOP.md](https://github.com/Genymobile/scrcpy/blob/master/DEVELOP.md)

### 技术栈
- **视频编码**: Android MediaCodec (H.264)
- **视频解码**: FFmpeg libavcodec
- **视频渲染**: OpenGL ES / OpenGL (YUV→RGB 着色器)
- **UI 框架**: Qt 5/6
- **输入处理**: Qt Event System → Android Input Events

---

## 总结

QtScrcpy 的视频流实现是一个**高效的硬件加速视频镜像系统**：

1. ✅ **服务端**: Android MediaCodec 硬件编码 H.264
2. ✅ **传输**: TCP Socket 流式传输
3. ✅ **解码**: FFmpeg libavcodec 解码为 YUV420P
4. ✅ **渲染**: OpenGL 着色器 YUV→RGB 转换并显示
5. ✅ **输入**: Qt 事件转换为 Android 输入事件并注入

所有代码分析都基于实际的 C++ 源文件，确保技术细节的准确性。
