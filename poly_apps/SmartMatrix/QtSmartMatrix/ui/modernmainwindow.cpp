#include "modernmainwindow.h"
#include <QApplication>
#include <QCloseEvent>
#include <QKeyEvent>
#include <QResizeEvent>
#include <QMessageBox>
#include <QSettings>
#include <QDebug>
#include <QInputDialog>
#include <QLineEdit>

// Static constants are defined in the header file

ModernMainWindow::ModernMainWindow(QWidget *parent)
    : QMainWindow(parent)
    , m_deviceGroupManager(new ModernDeviceGroupManager(this))
    , m_gridLayoutManager(nullptr)
    , m_deviceTreeWidget(nullptr)
    , m_mainSplitter(nullptr)
    , m_leftPanel(nullptr)
    , m_rightPanel(nullptr)
    , m_gridContainer(nullptr)
    , m_menuBar(nullptr)
    , m_toolBar(nullptr)
    , m_statusBar(nullptr)
    , m_statusUpdateTimer(new QTimer(this))
{
    setupUI();
    setupConnections();
    setupShortcuts();

    // Connect to device manager for real device events
    connect(&qsc::IDeviceManage::getInstance(), &qsc::IDeviceManage::deviceConnected,
            this, &ModernMainWindow::onRealDeviceConnected);
    connect(&qsc::IDeviceManage::getInstance(), &qsc::IDeviceManage::deviceDisconnected,
            this, &ModernMainWindow::onRealDeviceDisconnected);

    // Start status update timer
    m_statusUpdateTimer->setInterval(STATUS_UPDATE_INTERVAL_MS);
    m_statusUpdateTimer->setSingleShot(false);
    connect(m_statusUpdateTimer, &QTimer::timeout, this, &ModernMainWindow::updateStatusBar);
    m_statusUpdateTimer->start();

    // Restore window state
    restoreWindowState();

    // Update initial status
    updateStatusBar();
    updateWindowTitle();

    // Show welcome message
    qInfo() << "Modern UI initialized successfully";
    qInfo() << "Ready to manage devices with group control";
}

ModernMainWindow::~ModernMainWindow()
{
    saveWindowState();
}

void ModernMainWindow::setGroupMode(bool enabled)
{
    if (m_isGroupMode != enabled) {
        m_isGroupMode = enabled;
        emit groupModeChanged();
        emit groupModeToggled(enabled);
        
        // Update UI based on group mode
        updateMenuStates();
        updateToolBarStates();
        updateStatusBar();
    }
}

int ModernMainWindow::connectedDeviceCount() const
{
    return m_deviceGroupManager ? m_deviceGroupManager->connectedDeviceCount() : 0;
}

int ModernMainWindow::totalDeviceCount() const
{
    return m_deviceGroupManager ? m_deviceGroupManager->totalDeviceCount() : 0;
}

void ModernMainWindow::addDevice(const QString &serial, const QString &name, const QString &groupName)
{
    if (m_deviceGroupManager) {
        m_deviceGroupManager->addDevice(serial, name, groupName);
    }
}

void ModernMainWindow::removeDevice(const QString &serial)
{
    if (m_deviceGroupManager) {
        m_deviceGroupManager->removeDevice(serial);
    }
}

void ModernMainWindow::updateDeviceStatus(const QString &serial, DeviceStatus status)
{
    if (m_deviceGroupManager) {
        m_deviceGroupManager->updateDeviceStatus(serial, status);
    }
}

void ModernMainWindow::refreshDevices()
{
    if (m_deviceGroupManager) {
        m_deviceGroupManager->loadDeviceGroups();
    }
    
    updateDeviceGrid();
    updateDeviceTree();
}

void ModernMainWindow::setSplitterSizes(const QList<int> &sizes)
{
    if (m_mainSplitter) {
        m_mainSplitter->setSizes(sizes);
    }
}

