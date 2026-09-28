#include "modernuiintegration.h"
#include "dialog.h"
#include "modernmainwindow.h"
#include "moderndevicegroupmanager.h"
#include "moderngridlayoutmanager.h"
#include "moderndevicetreewidget.h"
#include "modernstylesystem.h"
#include <QApplication>
#include <QMessageBox>
#include <QDebug>

// Static constants definition (simplified for Modern UI only)
const QString ModernUIIntegration::CONFIG_GROUP_UI = "UI";
const QString ModernUIIntegration::CONFIG_GROUP_DEVICES = "Devices";

ModernUIIntegration::ModernUIIntegration(Dialog *parentDialog, QObject *parent)
    : QObject(parent)
    , m_parentDialog(parentDialog)
    , m_modernMainWindow(nullptr)
    , m_deviceGroupManager(nullptr)
    , m_gridLayoutManager(nullptr)
    , m_deviceTreeWidget(nullptr)
    , m_styleSystem(nullptr)
    // Modern UI is always enabled (hardcoded)
    , m_hybridSplitter(nullptr)
    , m_uiStack(nullptr)
    , m_settings(new QSettings(this))
    , m_refreshTimer(new QTimer(this))
    , m_syncTimer(new QTimer(this))
{
    setupConfiguration();
    setupTimers();
    setupConnections();
    
    // Load configuration
    loadConfiguration();
    
    // Initialize modern UI if enabled
    if (m_modernUIEnabled) {
        initializeModernUI();
    }
}

ModernUIIntegration::~ModernUIIntegration()
{
    saveConfiguration();
}

// Modern UI is always enabled (hardcoded) - no mode switching needed

void ModernUIIntegration::initializeModernUI()
{
    if (m_initialized) {
        return;
    }
    
    try {
        // Create modern components
        createModernComponents();
        
        // Setup UI
        setupUI();
        
        // Sync initial data
        syncDeviceData();
        
        m_initialized = true;
        
        qDebug() << "Modern UI initialized successfully";
    } catch (const std::exception &e) {
        qWarning() << "Failed to initialize modern UI:" << e.what();
        QMessageBox::warning(nullptr, "Modern UI Error", 
                           QString("Failed to initialize modern UI: %1").arg(e.what()));
    }
}

// Modern UI is always enabled (hardcoded) - no legacy UI switching

void ModernUIIntegration::switchToModernUI()
{
    if (!m_modernUIEnabled) {
        return;
    }
    
    // Initialize modern UI if not already done
    if (!m_initialized) {
        initializeModernUI();
    }
    
    if (m_modernMainWindow) {
        // Show modern UI
        m_modernMainWindow->show();
        
        // Hide legacy UI
        if (m_parentDialog) {
            m_parentDialog->hide();
        }
        
        // Hide hybrid container if it exists
        if (m_hybridContainer) {
            m_hybridContainer->hide();
        }
        
        qDebug() << "Switched to modern UI";
    }
}

void ModernUIIntegration::switchToHybridUI()
{
    if (!m_hybridModeEnabled) {
        return;
    }
    
    // Initialize modern UI if not already done
    if (!m_initialized) {
        initializeModernUI();
    }
    
    if (m_hybridContainer) {
        // Show hybrid container
        m_hybridContainer->show();
        
        // Hide other UIs
        if (m_parentDialog) {
            m_parentDialog->hide();
        }
        if (m_modernMainWindow) {
            m_modernMainWindow->hide();
        }
        
        qDebug() << "Switched to hybrid UI";
    }
}

void ModernUIIntegration::refreshUI()
{
    if (m_syncing) {
        return;
    }
    
    m_syncing = true;
    
    try {
        // Sync device data
        syncDeviceData();
        
        // Update UI state
        updateUIState();
        
        emit uiRefreshed();
    } catch (const std::exception &e) {
        qWarning() << "Failed to refresh UI:" << e.what();
    }
    
    m_syncing = false;
}

void ModernUIIntegration::syncDeviceData()
{
    if (!m_initialized || !m_parentDialog) {
        return;
    }
    
    // Sync device list from legacy UI to modern UI
    // This would need to be implemented based on the actual Dialog class structure
    // For now, we'll provide a placeholder implementation
    
    qDebug() << "Syncing device data between legacy and modern UI";
    
    // TODO: Implement actual device data synchronization
    // This would involve:
    // 1. Getting device list from legacy UI
    // 2. Updating modern UI device group manager
    // 3. Syncing device statuses
    // 4. Syncing device selections
}

void ModernUIIntegration::syncDeviceStatus()
{
    if (!m_initialized) {
        return;
    }
    
    // Sync device status between UIs
    qDebug() << "Syncing device status";
    
    // TODO: Implement device status synchronization
}

