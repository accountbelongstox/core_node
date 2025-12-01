#include "modernmainwindow.h"
#include <QApplication>
#include <QScreen>
#include <QDir>
#include <QStandardPaths>
#include <QFileDialog>
#include <QInputDialog>
#include <QColorDialog>
#include <QMessageBox>
#include <QDebug>

// 测试数据函数声明
void addTestData(ModernDeviceGroupManager *manager);

ModernMainWindow::ModernMainWindow(QWidget *parent)
    : QMainWindow(parent)
    , m_centralWidget(nullptr)
    , m_mainSplitter(nullptr)
    , m_centralLayout(nullptr)
    , m_deviceTreeWidget(nullptr)
    , m_rightPanel(nullptr)
    , m_deviceGroupManager(nullptr)
    , m_menuBar(nullptr)
    , m_toolBar(nullptr)
    , m_statusBar(nullptr)
    , m_fileMenu(nullptr)
    , m_editMenu(nullptr)
    , m_viewMenu(nullptr)
    , m_toolsMenu(nullptr)
    , m_helpMenu(nullptr)
    , m_trayMenu(nullptr)
    , m_newGroupAction(nullptr)
    , m_deleteGroupAction(nullptr)
    , m_groupSettingsAction(nullptr)
    , m_deviceSettingsAction(nullptr)
    , m_globalSettingsAction(nullptr)
    , m_aboutAction(nullptr)
    , m_exitAction(nullptr)
    , m_minimizeToTrayAction(nullptr)
    , m_showWindowAction(nullptr)
    , m_quitApplicationAction(nullptr)
    , m_statusLabel(nullptr)
    , m_deviceCountLabel(nullptr)
    , m_connectionStatusLabel(nullptr)
    , m_operationProgressBar(nullptr)
    , m_trayIcon(nullptr)
    , m_settings(nullptr)
    , m_minimizeToTray(true)
    , m_startMinimized(false)
    , m_showNotifications(true)
    , m_autoConnect(false)
    , m_connectionTimeout(30)
    , m_quality(80)
    , m_resolution("1080p")
    , m_statusUpdateTimer(nullptr)
{
    // 初始化设置
    m_settings = new QSettings("SmartMatrix", "ModernUI", this);
    loadSettings();

    // 设置窗口属性
    setWindowTitle("SmartMatrix - Modern Device Manager");
    setMinimumSize(1000, 700);
    resize(1200, 800);

    // 创建UI
    setupUI();
    createMenuBar();
    createToolBar();
    createStatusBar();
    createSystemTray();
    setupConnections();
    applyModernStyle();

    // 启动状态更新定时器
    m_statusUpdateTimer = new QTimer(this);
    connect(m_statusUpdateTimer, &QTimer::timeout, this, &ModernMainWindow::updateStatusBar);
    m_statusUpdateTimer->start(1000); // 每秒更新一次

    // 初始状态更新
    updateStatusBar();
    updateWindowTitle();

    // 如果设置了启动时最小化，则最小化到托盘
    if (m_startMinimized) {
        hide();
        if (m_trayIcon) {
            m_trayIcon->show();
        }
    }
}

ModernMainWindow::~ModernMainWindow()
{
    saveSettings();
}

void ModernMainWindow::closeEvent(QCloseEvent *event)
{
    if (m_minimizeToTray && m_trayIcon && m_trayIcon->isVisible()) {
        hide();
        if (m_showNotifications) {
            m_trayIcon->showMessage("SmartMatrix", "Application minimized to tray", 
                                  QSystemTrayIcon::Information, 2000);
        }
        event->ignore();
    } else {
        event->accept();
    }
}

void ModernMainWindow::showEvent(QShowEvent *event)
{
    QMainWindow::showEvent(event);
    updateStatusBar();
}

void ModernMainWindow::hideEvent(QHideEvent *event)
{
    QMainWindow::hideEvent(event);
}

void ModernMainWindow::resizeEvent(QResizeEvent *event)
{
    QMainWindow::resizeEvent(event);
    saveSettings();
}

void ModernMainWindow::moveEvent(QMoveEvent *event)
{
    QMainWindow::moveEvent(event);
    saveSettings();
}

