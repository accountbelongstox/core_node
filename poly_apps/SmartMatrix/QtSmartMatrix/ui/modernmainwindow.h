#ifndef MODERNMAINWINDOW_H
#define MODERNMAINWINDOW_H

#include <QMainWindow>
#include <QSplitter>
#include <QHBoxLayout>
#include <QVBoxLayout>
#include <QWidget>
#include <QMenuBar>
#include <QStatusBar>
#include <QToolBar>
#include <QAction>
#include <QActionGroup>
#include <QMenu>
#include <QLabel>
#include <QProgressBar>
#include <QTimer>
#include <QSystemTrayIcon>
#include <QApplication>
#include <QMessageBox>
#include <QSettings>
#include <QCloseEvent>
#include <QShowEvent>
#include <QHideEvent>
#include <QResizeEvent>
#include <QMoveEvent>

#include "moderndevicetreewidget.h"
#include "modernrightpanel.h"
#include "moderndevicegroupmanager.h"

class ModernMainWindow : public QMainWindow
{
    Q_OBJECT

public:
    explicit ModernMainWindow(QWidget *parent = nullptr);
    ~ModernMainWindow();

protected:
    void closeEvent(QCloseEvent *event) override;
    void showEvent(QShowEvent *event) override;
    void hideEvent(QHideEvent *event) override;
    void resizeEvent(QResizeEvent *event) override;
    void moveEvent(QMoveEvent *event) override;

private slots:
    // 菜单和工具栏动作
    void onNewGroup();
    void onDeleteGroup();
    void onGroupSettings();
    void onDeviceSettings();
    void onGlobalSettings();
    void onAbout();
    void onExit();
    void onMinimizeToTray();
    void onShowWindow();
    void onQuitApplication();

    // 设备树信号处理
    void onDeviceSelectionChanged(const QStringList &serials);
    void onGroupSelectionChanged(const QString &groupName);
    void onDeviceDoubleClicked(const QString &serial);
    void onGroupDoubleClicked(const QString &groupName);

    // 右侧面板信号处理
    void onDeviceOperationRequested(const QString &operation, const QStringList &serials);
    void onGroupOperationRequested(const QString &operation, const QString &groupName);
    void onGlobalOperationRequested(const QString &operation);
    void onSettingsChanged(const QString &key, const QVariant &value);

    // 设备管理器信号处理
    void onDeviceStatusChanged(const QString &serial, DeviceStatus status);
    void onDeviceNameChanged(const QString &serial, const QString &name);
    void onDeviceGroupAdded(const QString &groupName);
    void onDeviceGroupRemoved(const QString &groupName);

    // 状态更新
    void updateStatusBar();
    void updateWindowTitle();

    // 系统托盘
    void onTrayIconActivated(QSystemTrayIcon::ActivationReason reason);

private:
    void setupUI();
    void createMenuBar();
    void createToolBar();
    void createStatusBar();
    void createSystemTray();
    void setupConnections();
    void loadSettings();
    void saveSettings();
    void applyModernStyle();

    // UI组件
    QWidget *m_centralWidget;
    QSplitter *m_mainSplitter;
    QHBoxLayout *m_centralLayout;
    
    // 核心组件
    ModernDeviceTreeWidget *m_deviceTreeWidget;
    ModernRightPanel *m_rightPanel;
    ModernDeviceGroupManager *m_deviceGroupManager;

    // 菜单和工具栏
    QMenuBar *m_menuBar;
    QToolBar *m_toolBar;
    QStatusBar *m_statusBar;
    
    // 菜单
    QMenu *m_fileMenu;
    QMenu *m_editMenu;
    QMenu *m_viewMenu;
    QMenu *m_toolsMenu;
    QMenu *m_helpMenu;
    QMenu *m_trayMenu;

    // 动作
    QAction *m_newGroupAction;
    QAction *m_deleteGroupAction;
    QAction *m_groupSettingsAction;
    QAction *m_deviceSettingsAction;
    QAction *m_globalSettingsAction;
    QAction *m_aboutAction;
    QAction *m_exitAction;
    QAction *m_minimizeToTrayAction;
    QAction *m_showWindowAction;
    QAction *m_quitApplicationAction;

    // 状态栏组件
    QLabel *m_statusLabel;
    QLabel *m_deviceCountLabel;
    QLabel *m_connectionStatusLabel;
    QProgressBar *m_operationProgressBar;

    // 系统托盘
    QSystemTrayIcon *m_trayIcon;

    // 设置
    QSettings *m_settings;

    // 状态
    bool m_minimizeToTray;
    bool m_startMinimized;
    bool m_showNotifications;
    bool m_autoConnect;
    int m_connectionTimeout;
    int m_quality;
    QString m_resolution;

    // 定时器
    QTimer *m_statusUpdateTimer;
};

#endif // MODERNMAINWINDOW_H