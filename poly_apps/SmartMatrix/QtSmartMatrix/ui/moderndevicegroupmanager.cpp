#include "moderndevicegroupmanager.h"
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QStandardPaths>
#include <QDir>
#include <QDebug>
#include <QApplication>

// Static constant definitions
const QString ModernDeviceGroupManager::DEFAULT_GROUP_NAME = "Unassigned Devices";
const QString ModernDeviceGroupManager::DEFAULT_CONFIG_FILE = "device_groups.json";

// Predefined group colors (modern and visually distinct)
const QList<QColor> ModernDeviceGroupManager::GROUP_COLORS = {
    QColor(100, 149, 237), // Cornflower Blue
    QColor(50, 205, 50),   // Lime Green
    QColor(255, 140, 0),   // Dark Orange
    QColor(138, 43, 226),  // Blue Violet
    QColor(220, 20, 60),   // Crimson
    QColor(0, 191, 255),   // Deep Sky Blue
    QColor(255, 215, 0),   // Gold
    QColor(147, 112, 219), // Medium Purple
    QColor(64, 224, 208),  // Turquoise
    QColor(255, 105, 180), // Hot Pink
};

// DeviceInfo implementation
QJsonObject DeviceInfo::toJson() const
{
    QJsonObject obj;
    obj["serial"] = m_serial;
    obj["name"] = m_name;
    obj["status"] = static_cast<int>(m_status);
    obj["statusColor"] = m_statusColor.name();
    obj["isSelected"] = m_isSelected;
    obj["groupName"] = m_groupName;
    return obj;
}

DeviceInfo DeviceInfo::fromJson(const QJsonObject &json)
{
    DeviceInfo device;
    device.m_serial = json["serial"].toString();
    device.m_name = json["name"].toString();
    device.m_status = static_cast<DeviceStatus>(json["status"].toInt());
    device.m_statusColor = QColor(json["statusColor"].toString());
    device.m_isSelected = json["isSelected"].toBool();
    device.m_groupName = json["groupName"].toString();
    return device;
}

QColor DeviceInfo::getStatusColor() const
{
    switch (m_status) {
    case DeviceStatus::Disconnected:
        return QColor(Qt::gray);
    case DeviceStatus::Connecting:
        return QColor(Qt::yellow);
    case DeviceStatus::Connected:
        return QColor(Qt::green);
    case DeviceStatus::Error:
        return QColor(Qt::red);
    default:
        return QColor(Qt::gray);
    }
}

QString DeviceInfo::getStatusText() const
{
    switch (m_status) {
    case DeviceStatus::Disconnected:
        return "Disconnected";
    case DeviceStatus::Connecting:
        return "Connecting";
    case DeviceStatus::Connected:
        return "Connected";
    case DeviceStatus::Error:
        return "Error";
    default:
        return "Unknown";
    }
}

// DeviceGroup implementation
void DeviceGroup::addDevice(const DeviceInfo &device)
{
    // Check if already exists
    for (auto it = m_devices.begin(); it != m_devices.end(); ++it) {
        if (it->m_serial == device.m_serial) {
            *it = device;
            return;
        }
    }
    m_devices.append(device);
}

void DeviceGroup::removeDevice(const QString &serial)
{
    for (auto it = m_devices.begin(); it != m_devices.end(); ++it) {
        if (it->m_serial == serial) {
            m_devices.erase(it);
            return;
        }
    }
}

void DeviceGroup::updateDeviceStatus(const QString &serial, DeviceStatus status)
{
    for (auto &device : m_devices) {
        if (device.m_serial == serial) {
            device.m_status = status;
            device.m_statusColor = device.getStatusColor();
            return;
        }
    }
}

DeviceInfo* DeviceGroup::getDevice(const QString &serial)
{
    for (auto &device : m_devices) {
        if (device.m_serial == serial) {
            return &device;
        }
    }
    return nullptr;
}

QJsonObject DeviceGroup::toJson() const
{
    QJsonObject obj;
    obj["name"] = m_name;
    obj["isSelected"] = m_isSelected;
    obj["isExpanded"] = m_isExpanded;
    obj["color"] = m_color.name();

    QJsonArray devicesArray;
    for (const auto &device : m_devices) {
        devicesArray.append(device.toJson());
    }
    obj["devices"] = devicesArray;

    return obj;
}

