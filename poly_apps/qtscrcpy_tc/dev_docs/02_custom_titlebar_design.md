# 自定义标题栏设计文档

**日期**: 2025-10-14
**功能**: 自定义无边框窗口标题栏
**相关任务**: 实现最小化、最大化、重启、关闭功能

---

## 1. 设计目标

### 功能需求
1. **标题显示**: 显示应用名称 "灿烂传媒-智云矩阵"
2. **窗口拖动**: 支持鼠标拖动移动窗口
3. **双击最大化**: 双击标题栏切换最大化/还原
4. **最小化按钮**: 最小化窗口到任务栏
5. **最大化/还原按钮**: 切换最大化状态
6. **重启按钮**: 重启应用程序
7. **关闭按钮**: 完整关闭应用

### 非功能需求
1. **美观**: 现代化扁平设计
2. **响应式**: 自适应窗口大小
3. **流畅**: 动画过渡自然
4. **可维护**: 代码结构清晰

---

## 2. UI设计规格

### 2.1 布局结构

```
CustomTitleBar (QWidget)
├── QHBoxLayout (margin: 0, spacing: 0)
│   ├── titleLabel (QLabel) - 应用标题
│   ├── Spacer (QSpacerItem) - 弹性空间
│   ├── minimizeButton (QPushButton)
│   ├── maximizeButton (QPushButton)
│   ├── restartButton (QPushButton)
│   └── closeButton (QPushButton)
```

### 2.2 尺寸规格

- **标题栏高度**: 40px
- **按钮尺寸**: 40x40px (正方形)
- **标题字体**: 14pt, 加粗
- **按钮图标**: 16x16px (或使用字体图标)
- **左侧边距**: 15px
- **按钮间距**: 0px (无缝连接)

### 2.3 颜色方案

#### 默认主题
```css
/* 标题栏背景 */
background: #2c3e50;

/* 标题文字 */
color: #ecf0f1;

/* 按钮默认状态 */
button-background: transparent;
button-text: #ecf0f1;

/* 按钮悬停状态 */
button-hover-background: #34495e;

/* 按钮按下状态 */
button-pressed-background: #1abc9c;

/* 关闭按钮特殊颜色 */
close-button-hover: #e74c3c;
close-button-pressed: #c0392b;

/* 重启按钮特殊颜色 */
restart-button-hover: #f39c12;
restart-button-pressed: #e67e22;
```

---

## 3. 类设计

### 3.1 CustomTitleBar类

```cpp
class CustomTitleBar : public QWidget
{
    Q_OBJECT

public:
    explicit CustomTitleBar(QWidget *parent = nullptr);
    ~CustomTitleBar();

    // 设置标题
    void setTitle(const QString &title);

    // 更新最大化按钮图标
    void updateMaximizeButton(bool isMaximized);

signals:
    // 按钮点击信号
    void minimizeClicked();
    void maximizeClicked();
    void restartClicked();
    void closeClicked();

protected:
    // 鼠标事件处理 - 实现窗口拖动
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;
    void mouseDoubleClickEvent(QMouseEvent *event) override;

private:
    void setupUI();
    void setupConnections();
    void applyStyles();

private:
    QLabel *m_titleLabel;
    QPushButton *m_minimizeButton;
    QPushButton *m_maximizeButton;
    QPushButton *m_restartButton;
    QPushButton *m_closeButton;

    QPoint m_dragPosition;
    bool m_isDragging;
};
```

---

## 4. 实现细节

### 4.1 窗口拖动实现

```cpp
void CustomTitleBar::mousePressEvent(QMouseEvent *event)
{
    if (event->button() == Qt::LeftButton) {
        m_isDragging = true;
        m_dragPosition = event->globalPosition().toPoint() -
                         window()->frameGeometry().topLeft();
        event->accept();
    }
}

void CustomTitleBar::mouseMoveEvent(QMouseEvent *event)
{
    if (m_isDragging && (event->buttons() & Qt::LeftButton)) {
        // 防止在最大化状态下拖动
        if (window()->isMaximized()) {
            return;
        }
        window()->move(event->globalPosition().toPoint() - m_dragPosition);
        event->accept();
    }
}

void CustomTitleBar::mouseReleaseEvent(QMouseEvent *event)
{
    if (event->button() == Qt::LeftButton) {
        m_isDragging = false;
        event->accept();
    }
}
```

### 4.2 双击最大化实现

```cpp
void CustomTitleBar::mouseDoubleClickEvent(QMouseEvent *event)
{
    if (event->button() == Qt::LeftButton) {
        emit maximizeClicked();
        event->accept();
    }
}
```

### 4.3 按钮图标

使用Unicode字符作为图标 (跨平台兼容性好):

```cpp
m_minimizeButton->setText("—");  // U+2014 (EM DASH)
m_maximizeButton->setText("□");  // U+25A1 (WHITE SQUARE)
m_restartButton->setText("⟲");   // U+27F2 (ANTICLOCKWISE GAPPED CIRCLE ARROW)
m_closeButton->setText("✕");     // U+2715 (MULTIPLICATION X)

// 还原按钮时的图标
// m_maximizeButton->setText("❐");  // U+2750 (UPPER RIGHT DROP-SHADOWED WHITE SQUARE)
```

