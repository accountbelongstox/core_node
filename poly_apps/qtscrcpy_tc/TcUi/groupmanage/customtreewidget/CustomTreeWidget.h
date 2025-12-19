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

#define ITEM_HEIGHT 40	// Device item height;

struct DeviceDataStruct;
struct NodeDataStruct;
class DeviceItemWidget;
class DeviceListWidget;

/*==================================Sidebar Section==================================*/
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
    static QList<NodeDataStruct> m_nodeDataList;// Entire list data for display
    QList<DeviceListWidget*> m_nodeWidgetList;  // Entire list UI for display

private:
    QHBoxLayout* hMainLayout;   // Entire left sidebar layout
    QScrollArea* m_scrollArea;  // Scroll area for the entire left sidebar
    QVBoxLayout* vBackWidget;   // Actual content area of the entire left sidebar
    QWidget* m_deviceBackWidget;// All list areas in actual content
    QTimer m_refreshTimer;      // Refresh data timer;
    int m_refreshIndex;
    AdbProcess m_adb;
    QString phonename;
    DeviceGroups* devicegroups; // Handle actual data information
    DeviceManage* m_deviceManage; // Actually operate device
};

// Data structure for displaying a device
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

// Data structure for displaying a device group
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

/*==================================Device Group Section==================================*/
class DeviceListWidget : public QWidget
{
    Q_OBJECT

public:
    DeviceListWidget(QWidget* parent = NULL);
    // Set title bar information;
    void setTitleInfo(QString strTitle, int count, QColor numberColor, bool choose);
    // Add device sub-item;
    void addDeviceItem(DeviceDataStruct* deviceData, QColor connectColor, QString deviceName, QString deviceNumber, bool choose);
    // Update the status of a specific device item;
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
    QLabel* m_numberLabel;      // Number of devices in title bar (also uses color to indicate connection status)

private:
    QWidget* m_titleBackWidget; // Group title bar
    QLabel* m_foldStateLabel;   // Fold state icon in title bar
    QLabel* m_titleLabel;       // Group name in title bar
    QCheckBox *m_foldTagCheck;  // Whether the group is selected in title bar
    QListWidget* m_listWidget;  // All devices in the group

    bool m_isFolded;
};

/*==================================Device Item Section==================================*/
class DeviceItemWidget : public QWidget
{
    Q_OBJECT

public:
    DeviceItemWidget(QWidget* parent = NULL);
    // Set this device information;
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
    QWidget* m_colorWidget;     // Device connection status
    QLabel* m_deviceLabel;      // Device name
    QLabel* m_numberLabel;      // Device serial number
    QCheckBox *m_deviceCheck;   // Whether the device is selected
};

#endif // CUSTOMTREEWIDGET_H