DeviceGroup DeviceGroup::fromJson(const QJsonObject &json)
{
    DeviceGroup group;
    group.m_name = json["name"].toString();
    group.m_isSelected = json["isSelected"].toBool();
    group.m_isExpanded = json["isExpanded"].toBool();
    group.m_color = QColor(json["color"].toString());
    if (!group.m_color.isValid()) {
        group.m_color = QColor(100, 149, 237); // Default color if invalid
    }

    QJsonArray devicesArray = json["devices"].toArray();
    for (const auto &value : devicesArray) {
        if (value.isObject()) {
            DeviceInfo device = DeviceInfo::fromJson(value.toObject());
            group.m_devices.append(device);
        }
    }

    return group;
}

// ModernDeviceGroupManager implementation
ModernDeviceGroupManager::ModernDeviceGroupManager(QObject *parent)
    : QObject(parent)
    , m_autoSaveTimer(new QTimer(this))
{
    // Set default config path
    QString appDataPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(appDataPath);
    m_configPath = QDir(appDataPath).filePath(DEFAULT_CONFIG_FILE);
    
    setupAutoSave();
    
    // Create default group
    addDeviceGroup(DEFAULT_GROUP_NAME);
    
    // Load configuration
    loadDeviceGroups();
}

ModernDeviceGroupManager::~ModernDeviceGroupManager()
{
    saveDeviceGroups();
}

void ModernDeviceGroupManager::setupAutoSave()
{
    m_autoSaveTimer->setInterval(AUTO_SAVE_INTERVAL_MS);
    m_autoSaveTimer->setSingleShot(false);
    connect(m_autoSaveTimer, &QTimer::timeout, this, &ModernDeviceGroupManager::onAutoSaveTimer);
    m_autoSaveTimer->start();
}

QStringList ModernDeviceGroupManager::deviceGroups() const
{
    if (m_cachedGroupNames.isEmpty()) {
        m_cachedGroupNames.clear();
        for (const auto &group : m_groups) {
            m_cachedGroupNames.append(group.m_name);
        }
    }
    return m_cachedGroupNames;
}

int ModernDeviceGroupManager::selectedGroupCount() const
{
    if (m_cachedSelectedCount == 0) {
        m_cachedSelectedCount = 0;
        for (const auto &group : m_groups) {
            if (group.m_isSelected) {
                m_cachedSelectedCount++;
            }
        }
    }
    return m_cachedSelectedCount;
}

int ModernDeviceGroupManager::totalDeviceCount() const
{
    if (m_cachedTotalCount == 0) {
        m_cachedTotalCount = 0;
        for (const auto &group : m_groups) {
            m_cachedTotalCount += group.getDeviceCount();
        }
    }
    return m_cachedTotalCount;
}

int ModernDeviceGroupManager::connectedDeviceCount() const
{
    if (m_cachedConnectedCount == 0) {
        m_cachedConnectedCount = 0;
        for (const auto &group : m_groups) {
            m_cachedConnectedCount += group.getConnectedCount();
        }
    }
    return m_cachedConnectedCount;
}

int ModernDeviceGroupManager::selectedDeviceCount() const
{
    int count = 0;
    for (const auto &group : m_groups) {
        for (const auto &device : group.m_devices) {
            if (device.m_isSelected) {
                count++;
            }
        }
    }
    return count;
}

QString ModernDeviceGroupManager::configPath() const
{
    return m_configPath;
}

void ModernDeviceGroupManager::setConfigPath(const QString &path)
{
    if (m_configPath != path) {
        m_configPath = path;
        emit configPathChanged();
    }
}

void ModernDeviceGroupManager::addDeviceGroup(const QString &groupName)
{
    if (hasDeviceGroup(groupName)) {
        return;
    }

    // Auto-assign color based on group index
    QColor color = getNextGroupColor(m_groups.size());
    DeviceGroup group(groupName, color);
    m_groups.append(group);

    // Clear cache
    m_cachedGroupNames.clear();
    m_cachedSelectedCount = 0;
    m_cachedTotalCount = 0;
    m_cachedConnectedCount = 0;

    emit deviceGroupAdded(groupName);
    emit deviceGroupsChanged();
    emit selectedGroupCountChanged();
    emit totalDeviceCountChanged();
    emit connectedDeviceCountChanged();
}

void ModernDeviceGroupManager::addDeviceGroup(const QString &groupName, const QColor &color)
{
    if (hasDeviceGroup(groupName)) {
        return;
    }

    DeviceGroup group(groupName, color);
    m_groups.append(group);

    // Clear cache
    m_cachedGroupNames.clear();
    m_cachedSelectedCount = 0;
    m_cachedTotalCount = 0;
    m_cachedConnectedCount = 0;

    emit deviceGroupAdded(groupName);
    emit deviceGroupsChanged();
    emit selectedGroupCountChanged();
    emit totalDeviceCountChanged();
    emit connectedDeviceCountChanged();
}

