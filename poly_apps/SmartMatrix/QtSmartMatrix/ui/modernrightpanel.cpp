#include "modernrightpanel.h"
#include <QDebug>
#include <QApplication>
#include <QStyleFactory>
#include <QPalette>
#include <QMessageBox>
#include <QColorDialog>

ModernRightPanel::ModernRightPanel(QWidget *parent)
    : QWidget(parent)
    , m_deviceGroupManager(nullptr)
    , m_operationMode(GlobalMode)
    , m_mainLayout(nullptr)
    , m_stackedWidget(nullptr)
    , m_modeToolBar(nullptr)
    , m_modeActionGroup(nullptr)
    , m_globalModePage(nullptr)
    , m_groupModePage(nullptr)
    , m_deviceModePage(nullptr)
    , m_operationPanel(nullptr)
    , m_settingsPanel(nullptr)
    , m_statisticsPanel(nullptr)
    , m_globalConnectAllBtn(nullptr)
    , m_globalDisconnectAllBtn(nullptr)
    , m_globalRefreshBtn(nullptr)
    , m_globalSettingsBtn(nullptr)
    , m_globalStatsLabel(nullptr)
    , m_groupConnectBtn(nullptr)
    , m_groupDisconnectBtn(nullptr)
    , m_groupSettingsBtn(nullptr)
    , m_groupDeleteBtn(nullptr)
    , m_groupStatsLabel(nullptr)
    , m_groupColorCombo(nullptr)
    , m_deviceConnectBtn(nullptr)
    , m_deviceDisconnectBtn(nullptr)
    , m_deviceSettingsBtn(nullptr)
    , m_deviceRemoveBtn(nullptr)
    , m_deviceInfoLabel(nullptr)
    , m_autoConnectCheck(nullptr)
    , m_showNotificationsCheck(nullptr)
    , m_connectionTimeoutSpin(nullptr)
    , m_qualitySlider(nullptr)
    , m_resolutionCombo(nullptr)
    , m_fadeAnimation(nullptr)
    , m_opacityEffect(nullptr)
    , m_animationTimer(nullptr)
{
    setupUI();
    createActions();
    setupAnimations();
    applyModernStyle();
}

ModernRightPanel::~ModernRightPanel()
{
    if (m_fadeAnimation) {
        m_fadeAnimation->deleteLater();
    }
    if (m_animationTimer) {
        m_animationTimer->deleteLater();
    }
}

void ModernRightPanel::setDeviceGroupManager(ModernDeviceGroupManager *manager)
{
    if (m_deviceGroupManager == manager) {
        return;
    }

    // 断开旧连接
    if (m_deviceGroupManager) {
        disconnect(m_deviceGroupManager, nullptr, this, nullptr);
    }

    m_deviceGroupManager = manager;

    // 连接新信号
    if (m_deviceGroupManager) {
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceGroupAdded,
                this, &ModernRightPanel::onGroupAdded);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceGroupRemoved,
                this, &ModernRightPanel::onGroupRemoved);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceStatusChanged,
                this, &ModernRightPanel::onDeviceStatusChanged);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceNameChanged,
                this, &ModernRightPanel::onDeviceNameChanged);
    }

    updateStatistics();
    updateOperationButtons();
}

void ModernRightPanel::setOperationMode(OperationMode mode)
{
    if (m_operationMode == mode) {
        return;
    }

    m_operationMode = mode;
    updateModeDisplay();
    updateOperationButtons();
    emit operationModeChanged(mode);
}

void ModernRightPanel::onDeviceSelectionChanged(const QStringList &serials)
{
    m_selectedDeviceSerials = serials;
    updateOperationButtons();
    updateStatistics();
    
    if (!serials.isEmpty()) {
        setOperationMode(DeviceMode);
    }
}

void ModernRightPanel::onGroupSelectionChanged(const QString &groupName)
{
    m_selectedGroupName = groupName;
    updateOperationButtons();
    updateStatistics();
    updateGroupSettings();
    
    if (!groupName.isEmpty()) {
        setOperationMode(GroupMode);
    }
}

void ModernRightPanel::onClearSelection()
{
    m_selectedDeviceSerials.clear();
    m_selectedGroupName.clear();
    setOperationMode(GlobalMode);
    updateOperationButtons();
    updateStatistics();
}

