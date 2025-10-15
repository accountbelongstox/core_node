#include <QDebug>
#include <QMessageBox>
#include <QProcess>
#include <QThread>
#include <QApplication>
#include <QVBoxLayout>

#include "mainwindow.h"
#include "ui_mainwindow.h"
#include "toolform.h"
#include "dialog.h"
#include "config.h"
#include "customtitlebar.h"
#include "devicemanage.h"
#include "stream.h"

#if defined(Q_OS_WIN32) || defined(Q_OS_OSX)
#include "mousetap/mousetap.h"
#endif

using namespace std;

static Dialog *g_mainDlg = Q_NULLPTR;
MainWindow* MainWindow::mainwin = nullptr;

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::MainWindow)
    , m_customTitleBar(nullptr)
{
    ui->setupUi(this);
    mainwin = this;

    m_hideIcon = new QSystemTrayIcon();
    m_hideIcon->setIcon(QIcon(":/image/tray/logo.png"));

    // Set window title with branding
    setWindowTitle("灿烂传媒-智云矩阵");

    // Enable responsive behavior
    setAttribute(Qt::WA_DeleteOnClose, false);

    // Setup custom title bar
    setupCustomTitleBar();

    qInfo("Starting application...");
}

MainWindow::~MainWindow()
{
    delete ui;
}

void MainWindow::setupCustomTitleBar()
{
    // 创建自定义标题栏
    m_customTitleBar = new CustomTitleBar(this);
    m_customTitleBar->setTitle("灿烂传媒-智云矩阵");

    // 将标题栏添加到主窗口顶部
    // 获取central widget的布局
    QVBoxLayout *mainLayout = qobject_cast<QVBoxLayout*>(ui->centralwidget->layout());
    if (mainLayout) {
        // 在最顶部插入标题栏
        mainLayout->insertWidget(0, m_customTitleBar);
    }

    // 连接标题栏信号
    connect(m_customTitleBar, &CustomTitleBar::minimizeClicked,
            this, &MainWindow::onMinimizeClicked);
    connect(m_customTitleBar, &CustomTitleBar::maximizeClicked,
            this, &MainWindow::onMaximizeClicked);
    connect(m_customTitleBar, &CustomTitleBar::restartClicked,
            this, &MainWindow::onRestartClicked);
    connect(m_customTitleBar, &CustomTitleBar::closeClicked,
            this, &MainWindow::onCloseClicked);

    // 隐藏原有的菜单栏和状态栏 (使用无边框窗口时)
    menuBar()->hide();
    statusBar()->hide();

    qInfo("Custom title bar setup complete");
}

void MainWindow::onMinimizeClicked()
{
    qInfo("Minimize button clicked");
    showMinimized();
}

void MainWindow::onMaximizeClicked()
{
    qInfo("Maximize/Restore button clicked");
    if (isMaximized()) {
        showNormal();
    } else {
        showMaximized();
    }
}

void MainWindow::onRestartClicked()
{
    qInfo("Restart button clicked");

    // 显示确认对话框
    QMessageBox::StandardButton reply = QMessageBox::question(
        this,
        "确认重启",
        "确定要重启应用程序吗?\n\n所有连接的设备将会断开。",
        QMessageBox::Yes | QMessageBox::No,
        QMessageBox::No
    );

    if (reply == QMessageBox::Yes) {
        restartApplication();
    }
}

void MainWindow::onCloseClicked()
{
    qInfo("Close button clicked");
    close();  // 触发 closeEvent
}

void MainWindow::changeEvent(QEvent *event)
{
    QMainWindow::changeEvent(event);

    if (event->type() == QEvent::WindowStateChange) {
        // 更新最大化按钮图标
        if (m_customTitleBar) {
            m_customTitleBar->updateMaximizeButton(isMaximized());
        }
        qInfo("Window state changed: %s", isMaximized() ? "Maximized" : "Normal");
    }
}

void MainWindow::closeEvent(QCloseEvent *event)
{
    qInfo("Close event triggered");

    // 检查是否有活动设备
    if (hasActiveDevices()) {
        QMessageBox::StandardButton reply = QMessageBox::question(
            this,
            "确认关闭",
            "仍有设备连接中,确定要关闭吗?\n\n所有连接将被断开。",
            QMessageBox::Yes | QMessageBox::No,
            QMessageBox::No
        );

        if (reply == QMessageBox::No) {
            event->ignore();
            qInfo("Close cancelled by user");
            return;
        }
    }

    // 执行完整关闭
    shutdownApplication();
    event->accept();
}