void ModernMainWindow::setupUI()
{
    // 创建中央部件
    m_centralWidget = new QWidget(this);
    setCentralWidget(m_centralWidget);

    // 创建主布局
    m_centralLayout = new QHBoxLayout(m_centralWidget);
    m_centralLayout->setContentsMargins(0, 0, 0, 0);
    m_centralLayout->setSpacing(0);

    // 创建分割器
    m_mainSplitter = new QSplitter(Qt::Horizontal, this);
    m_centralLayout->addWidget(m_mainSplitter);

    // 创建设备组管理器
    m_deviceGroupManager = new ModernDeviceGroupManager(this);
    
    // 添加测试数据
    addTestData(m_deviceGroupManager);

    // 创建设备树部件
    m_deviceTreeWidget = new ModernDeviceTreeWidget(this);
    m_deviceTreeWidget->setDeviceGroupManager(m_deviceGroupManager);
    m_deviceTreeWidget->setCheckboxEnabled(true);
    m_deviceTreeWidget->setShowRootGroup(true);
    m_deviceTreeWidget->setShowGroupColorIndicator(true);
    m_mainSplitter->addWidget(m_deviceTreeWidget);

    // 创建右侧面板
    m_rightPanel = new ModernRightPanel(this);
    m_rightPanel->setDeviceGroupManager(m_deviceGroupManager);
    m_mainSplitter->addWidget(m_rightPanel);

    // 设置分割器比例 (左侧60%, 右侧40%)
    m_mainSplitter->setSizes({600, 400});
    m_mainSplitter->setStretchFactor(0, 3);
    m_mainSplitter->setStretchFactor(1, 2);
}

void ModernMainWindow::createMenuBar()
{
    m_menuBar = menuBar();

    // 文件菜单
    m_fileMenu = m_menuBar->addMenu("&File");
    
    m_newGroupAction = new QAction("&New Group", this);
    m_newGroupAction->setShortcut(QKeySequence::New);
    m_newGroupAction->setStatusTip("Create a new device group");
    m_fileMenu->addAction(m_newGroupAction);

    m_fileMenu->addSeparator();

    m_exitAction = new QAction("E&xit", this);
    m_exitAction->setShortcut(QKeySequence::Quit);
    m_exitAction->setStatusTip("Exit the application");
    m_fileMenu->addAction(m_exitAction);

    // 编辑菜单
    m_editMenu = m_menuBar->addMenu("&Edit");
    
    m_deleteGroupAction = new QAction("&Delete Group", this);
    m_deleteGroupAction->setShortcut(QKeySequence::Delete);
    m_deleteGroupAction->setStatusTip("Delete selected group");
    m_editMenu->addAction(m_deleteGroupAction);

    // 视图菜单
    m_viewMenu = m_menuBar->addMenu("&View");
    
    QAction *toggleTreeAction = new QAction("Toggle &Device Tree", this);
    toggleTreeAction->setCheckable(true);
    toggleTreeAction->setChecked(true);
    toggleTreeAction->setShortcut(QKeySequence("Ctrl+T"));
    m_viewMenu->addAction(toggleTreeAction);

    QAction *togglePanelAction = new QAction("Toggle &Right Panel", this);
    togglePanelAction->setCheckable(true);
    togglePanelAction->setChecked(true);
    togglePanelAction->setShortcut(QKeySequence("Ctrl+P"));
    m_viewMenu->addAction(togglePanelAction);

    // 工具菜单
    m_toolsMenu = m_menuBar->addMenu("&Tools");
    
    m_globalSettingsAction = new QAction("&Global Settings", this);
    m_globalSettingsAction->setShortcut(QKeySequence::Preferences);
    m_globalSettingsAction->setStatusTip("Open global settings");
    m_toolsMenu->addAction(m_globalSettingsAction);

    m_toolsMenu->addSeparator();

    m_groupSettingsAction = new QAction("&Group Settings", this);
    m_groupSettingsAction->setStatusTip("Open group settings");
    m_toolsMenu->addAction(m_groupSettingsAction);

    m_deviceSettingsAction = new QAction("&Device Settings", this);
    m_deviceSettingsAction->setStatusTip("Open device settings");
    m_toolsMenu->addAction(m_deviceSettingsAction);

    // 帮助菜单
    m_helpMenu = m_menuBar->addMenu("&Help");
    
    m_aboutAction = new QAction("&About", this);
    m_aboutAction->setStatusTip("About SmartMatrix");
    m_helpMenu->addAction(m_aboutAction);

    // 连接信号
    connect(m_newGroupAction, &QAction::triggered, this, &ModernMainWindow::onNewGroup);
    connect(m_deleteGroupAction, &QAction::triggered, this, &ModernMainWindow::onDeleteGroup);
    connect(m_groupSettingsAction, &QAction::triggered, this, &ModernMainWindow::onGroupSettings);
    connect(m_deviceSettingsAction, &QAction::triggered, this, &ModernMainWindow::onDeviceSettings);
    connect(m_globalSettingsAction, &QAction::triggered, this, &ModernMainWindow::onGlobalSettings);
    connect(m_aboutAction, &QAction::triggered, this, &ModernMainWindow::onAbout);
    connect(m_exitAction, &QAction::triggered, this, &ModernMainWindow::onExit);

    connect(toggleTreeAction, &QAction::toggled, this, [this](bool visible) {
        m_deviceTreeWidget->setVisible(visible);
    });

    connect(togglePanelAction, &QAction::toggled, this, [this](bool visible) {
        m_rightPanel->setVisible(visible);
    });
}