void ModernRightPanel::onDeviceStatusChanged(const QString &serial, DeviceStatus status)
{
    Q_UNUSED(serial)
    Q_UNUSED(status)
    updateStatistics();
    updateOperationButtons();
}

void ModernRightPanel::onDeviceNameChanged(const QString &serial, const QString &name)
{
    Q_UNUSED(serial)
    Q_UNUSED(name)
    updateStatistics();
}

void ModernRightPanel::onGroupAdded(const QString &groupName)
{
    Q_UNUSED(groupName)
    updateStatistics();
}

void ModernRightPanel::onGroupRemoved(const QString &groupName)
{
    if (m_selectedGroupName == groupName) {
        onClearSelection();
    }
    updateStatistics();
}

void ModernRightPanel::onGroupColorChanged(const QString &groupName, const QColor &color)
{
    Q_UNUSED(groupName)
    Q_UNUSED(color)
    updateGroupSettings();
}

void ModernRightPanel::onDeviceOperation()
{
    QPushButton *button = qobject_cast<QPushButton*>(sender());
    if (!button || m_selectedDeviceSerials.isEmpty()) {
        return;
    }

    QString operation = button->text().toLower().replace(" ", "_");
    emit deviceOperationRequested(operation, m_selectedDeviceSerials);
}

void ModernRightPanel::onGroupOperation()
{
    QPushButton *button = qobject_cast<QPushButton*>(sender());
    if (!button || m_selectedGroupName.isEmpty()) {
        return;
    }

    QString operation = button->text().toLower().replace(" ", "_");
    emit groupOperationRequested(operation, m_selectedGroupName);
}

void ModernRightPanel::onGlobalOperation()
{
    QPushButton *button = qobject_cast<QPushButton*>(sender());
    if (!button) {
        return;
    }

    QString operation = button->text().toLower().replace(" ", "_");
    emit globalOperationRequested(operation);
}

void ModernRightPanel::onSettingsChanged()
{
    if (!m_deviceGroupManager) {
        return;
    }

    // 处理设置变化
    if (m_autoConnectCheck) {
        emit settingsChanged("auto_connect", m_autoConnectCheck->isChecked());
    }
    if (m_showNotificationsCheck) {
        emit settingsChanged("show_notifications", m_showNotificationsCheck->isChecked());
    }
    if (m_connectionTimeoutSpin) {
        emit settingsChanged("connection_timeout", m_connectionTimeoutSpin->value());
    }
    if (m_qualitySlider) {
        emit settingsChanged("quality", m_qualitySlider->value());
    }
    if (m_resolutionCombo) {
        emit settingsChanged("resolution", m_resolutionCombo->currentText());
    }
}

void ModernRightPanel::onAnimationFinished()
{
    // 动画完成后的处理
    updateModeDisplay();
}

void ModernRightPanel::setupUI()
{
    // 主布局
    m_mainLayout = new QVBoxLayout(this);
    m_mainLayout->setContentsMargins(8, 8, 8, 8);
    m_mainLayout->setSpacing(8);

    // 模式工具栏
    m_modeToolBar = new QToolBar(this);
    m_modeToolBar->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);
    m_modeToolBar->setMovable(false);
    m_modeToolBar->setFloatable(false);
    m_mainLayout->addWidget(m_modeToolBar);

    // 堆叠窗口
    m_stackedWidget = new QStackedWidget(this);
    m_mainLayout->addWidget(m_stackedWidget);

    // 创建模式页面
    setupGlobalMode();
    setupGroupMode();
    setupDeviceMode();

    // 设置初始模式
    updateModeDisplay();
}

void ModernRightPanel::createActions()
{
    m_modeActionGroup = new QActionGroup(this);

    // 全局模式动作
    QAction *globalAction = new QAction("Global", this);
    globalAction->setCheckable(true);
    globalAction->setChecked(true);
    globalAction->setData(GlobalMode);
    m_modeActionGroup->addAction(globalAction);
    m_modeToolBar->addAction(globalAction);

    // 组模式动作
    QAction *groupAction = new QAction("Group", this);
    groupAction->setCheckable(true);
    groupAction->setData(GroupMode);
    m_modeActionGroup->addAction(groupAction);
    m_modeToolBar->addAction(groupAction);

    // 设备模式动作
    QAction *deviceAction = new QAction("Device", this);
    deviceAction->setCheckable(true);
    deviceAction->setData(DeviceMode);
    m_modeActionGroup->addAction(deviceAction);
    m_modeToolBar->addAction(deviceAction);

    // 连接信号
    connect(m_modeActionGroup, &QActionGroup::triggered, this, [this](QAction *action) {
        OperationMode mode = static_cast<OperationMode>(action->data().toInt());
        setOperationMode(mode);
    });
}