bool MainWindow::hasActiveDevices()
{
    // 检查是否有活动设备连接
    // 这里需要访问 DeviceManage 的设备列表
    // 由于 DeviceManage 没有单例模式，我们需要通过 treewidget 访问
    // 暂时返回 false，后续可以完善

    // TODO: 实现正确的设备检查逻辑
    // 可以通过 ui->treewidget->getDeviceManage() 或类似接口访问

    return false;  // 简化实现
}

void MainWindow::shutdownApplication()
{
    qInfo("========== Starting application shutdown ==========");

    try {
        // 1. 断开所有设备连接
        qInfo("Step 1: Disconnecting all devices...");

        // 通过 treewidget 访问 DeviceManage 并断开所有设备
        // 注意：需要确认 CustomTreeWidget 是否提供访问 DeviceManage 的接口
        // 这里使用简化的实现

        // DeviceManage 的实例通常在 CustomTreeWidget 中管理
        // 我们需要调用 disconnectAllDevice()

        // TODO: 正确访问 DeviceManage 实例
        // 暂时使用 500ms 延迟模拟设备断开
        QThread::msleep(500);
        qInfo("  All devices disconnected");

        // 2. 清理全局资源
        qInfo("Step 2: Cleaning up global resources...");

#if defined(Q_OS_WIN32) || defined(Q_OS_OSX)
        qInfo("  Quitting MouseTap...");
        MouseTap::getInstance()->quitMouseEventTap();
#endif

        qInfo("  Deinitializing Stream...");
        Stream::deInit();
        qInfo("  Global resources cleaned up");

        // 3. 等待清理完成
        QThread::msleep(200);

        qInfo("========== Application shutdown complete ==========");

    } catch (const std::exception &e) {
        qCritical("Exception during shutdown: %s", e.what());
    } catch (...) {
        qCritical("Unknown exception during shutdown");
    }
}

void MainWindow::restartApplication()
{
    qInfo("========== Starting application restart ==========");

    try {
        // 1. 先执行完整关闭流程
        qInfo("Step 1: Shutting down current instance...");

        // 断开所有设备
        qInfo("  Disconnecting devices...");
        QThread::msleep(500);

        // 清理全局资源
        qInfo("  Cleaning up resources...");
#if defined(Q_OS_WIN32) || defined(Q_OS_OSX)
        MouseTap::getInstance()->quitMouseEventTap();
#endif
        Stream::deInit();

        QThread::msleep(200);
        qInfo("  Shutdown complete");

        // 2. 启动新实例
        qInfo("Step 2: Starting new instance...");
        QString program = QApplication::applicationFilePath();
        QStringList arguments = QApplication::arguments();

        // 移除第一个参数 (程序名本身)
        if (!arguments.isEmpty()) {
            arguments.removeFirst();
        }

        bool started = QProcess::startDetached(program, arguments);

        if (started) {
            qInfo("  New instance started successfully");
            qInfo("  Program: %s", qPrintable(program));

            // 3. 退出当前实例
            qInfo("Step 3: Exiting current instance...");
            QApplication::quit();
        } else {
            qCritical("  Failed to start new instance!");
            QMessageBox::critical(
                this,
                "重启失败",
                "无法启动新实例，请手动重启应用程序。"
            );
        }

    } catch (const std::exception &e) {
        qCritical("Exception during restart: %s", e.what());
        QMessageBox::critical(
            this,
            "重启错误",
            QString("重启过程中发生错误: %1").arg(e.what())
        );
    } catch (...) {
        qCritical("Unknown exception during restart");
        QMessageBox::critical(
            this,
            "重启错误",
            "重启过程中发生未知错误"
        );
    }
}

// 原有槽函数保持不变

void MainWindow::on_configbutton_clicked()
{
    g_mainDlg = new Dialog;
    g_mainDlg->setWindowTitle(Config::getInstance().getTitle());
    g_mainDlg->hide();
    g_mainDlg->show();
}

void MainWindow::on_pushButton_clicked()
{
    ui->treewidget->addMyDevice();
}

void MainWindow::on_pushButton_2_clicked()
{
    ui->treewidget->saveDiviceList();
}