void ModernMainWindow::createToolBar()
{
    m_toolBar = addToolBar("Main Toolbar");
    m_toolBar->setMovable(false);
    m_toolBar->setFloatable(false);

    // 添加工具栏动作
    m_toolBar->addAction(m_newGroupAction);
    m_toolBar->addAction(m_deleteGroupAction);
    m_toolBar->addSeparator();
    m_toolBar->addAction(m_globalSettingsAction);
}

void ModernMainWindow::createStatusBar()
{
    m_statusBar = statusBar();

    // 状态标签
    m_statusLabel = new QLabel("Ready");
    m_statusBar->addWidget(m_statusLabel);

    // 设备计数标签
    m_deviceCountLabel = new QLabel("Devices: 0");
    m_statusBar->addPermanentWidget(m_deviceCountLabel);

    // 连接状态标签
    m_connectionStatusLabel = new QLabel("Disconnected");
    m_statusBar->addPermanentWidget(m_connectionStatusLabel);

    // 进度条
    m_operationProgressBar = new QProgressBar();
    m_operationProgressBar->setVisible(false);
    m_operationProgressBar->setMaximumWidth(200);
    m_statusBar->addPermanentWidget(m_operationProgressBar);
}

void ModernMainWindow::createSystemTray()
{
    if (!QSystemTrayIcon::isSystemTrayAvailable()) {
        return;
    }

    m_trayIcon = new QSystemTrayIcon(this);
    m_trayIcon->setIcon(QIcon(":/icons/smartmatrix.png")); // 需要添加图标资源

    // 创建托盘菜单
    m_trayMenu = new QMenu(this);
    
    m_showWindowAction = new QAction("&Show Window", this);
    m_trayMenu->addAction(m_showWindowAction);

    m_trayMenu->addSeparator();

    m_minimizeToTrayAction = new QAction("&Minimize to Tray", this);
    m_minimizeToTrayAction->setCheckable(true);
    m_minimizeToTrayAction->setChecked(m_minimizeToTray);
    m_trayMenu->addAction(m_minimizeToTrayAction);

    m_trayMenu->addSeparator();

    m_quitApplicationAction = new QAction("&Quit", this);
    m_trayMenu->addAction(m_quitApplicationAction);

    m_trayIcon->setContextMenu(m_trayMenu);

    // 连接信号
    connect(m_trayIcon, &QSystemTrayIcon::activated, this, &ModernMainWindow::onTrayIconActivated);
    connect(m_showWindowAction, &QAction::triggered, this, &ModernMainWindow::onShowWindow);
    connect(m_minimizeToTrayAction, &QAction::toggled, this, [this](bool enabled) {
        m_minimizeToTray = enabled;
        saveSettings();
    });
    connect(m_quitApplicationAction, &QAction::triggered, this, &ModernMainWindow::onQuitApplication);

    m_trayIcon->show();
}