void ModernDeviceGroupManager::removeDeviceGroup(const QString &groupName)
{
    if (groupName == DEFAULT_GROUP_NAME) {
        return; // Cannot delete default group
    }
    
    for (auto it = m_groups.begin(); it != m_groups.end(); ++it) {
        if (it->m_name == groupName) {
            // Move devices to default group
            for (const auto &device : it->m_devices) {
                moveDevice(device.m_serial, DEFAULT_GROUP_NAME);
            }
            
            m_groups.erase(it);
            
            // Clear cache
            m_cachedGroupNames.clear();
            m_cachedSelectedCount = 0;
            m_cachedTotalCount = 0;
            m_cachedConnectedCount = 0;
            
            emit deviceGroupRemoved(groupName);
            emit deviceGroupsChanged();
            emit selectedGroupCountChanged();
            emit totalDeviceCountChanged();
            emit connectedDeviceCountChanged();
            return;
        }
    }
}

void ModernDeviceGroupManager::renameDeviceGroup(const QString &oldName, const QString &newName)
{
    if (oldName == DEFAULT_GROUP_NAME || hasDeviceGroup(newName)) {
        return;
    }
    
    for (auto &group : m_groups) {
        if (group.m_name == oldName) {
            group.m_name = newName;
            
            // Update device group names
            for (auto &device : group.m_devices) {
                device.m_groupName = newName;
            }
            
            // Clear cache
            m_cachedGroupNames.clear();
            
            emit deviceGroupRenamed(oldName, newName);
            emit deviceGroupsChanged();
            return;
        }
    }
}

bool ModernDeviceGroupManager::hasDeviceGroup(const QString &groupName) const
{
    for (const auto &group : m_groups) {
        if (group.m_name == groupName) {
            return true;
        }
    }
    return false;
}

void ModernDeviceGroupManager::setGroupColor(const QString &groupName, const QColor &color)
{
    for (auto &group : m_groups) {
        if (group.m_name == groupName) {
            group.m_color = color;
            emit deviceGroupsChanged();
            return;
        }
    }
}

QColor ModernDeviceGroupManager::getGroupColor(const QString &groupName) const
{
    for (const auto &group : m_groups) {
        if (group.m_name == groupName) {
            return group.m_color;
        }
    }
    return QColor(100, 149, 237); // Default color
}

QColor ModernDeviceGroupManager::getNextGroupColor(int index)
{
    if (GROUP_COLORS.isEmpty()) {
        return QColor(100, 149, 237);
    }
    return GROUP_COLORS[index % GROUP_COLORS.size()];
}

void ModernDeviceGroupManager::addDevice(const QString &serial, const QString &name, const QString &groupName)
{
    QString targetGroup = groupName.isEmpty() ? DEFAULT_GROUP_NAME : groupName;
    
    // Ensure group exists
    if (!hasDeviceGroup(targetGroup)) {
        addDeviceGroup(targetGroup);
    }
    
    DeviceInfo device(serial, name, targetGroup);
    
    for (auto &group : m_groups) {
        if (group.m_name == targetGroup) {
            group.addDevice(device);
            
            // Clear cache
            m_cachedTotalCount = 0;
            m_cachedConnectedCount = 0;
            
            emit deviceAdded(serial, targetGroup);
            emit totalDeviceCountChanged();
            emit connectedDeviceCountChanged();
            return;
        }
    }
}

void ModernDeviceGroupManager::removeDevice(const QString &serial)
{
    for (auto &group : m_groups) {
        for (auto it = group.m_devices.begin(); it != group.m_devices.end(); ++it) {
            if (it->m_serial == serial) {
                group.m_devices.erase(it);
                
                // Clear cache
                m_cachedTotalCount = 0;
                m_cachedConnectedCount = 0;
                
                emit deviceRemoved(serial);
                emit totalDeviceCountChanged();
                emit connectedDeviceCountChanged();
                return;
            }
        }
    }
}