void ModernMainWindow::setTreeWidgetWidth(int width)
{
    if (m_mainSplitter) {
        QList<int> sizes = m_mainSplitter->sizes();
        if (sizes.size() >= 2) {
            sizes[0] = width;
            m_mainSplitter->setSizes(sizes);
        }
    }
}

void ModernMainWindow::setGridLayoutColumns(int columns)
{
    if (m_gridLayoutManager) {
        m_gridLayoutManager->setColumnCount(columns);
    }
}

void ModernMainWindow::setAutoAdjustColumns(bool enabled)
{
    if (m_gridLayoutManager) {
        m_gridLayoutManager->setAutoAdjustColumns(enabled);
    }
}

void ModernMainWindow::closeEvent(QCloseEvent *event)
{
    saveWindowState();
    event->accept();
}

void ModernMainWindow::resizeEvent(QResizeEvent *event)
{
    QMainWindow::resizeEvent(event);
    
    // Update grid layout when window is resized
    if (m_gridLayoutManager) {
        m_gridLayoutManager->refreshLayout();
    }
}

void ModernMainWindow::keyPressEvent(QKeyEvent *event)
{
    // Handle global shortcuts
    if (event->modifiers() & Qt::ControlModifier) {
        switch (event->key()) {
        case Qt::Key_N:
            onNewGroup();
            return;
        case Qt::Key_R:
            onRefreshDevices();
            return;
        case Qt::Key_A:
            onSelectAllDevices();
            return;
        case Qt::Key_D:
            onDeselectAllDevices();
            return;
        case Qt::Key_G:
            onToggleGroupMode();
            return;
        }
    }
    
    QMainWindow::keyPressEvent(event);
}

void ModernMainWindow::onNewGroup()
{
    if (m_deviceTreeWidget) {
        // Trigger create group action in tree widget
        m_deviceTreeWidget->triggerCreateGroup();
    }
}

void ModernMainWindow::onDeleteGroup()
{
    if (m_deviceTreeWidget) {
        // Trigger delete group action in tree widget
        m_deviceTreeWidget->triggerDeleteGroup();
    }
}

void ModernMainWindow::onRenameGroup()
{
    if (m_deviceTreeWidget) {
        // Trigger rename group action in tree widget
        m_deviceTreeWidget->triggerRenameGroup();
    }
}

void ModernMainWindow::onRefreshDevices()
{
    refreshDevices();
}

void ModernMainWindow::onSelectAllDevices()
{
    if (m_deviceGroupManager) {
        m_deviceGroupManager->selectAllDevices();
    }
}

void ModernMainWindow::onDeselectAllDevices()
{
    if (m_deviceGroupManager) {
        m_deviceGroupManager->deselectAllDevices();
    }
}

void ModernMainWindow::onToggleGroupMode()
{
    setGroupMode(!m_isGroupMode);
}

void ModernMainWindow::onShowSettings()
{
    // TODO: Implement settings dialog
    QMessageBox::information(this, "Settings", "Settings dialog not implemented yet.");
}

void ModernMainWindow::onShowAbout()
{
    QMessageBox::about(this, "About QtScrcpy Modern UI", 
                      "QtScrcpy Modern UI Extension\n\n"
                      "A modern device management interface built with Qt6.9\n"
                      "Features:\n"
                      "- Device group management\n"
                      "- Responsive grid layout\n"
                      "- Modern animations and interactions\n"
                      "- Drag-and-drop support\n"
                      "- Real-time status updates");
}

void ModernMainWindow::onDeviceGroupAdded(const QString &groupName)
{
    Q_UNUSED(groupName)
    updateStatusBar();
    updateWindowTitle();
}

void ModernMainWindow::onDeviceGroupRemoved(const QString &groupName)
{
    Q_UNUSED(groupName)
    updateStatusBar();
    updateWindowTitle();
}

void ModernMainWindow::onDeviceAdded(const QString &serial, const QString &groupName)
{
    Q_UNUSED(serial)
    Q_UNUSED(groupName)
    updateStatusBar();
    updateWindowTitle();
}

void ModernMainWindow::onDeviceRemoved(const QString &serial)
{
    Q_UNUSED(serial)
    updateStatusBar();
    updateWindowTitle();
}