void ModernMainWindow::setupConnections()
{
    // 设备树信号连接
    connect(m_deviceTreeWidget, &ModernDeviceTreeWidget::selectedDeviceSerialsChanged,
            this, [this]() {
                QStringList serials = m_deviceTreeWidget->selectedDeviceSerials();
                onDeviceSelectionChanged(serials);
            });
    connect(m_deviceTreeWidget, &ModernDeviceTreeWidget::selectedGroupNameChanged,
            this, [this]() {
                QString groupName = m_deviceTreeWidget->selectedGroupName();
                onGroupSelectionChanged(groupName);
            });
    connect(m_deviceTreeWidget, &ModernDeviceTreeWidget::deviceDoubleClicked,
            this, &ModernMainWindow::onDeviceDoubleClicked);
    connect(m_deviceTreeWidget, &ModernDeviceTreeWidget::deviceGroupDoubleClicked,
            this, &ModernMainWindow::onGroupDoubleClicked);

    // 右侧面板信号连接
    connect(m_rightPanel, &ModernRightPanel::deviceOperationRequested,
            this, &ModernMainWindow::onDeviceOperationRequested);
    connect(m_rightPanel, &ModernRightPanel::groupOperationRequested,
            this, &ModernMainWindow::onGroupOperationRequested);
    connect(m_rightPanel, &ModernRightPanel::globalOperationRequested,
            this, &ModernMainWindow::onGlobalOperationRequested);
    connect(m_rightPanel, &ModernRightPanel::settingsChanged,
            this, &ModernMainWindow::onSettingsChanged);

    // 设备管理器信号连接
    connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceStatusChanged,
            this, &ModernMainWindow::onDeviceStatusChanged);
    connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceNameChanged,
            this, &ModernMainWindow::onDeviceNameChanged);
    connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceGroupAdded,
            this, &ModernMainWindow::onDeviceGroupAdded);
    connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceGroupRemoved,
            this, &ModernMainWindow::onDeviceGroupRemoved);
}

void ModernMainWindow::loadSettings()
{
    m_settings->beginGroup("Window");
    restoreGeometry(m_settings->value("geometry").toByteArray());
    restoreState(m_settings->value("windowState").toByteArray());
    m_settings->endGroup();

    m_settings->beginGroup("Preferences");
    m_minimizeToTray = m_settings->value("minimizeToTray", true).toBool();
    m_startMinimized = m_settings->value("startMinimized", false).toBool();
    m_showNotifications = m_settings->value("showNotifications", true).toBool();
    m_autoConnect = m_settings->value("autoConnect", false).toBool();
    m_connectionTimeout = m_settings->value("connectionTimeout", 30).toInt();
    m_quality = m_settings->value("quality", 80).toInt();
    m_resolution = m_settings->value("resolution", "1080p").toString();
    m_settings->endGroup();
}

void ModernMainWindow::saveSettings()
{
    m_settings->beginGroup("Window");
    m_settings->setValue("geometry", saveGeometry());
    m_settings->setValue("windowState", saveState());
    m_settings->endGroup();

    m_settings->beginGroup("Preferences");
    m_settings->setValue("minimizeToTray", m_minimizeToTray);
    m_settings->setValue("startMinimized", m_startMinimized);
    m_settings->setValue("showNotifications", m_showNotifications);
    m_settings->setValue("autoConnect", m_autoConnect);
    m_settings->setValue("connectionTimeout", m_connectionTimeout);
    m_settings->setValue("quality", m_quality);
    m_settings->setValue("resolution", m_resolution);
    m_settings->endGroup();
}

void ModernMainWindow::applyModernStyle()
{
    setStyleSheet(R"(
        QMainWindow {
            background-color: #2b2b2b;
            color: #ffffff;
        }
        
        QMenuBar {
            background-color: #353535;
            color: #ffffff;
            border-bottom: 1px solid #555555;
        }
        
        QMenuBar::item {
            background-color: transparent;
            padding: 4px 8px;
        }
        
        QMenuBar::item:selected {
            background-color: #404040;
        }
        
        QMenu {
            background-color: #353535;
            color: #ffffff;
            border: 1px solid #555555;
        }
        
        QMenu::item {
            padding: 6px 20px;
        }
        
        QMenu::item:selected {
            background-color: #404040;
        }
        
        QToolBar {
            background-color: #353535;
            border: none;
            spacing: 3px;
        }
        
        QToolBar QToolButton {
            background-color: transparent;
            border: 1px solid transparent;
            border-radius: 4px;
            padding: 6px 12px;
        }
        
        QToolBar QToolButton:hover {
            background-color: #404040;
            border-color: #555555;
        }
        
        QToolBar QToolButton:pressed {
            background-color: #353535;
        }
        
        QStatusBar {
            background-color: #353535;
            color: #ffffff;
            border-top: 1px solid #555555;
        }
        
        QSplitter::handle {
            background-color: #555555;
        }
        
        QSplitter::handle:horizontal {
            width: 2px;
        }
        
        QSplitter::handle:vertical {
            height: 2px;
        }
    )");
}

