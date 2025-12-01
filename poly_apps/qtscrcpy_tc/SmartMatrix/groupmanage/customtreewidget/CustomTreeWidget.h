#ifndef CUSTOMTREEWIDGET_H
#define CUSTOMTREEWIDGET_H

#include <QWidget>
#include <QLabel>
#include <QHBoxLayout>
#include <QPainter>
#include <QListWidget>
#include <QMouseEvent>
#include <QScrollArea>
#include <QTimer>
#include <QCheckBox>

#include "adbprocess.h"
#include "devicemanage.h"
#include "device.h"
#include "devicegroups.h"
#include "config.h"

#define ITEM_HEIGHT 40	// 设备项高度;

struct DeviceDataStruct;
struct NodeDataStruct;
class DeviceItemWidget;
class DeviceListWidget;

/*==================================侧边栏部分==================================*/
class CustomTreeWidget : public QWidget
{
    Q_OBJECT

public:
    CustomTreeWidget(QWidget *parent = Q_NULLPTR);
    void addMyDevice();
    void saveDiviceList();

private:
    void initWidget();
    void showWidget();
    void loadJsonConfig();
    bool checkAdbRun();
    void on_updateDevice_clicked();
    void on_startServerBtn_clicked();
    bool eventFilter(QObject *watched, QEvent *event);
    void addNewGroupList();

private slots:
    void onNodeFoldChanged();
    void onUpdateData();
    void onDeleteGroup();
    void onDeviceAddToGroup(int dstGroup, int srcGroup, int srcDevice);
    void onGroupNameChanged(int srcGroup, QString name);
    void onGroupChooseChanged(int srcGroup, bool choose);
    void onDeviceNameChangedWithGroup(int srcGroup, int srcDevice, QString name);
    void onDeviceCheckboxChangeFromGroup(int groupIndex, int deviceIndex, bool choose);

public:
    static QList<NodeDataStruct> m_nodeDataList;// 显示用的整个列表数据
    QList<DeviceListWidget*> m_nodeWidgetList;  // 显示用的整个列表UI

private:
    QHBoxLayout* hMainLayout;   // 整个左侧边栏布局
    QScrollArea* m_scrollArea;  // 整个左侧边栏的滚动区域
    QVBoxLayout* vBackWidget;   // 整个左侧边栏的实际内容区域
    QWidget* m_deviceBackWidget;// 实际内容中所有列表区域
    QTimer m_refreshTimer;      // 刷新数据时钟;
    int m_refreshIndex;
    AdbProcess m_adb;
    QString phonename;
    DeviceGroups* devicegroups; // 处理实际数据信息
    DeviceManage* m_deviceManage; // 实际操作设备
};

// 一个设备的用于显示的数据结构
struct DeviceDataStruct
{
    QColor connectColor;
    QString deviceName;
    QString deviceNumber;
    bool choose;
    DeviceGroups::DeviceItem* device;
    DeviceItemWidget* itemWidget;
    int index;
};

// 一个设备组用于显示的数据结构
struct NodeDataStruct
{
    QString strNodeName;
    int strNodeCount;
    QColor numberColor;
    bool choose;
    QList<DeviceDataStruct> deviceDataList;
    DeviceGroups::Group* group;
    DeviceListWidget* deviceListWidget;
};

/*==================================设备组部分==================================*/
class DeviceListWidget : public QWidget
{
    Q_OBJECT

public:
    DeviceListWidget(QWidget* parent = NULL);
    // 设置标题栏信息;
    void setTitleInfo(QString strTitle, int count, QColor numberColor, bool choose);
    // 添加设备子项;
    void addDeviceItem(DeviceDataStruct* deviceData, QColor connectColor, QString deviceName, QString deviceNumber, bool choose);
    // 更新设备某一项状态;
    void updateDeviceItem(int rowCount, QColor connectColor, QString deviceName, QString deviceNumber);
    void updateDeviceIndex(int deviceIndex);

private:
    void initTitleBackWidget();
    void initWidget();
    bool eventFilter(QObject *watched, QEvent *event);

signals:
    void signalNodeFoldChanged(int itemHeight);
    void signalDeleteGroup();
    void signalDeviceAddToGroup(int dstGroup, int srcGroup, int srcDevice);
    void signalGroupNameChanged(int srcGroup, QString name);
    void signalGroupChooseChanged(int srcGroup, bool choose);
    void signalDeviceNameChangedWithGroup(int srcGroup, int srcDevice, QString name);
    void signalDeviceDeleteFromGoup(int groupIndex, int deviceIndex);
    void signalDeviceCheckboxChangeFromGroup(int goupIndex, int deviceIndex, bool choose);

public slots:
    void onDeleteDevice(int deviceIndex);

private slots:
    void onAddToGroup(int dstGroup, int srcDevice);
    void onDeviceNameChanged(int deviceIndex, QString text);
    void onCheckboxChangeFromDevice(int deviceIndex, bool choose);
    void onGroupCheckboxTextGet();

public:
    int groupIndex;
    QLabel* m_numberLabel;      // 标题栏中设备数量（同时也用颜色表示连接状态）

private:
    QWidget* m_titleBackWidget; // 组标题栏
    QLabel* m_foldStateLabel;   // 标题栏中折叠状态图标
    QLabel* m_titleLabel;       // 标题栏中组名
    QCheckBox *m_foldTagCheck;  // 标题栏中组是否被选中
    QListWidget* m_listWidget;  // 组中所有设备

    bool m_isFolded;
};

/*==================================设备项部分==================================*/
class DeviceItemWidget : public QWidget
{
    Q_OBJECT

public:
    DeviceItemWidget(QWidget* parent = NULL);
    // 设置本设备信息;
    void setDeviceInfo(QColor connectColor, QString deviceName, QString deviceNumber, bool choose);

private:
    void initWidget();
    bool eventFilter(QObject *watched, QEvent *event);
    void removeCurrentDevice();

private slots:
    void onCheckboxTextGet();

signals:
    void signalDeleteDevice(int deviceIndex);
    void signalDeviceNameChanged(int deviceIndex, QString text);
    void signalAddToGroup(int dstGroup, int srcDevice);
    void signalCheckboxChangeFromDevice(int deviceIndex, bool choose);

public:
    int deviceIndex;

private:
    QWidget* m_colorWidget;     // 设备连接状态
    QLabel* m_deviceLabel;      // 设备名
    QLabel* m_numberLabel;      // 设备序列号
    QCheckBox *m_deviceCheck;   // 设备是否选中
};

#endif // CUSTOMTREEWIDGET_H
