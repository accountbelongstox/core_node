/**!
 * @brief Load and save json configuration file, maintain a copy of the list configuration in use
 */

#include <QFile>
#include <QCoreApplication>
#include <QFileInfo>
#include <QDebug>

#include "devicegroups.h"

QString DeviceGroups::s_deviceGroupsPath = "";

DeviceGroups::DeviceGroups(QObject *parent) : QObject(parent)
{
    QFile loadFile(DeviceGroups::getDeviceGroupsPath() + "/" + "deviceGroups.json");
    if (!loadFile.open(QIODevice::ReadOnly)) {
        qWarning("open file failed: deviceGroups.json");
        return;
    }
    filedata = loadFile.readAll();
    loadFile.close();
}

DeviceGroups::~DeviceGroups() {}

void DeviceGroups::loadDeviceGroups()
{
    QString errorString;
    QJsonParseError jsonError;
    QPair<QString, QString> item;
    qDebug("filedata: %s", filedata.toLocal8Bit().constData());

    jsonDoc = QJsonDocument::fromJson(filedata.toUtf8(), &jsonError);
    QString myjson = jsonDoc.toJson();
    qDebug("jsondata: %s", myjson.toLocal8Bit().constData());

    if (jsonError.error != QJsonParseError::NoError) {
        errorString = QString("json error: %1").arg(jsonError.errorString());
        qWarning("%s", errorString.toLocal8Bit().constData());
    }

    rootObj = jsonDoc.object();

    int count = rootObj.count();
    qDebug("json num: %d", count);

    if (!checkItem(rootObj, "deviceGroups")) {
        errorString = QString("json error: no find deviceGroups");
        qWarning("%s", errorString.toLocal8Bit().constData());
    } else {
        qDebug("got deviceGroups");
    }

    // deviceGroups
    if (rootObj.contains("deviceGroups") && rootObj.value("deviceGroups").isArray()) {
        QJsonArray groupJsonArray;
        groupJsonArray = rootObj.value("deviceGroups").toArray();
        int size = groupJsonArray.size();
        qDebug("group num: %d", size);
        for (int i = 0; i < size; i++) {
            if (!groupJsonArray.at(i).isObject()) {
                errorString = QString("json error: deviceGroups node must be json object");
                qWarning("%s", errorString.toLocal8Bit().constData());
            } else {
                QJsonObject groupJsonObj;
                groupJsonObj = groupJsonArray.at(i).toObject();
                if (!groupJsonObj.contains("groupName") || !groupJsonObj.value("groupName").isString()) {
                    errorString = QString("json error: keyMapNodes no find node groupName");
                    qWarning("%s", errorString.toLocal8Bit().constData());
                } else {
                    Group group;
                    group.groupName = groupJsonObj.value("groupName").toString();
                    group.groupScript = groupJsonObj.value("groupScript").toBool();
                    group.groupSelect = groupJsonObj.value("groupSelect").toBool();
                    group.groupConnectStatus = false;
                    std::wstring valueTmp = L"未分组设备";
                    QString tmpName = QString::fromStdWString(valueTmp);
                    if (group.groupName == tmpName)
                        allGroupOrder = i;
                    QJsonArray deviceJsonArray;
                    deviceJsonArray = groupJsonObj.value("deviceLists").toArray();
                    int deviceNum = deviceJsonArray.size();
                    qDebug("device num: %d", deviceNum);
                    for (int j = 0; j < deviceNum; j++) {
                        QJsonObject deviceJsonObj;
                        deviceJsonObj = deviceJsonArray.at(j).toObject();
                        if (!deviceJsonObj.contains("deviceName") || !deviceJsonObj.value("deviceName").isString()) {
                            errorString = QString("json error: keyMapNodes no find node deviceName");
                            qWarning("%s", errorString.toLocal8Bit().constData());
                        } else {
                            DeviceItem device;
                            device.deviceName = deviceJsonObj.value("deviceName").toString();
                            qDebug("device name: %s", device.deviceName.toLocal8Bit().constData());
                            device.deviceSerialNumber = deviceJsonObj.value("deviceSerialNumber").toString();
                            device.deviceScript = deviceJsonObj.value("deviceScript").toBool();
                            device.deviceSelect = deviceJsonObj.value("deviceSelect").toBool();
                            device.deviceExist = false;
                            device.deviceConnectStatus = false;
                            group.deviceTree.append(device);
                        }
                    }
                    groupTree.append(group);
                }
            }
        }
    }
}