void ModernRightPanel::setupGlobalMode()
{
    m_globalModePage = new QWidget();
    QVBoxLayout *layout = new QVBoxLayout(m_globalModePage);
    layout->setContentsMargins(0, 0, 0, 0);

    // 操作面板
    m_operationPanel = createOperationPanel();
    layout->addWidget(m_operationPanel);

    // 统计面板
    m_statisticsPanel = createStatisticsPanel();
    layout->addWidget(m_statisticsPanel);

    // 设置面板
    m_settingsPanel = createGlobalSettingsPanel();
    layout->addWidget(m_settingsPanel);

    layout->addStretch();

    m_stackedWidget->addWidget(m_globalModePage);
}

void ModernRightPanel::setupGroupMode()
{
    m_groupModePage = new QWidget();
    QVBoxLayout *layout = new QVBoxLayout(m_groupModePage);
    layout->setContentsMargins(0, 0, 0, 0);

    // 组操作面板
    QGroupBox *groupBox = new QGroupBox("Group Operations");
    QVBoxLayout *groupLayout = new QVBoxLayout(groupBox);

    m_groupConnectBtn = new QPushButton("Connect Group");
    m_groupDisconnectBtn = new QPushButton("Disconnect Group");
    m_groupSettingsBtn = new QPushButton("Group Settings");
    m_groupDeleteBtn = new QPushButton("Delete Group");

    groupLayout->addWidget(m_groupConnectBtn);
    groupLayout->addWidget(m_groupDisconnectBtn);
    groupLayout->addWidget(m_groupSettingsBtn);
    groupLayout->addWidget(m_groupDeleteBtn);

    connect(m_groupConnectBtn, &QPushButton::clicked, this, &ModernRightPanel::onGroupOperation);
    connect(m_groupDisconnectBtn, &QPushButton::clicked, this, &ModernRightPanel::onGroupOperation);
    connect(m_groupSettingsBtn, &QPushButton::clicked, this, &ModernRightPanel::onGroupOperation);
    connect(m_groupDeleteBtn, &QPushButton::clicked, this, &ModernRightPanel::onGroupOperation);

    layout->addWidget(groupBox);

    // 组统计
    m_groupStatsLabel = new QLabel("No group selected");
    layout->addWidget(m_groupStatsLabel);

    // 组设置
    QGroupBox *settingsBox = new QGroupBox("Group Settings");
    QVBoxLayout *settingsLayout = new QVBoxLayout(settingsBox);

    m_groupColorCombo = new QComboBox();
    m_groupColorCombo->addItems({"Red", "Green", "Blue", "Yellow", "Purple", "Orange", "Cyan", "Magenta"});
    settingsLayout->addWidget(new QLabel("Group Color:"));
    settingsLayout->addWidget(m_groupColorCombo);

    connect(m_groupColorCombo, QOverload<int>::of(&QComboBox::currentIndexChanged),
            this, &ModernRightPanel::onSettingsChanged);

    layout->addWidget(settingsBox);
    layout->addStretch();

    m_stackedWidget->addWidget(m_groupModePage);
}

