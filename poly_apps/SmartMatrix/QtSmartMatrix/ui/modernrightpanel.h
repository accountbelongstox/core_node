#ifndef MODERNRIGHTPANEL_H
#define MODERNRIGHTPANEL_H

#include <QWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QToolBar>
#include <QToolButton>
#include <QPushButton>
#include <QLabel>
#include <QStackedWidget>
#include <QScrollArea>
#include <QGroupBox>
#include <QCheckBox>
#include <QSpinBox>
#include <QComboBox>
#include <QSlider>
#include <QProgressBar>
#include <QTextEdit>
#include <QListWidget>
#include <QTreeWidget>
#include <QSplitter>
#include <QFrame>
#include <QAction>
#include <QActionGroup>
#include <QButtonGroup>
#include <QTimer>
#include <QPropertyAnimation>
#include <QGraphicsOpacityEffect>
#include <QPainter>
#include <QStyleOption>
#include <QApplication>

#include "moderndevicegroupmanager.h"

class ModernRightPanel : public QWidget
{
    Q_OBJECT

public:
    enum OperationMode {
        GlobalMode,      // 全局操作模式
        GroupMode,       // 组操作模式  
        DeviceMode       // 设备操作模式
    };
    Q_ENUM(OperationMode)

    explicit ModernRightPanel(QWidget *parent = nullptr);
    ~ModernRightPanel();

    // 设置设备组管理器
    void setDeviceGroupManager(ModernDeviceGroupManager *manager);

    // 操作模式控制
    OperationMode operationMode() const { return m_operationMode; }
    void setOperationMode(OperationMode mode);

    // 选择状态
    QStringList selectedDeviceSerials() const { return m_selectedDeviceSerials; }
    QString selectedGroupName() const { return m_selectedGroupName; }

public slots:
    // 选择变化处理
    void onDeviceSelectionChanged(const QStringList &serials);
    void onGroupSelectionChanged(const QString &groupName);
    void onClearSelection();

    // 设备状态更新
    void onDeviceStatusChanged(const QString &serial, DeviceStatus status);
    void onDeviceNameChanged(const QString &serial, const QString &name);

    // 组变化处理
    void onGroupAdded(const QString &groupName);
    void onGroupRemoved(const QString &groupName);
    void onGroupColorChanged(const QString &groupName, const QColor &color);

signals:
    // 操作模式变化
    void operationModeChanged(OperationMode mode);

    // 设备操作信号
    void deviceOperationRequested(const QString &operation, const QStringList &serials);
    void groupOperationRequested(const QString &operation, const QString &groupName);
    void globalOperationRequested(const QString &operation);

    // 设置变化信号
    void settingsChanged(const QString &key, const QVariant &value);

private slots:
    // 操作按钮处理
    void onDeviceOperation();
    void onGroupOperation();
    void onGlobalOperation();
    void onSettingsChanged();

    // 动画处理
    void onAnimationFinished();

private:
    void setupUI();
    void createActions();
    void setupGlobalMode();
    void setupGroupMode();
    void setupDeviceMode();
    void updateModeDisplay();
    void updateOperationButtons();
    void updateStatistics();
    void updateGroupSettings();
    void updateDeviceSettings();

    // UI创建辅助方法
    QWidget* createOperationPanel();
    QWidget* createSettingsPanel();
    QWidget* createStatisticsPanel();
    QWidget* createGroupSettingsPanel();
    QWidget* createDeviceSettingsPanel();
    QWidget* createGlobalSettingsPanel();

    // 样式和动画
    void setupAnimations();
    void applyModernStyle();
    void animateModeTransition();

private:
    // 核心组件
    ModernDeviceGroupManager *m_deviceGroupManager;
    OperationMode m_operationMode;

    // 选择状态
    QStringList m_selectedDeviceSerials;
    QString m_selectedGroupName;

    // UI组件
    QVBoxLayout *m_mainLayout;
    QStackedWidget *m_stackedWidget;
    QToolBar *m_modeToolBar;
    QActionGroup *m_modeActionGroup;
    
    // 模式页面
    QWidget *m_globalModePage;
    QWidget *m_groupModePage;
    QWidget *m_deviceModePage;

    // 操作面板
    QWidget *m_operationPanel;
    QWidget *m_settingsPanel;
    QWidget *m_statisticsPanel;

    // 全局模式组件
    QPushButton *m_globalConnectAllBtn;
    QPushButton *m_globalDisconnectAllBtn;
    QPushButton *m_globalRefreshBtn;
    QPushButton *m_globalSettingsBtn;
    QLabel *m_globalStatsLabel;

    // 组模式组件
    QPushButton *m_groupConnectBtn;
    QPushButton *m_groupDisconnectBtn;
    QPushButton *m_groupSettingsBtn;
    QPushButton *m_groupDeleteBtn;
    QLabel *m_groupStatsLabel;
    QComboBox *m_groupColorCombo;

    // 设备模式组件
    QPushButton *m_deviceConnectBtn;
    QPushButton *m_deviceDisconnectBtn;
    QPushButton *m_deviceSettingsBtn;
    QPushButton *m_deviceRemoveBtn;
    QLabel *m_deviceInfoLabel;

    // 设置组件
    QCheckBox *m_autoConnectCheck;
    QCheckBox *m_showNotificationsCheck;
    QSpinBox *m_connectionTimeoutSpin;
    QSlider *m_qualitySlider;
    QComboBox *m_resolutionCombo;

    // 动画
    QPropertyAnimation *m_fadeAnimation;
    QGraphicsOpacityEffect *m_opacityEffect;
    QTimer *m_animationTimer;

    // 样式
    QString m_currentStyle;
};

#endif // MODERNRIGHTPANEL_H