void ModernMainWindow::onDeviceStatusChanged(const QString &serial, DeviceStatus status)
{
    Q_UNUSED(serial)
    Q_UNUSED(status)
    updateStatusBar();
    updateWindowTitle();
}

void ModernMainWindow::onDeviceSelectionChanged(const QString &serial, bool selected)
{
    Q_UNUSED(serial)
    Q_UNUSED(selected)
    updateStatusBar();
}

void ModernMainWindow::onGroupSelected(const QString &groupName)
{
    if (m_currentGroupName != groupName) {
        m_currentGroupName = groupName;
        emit currentGroupNameChanged();
        emit groupSelected(groupName);
        
        // Apply group filter to grid
        applyGroupFilter();
        updateStatusBar();
    }
}

void ModernMainWindow::onDeviceSelected(const QString &serial)
{
    emit deviceSelected(serial);
    updateStatusBar();
}

void ModernMainWindow::onDeviceDoubleClicked(const QString &serial)
{
    emit deviceDoubleClicked(serial);
}

void ModernMainWindow::onDeviceRightClicked(const QString &serial, const QPoint &globalPos)
{
    Q_UNUSED(serial)
    Q_UNUSED(globalPos)
    // Handle device right-click in tree
}

void ModernMainWindow::onDeviceClicked(const QString &serial)
{
    emit deviceSelected(serial);
    updateStatusBar();
}

void ModernMainWindow::onDeviceDoubleClickedGrid(const QString &serial)
{
    emit deviceDoubleClicked(serial);
}

void ModernMainWindow::onDeviceRightClickedGrid(const QString &serial, const QPoint &globalPos)
{
    Q_UNUSED(serial)
    Q_UNUSED(globalPos)
    // Handle device right-click in grid
}

void ModernMainWindow::updateStatusBar()
{
    if (!m_statusBar) {
        return;
    }
    
    // Update device count
    int total = totalDeviceCount();
    int connected = connectedDeviceCount();
    m_deviceCountLabel->setText(QString("Devices: %1/%2 connected").arg(connected).arg(total));
    
    // Update connection status
    if (total > 0) {
        m_connectionStatusLabel->setText(QString("Connection: %1%").arg((connected * 100) / total));
        m_connectionProgressBar->setValue((connected * 100) / total);
    } else {
        m_connectionStatusLabel->setText("Connection: No devices");
        m_connectionProgressBar->setValue(0);
    }
    
    // Update status label
    if (m_isGroupMode) {
        m_statusLabel->setText(QString("Group Mode: %1").arg(m_currentGroupName));
    } else {
        m_statusLabel->setText("Individual Mode");
    }
}

void ModernMainWindow::updateWindowTitle()
{
    int total = totalDeviceCount();
    int connected = connectedDeviceCount();
    setWindowTitle(QString("QtScrcpy Modern UI - %1/%2 devices connected").arg(connected).arg(total));
}

void ModernMainWindow::setupUI()
{
    // Set window properties
    setWindowTitle("QtScrcpy Modern UI");
    setMinimumSize(800, 600);
    resize(1200, 800);
    
    // Create central widget
    QWidget *centralWidget = createCentralWidget();
    setCentralWidget(centralWidget);
    
    // Setup menu bar, toolbar, and status bar
    setupMenuBar();
    setupToolBar();
    setupStatusBar();
}