void ModernDeviceGroupManager::moveDevice(const QString &serial, const QString &targetGroup)
{
    if (!hasDeviceGroup(targetGroup)) {
        addDeviceGroup(targetGroup);
    }
    
    DeviceInfo deviceToMove;
    QString fromGroup;
    
    // Find device
    for (auto &group : m_groups) {
        for (auto it = group.m_devices.begin(); it != group.m_devices.end(); ++it) {
            if (it->m_serial == serial) {
                deviceToMove = *it;
                fromGroup = group.m_name;
                group.m_devices.erase(it);
                
                // Clear cache
                m_cachedTotalCount = 0;
                m_cachedConnectedCount = 0;
                
                emit deviceMoved(serial, fromGroup, targetGroup);
                emit totalDeviceCountChanged();
                emit connectedDeviceCountChanged();
                break;
            }
        }
        if (!fromGroup.isEmpty()) {
            break;
        }
    }
    
    // Add to target group
    if (!fromGroup.isEmpty()) {
        deviceToMove.m_groupName = targetGroup;
        for (auto &group : m_groups) {
            if (group.m_name == targetGroup) {
                group.addDevice(deviceToMove);
                break;
            }
        }
    }
}

void ModernDeviceGroupManager::updateDeviceStatus(const QString &serial, DeviceStatus status)
{
    for (auto &group : m_groups) {
        for (auto &device : group.m_devices) {
            if (device.m_serial == serial) {
                DeviceStatus oldStatus = device.m_status;
                device.m_status = status;
                device.m_statusColor = device.getStatusColor();
                
                // Clear cache
                m_cachedConnectedCount = 0;
                
                emit deviceStatusChanged(serial, status);
                emit connectedDeviceCountChanged();
                return;
            }
        }
    }
}

void ModernDeviceGroupManager::updateDeviceName(const QString &serial, const QString &name)
{
    for (auto &group : m_groups) {
        for (auto &device : group.m_devices) {
            if (device.m_serial == serial) {
                device.m_name = name;
                emit deviceNameChanged(serial, name);
                return;
            }
        }
    }
}

void ModernDeviceGroupManager::setDeviceSelected(const QString &serial, bool selected)
{
    for (auto &group : m_groups) {
        for (auto &device : group.m_devices) {
            if (device.m_serial == serial) {
                device.m_isSelected = selected;
                
                // Clear cache
                m_cachedSelectedCount = 0;
                
                emit deviceSelectionChanged(serial, selected);
                emit selectedGroupCountChanged();
                return;
            }
        }
    }
}

DeviceInfo* ModernDeviceGroupManager::getDevice(const QString &serial)
{
    for (auto &group : m_groups) {
        DeviceInfo* device = group.getDevice(serial);
        if (device) {
            return device;
        }
    }
    return nullptr;
}

DeviceGroup* ModernDeviceGroupManager::getDeviceGroup(const QString &groupName)
{
    for (auto &group : m_groups) {
        if (group.m_name == groupName) {
            return &group;
        }
    }
    return nullptr;
}

QList<DeviceInfo> ModernDeviceGroupManager::getDevicesInGroup(const QString &groupName) const
{
    for (const auto &group : m_groups) {
        if (group.m_name == groupName) {
            return group.m_devices;
        }
    }
    return QList<DeviceInfo>();
}

QList<DeviceInfo> ModernDeviceGroupManager::getSelectedDevices() const
{
    QList<DeviceInfo> selectedDevices;
    for (const auto &group : m_groups) {
        for (const auto &device : group.m_devices) {
            if (device.m_isSelected) {
                selectedDevices.append(device);
            }
        }
    }
    return selectedDevices;
}

QList<DeviceInfo> ModernDeviceGroupManager::getConnectedDevices() const
{
    QList<DeviceInfo> connectedDevices;
    for (const auto &group : m_groups) {
        for (const auto &device : group.m_devices) {
            if (device.m_status == DeviceStatus::Connected) {
                connectedDevices.append(device);
            }
        }
    }
    return connectedDevices;
}

void ModernDeviceGroupManager::loadDeviceGroups()
{
    loadDeviceGroups(m_configPath);
}

void ModernDeviceGroupManager::saveDeviceGroups()
{
    saveDeviceGroups(m_configPath);
}

void ModernDeviceGroupManager::loadDeviceGroups(const QString &configPath)
{
    QFile file(configPath);
    if (!file.open(QIODevice::ReadOnly)) {
        qDebug() << "Cannot open config file:" << configPath;
        return;
    }
    
    QJsonDocument doc = QJsonDocument::fromJson(file.readAll());
    file.close();
    
    if (doc.isNull() || !doc.isObject()) {
        qDebug() << "Config file format error:" << configPath;
        return;
    }
    
    fromJson(doc.object());
    
    // Clear cache
    m_cachedGroupNames.clear();
    m_cachedSelectedCount = 0;
    m_cachedTotalCount = 0;
    m_cachedConnectedCount = 0;
    
    emit deviceGroupsChanged();
    emit selectedGroupCountChanged();
    emit totalDeviceCountChanged();
    emit connectedDeviceCountChanged();
}