// 槽函数实现
void ModernMainWindow::onNewGroup()
{
    bool ok;
    QString groupName = QInputDialog::getText(this, "New Group", "Enter group name:", 
                                            QLineEdit::Normal, "", &ok);
    if (ok && !groupName.isEmpty()) {
        m_deviceGroupManager->addDeviceGroup(groupName);
        m_statusLabel->setText(QString("Created group: %1").arg(groupName));
    }
}

void ModernMainWindow::onDeleteGroup()
{
    QString selectedGroup = m_rightPanel->selectedGroupName();
    if (selectedGroup.isEmpty()) {
        QMessageBox::information(this, "Delete Group", "Please select a group to delete.");
        return;
    }

    int ret = QMessageBox::question(this, "Delete Group", 
                                  QString("Are you sure you want to delete group '%1'?").arg(selectedGroup),
                                  QMessageBox::Yes | QMessageBox::No);
    if (ret == QMessageBox::Yes) {
        m_deviceGroupManager->removeDeviceGroup(selectedGroup);
        m_statusLabel->setText(QString("Deleted group: %1").arg(selectedGroup));
    }
}

void ModernMainWindow::onGroupSettings()
{
    QString selectedGroup = m_rightPanel->selectedGroupName();
    if (selectedGroup.isEmpty()) {
        QMessageBox::information(this, "Group Settings", "Please select a group to configure.");
        return;
    }

    // 这里可以打开组设置对话框
    QMessageBox::information(this, "Group Settings", 
                           QString("Group settings for: %1").arg(selectedGroup));
}

void ModernMainWindow::onDeviceSettings()
{
    QStringList selectedDevices = m_rightPanel->selectedDeviceSerials();
    if (selectedDevices.isEmpty()) {
        QMessageBox::information(this, "Device Settings", "Please select devices to configure.");
        return;
    }

    // 这里可以打开设备设置对话框
    QMessageBox::information(this, "Device Settings", 
                           QString("Device settings for %1 device(s)").arg(selectedDevices.size()));
}

void ModernMainWindow::onGlobalSettings()
{
    // 这里可以打开全局设置对话框
    QMessageBox::information(this, "Global Settings", "Global settings dialog");
}

void ModernMainWindow::onAbout()
{
    QMessageBox::about(this, "About SmartMatrix", 
                      "SmartMatrix Modern Device Manager\n\n"
                      "Version 2.0\n"
                      "A modern Qt-based device management application.");
}

void ModernMainWindow::onExit()
{
    close();
}

void ModernMainWindow::onMinimizeToTray()
{
    hide();
    if (m_trayIcon) {
        m_trayIcon->show();
    }
}

void ModernMainWindow::onShowWindow()
{
    show();
    raise();
    activateWindow();
}

void ModernMainWindow::onQuitApplication()
{
    QApplication::quit();
}

void ModernMainWindow::onDeviceSelectionChanged(const QStringList &serials)
{
    m_rightPanel->onDeviceSelectionChanged(serials);
    updateStatusBar();
}

void ModernMainWindow::onGroupSelectionChanged(const QString &groupName)
{
    m_rightPanel->onGroupSelectionChanged(groupName);
    updateStatusBar();
}

void ModernMainWindow::onDeviceDoubleClicked(const QString &serial)
{
    // 双击设备时的处理
    m_statusLabel->setText(QString("Double-clicked device: %1").arg(serial));
}

void ModernMainWindow::onGroupDoubleClicked(const QString &groupName)
{
    // 双击组时的处理
    m_statusLabel->setText(QString("Double-clicked group: %1").arg(groupName));
}