void ModernUIIntegration::syncConfiguration()
{
    if (!m_initialized) {
        return;
    }
    
    // Sync configuration between UIs
    qDebug() << "Syncing configuration";
    
    // TODO: Implement configuration synchronization
}

void ModernUIIntegration::syncUIState()
{
    if (!m_initialized) {
        return;
    }
    
    // Sync UI state between UIs
    qDebug() << "Syncing UI state";
    
    // TODO: Implement UI state synchronization
}

void ModernUIIntegration::loadConfiguration()
{
    m_settings->beginGroup(CONFIG_GROUP_UI);
    
    // Modern UI is always enabled (hardcoded)
    qDebug() << "Configuration loaded - Modern UI is always enabled";
    
    m_settings->endGroup();
}

void ModernUIIntegration::saveConfiguration()
{
    m_settings->beginGroup(CONFIG_GROUP_UI);
    
    // Modern UI is always enabled (hardcoded)
    qDebug() << "Configuration saved - Modern UI is always enabled";
    
    m_settings->endGroup();
}

void ModernUIIntegration::resetToDefaults()
{
    // Modern UI is always enabled (hardcoded)
    saveConfiguration();
    
    qDebug() << "Configuration reset to defaults - Modern UI is always enabled";
}

void ModernUIIntegration::saveUIState()
{
    // Save UI state
    qDebug() << "Saving UI state";
    
    // TODO: Implement UI state saving
}

void ModernUIIntegration::restoreUIState()
{
    // Restore UI state
    qDebug() << "Restoring UI state";
    
    // TODO: Implement UI state restoration
}

void ModernUIIntegration::updateUIState()
{
    // Update UI state
    qDebug() << "Updating UI state";
    
    // TODO: Implement UI state updating
}

void ModernUIIntegration::onDeviceConnected(const QString &serial, const QString &name)
{
    if (m_deviceGroupManager) {
        m_deviceGroupManager->addDevice(serial, name);
    }
    
    emit deviceConnected(serial, name);
}

void ModernUIIntegration::onDeviceDisconnected(const QString &serial)
{
    if (m_deviceGroupManager) {
        m_deviceGroupManager->removeDevice(serial);
    }
    
    emit deviceDisconnected(serial);
}

void ModernUIIntegration::onDeviceStatusChanged(const QString &serial, int status)
{
    if (m_deviceGroupManager) {
        DeviceStatus deviceStatus = static_cast<DeviceStatus>(status);
        m_deviceGroupManager->updateDeviceStatus(serial, deviceStatus);
    }
    
    emit deviceStatusChanged(serial, status);
}

void ModernUIIntegration::onDeviceSelectionChanged(const QString &serial, bool selected)
{
    if (m_deviceGroupManager) {
        m_deviceGroupManager->setDeviceSelected(serial, selected);
    }
    
    emit deviceSelectionChanged(serial, selected);
}

void ModernUIIntegration::onUIModeToggle()
{
    // Toggle between legacy and modern UI
    if (m_currentUIMode == UIMode::Legacy) {
        setCurrentUIMode(UIMode::Modern);
    } else {
        setCurrentUIMode(UIMode::Legacy);
    }
}

void ModernUIIntegration::onHybridModeToggle()
{
    // Toggle hybrid mode
    setHybridModeEnabled(!m_hybridModeEnabled);
}

void ModernUIIntegration::onRefreshTimer()
{
    refreshUI();
}

void ModernUIIntegration::onConfigurationChanged()
{
    emit configurationChanged();
}

void ModernUIIntegration::setupUI()
{
    // Create UI switcher
    m_uiSwitcher = createUISwitcher();
    
    // Create hybrid container if hybrid mode is enabled
    if (m_hybridModeEnabled) {
        m_hybridContainer = createHybridContainer();
    }
}

void ModernUIIntegration::setupConnections()
{
    // Connect timers
    connect(m_refreshTimer, &QTimer::timeout, this, &ModernUIIntegration::onRefreshTimer);
    connect(m_syncTimer, &QTimer::timeout, this, &ModernUIIntegration::syncDeviceData);
    
    // Connect configuration changes
    connect(this, &ModernUIIntegration::configurationChanged, 
            this, &ModernUIIntegration::onConfigurationChanged);
}

void ModernUIIntegration::setupTimers()
{
    // Setup refresh timer
    m_refreshTimer->setInterval(REFRESH_INTERVAL_MS);
    m_refreshTimer->setSingleShot(false);
    m_refreshTimer->start();
    
    // Setup sync timer
    m_syncTimer->setInterval(SYNC_INTERVAL_MS);
    m_syncTimer->setSingleShot(false);
    m_syncTimer->start();
}

void ModernUIIntegration::setupConfiguration()
{
    // Setup configuration - QSettings constructor handles organization and app name in Qt6
    // m_settings is already initialized with proper organization and app name
}

