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
    , m_hybridSplitter(nullptr)
    , m_uiStack(nullptr)
    , m_settings(new QSettings(this))
    , m_refreshTimer(new QTimer(this))
    , m_syncTimer(new QTimer(this))
    , m_initialized(false)
    , m_syncing(false)
{
    // Modern UI is always enabled (hardcoded)
    initializeModernUI();
    setupTimers();
    loadConfiguration();
}

ModernUIIntegration::~ModernUIIntegration()
{
    saveConfiguration();
}

void ModernUIIntegration::initializeModernUI()
{
    if (m_initialized) {
        return;
    }
    
    try {
        // Create style system
        m_styleSystem = new ModernStyleSystem(this);
        
        // Create device group manager
        m_deviceGroupManager = new ModernDeviceGroupManager(this);
        
        // Create grid layout manager
        m_gridLayoutManager = new ModernGridLayoutManager(m_parentDialog);
        
        // Create device tree widget
        m_deviceTreeWidget = new ModernDeviceTreeWidget(this);
        
        // Create modern main window
        m_modernMainWindow = new ModernMainWindow(this);
        
        // Connect signals
        connectSignals();
        
        m_initialized = true;
        qDebug() << "Modern UI initialized successfully";
        
    } catch (const std::exception &e) {
        QMessageBox::warning(nullptr, "Modern UI Error", 
                           QString("Failed to initialize modern UI: %1").arg(e.what()));
    }
}

void ModernUIIntegration::setupTimers()
{
    // Setup refresh timer
    m_refreshTimer->setInterval(REFRESH_INTERVAL_MS);
    connect(m_refreshTimer, &QTimer::timeout, this, &ModernUIIntegration::refreshDevices);
    m_refreshTimer->start();
    
    // Setup sync timer
    m_syncTimer->setInterval(SYNC_INTERVAL_MS);
    connect(m_syncTimer, &QTimer::timeout, this, &ModernUIIntegration::syncUIState);
    m_syncTimer->start();
}

void ModernUIIntegration::connectSignals()
{
    // Connect device group manager signals
    if (m_deviceGroupManager) {
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceAdded,
                this, &ModernUIIntegration::onDeviceConnected);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceRemoved,
                this, &ModernUIIntegration::onDeviceDisconnected);
    }
    
    // Connect grid layout manager signals
    if (m_gridLayoutManager) {
        connect(m_gridLayoutManager, &ModernGridLayoutManager::deviceClicked,
                this, &ModernUIIntegration::onDeviceSelectionChanged);
    }
    
    // Connect device tree widget signals
    if (m_deviceTreeWidget) {
        connect(m_deviceTreeWidget, &ModernDeviceTreeWidget::deviceSelected,
                this, &ModernUIIntegration::onDeviceSelectionChanged);
    }
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

void ModernUIIntegration::refreshDevices()
{
    if (m_deviceGroupManager) {
        m_deviceGroupManager->refreshDevices();
    }
}

void ModernUIIntegration::syncUIState()
{
    if (m_syncing) {
        return;
    }
    
    m_syncing = true;
    
    // Sync UI state between components
    if (m_deviceGroupManager && m_deviceTreeWidget) {
        // Sync device selection
        QStringList selectedDevices = m_deviceTreeWidget->selectedDeviceSerials();
        // Update grid layout with selected devices
    }
    
    m_syncing = false;
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
        m_deviceGroupManager->updateDeviceStatus(serial, status);
    }
    
    emit deviceStatusChanged(serial, status);
}

void ModernUIIntegration::onDeviceSelectionChanged(const QString &serial, bool selected)
{
    if (m_gridLayoutManager) {
        if (selected) {
            m_gridLayoutManager->addDevice(serial);
        } else {
            m_gridLayoutManager->removeDevice(serial);
        }
    }
    
    emit deviceSelectionChanged(serial, selected);
}

void ModernUIIntegration::showModernUI()
{
    if (m_modernMainWindow) {
        m_modernMainWindow->show();
        qDebug() << "Modern UI shown";
    }
}

void ModernUIIntegration::hideModernUI()
{
    if (m_modernMainWindow) {
        m_modernMainWindow->hide();
        qDebug() << "Modern UI hidden";
    }
}

void ModernUIIntegration::resetToDefaults()
{
    // Modern UI is always enabled (hardcoded)
    saveConfiguration();
    
    qDebug() << "Configuration reset to defaults - Modern UI is always enabled";
}