void ModernRightPanel::setupDeviceMode()
{
    m_deviceModePage = new QWidget();
    QVBoxLayout *layout = new QVBoxLayout(m_deviceModePage);
    layout->setContentsMargins(0, 0, 0, 0);

    // 设备操作面板
    QGroupBox *deviceBox = new QGroupBox("Device Operations");
    QVBoxLayout *deviceLayout = new QVBoxLayout(deviceBox);

    m_deviceConnectBtn = new QPushButton("Connect Device");
    m_deviceDisconnectBtn = new QPushButton("Disconnect Device");
    m_deviceSettingsBtn = new QPushButton("Device Settings");
    m_deviceRemoveBtn = new QPushButton("Remove Device");

    deviceLayout->addWidget(m_deviceConnectBtn);
    deviceLayout->addWidget(m_deviceDisconnectBtn);
    deviceLayout->addWidget(m_deviceSettingsBtn);
    deviceLayout->addWidget(m_deviceRemoveBtn);

    connect(m_deviceConnectBtn, &QPushButton::clicked, this, &ModernRightPanel::onDeviceOperation);
    connect(m_deviceDisconnectBtn, &QPushButton::clicked, this, &ModernRightPanel::onDeviceOperation);
    connect(m_deviceSettingsBtn, &QPushButton::clicked, this, &ModernRightPanel::onDeviceOperation);
    connect(m_deviceRemoveBtn, &QPushButton::clicked, this, &ModernRightPanel::onDeviceOperation);

    layout->addWidget(deviceBox);

    // 设备信息
    m_deviceInfoLabel = new QLabel("No device selected");
    layout->addWidget(m_deviceInfoLabel);

    // 设备设置
    QGroupBox *settingsBox = new QGroupBox("Device Settings");
    QVBoxLayout *settingsLayout = new QVBoxLayout(settingsBox);

    m_autoConnectCheck = new QCheckBox("Auto Connect");
    m_showNotificationsCheck = new QCheckBox("Show Notifications");
    m_connectionTimeoutSpin = new QSpinBox();
    m_connectionTimeoutSpin->setRange(5, 60);
    m_connectionTimeoutSpin->setValue(30);
    m_connectionTimeoutSpin->setSuffix(" sec");

    m_qualitySlider = new QSlider(Qt::Horizontal);
    m_qualitySlider->setRange(1, 100);
    m_qualitySlider->setValue(80);

    m_resolutionCombo = new QComboBox();
    m_resolutionCombo->addItems({"720p", "1080p", "1440p", "4K"});

    settingsLayout->addWidget(m_autoConnectCheck);
    settingsLayout->addWidget(m_showNotificationsCheck);
    settingsLayout->addWidget(new QLabel("Connection Timeout:"));
    settingsLayout->addWidget(m_connectionTimeoutSpin);
    settingsLayout->addWidget(new QLabel("Quality:"));
    settingsLayout->addWidget(m_qualitySlider);
    settingsLayout->addWidget(new QLabel("Resolution:"));
    settingsLayout->addWidget(m_resolutionCombo);

    connect(m_autoConnectCheck, &QCheckBox::toggled, this, &ModernRightPanel::onSettingsChanged);
    connect(m_showNotificationsCheck, &QCheckBox::toggled, this, &ModernRightPanel::onSettingsChanged);
    connect(m_connectionTimeoutSpin, QOverload<int>::of(&QSpinBox::valueChanged),
            this, &ModernRightPanel::onSettingsChanged);
    connect(m_qualitySlider, &QSlider::valueChanged, this, &ModernRightPanel::onSettingsChanged);
    connect(m_resolutionCombo, QOverload<int>::of(&QComboBox::currentIndexChanged),
            this, &ModernRightPanel::onSettingsChanged);

    layout->addWidget(settingsBox);
    layout->addStretch();

    m_stackedWidget->addWidget(m_deviceModePage);
}

void ModernRightPanel::updateModeDisplay()
{
    // 更新工具栏选中状态
    for (QAction *action : m_modeActionGroup->actions()) {
        OperationMode mode = static_cast<OperationMode>(action->data().toInt());
        action->setChecked(mode == m_operationMode);
    }

    // 切换页面
    switch (m_operationMode) {
    case GlobalMode:
        m_stackedWidget->setCurrentWidget(m_globalModePage);
        break;
    case GroupMode:
        m_stackedWidget->setCurrentWidget(m_groupModePage);
        break;
    case DeviceMode:
        m_stackedWidget->setCurrentWidget(m_deviceModePage);
        break;
    }
}