QWidget* ModernUIIntegration::createUISwitcher()
{
    QWidget *switcher = new QWidget();
    QHBoxLayout *layout = new QHBoxLayout(switcher);
    
    // Create UI mode label
    m_uiModeLabel = new QLabel("UI Mode:");
    layout->addWidget(m_uiModeLabel);
    
    // Create legacy UI button
    m_legacyUIButton = new QPushButton("Legacy UI");
    m_legacyUIButton->setCheckable(true);
    m_legacyUIButton->setChecked(m_currentUIMode == UIMode::Legacy);
    connect(m_legacyUIButton, &QPushButton::clicked, [this]() {
        setCurrentUIMode(UIMode::Legacy);
    });
    layout->addWidget(m_legacyUIButton);
    
    // Create modern UI button
    m_modernUIButton = new QPushButton("Modern UI");
    m_modernUIButton->setCheckable(true);
    m_modernUIButton->setChecked(m_currentUIMode == UIMode::Modern);
    connect(m_modernUIButton, &QPushButton::clicked, [this]() {
        setCurrentUIMode(UIMode::Modern);
    });
    layout->addWidget(m_modernUIButton);
    
    // Create hybrid UI button
    m_hybridUIButton = new QPushButton("Hybrid UI");
    m_hybridUIButton->setCheckable(true);
    m_hybridUIButton->setChecked(m_currentUIMode == UIMode::Hybrid);
    connect(m_hybridUIButton, &QPushButton::clicked, [this]() {
        setCurrentUIMode(UIMode::Hybrid);
    });
    layout->addWidget(m_hybridUIButton);
    
    // Create hybrid mode checkbox
    m_hybridModeCheckBox = new QCheckBox("Enable Hybrid Mode");
    m_hybridModeCheckBox->setChecked(m_hybridModeEnabled);
    connect(m_hybridModeCheckBox, &QCheckBox::toggled, this, &ModernUIIntegration::onHybridModeToggle);
    layout->addWidget(m_hybridModeCheckBox);
    
    return switcher;
}

QWidget* ModernUIIntegration::createHybridContainer()
{
    QWidget *container = new QWidget();
    QVBoxLayout *layout = new QVBoxLayout(container);
    
    // Create hybrid splitter
    m_hybridSplitter = new QSplitter(Qt::Horizontal, container);
    
    // Create UI stack
    m_uiStack = new QStackedWidget(container);
    
    // Add legacy UI to stack
    if (m_parentDialog) {
        m_uiStack->addWidget(m_parentDialog);
    }
    
    // Add modern UI to stack
    if (m_modernMainWindow) {
        m_uiStack->addWidget(m_modernMainWindow);
    }
    
    // Add to splitter
    m_hybridSplitter->addWidget(m_uiStack);
    
    // Add to layout
    layout->addWidget(m_hybridSplitter);
    
    return container;
}

void ModernUIIntegration::createModernComponents()
{
    // Create modern style system
    m_styleSystem = ModernStyleSystem::instance();
    
    // Create modern device group manager
    m_deviceGroupManager = new ModernDeviceGroupManager(this);
    
    // Create modern grid layout manager
    m_gridLayoutManager = new ModernGridLayoutManager(m_parentDialog);
    
    // Create modern device tree widget
    m_deviceTreeWidget = new ModernDeviceTreeWidget();
    m_deviceTreeWidget->setDeviceGroupManager(m_deviceGroupManager);
    
    // Create modern main window
    m_modernMainWindow = new ModernMainWindow();
    m_modernMainWindow->setParent(nullptr); // Make it a top-level window
    
    qDebug() << "Modern components created successfully";
}

void ModernUIIntegration::updateUISwitcher()
{
    if (m_uiSwitcher) {
        // Update button states
        m_legacyUIButton->setChecked(m_currentUIMode == UIMode::Legacy);
        m_modernUIButton->setChecked(m_currentUIMode == UIMode::Modern);
        m_hybridUIButton->setChecked(m_currentUIMode == UIMode::Hybrid);
        
        // Update button enabled states
        m_modernUIButton->setEnabled(m_modernUIEnabled);
        m_hybridUIButton->setEnabled(m_hybridModeEnabled);
    }
}

void ModernUIIntegration::updateHybridMode()
{
    if (m_hybridModeCheckBox) {
        m_hybridModeCheckBox->setChecked(m_hybridModeEnabled);
    }
    
    if (m_hybridUIButton) {
        m_hybridUIButton->setEnabled(m_hybridModeEnabled);
    }
}

void ModernUIIntegration::updateModernComponents()
{
    // Update modern components
    qDebug() << "Updating modern components";
    
    // TODO: Implement modern components updating
}
