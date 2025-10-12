#ifndef MODERNMAINWINDOW_H
#define MODERNMAINWINDOW_H

#include <QMainWindow>
#include <QSplitter>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QWidget>
#include <QMenuBar>
#include <QToolBar>
#include <QStatusBar>
#include <QLabel>
#include <QProgressBar>
#include <QProperty>
#include <QTimer>
#include "moderndevicegroupmanager.h"
#include "moderngridlayoutmanager.h"
#include "moderndevicetreewidget.h"
#include "../QtScrcpyCore/include/QtScrcpyCore.h"

/**
 * @brief Modern main window for QtScrcpy
 * 
 * Integrates all modern UI components with a clean, responsive layout
 * Based on Qt6.9's modern features and best practices
 */
class ModernMainWindow : public QMainWindow
{
    Q_OBJECT

public:
    explicit ModernMainWindow(QWidget *parent = nullptr);
    ~ModernMainWindow();

    // Using Qt6.9's QProperty system
    Q_PROPERTY(bool isGroupMode READ isGroupMode WRITE setGroupMode NOTIFY groupModeChanged)
    Q_PROPERTY(int connectedDeviceCount READ connectedDeviceCount NOTIFY connectedDeviceCountChanged)
    Q_PROPERTY(int totalDeviceCount READ totalDeviceCount NOTIFY totalDeviceCountChanged)
    Q_PROPERTY(QString currentGroupName READ currentGroupName NOTIFY currentGroupNameChanged)

    // Main functionality
    bool isGroupMode() const { return m_isGroupMode; }
    void setGroupMode(bool enabled);
    int connectedDeviceCount() const;
    int totalDeviceCount() const;
    QString currentGroupName() const { return m_currentGroupName; }

    // Device management
    void addDevice(const QString &serial, const QString &name, const QString &groupName = "Unassigned Devices");
    void removeDevice(const QString &serial);
    void updateDeviceStatus(const QString &serial, DeviceStatus status);
    void refreshDevices();

    // UI management
    void setSplitterSizes(const QList<int> &sizes);
    void setTreeWidgetWidth(int width);
    void setGridLayoutColumns(int columns);
    void setAutoAdjustColumns(bool enabled);

protected:
    // Override close event
    void closeEvent(QCloseEvent *event) override;
    
    // Override resize event
    void resizeEvent(QResizeEvent *event) override;
    
    // Override key press event
    void keyPressEvent(QKeyEvent *event) override;

signals:
    void groupModeChanged();
    void connectedDeviceCountChanged();
    void totalDeviceCountChanged();
    void currentGroupNameChanged();
    
    // Device signals
    void deviceConnected(const QString &serial);
    void deviceDisconnected(const QString &serial);
    void deviceSelected(const QString &serial);
    void deviceDoubleClicked(const QString &serial);
    
    // Group signals
    void groupSelected(const QString &groupName);
    void groupModeToggled(bool enabled);

private slots:
    // Menu actions
    void onNewGroup();
    void onDeleteGroup();
    void onRenameGroup();
    void onRefreshDevices();
    void onSelectAllDevices();
    void onDeselectAllDevices();
    void onToggleGroupMode();
    void onShowSettings();
    void onShowAbout();

    // Real device management (from qsc::IDeviceManage)
    void onRealDeviceConnected(bool success, const QString& serial, const QString& deviceName, const QSize& size);
    void onRealDeviceDisconnected(QString serial);
    
    // Device group manager slots
    void onDeviceGroupAdded(const QString &groupName);
    void onDeviceGroupRemoved(const QString &groupName);
    void onDeviceAdded(const QString &serial, const QString &groupName);
    void onDeviceRemoved(const QString &serial);
    void onDeviceStatusChanged(const QString &serial, DeviceStatus status);
    void onDeviceSelectionChanged(const QString &serial, bool selected);
    
    // Tree widget slots
    void onGroupSelected(const QString &groupName);
    void onDeviceSelected(const QString &serial);
    void onDeviceDoubleClicked(const QString &serial);
    void onDeviceRightClicked(const QString &serial, const QPoint &globalPos);
    
    // Grid layout slots
    void onDeviceClicked(const QString &serial);
    void onDeviceDoubleClickedGrid(const QString &serial);
    void onDeviceRightClickedGrid(const QString &serial, const QPoint &globalPos);
    
    // Status updates
    void updateStatusBar();
    void updateWindowTitle();

private:
    void setupUI();
    void setupMenuBar();
    void setupToolBar();
    void setupStatusBar();
    void setupConnections();
    void setupShortcuts();
    
    // UI creation helpers
    QWidget* createCentralWidget();
    QWidget* createLeftPanel();
    QWidget* createRightPanel();
    QWidget* createGridContainer();
    
    // Device management helpers
    void updateDeviceGrid();
    void updateDeviceTree();
    void syncDeviceSelection();
    void applyGroupFilter();
    
    // UI state management
    void saveWindowState();
    void restoreWindowState();
    void updateMenuStates();
    void updateToolBarStates();
    
    // Data members
    ModernDeviceGroupManager *m_deviceGroupManager;
    ModernGridLayoutManager *m_gridLayoutManager;
    ModernDeviceTreeWidget *m_deviceTreeWidget;
    
    // UI components
    QSplitter *m_mainSplitter;
    QWidget *m_leftPanel;
    QWidget *m_rightPanel;
    QWidget *m_gridContainer;
    
    // Menu and toolbar
    QMenuBar *m_menuBar;
    QToolBar *m_toolBar;
    QStatusBar *m_statusBar;
    
    // Menu actions
    QAction *m_newGroupAction;
    QAction *m_deleteGroupAction;
    QAction *m_renameGroupAction;
    QAction *m_refreshDevicesAction;
    QAction *m_selectAllAction;
    QAction *m_deselectAllAction;
    QAction *m_toggleGroupModeAction;
    QAction *m_showSettingsAction;
    QAction *m_showAboutAction;
    
    // Status bar widgets
    QLabel *m_statusLabel;
    QLabel *m_deviceCountLabel;
    QLabel *m_connectionStatusLabel;
    QProgressBar *m_connectionProgressBar;
    
    // State
    bool m_isGroupMode = false;
    QString m_currentGroupName;
    QTimer *m_statusUpdateTimer;
    
    // Constants
    static const int STATUS_UPDATE_INTERVAL_MS = 1000;
    static const int DEFAULT_TREE_WIDTH = 250;
    static const int DEFAULT_GRID_COLUMNS = 4;
};

#endif // MODERNMAINWINDOW_H