### 4.4 样式表 (QSS)

```cpp
QString CustomTitleBar::getStyleSheet()
{
    return R"(
        CustomTitleBar {
            background-color: #2c3e50;
            min-height: 40px;
            max-height: 40px;
        }

        QLabel#titleLabel {
            color: #ecf0f1;
            font-size: 14pt;
            font-weight: bold;
            padding-left: 15px;
        }

        QPushButton {
            background-color: transparent;
            color: #ecf0f1;
            border: none;
            font-size: 16pt;
            min-width: 40px;
            max-width: 40px;
            min-height: 40px;
            max-height: 40px;
        }

        QPushButton:hover {
            background-color: #34495e;
        }

        QPushButton:pressed {
            background-color: #1abc9c;
        }

        QPushButton#closeButton:hover {
            background-color: #e74c3c;
        }

        QPushButton#closeButton:pressed {
            background-color: #c0392b;
        }

        QPushButton#restartButton:hover {
            background-color: #f39c12;
        }

        QPushButton#restartButton:pressed {
            background-color: #e67e22;
        }
    )";
}
```

---

## 5. MainWindow集成

### 5.1 修改 MainWindow 结构

```cpp
// mainwindow.h
class MainWindow : public QMainWindow
{
    Q_OBJECT
public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private slots:
    void onMinimizeClicked();
    void onMaximizeClicked();
    void onRestartClicked();
    void onCloseClicked();

    // 原有槽函数...
    void on_configbutton_clicked();
    void on_pushButton_clicked();
    void on_pushButton_2_clicked();

protected:
    void changeEvent(QEvent *event) override;  // 监听窗口状态变化

private:
    void setupCustomTitleBar();
    void shutdownApplication();  // 完整关闭逻辑
    void restartApplication();   // 重启逻辑

private:
    Ui::MainWindow *ui;
    CustomTitleBar *m_customTitleBar;
    QSystemTrayIcon *m_hideIcon;

public:
    static MainWindow *mainwin;
};
```

### 5.2 Main.cpp 修改

```cpp
int main(int argc, char *argv[])
{
    // 初始化...

    MainWindow w;

    // 设置无边框窗口
    w.setWindowFlags(Qt::Window | Qt::FramelessWindowHint);

    // 设置全屏 (真正的全屏)
    w.showMaximized();  // 先最大化

    // 或者使用几何信息设置全屏
    // QScreen *screen = QApplication::primaryScreen();
    // w.setGeometry(screen->geometry());

    w.show();

    return a.exec();
}
```

---

## 6. 完整关闭逻辑设计

### 6.1 关闭顺序

```cpp
void MainWindow::shutdownApplication()
{
    qInfo("Starting application shutdown...");

    // 1. 显示关闭提示 (可选)
    // QMessageBox::information(this, "关闭", "正在关闭应用...");

    // 2. 断开所有设备连接
    qInfo("Disconnecting all devices...");
    DeviceManage::getInstance().disconnectAllDevice();

    // 等待设备关闭完成
    QThread::msleep(500);

    // 3. 清理全局资源
    qInfo("Cleaning up global resources...");

#if defined(Q_OS_WIN32) || defined(Q_OS_OSX)
    MouseTap::getInstance()->quitMouseEventTap();
#endif

    Stream::deInit();

    // 4. 关闭主窗口
    qInfo("Closing main window...");
    close();

    // 5. 退出应用
    qInfo("Application shutdown complete.");
    QApplication::quit();
}
```

### 6.2 优雅关闭检查

```cpp
void MainWindow::closeEvent(QCloseEvent *event)
{
    // 检查是否有正在进行的操作
    if (hasActiveDevices()) {
        QMessageBox::StandardButton reply = QMessageBox::question(
            this,
            "确认关闭",
            "仍有设备连接中,确定要关闭吗?",
            QMessageBox::Yes | QMessageBox::No
        );

        if (reply == QMessageBox::No) {
            event->ignore();
            return;
        }
    }

    // 执行完整关闭
    shutdownApplication();
    event->accept();
}
```

---

## 7. 重启逻辑设计

### 方案选择: QProcess重启 (推荐)

```cpp
void MainWindow::restartApplication()
{
    qInfo("Restarting application...");

    // 1. 先执行完整关闭流程
    qInfo("Shutting down before restart...");

    // 断开所有设备
    DeviceManage::getInstance().disconnectAllDevice();
    QThread::msleep(500);

    // 清理全局资源
#if defined(Q_OS_WIN32) || defined(Q_OS_OSX)
    MouseTap::getInstance()->quitMouseEventTap();
#endif
    Stream::deInit();

    // 2. 启动新实例
    qInfo("Starting new instance...");
    QProcess::startDetached(
        QApplication::applicationFilePath(),
        QApplication::arguments()
    );

    // 3. 退出当前实例
    qInfo("Exiting current instance...");
    QApplication::quit();
}
```