void ModernMainWindow::onDeviceOperationRequested(const QString &operation, const QStringList &serials)
{
    m_statusLabel->setText(QString("Device operation: %1 on %2 device(s)").arg(operation).arg(serials.size()));
    
    // 这里实现具体的设备操作
    if (operation == "connect_device") {
        // 连接设备
    } else if (operation == "disconnect_device") {
        // 断开设备
    } else if (operation == "device_settings") {
        onDeviceSettings();
    } else if (operation == "remove_device") {
        // 移除设备
    }
}

void ModernMainWindow::onGroupOperationRequested(const QString &operation, const QString &groupName)
{
    m_statusLabel->setText(QString("Group operation: %1 on group %2").arg(operation).arg(groupName));
    
    // 这里实现具体的组操作
    if (operation == "connect_group") {
        // 连接组
    } else if (operation == "disconnect_group") {
        // 断开组
    } else if (operation == "group_settings") {
        onGroupSettings();
    } else if (operation == "delete_group") {
        onDeleteGroup();
    }
}

void ModernMainWindow::onGlobalOperationRequested(const QString &operation)
{
    m_statusLabel->setText(QString("Global operation: %1").arg(operation));
    
    // 这里实现具体的全局操作
    if (operation == "connect_all") {
        // 连接所有设备
    } else if (operation == "disconnect_all") {
        // 断开所有设备
    } else if (operation == "refresh") {
        // 刷新设备列表
    } else if (operation == "global_settings") {
        onGlobalSettings();
    }
}

void ModernMainWindow::onSettingsChanged(const QString &key, const QVariant &value)
{
    m_settings->setValue(QString("Preferences/%1").arg(key), value);
    m_statusLabel->setText(QString("Setting changed: %1 = %2").arg(key).arg(value.toString()));
}

void ModernMainWindow::onDeviceStatusChanged(const QString &serial, DeviceStatus status)
{
    Q_UNUSED(serial)
    Q_UNUSED(status)
    updateStatusBar();
}

void ModernMainWindow::onDeviceNameChanged(const QString &serial, const QString &name)
{
    Q_UNUSED(serial)
    Q_UNUSED(name)
    updateStatusBar();
}

void ModernMainWindow::onDeviceGroupAdded(const QString &groupName)
{
    m_statusLabel->setText(QString("Group added: %1").arg(groupName));
    updateStatusBar();
}

void ModernMainWindow::onDeviceGroupRemoved(const QString &groupName)
{
    m_statusLabel->setText(QString("Group removed: %1").arg(groupName));
    updateStatusBar();
}

void ModernMainWindow::updateStatusBar()
{
    if (!m_deviceGroupManager) {
        return;
    }
    
    // 更新设备计数
    int totalDevices = m_deviceGroupManager->totalDeviceCount();
    int connectedDevices = m_deviceGroupManager->connectedDeviceCount();
    int selectedDevices = m_deviceGroupManager->selectedDeviceCount();
    
    m_deviceCountLabel->setText(QString("Devices: %1 | Connected: %2 | Selected: %3")
                               .arg(totalDevices)
                               .arg(connectedDevices)
                               .arg(selectedDevices));

    // 更新连接状态
    if (connectedDevices > 0) {
        m_connectionStatusLabel->setText(QString("Connected: %1").arg(connectedDevices));
        m_connectionStatusLabel->setStyleSheet("color: #4CAF50;");
    } else {
        m_connectionStatusLabel->setText("Disconnected");
        m_connectionStatusLabel->setStyleSheet("color: #F44336;");
    }
}

void ModernMainWindow::updateWindowTitle()
{
    if (!m_deviceGroupManager) {
        return;
    }
    
    int totalDevices = m_deviceGroupManager->totalDeviceCount();
    int connectedDevices = m_deviceGroupManager->connectedDeviceCount();
    
    QString title = QString("SmartMatrix - %1 devices (%2 connected)")
                   .arg(totalDevices)
                   .arg(connectedDevices);
    setWindowTitle(title);
}

void ModernMainWindow::onTrayIconActivated(QSystemTrayIcon::ActivationReason reason)
{
    switch (reason) {
    case QSystemTrayIcon::DoubleClick:
        onShowWindow();
        break;
    case QSystemTrayIcon::Trigger:
        if (isVisible()) {
            hide();
    } else {
            show();
        }
        break;
    default:
        break;
    }
}