void ModernDeviceGroupManager::saveDeviceGroups(const QString &configPath)
{
    QFile file(configPath);
    if (!file.open(QIODevice::WriteOnly)) {
        qDebug() << "Cannot save config file:" << configPath;
        return;
    }
    
    QJsonDocument doc(toJson());
    file.write(doc.toJson());
    file.close();
}

void ModernDeviceGroupManager::selectAllDevices()
{
    for (auto &group : m_groups) {
        for (auto &device : group.m_devices) {
            device.m_isSelected = true;
        }
    }
    
    // Clear cache
    m_cachedSelectedCount = 0;
    
    emit allDevicesSelected();
    emit selectedGroupCountChanged();
}

void ModernDeviceGroupManager::deselectAllDevices()
{
    for (auto &group : m_groups) {
        for (auto &device : group.m_devices) {
            device.m_isSelected = false;
        }
    }
    
    // Clear cache
    m_cachedSelectedCount = 0;
    
    emit allDevicesDeselected();
    emit selectedGroupCountChanged();
}

void ModernDeviceGroupManager::selectGroupDevices(const QString &groupName)
{
    for (auto &group : m_groups) {
        if (group.m_name == groupName) {
            for (auto &device : group.m_devices) {
                device.m_isSelected = true;
            }
            
            // Clear cache
            m_cachedSelectedCount = 0;
            
            emit groupDevicesSelected(groupName);
            emit selectedGroupCountChanged();
            return;
        }
    }
}

void ModernDeviceGroupManager::deselectGroupDevices(const QString &groupName)
{
    for (auto &group : m_groups) {
        if (group.m_name == groupName) {
            for (auto &device : group.m_devices) {
                device.m_isSelected = false;
            }
            
            // Clear cache
            m_cachedSelectedCount = 0;
            
            emit groupDevicesDeselected(groupName);
            emit selectedGroupCountChanged();
            return;
        }
    }
}

bool ModernDeviceGroupManager::isDeviceSelected(const QString &serial) const
{
    for (const auto &group : m_groups) {
        for (const auto &device : group.m_devices) {
            if (device.m_serial == serial) {
                return device.m_isSelected;
            }
        }
    }
    return false;
}

bool ModernDeviceGroupManager::isDeviceConnected(const QString &serial) const
{
    for (const auto &group : m_groups) {
        for (const auto &device : group.m_devices) {
            if (device.m_serial == serial) {
                return device.m_status == DeviceStatus::Connected;
            }
        }
    }
    return false;
}

DeviceStatus ModernDeviceGroupManager::getDeviceStatus(const QString &serial) const
{
    for (const auto &group : m_groups) {
        for (const auto &device : group.m_devices) {
            if (device.m_serial == serial) {
                return device.m_status;
            }
        }
    }
    return DeviceStatus::Disconnected;
}

void ModernDeviceGroupManager::onAutoSaveTimer()
{
    saveDeviceGroups();
}

void ModernDeviceGroupManager::updateCounts()
{
    // Clear cache, force recalculation
    m_cachedGroupNames.clear();
    m_cachedSelectedCount = 0;
    m_cachedTotalCount = 0;
    m_cachedConnectedCount = 0;
    
    emit deviceGroupsChanged();
    emit selectedGroupCountChanged();
    emit totalDeviceCountChanged();
    emit connectedDeviceCountChanged();
}

QJsonObject ModernDeviceGroupManager::toJson() const
{
    QJsonObject obj;
    obj["version"] = "1.0";
    obj["configPath"] = m_configPath;
    
    QJsonArray groupsArray;
    for (const auto &group : m_groups) {
        groupsArray.append(group.toJson());
    }
    obj["groups"] = groupsArray;
    
    return obj;
}

void ModernDeviceGroupManager::fromJson(const QJsonObject &json)
{
    m_groups.clear();
    
    QJsonArray groupsArray = json["groups"].toArray();
    for (const auto &value : groupsArray) {
        if (value.isObject()) {
            DeviceGroup group = DeviceGroup::fromJson(value.toObject());
            m_groups.append(group);
        }
    }
    
    // Ensure default group exists
    if (!hasDeviceGroup(DEFAULT_GROUP_NAME)) {
        addDeviceGroup(DEFAULT_GROUP_NAME);
    }
}