void DeviceGroups::saveJsonFile()
{
    QJsonDocument saveJsonDoc;
    QString saveFileData;
    QJsonObject saveRootObj;

    QJsonArray groupJsonArray;
    foreach (Group i, groupTree)
    {
        QJsonObject groupJsonObj;
        QJsonArray deviceJsonArray;
        foreach (DeviceItem j, i.deviceTree)
        {
            QJsonObject deviceJsonObj;
            deviceJsonObj.insert("deviceName", j.deviceName);
            deviceJsonObj.insert("deviceScript", j.deviceScript);
            deviceJsonObj.insert("deviceSelect", j.deviceSelect);
            deviceJsonObj.insert("deviceSerialNumber", j.deviceSerialNumber);
            deviceJsonObj.insert("deviceName", j.deviceName);
            deviceJsonObj.insert("deviceName", j.deviceName);
            deviceJsonArray.append(deviceJsonObj);
        }
        groupJsonObj.insert("deviceLists", deviceJsonArray);
        groupJsonObj.insert("groupName", i.groupName);
        groupJsonObj.insert("groupScript", i.groupScript);
        groupJsonObj.insert("groupSelect", i.groupSelect);
        groupJsonArray.append(groupJsonObj);
    }

    saveRootObj.insert("deviceGroups", groupJsonArray);
    saveJsonDoc.setObject(saveRootObj);

    QFile loadFile(DeviceGroups::getDeviceGroupsPath() + "/" + "deviceGroups.json");
    if (loadFile.open(QIODevice::WriteOnly)) {
        // Qt 6: Cast to void to suppress C4834 warning (nodiscard attribute on write())
        (void)loadFile.write(saveJsonDoc.toJson());
        loadFile.close();
    }
    saveFileData = saveJsonDoc.toJson();
    qDebug("write jsondata: %s", saveFileData.toLocal8Bit().constData());
}

bool DeviceGroups::checkDevice(QString serialname)
{
    foreach (Group i, groupTree)
    {
        foreach (DeviceItem j, i.deviceTree)
        {
            if (j.deviceSerialNumber == serialname)
                return true;
        }
    }

    return false;
}

void DeviceGroups::setDeviceExist(QString serialname)
{
    for (int i = 0; i < groupTree.size(); i++)
    {
        for (int j = 0; j < groupTree[i].deviceTree.size(); j++)
        {
            if (groupTree[i].deviceTree[j].deviceSerialNumber == serialname)
            {
                groupTree[i].deviceTree[j].deviceExist = true;
                break;
            }
        }
    }
}

const QString &DeviceGroups::getDeviceGroupsPath()
{
    if (s_deviceGroupsPath.isEmpty()) {
        s_deviceGroupsPath = QString::fromLocal8Bit(qgetenv("TC_CONFIG_PATH"));
        QFileInfo fileInfo(s_deviceGroupsPath);
        if (s_deviceGroupsPath.isEmpty() || !fileInfo.isDir()) {
            s_deviceGroupsPath = QCoreApplication::applicationDirPath() + "/config";
        }
    }

    return s_deviceGroupsPath;
}

int DeviceGroups::getGroupCount()
{
    return groupTree.size();
}

QJsonObject DeviceGroups::getItemObject(const QJsonObject &node, const QString &name)
{
    return node.value(name).toObject();
}

bool DeviceGroups::checkItem(const QJsonObject &node, const QString &name)
{
    return node.contains(name);
}

bool DeviceGroups::checkItemObject(const QJsonObject &node, const QString &name)
{
    return node.contains(name) && node.value(name).isObject();
}

QPair<QString, QString> DeviceGroups::getItemValue(const QJsonObject &node, const QString &name)
{
    QString value = getItemString(node, name);
    return {"groupName", value};
}

QString DeviceGroups::getItemString(const QJsonObject &node, const QString &name)
{
    return node.value(name).toString();
}

bool DeviceGroups::checkItemString(const QJsonObject &node, const QString &name)
{
    return node.contains(name) && node.value(name).isString();
}