void ModernMainWindow::setupMenuBar()
{
    m_menuBar = menuBar();
    
    // File menu
    QMenu *fileMenu = m_menuBar->addMenu("&File");
    m_refreshDevicesAction = fileMenu->addAction("&Refresh Devices", this, &ModernMainWindow::onRefreshDevices);
    m_refreshDevicesAction->setShortcut(QKeySequence::Refresh);
    fileMenu->addSeparator();
    QAction *exitAction = fileMenu->addAction("E&xit");
    exitAction->setShortcut(QKeySequence::Quit);
    connect(exitAction, &QAction::triggered, this, &QWidget::close);
    
    // Group menu
    QMenu *groupMenu = m_menuBar->addMenu("&Group");
    m_newGroupAction = groupMenu->addAction("&New Group", this, &ModernMainWindow::onNewGroup);
    m_newGroupAction->setShortcut(QKeySequence::New);
    m_deleteGroupAction = groupMenu->addAction("&Delete Group", this, &ModernMainWindow::onDeleteGroup);
    m_renameGroupAction = groupMenu->addAction("&Rename Group", this, &ModernMainWindow::onRenameGroup);
    
    // Device menu
    QMenu *deviceMenu = m_menuBar->addMenu("&Device");
    m_selectAllAction = deviceMenu->addAction("Select &All", this, &ModernMainWindow::onSelectAllDevices);
    m_selectAllAction->setShortcut(QKeySequence::SelectAll);
    m_deselectAllAction = deviceMenu->addAction("&Deselect All", this, &ModernMainWindow::onDeselectAllDevices);
    
    // View menu
    QMenu *viewMenu = m_menuBar->addMenu("&View");
    m_toggleGroupModeAction = viewMenu->addAction("Toggle &Group Mode", this, &ModernMainWindow::onToggleGroupMode);
    m_toggleGroupModeAction->setShortcut(QKeySequence("Ctrl+G"));
    m_toggleGroupModeAction->setCheckable(true);
    
    // Help menu
    QMenu *helpMenu = m_menuBar->addMenu("&Help");
    m_showAboutAction = helpMenu->addAction("&About", this, &ModernMainWindow::onShowAbout);
    m_showSettingsAction = helpMenu->addAction("&Settings", this, &ModernMainWindow::onShowSettings);
}

void ModernMainWindow::setupToolBar()
{
    m_toolBar = addToolBar("Main Toolbar");
    m_toolBar->setToolButtonStyle(Qt::ToolButtonTextBesideIcon);
    
    // Add toolbar actions
    m_toolBar->addAction(m_newGroupAction);
    m_toolBar->addAction(m_refreshDevicesAction);
    m_toolBar->addSeparator();
    m_toolBar->addAction(m_selectAllAction);
    m_toolBar->addAction(m_deselectAllAction);
    m_toolBar->addSeparator();
    m_toolBar->addAction(m_toggleGroupModeAction);
}

void ModernMainWindow::setupStatusBar()
{
    m_statusBar = statusBar();
    
    // Create status widgets
    m_statusLabel = new QLabel("Ready");
    m_deviceCountLabel = new QLabel("Devices: 0/0 connected");
    m_connectionStatusLabel = new QLabel("Connection: No devices");
    m_connectionProgressBar = new QProgressBar();
    
    // Configure progress bar
    m_connectionProgressBar->setMaximumWidth(100);
    m_connectionProgressBar->setMaximumHeight(16);
    
    // Add widgets to status bar
    m_statusBar->addWidget(m_statusLabel, 1);
    m_statusBar->addPermanentWidget(m_deviceCountLabel);
    m_statusBar->addPermanentWidget(m_connectionStatusLabel);
    m_statusBar->addPermanentWidget(m_connectionProgressBar);
}