### 重启确认对话框

```cpp
void MainWindow::onRestartClicked()
{
    QMessageBox::StandardButton reply = QMessageBox::question(
        this,
        "确认重启",
        "确定要重启应用程序吗?",
        QMessageBox::Yes | QMessageBox::No
    );

    if (reply == QMessageBox::Yes) {
        restartApplication();
    }
}
```

---

## 8. 全屏修复方案

### 问题分析
当前实现使用 `Qt::FramelessWindowHint + Qt::WindowStaysOnTopHint + Qt::WindowFullScreen`,
但仍不能覆盖Windows任务栏。

### 解决方案

#### 方案A: 使用屏幕几何信息
```cpp
void MainWindow::setTrueFullScreen()
{
    // 设置无边框
    setWindowFlags(Qt::Window | Qt::FramelessWindowHint);

    // 获取主屏幕
    QScreen *screen = QApplication::primaryScreen();

    // 设置窗口几何为屏幕完整区域
    setGeometry(screen->geometry());

    // 显示并置顶
    showNormal();
    raise();
    activateWindow();
}
```

#### 方案B: Windows特定API (推荐)
```cpp
#ifdef Q_OS_WIN32
#include <windows.h>

void MainWindow::setTrueFullScreen()
{
    // Qt设置
    setWindowFlags(Qt::Window | Qt::FramelessWindowHint);

    // 获取窗口句柄
    HWND hwnd = (HWND)winId();

    // 设置窗口样式
    SetWindowLong(hwnd, GWL_STYLE,
                  WS_POPUP | WS_VISIBLE);

    // 获取屏幕尺寸
    int width = GetSystemMetrics(SM_CXSCREEN);
    int height = GetSystemMetrics(SM_CYSCREEN);

    // 设置窗口位置和大小
    SetWindowPos(hwnd, HWND_TOP,
                 0, 0, width, height,
                 SWP_SHOWWINDOW);

    show();
}
#endif
```

#### 方案C: 混合方案 (最佳)
```cpp
void MainWindow::enterFullScreen()
{
    setWindowFlags(Qt::Window | Qt::FramelessWindowHint);

#ifdef Q_OS_WIN32
    // Windows特定处理
    HWND hwnd = (HWND)winId();
    SetWindowLong(hwnd, GWL_STYLE, WS_POPUP | WS_VISIBLE);

    QScreen *screen = QApplication::primaryScreen();
    QRect screenGeometry = screen->geometry();

    SetWindowPos(hwnd, HWND_TOP,
                 screenGeometry.x(), screenGeometry.y(),
                 screenGeometry.width(), screenGeometry.height(),
                 SWP_SHOWWINDOW);
#else
    // 其他平台使用Qt API
    QScreen *screen = QApplication::primaryScreen();
    setGeometry(screen->geometry());
#endif

    showNormal();
    raise();
    activateWindow();
}
```

---

## 9. 实现步骤

### 步骤1: 创建CustomTitleBar类
- [ ] 创建 customtitlebar.h
- [ ] 创建 customtitlebar.cpp
- [ ] 实现UI布局
- [ ] 实现样式表
- [ ] 实现拖动逻辑

### 步骤2: 集成到MainWindow
- [ ] 修改 mainwindow.h 添加成员
- [ ] 修改 mainwindow.cpp 集成标题栏
- [ ] 连接信号槽
- [ ] 移除原有menubar

### 步骤3: 实现关闭逻辑
- [ ] 实现 shutdownApplication()
- [ ] 实现 closeEvent() 重写
- [ ] 测试设备清理

### 步骤4: 实现重启逻辑
- [ ] 实现 restartApplication()
- [ ] 添加确认对话框
- [ ] 测试重启流程

### 步骤5: 修复全屏
- [ ] 实现 enterFullScreen()
- [ ] 修改 main.cpp
- [ ] 测试任务栏覆盖

### 步骤6: UI美化
- [ ] 优化颜色方案
- [ ] 添加过渡动画
- [ ] 响应式测试

### 步骤7: 全面测试
- [ ] 功能测试
- [ ] 边界测试
- [ ] 性能测试

---

## 10. 测试计划

### 功能测试
1. ✅ 标题栏显示正确
2. ✅ 窗口拖动流畅
3. ✅ 双击最大化工作
4. ✅ 最小化按钮功能
5. ✅ 最大化/还原切换
6. ✅ 重启功能正常
7. ✅ 关闭完整清理
8. ✅ 全屏覆盖任务栏

### 边界测试
1. 多显示器环境
2. 不同DPI设置
3. 有设备连接时关闭
4. 正在录制时关闭
5. 快速重复点击按钮

### 性能测试
1. 拖动响应延迟
2. 关闭清理时间
3. 重启启动时间

---

**文档作者**: Claude (AI Assistant)
**下次更新**: CustomTitleBar实现完成后
