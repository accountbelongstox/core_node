#ifndef DEVICEGROUPS_H
#define DEVICEGROUPS_H

#include <QObject>
#include <QJsonObject>
#include <QJsonArray>
#include <QJsonDocument>

#include "devicemanage.h"

class DeviceGroups : public QObject
{
    Q_OBJECT

public:
    struct DeviceItem
    {
        QString deviceName;
        QString deviceSerialNumber;
        bool deviceExist;
        bool deviceSelect;
        bool deviceConnectStatus;
        bool deviceScript;
        Device *m_device;
    };

    struct Group
    {
        QString groupName;
        bool groupScript;
        bool groupSelect;
        bool groupConnectStatus;
        QList<DeviceItem> deviceTree;
        DeviceManage *m_deviceManage;
    };

    DeviceGroups(QObject *parent = Q_NULLPTR);
    virtual ~DeviceGroups();
    void loadDeviceGroups();
    static const QString &getDeviceGroupsPath();
    int getGroupCount();
    void saveJsonFile();
    bool checkDevice(QString serialname);
    void setDeviceExist(QString serialname);

private:
    // safe check for base
    bool checkItem(const QJsonObject &node, const QString &name);
    bool checkItemObject(const QJsonObject &node, const QString &name);
    bool checkItemString(const QJsonObject &node, const QString &name);

    // get value from json object
    QJsonObject getItemObject(const QJsonObject &node, const QString &name);
    QString getItemString(const QJsonObject &node, const QString &name);
    QPair<QString, QString> getItemValue(const QJsonObject &node, const QString &name);

public:
    QJsonObject rootObj;
    QJsonDocument jsonDoc;
    QList<Group> groupTree;
    int allGroupOrder;

private:
    static QString s_deviceGroupsPath;
    QString filedata;
};

#endif // DEVICEGROUPS_H