void ModernMainWindow::setupConnections()
{
    // Connect device group manager signals
    if (m_deviceGroupManager) {
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceGroupAdded,
                this, &ModernMainWindow::onDeviceGroupAdded);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceGroupRemoved,
                this, &ModernMainWindow::onDeviceGroupRemoved);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceAdded,
                this, &ModernMainWindow::onDeviceAdded);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceRemoved,
                this, &ModernMainWindow::onDeviceRemoved);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceStatusChanged,
                this, &ModernMainWindow::onDeviceStatusChanged);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceSelectionChanged,
                this, &ModernMainWindow::onDeviceSelectionChanged);
    }
    
    // Connect tree widget signals
    if (m_deviceTreeWidget) {
        connect(m_deviceTreeWidget, &ModernDeviceTreeWidget::deviceGroupSelected,
                this, &ModernMainWindow::onGroupSelected);
        connect(m_deviceTreeWidget, &ModernDeviceTreeWidget::deviceSelected,
                this, &ModernMainWindow::onDeviceSelected);
        connect(m_deviceTreeWidget, &ModernDeviceTreeWidget::deviceDoubleClicked,
                this, &ModernMainWindow::onDeviceDoubleClicked);
        connect(m_deviceTreeWidget, &ModernDeviceTreeWidget::deviceRightClicked,
                this, &ModernMainWindow::onDeviceRightClicked);
    }
    
    // Connect grid layout manager signals
    if (m_gridLayoutManager) {
        connect(m_gridLayoutManager, &ModernGridLayoutManager::deviceClicked,
                this, &ModernMainWindow::onDeviceClicked);
        connect(m_gridLayoutManager, &ModernGridLayoutManager::deviceDoubleClicked,
                this, &ModernMainWindow::onDeviceDoubleClickedGrid);
        connect(m_gridLayoutManager, &ModernGridLayoutManager::deviceRightClicked,
                this, &ModernMainWindow::onDeviceRightClickedGrid);
    }
}

void ModernMainWindow::setupShortcuts()
{
    // Global shortcuts are handled in keyPressEvent
    // Additional shortcuts can be added here if needed
}

QWidget* ModernMainWindow::createCentralWidget()
{
    // Create main splitter
    m_mainSplitter = new QSplitter(Qt::Horizontal, this);
    
    // Create left panel (tree widget)
    m_leftPanel = createLeftPanel();
    m_mainSplitter->addWidget(m_leftPanel);
    
    // Create right panel (grid layout)
    m_rightPanel = createRightPanel();
    m_mainSplitter->addWidget(m_rightPanel);
    
    // Set splitter sizes
    m_mainSplitter->setSizes({DEFAULT_TREE_WIDTH, 800});
    m_mainSplitter->setStretchFactor(0, 0);
    m_mainSplitter->setStretchFactor(1, 1);
    
    return m_mainSplitter;
}

QWidget* ModernMainWindow::createLeftPanel()
{
    QWidget *panel = new QWidget();
    QVBoxLayout *layout = new QVBoxLayout(panel);
    layout->setContentsMargins(0, 0, 0, 0);
    
    // Create device tree widget
    m_deviceTreeWidget = new ModernDeviceTreeWidget(panel);
    m_deviceTreeWidget->setDeviceGroupManager(m_deviceGroupManager);
    
    layout->addWidget(m_deviceTreeWidget);
    
    return panel;
}

QWidget* ModernMainWindow::createRightPanel()
{
    QWidget *panel = new QWidget();
    QVBoxLayout *layout = new QVBoxLayout(panel);
    layout->setContentsMargins(0, 0, 0, 0);
    
    // Create grid container
    m_gridContainer = createGridContainer();
    layout->addWidget(m_gridContainer);
    
    return panel;
}

QWidget* ModernMainWindow::createGridContainer()
{
    QWidget *container = new QWidget();
    QVBoxLayout *layout = new QVBoxLayout(container);
    layout->setContentsMargins(8, 8, 8, 8);
    
    // Create grid layout manager
    m_gridLayoutManager = new ModernGridLayoutManager(container);
    m_gridLayoutManager->setParentWidget(container);
    m_gridLayoutManager->setColumnCount(DEFAULT_GRID_COLUMNS);
    m_gridLayoutManager->setAutoAdjustColumns(true);
    
    return container;
}

void ModernMainWindow::updateDeviceGrid()
{
    if (!m_gridLayoutManager || !m_deviceGroupManager) {
        return;
    }
    
    // Get devices based on current group or all devices
    QList<DeviceInfo> devices;
    if (m_isGroupMode && !m_currentGroupName.isEmpty()) {
        devices = m_deviceGroupManager->getDevicesInGroup(m_currentGroupName);
    } else {
        // Get all devices
        QStringList groupNames = m_deviceGroupManager->deviceGroups();
        for (const QString &groupName : groupNames) {
            devices.append(m_deviceGroupManager->getDevicesInGroup(groupName));
        }
    }
    
    m_gridLayoutManager->setDevices(devices);
}