void ModernRightPanel::updateOperationButtons()
{
    bool hasSelection = !m_selectedDeviceSerials.isEmpty() || !m_selectedGroupName.isEmpty();

    // 更新按钮状态
    if (m_groupConnectBtn) {
        m_groupConnectBtn->setEnabled(!m_selectedGroupName.isEmpty());
    }
    if (m_groupDisconnectBtn) {
        m_groupDisconnectBtn->setEnabled(!m_selectedGroupName.isEmpty());
    }
    if (m_groupSettingsBtn) {
        m_groupSettingsBtn->setEnabled(!m_selectedGroupName.isEmpty());
    }
    if (m_groupDeleteBtn) {
        m_groupDeleteBtn->setEnabled(!m_selectedGroupName.isEmpty());
    }

    if (m_deviceConnectBtn) {
        m_deviceConnectBtn->setEnabled(!m_selectedDeviceSerials.isEmpty());
    }
    if (m_deviceDisconnectBtn) {
        m_deviceDisconnectBtn->setEnabled(!m_selectedDeviceSerials.isEmpty());
    }
    if (m_deviceSettingsBtn) {
        m_deviceSettingsBtn->setEnabled(!m_selectedDeviceSerials.isEmpty());
    }
    if (m_deviceRemoveBtn) {
        m_deviceRemoveBtn->setEnabled(!m_selectedDeviceSerials.isEmpty());
    }
}

void ModernRightPanel::updateStatistics()
{
    if (!m_deviceGroupManager) {
        return;
    }

    // 更新全局统计
    if (m_globalStatsLabel) {
        int totalDevices = m_deviceGroupManager->totalDeviceCount();
        int connectedDevices = m_deviceGroupManager->connectedDeviceCount();
        int selectedDevices = m_deviceGroupManager->selectedDeviceCount();
        
        QString stats = QString("Total: %1 | Connected: %2 | Selected: %3")
                       .arg(totalDevices)
                       .arg(connectedDevices)
                       .arg(selectedDevices);
        m_globalStatsLabel->setText(stats);
    }

    // 更新组统计
    if (m_groupStatsLabel && !m_selectedGroupName.isEmpty()) {
        QList<DeviceInfo> devices = m_deviceGroupManager->getDevicesInGroup(m_selectedGroupName);
        int connected = 0;
        for (const DeviceInfo &device : devices) {
            if (device.m_status == DeviceStatus::Connected) {
                connected++;
            }
        }
        
        QString stats = QString("Group: %1\nDevices: %2 | Connected: %3")
                       .arg(m_selectedGroupName)
                       .arg(devices.size())
                       .arg(connected);
        m_groupStatsLabel->setText(stats);
    }

    // 更新设备信息
    if (m_deviceInfoLabel && !m_selectedDeviceSerials.isEmpty()) {
        QString info = QString("Selected Devices: %1").arg(m_selectedDeviceSerials.size());
        m_deviceInfoLabel->setText(info);
    }
}

void ModernRightPanel::updateGroupSettings()
{
    if (!m_groupColorCombo || m_selectedGroupName.isEmpty()) {
        return;
    }

    // 更新组颜色选择
    if (m_deviceGroupManager) {
        QColor groupColor = m_deviceGroupManager->getGroupColor(m_selectedGroupName);
        // 这里可以根据颜色设置combo的当前项
    }
}

void ModernRightPanel::updateDeviceSettings()
{
    // 更新设备相关设置
}

QWidget* ModernRightPanel::createOperationPanel()
{
    QGroupBox *groupBox = new QGroupBox("Global Operations");
    QVBoxLayout *layout = new QVBoxLayout(groupBox);

    m_globalConnectAllBtn = new QPushButton("Connect All");
    m_globalDisconnectAllBtn = new QPushButton("Disconnect All");
    m_globalRefreshBtn = new QPushButton("Refresh");
    m_globalSettingsBtn = new QPushButton("Global Settings");

    layout->addWidget(m_globalConnectAllBtn);
    layout->addWidget(m_globalDisconnectAllBtn);
    layout->addWidget(m_globalRefreshBtn);
    layout->addWidget(m_globalSettingsBtn);

    connect(m_globalConnectAllBtn, &QPushButton::clicked, this, &ModernRightPanel::onGlobalOperation);
    connect(m_globalDisconnectAllBtn, &QPushButton::clicked, this, &ModernRightPanel::onGlobalOperation);
    connect(m_globalRefreshBtn, &QPushButton::clicked, this, &ModernRightPanel::onGlobalOperation);
    connect(m_globalSettingsBtn, &QPushButton::clicked, this, &ModernRightPanel::onGlobalOperation);

    return groupBox;
}

QWidget* ModernRightPanel::createSettingsPanel()
{
    return new QWidget();
}

