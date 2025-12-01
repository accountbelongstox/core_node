#ifndef MODERNUIINTEGRATION_H
#define MODERNUIINTEGRATION_H

#include <QObject>
#include <QWidget>
#include <QSplitter>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QStackedWidget>
#include <QPushButton>
#include <QLabel>
#include <QCheckBox>
#include <QSettings>
#include <QTimer>
#include <QProperty>

// Forward declarations
class Dialog;
class ModernMainWindow;
class ModernDeviceGroupManager;
class ModernGridLayoutManager;
class ModernDeviceTreeWidget;
class ModernStyleSystem;

/**
 * @brief Modern UI Integration Manager
 * 
 * Manages the integration between legacy SmartMatrix UI and modern UI components
 * Provides seamless switching between UI modes and data synchronization
 */
class ModernUIIntegration : public QObject
{
    Q_OBJECT

public:
    // Modern UI is always enabled (hardcoded)

    explicit ModernUIIntegration(Dialog *parentDialog, QObject *parent = nullptr);
    ~ModernUIIntegration();

    // Modern UI is always enabled (hardcoded)

    // Component access
    ModernMainWindow* modernMainWindow() const { return m_modernMainWindow; }
    ModernDeviceGroupManager* deviceGroupManager() const { return m_deviceGroupManager; }
    ModernGridLayoutManager* gridLayoutManager() const { return m_gridLayoutManager; }
    ModernDeviceTreeWidget* deviceTreeWidget() const { return m_deviceTreeWidget; }
    ModernStyleSystem* styleSystem() const { return m_styleSystem; }

    // Integration methods
    void initializeModernUI();
    void switchToLegacyUI();
    void switchToModernUI();
    void switchToHybridUI();
    void refreshUI();

    // Data synchronization
    void syncDeviceData();
    void syncDeviceStatus();
    void syncConfiguration();
    void syncUIState();

    // Configuration management
    void loadConfiguration();
    void saveConfiguration();
    void resetToDefaults();

    // UI state management
    void saveUIState();
    void restoreUIState();
    void updateUIState();

    // Event handling
    void onDeviceConnected(const QString &serial, const QString &name);
    void onDeviceDisconnected(const QString &serial);
    void onDeviceStatusChanged(const QString &serial, int status);
    void onDeviceSelectionChanged(const QString &serial, bool selected);
    
    // UI control methods
    void showModernUI();
    void hideModernUI();

signals:
    // Modern UI signals (no mode changes needed)
    
    // Device events
    void deviceConnected(const QString &serial, const QString &name);
    void deviceDisconnected(const QString &serial);
    void deviceStatusChanged(const QString &serial, int status);
    void deviceSelectionChanged(const QString &serial, bool selected);
    
    // UI events
    void uiRefreshed();
    void configurationChanged();

private slots:
    void onRefreshTimer();
    void onConfigurationChanged();

private:
    void setupUI();
    void setupConnections();
    void setupTimers();
    void setupConfiguration();
    void connectSignals();
    void refreshDevices();
    
    // UI creation helpers
    QWidget* createUISwitcher();
    QWidget* createHybridContainer();
    void createModernComponents();
    
    // Data synchronization helpers
    void syncDeviceList();
    void syncDeviceGroups();
    void syncDeviceStatuses();
    void syncDeviceSelections();
    
    // Configuration helpers
    void loadUISettings();
    void saveUISettings();
    void loadDeviceGroups();
    void saveDeviceGroups();
    
    // UI state helpers
    void updateUISwitcher();
    void updateHybridMode();
    void updateModernComponents();

private:
    // Parent dialog reference
    Dialog *m_parentDialog;
    
    // UI mode and state
    // Modern UI is always enabled (hardcoded)
    
    // Modern UI components
    ModernMainWindow *m_modernMainWindow;
    ModernDeviceGroupManager *m_deviceGroupManager;
    ModernGridLayoutManager *m_gridLayoutManager;
    ModernDeviceTreeWidget *m_deviceTreeWidget;
    ModernStyleSystem *m_styleSystem;
    
    // UI switcher components
    QWidget *m_uiSwitcher;
    QPushButton *m_legacyUIButton;
    QPushButton *m_modernUIButton;
    QPushButton *m_hybridUIButton;
    QCheckBox *m_hybridModeCheckBox;
    QLabel *m_uiModeLabel;
    
    // Hybrid mode container
    QWidget *m_hybridContainer;
    QSplitter *m_hybridSplitter;
    QStackedWidget *m_uiStack;
    
    // Configuration and state
    QSettings *m_settings;
    QTimer *m_refreshTimer;
    QTimer *m_syncTimer;
    
    // State tracking
    bool m_initialized = false;
    bool m_syncing = false;
    
    // Constants
    static const int REFRESH_INTERVAL_MS = 1000;
    static const int SYNC_INTERVAL_MS = 500;
    static const QString CONFIG_GROUP_UI;
    static const QString CONFIG_GROUP_DEVICES;
};

#endif // MODERNUIINTEGRATION_H