void ModernMainWindow::updateDeviceTree()
{
    if (m_deviceTreeWidget) {
        m_deviceTreeWidget->refreshTree();
    }
}

void ModernMainWindow::syncDeviceSelection()
{
    // Sync selection between tree and grid
    // This can be implemented based on specific requirements
}

void ModernMainWindow::applyGroupFilter()
{
    updateDeviceGrid();
}

void ModernMainWindow::saveWindowState()
{
    QSettings settings;
    settings.beginGroup("MainWindow");
    settings.setValue("geometry", saveGeometry());
    settings.setValue("windowState", saveState());
    if (m_mainSplitter) {
        QList<int> sizes = m_mainSplitter->sizes();
        QVariantList sizeList;
        for (int size : sizes) {
            sizeList.append(size);
        }
        settings.setValue("splitterSizes", sizeList);
    } else {
        settings.setValue("splitterSizes", QVariant());
    }
    settings.setValue("groupMode", m_isGroupMode);
    settings.endGroup();
}

void ModernMainWindow::restoreWindowState()
{
    QSettings settings;
    settings.beginGroup("MainWindow");
    restoreGeometry(settings.value("geometry").toByteArray());
    restoreState(settings.value("windowState").toByteArray());
    
    QVariant splitterSizes = settings.value("splitterSizes");
    if (splitterSizes.isValid() && m_mainSplitter) {
        QList<QVariant> sizeList = splitterSizes.toList();
        QList<int> intList;
        for (const QVariant &size : sizeList) {
            intList.append(size.toInt());
        }
        m_mainSplitter->setSizes(intList);
    }
    
    m_isGroupMode = settings.value("groupMode", false).toBool();
    settings.endGroup();
}

void ModernMainWindow::updateMenuStates()
{
    if (m_toggleGroupModeAction) {
        m_toggleGroupModeAction->setChecked(m_isGroupMode);
    }
    
    // Update other menu states based on current selection
    bool hasSelection = !m_currentGroupName.isEmpty();
    if (m_deleteGroupAction) {
        m_deleteGroupAction->setEnabled(hasSelection && m_currentGroupName != "Unassigned Devices");
    }
    if (m_renameGroupAction) {
        m_renameGroupAction->setEnabled(hasSelection && m_currentGroupName != "Unassigned Devices");
    }
}

void ModernMainWindow::updateToolBarStates()
{
    // Update toolbar button states
    updateMenuStates();
}

// Real device management implementation
void ModernMainWindow::onRealDeviceConnected(bool success, const QString& serial, const QString& deviceName, const QSize& size)
{
    Q_UNUSED(size)

    if (!success) {
        qWarning() << "Device connection failed:" << serial;
        return;
    }

    qInfo() << "Device connected to Modern UI:" << deviceName << "-" << serial;

    // Add device to device group manager
    QString groupName = "Unassigned Devices";  // Default group
    addDevice(serial, deviceName.isEmpty() ? serial : deviceName, groupName);

    // Update device grid and tree
    updateDeviceGrid();
    updateDeviceTree();
    updateStatusBar();
    updateWindowTitle();

    // Show notification in status bar
    if (m_statusBar) {
        m_statusBar->showMessage(QString("Device connected: %1 - %2").arg(deviceName).arg(serial), 3000);
    }
}

void ModernMainWindow::onRealDeviceDisconnected(QString serial)
{
    qInfo() << "Device disconnected from Modern UI:" << serial;

    // Remove device from device group manager
    removeDevice(serial);

    // Update device grid and tree
    updateDeviceGrid();
    updateDeviceTree();
    updateStatusBar();
    updateWindowTitle();

    // Show notification in status bar
    if (m_statusBar) {
        m_statusBar->showMessage(QString("Device disconnected: %1").arg(serial), 3000);
    }
}