QWidget* ModernRightPanel::createStatisticsPanel()
{
    QGroupBox *groupBox = new QGroupBox("Statistics");
    QVBoxLayout *layout = new QVBoxLayout(groupBox);

    m_globalStatsLabel = new QLabel("No devices");
    layout->addWidget(m_globalStatsLabel);

    return groupBox;
}

QWidget* ModernRightPanel::createGroupSettingsPanel()
{
    return new QWidget();
}

QWidget* ModernRightPanel::createDeviceSettingsPanel()
{
    return new QWidget();
}

QWidget* ModernRightPanel::createGlobalSettingsPanel()
{
    QGroupBox *groupBox = new QGroupBox("Global Settings");
    QVBoxLayout *layout = new QVBoxLayout(groupBox);

    m_autoConnectCheck = new QCheckBox("Auto Connect New Devices");
    m_showNotificationsCheck = new QCheckBox("Show Notifications");
    
    layout->addWidget(m_autoConnectCheck);
    layout->addWidget(m_showNotificationsCheck);

    connect(m_autoConnectCheck, &QCheckBox::toggled, this, &ModernRightPanel::onSettingsChanged);
    connect(m_showNotificationsCheck, &QCheckBox::toggled, this, &ModernRightPanel::onSettingsChanged);

    return groupBox;
}

void ModernRightPanel::setupAnimations()
{
    m_fadeAnimation = new QPropertyAnimation(this, "windowOpacity");
    m_fadeAnimation->setDuration(300);
    m_fadeAnimation->setEasingCurve(QEasingCurve::InOutQuad);

    m_opacityEffect = new QGraphicsOpacityEffect(this);
    setGraphicsEffect(m_opacityEffect);

    m_animationTimer = new QTimer(this);
    m_animationTimer->setSingleShot(true);
    connect(m_animationTimer, &QTimer::timeout, this, &ModernRightPanel::onAnimationFinished);
}

void ModernRightPanel::applyModernStyle()
{
    m_currentStyle = R"(
        QWidget {
            background-color: #2b2b2b;
            color: #ffffff;
            font-family: 'Segoe UI', Arial, sans-serif;
        }
        
        QGroupBox {
            font-weight: bold;
            border: 2px solid #555555;
            border-radius: 8px;
            margin-top: 1ex;
            padding-top: 10px;
        }
        
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 10px;
            padding: 0 5px 0 5px;
        }
        
        QPushButton {
            background-color: #404040;
            border: 1px solid #555555;
            border-radius: 6px;
            padding: 8px 16px;
            font-weight: bold;
        }
        
        QPushButton:hover {
            background-color: #505050;
            border-color: #666666;
        }
        
        QPushButton:pressed {
            background-color: #353535;
        }
        
        QPushButton:disabled {
            background-color: #2a2a2a;
            color: #666666;
            border-color: #444444;
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
        
        QToolBar QToolButton:checked {
            background-color: #0078d4;
            border-color: #106ebe;
        }
        
        QLabel {
            color: #ffffff;
        }
        
        QCheckBox {
            color: #ffffff;
        }
        
        QCheckBox::indicator {
            width: 18px;
            height: 18px;
        }
        
        QCheckBox::indicator:unchecked {
            border: 2px solid #555555;
            background-color: #2b2b2b;
            border-radius: 3px;
        }
        
        QCheckBox::indicator:checked {
            border: 2px solid #0078d4;
            background-color: #0078d4;
            border-radius: 3px;
        }
        
        QSpinBox, QComboBox {
            background-color: #404040;
            border: 1px solid #555555;
            border-radius: 4px;
            padding: 4px 8px;
            color: #ffffff;
        }
        
        QSlider::groove:horizontal {
            border: 1px solid #555555;
            height: 8px;
            background: #404040;
            border-radius: 4px;
        }
        
        QSlider::handle:horizontal {
            background: #0078d4;
            border: 1px solid #106ebe;
            width: 18px;
            margin: -5px 0;
            border-radius: 9px;
        }
    )";
    
    setStyleSheet(m_currentStyle);
}

void ModernRightPanel::animateModeTransition()
{
    if (m_fadeAnimation) {
        m_fadeAnimation->setStartValue(1.0);
        m_fadeAnimation->setEndValue(0.7);
        m_fadeAnimation->start();
        
        m_animationTimer->start(150);
    }
}