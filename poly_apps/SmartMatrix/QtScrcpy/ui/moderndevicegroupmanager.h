#ifndef MODERNDEVICEGROUPMANAGER_H
#define MODERNDEVICEGROUPMANAGER_H

#include <QObject>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QStringList>
#include <QList>
#include <QColor>
#include <QTimer>
#include <QProperty>

/**
 * @brief Device status enumeration
 */
enum class DeviceStatus {
    Disconnected = 0,
    Connecting = 1,
    Connected = 2,
    Error = 3
};

Q_DECLARE_METATYPE(DeviceStatus)

/**
 * @brief Device information structure
 */
class DeviceInfo
{
    Q_GADGET
    
public:
    Q_PROPERTY(QString serial MEMBER m_serial)
    Q_PROPERTY(QString name MEMBER m_name)
    Q_PROPERTY(DeviceStatus status MEMBER m_status)
    Q_PROPERTY(QColor statusColor MEMBER m_statusColor)
    Q_PROPERTY(bool isSelected MEMBER m_isSelected)
    Q_PROPERTY(QString groupName MEMBER m_groupName)
    
    QString m_serial;
    QString m_name;
    DeviceStatus m_status = DeviceStatus::Disconnected;
    QColor m_statusColor = QColor(Qt::gray);
    bool m_isSelected = false;
    QString m_groupName;
    
    DeviceInfo() = default;
    DeviceInfo(const QString &serial, const QString &name, const QString &groupName = "Unassigned Devices")
        : m_serial(serial), m_name(name), m_groupName(groupName) {}
    
    // Equality operator for QProperty system
    bool operator==(const DeviceInfo &other) const {
        return m_serial == other.m_serial && m_name == other.m_name && 
               m_status == other.m_status && m_groupName == other.m_groupName;
    }
    
    // Convert to JSON
    QJsonObject toJson() const;
    static DeviceInfo fromJson(const QJsonObject &json);
    
    // Get status color
    QColor getStatusColor() const;
    
    // Get status text
    QString getStatusText() const;
};

Q_DECLARE_METATYPE(DeviceInfo)

/**
 * @brief Device group structure
 */
class DeviceGroup
{
    Q_GADGET
    
public:
    Q_PROPERTY(QString name MEMBER m_name)
    Q_PROPERTY(QList<DeviceInfo> devices MEMBER m_devices)
    Q_PROPERTY(bool isSelected MEMBER m_isSelected)
    Q_PROPERTY(bool isExpanded MEMBER m_isExpanded)
    Q_PROPERTY(int deviceCount READ getDeviceCount)
    Q_PROPERTY(int connectedCount READ getConnectedCount)
    
    QString m_name;
    QList<DeviceInfo> m_devices;
    bool m_isSelected = false;
    bool m_isExpanded = true;
    
    DeviceGroup() = default;
    DeviceGroup(const QString &name) : m_name(name) {}
    
    // Get device count
    int getDeviceCount() const { return m_devices.size(); }
    
    // Get connected device count
    int getConnectedCount() const {
        int count = 0;
        for (const auto &device : m_devices) {
            if (device.m_status == DeviceStatus::Connected) {
                count++;
            }
        }
        return count;
    }
    
    // Add device
    void addDevice(const DeviceInfo &device);
    
    // Remove device
    void removeDevice(const QString &serial);
    
    // Update device status
    void updateDeviceStatus(const QString &serial, DeviceStatus status);
    
    // Get device
    DeviceInfo* getDevice(const QString &serial);
    
    // Convert to JSON
    QJsonObject toJson() const;
    static DeviceGroup fromJson(const QJsonObject &json);
};

Q_DECLARE_METATYPE(DeviceGroup)

/**
 * @brief Modern device group manager
 * 
 * Based on Qt6.9's QProperty system, provides high-performance device group management functionality
 */
class ModernDeviceGroupManager : public QObject
{
    Q_OBJECT

public:
    explicit ModernDeviceGroupManager(QObject *parent = nullptr);
    ~ModernDeviceGroupManager();

    // Using Qt6.9's QProperty system
    Q_PROPERTY(QStringList deviceGroups READ deviceGroups NOTIFY deviceGroupsChanged)
    Q_PROPERTY(int selectedGroupCount READ selectedGroupCount NOTIFY selectedGroupCountChanged)
    Q_PROPERTY(int totalDeviceCount READ totalDeviceCount NOTIFY totalDeviceCountChanged)
    Q_PROPERTY(int connectedDeviceCount READ connectedDeviceCount NOTIFY connectedDeviceCountChanged)
    Q_PROPERTY(QString configPath READ configPath WRITE setConfigPath NOTIFY configPathChanged)

    // Device group management
    QStringList deviceGroups() const;
    int selectedGroupCount() const;
    int totalDeviceCount() const;
    int connectedDeviceCount() const;
    QString configPath() const;
    void setConfigPath(const QString &path);

    // Device group operations
    void addDeviceGroup(const QString &groupName);
    void removeDeviceGroup(const QString &groupName);
    void renameDeviceGroup(const QString &oldName, const QString &newName);
    bool hasDeviceGroup(const QString &groupName) const;

    // Device operations
    void addDevice(const QString &serial, const QString &name, const QString &groupName = "Unassigned Devices");
    void removeDevice(const QString &serial);
    void moveDevice(const QString &serial, const QString &targetGroup);
    void updateDeviceStatus(const QString &serial, DeviceStatus status);
    void updateDeviceName(const QString &serial, const QString &name);
    void setDeviceSelected(const QString &serial, bool selected);

    // Get device information
    DeviceInfo* getDevice(const QString &serial);
    DeviceGroup* getDeviceGroup(const QString &groupName);
    QList<DeviceInfo> getDevicesInGroup(const QString &groupName) const;
    QList<DeviceInfo> getSelectedDevices() const;
    QList<DeviceInfo> getConnectedDevices() const;

    // Configuration management
    void loadDeviceGroups();
    void saveDeviceGroups();
    void loadDeviceGroups(const QString &configPath);
    void saveDeviceGroups(const QString &configPath);

    // Batch operations
    void selectAllDevices();
    void deselectAllDevices();
    void selectGroupDevices(const QString &groupName);
    void deselectGroupDevices(const QString &groupName);

    // Status queries
    bool isDeviceSelected(const QString &serial) const;
    bool isDeviceConnected(const QString &serial) const;
    DeviceStatus getDeviceStatus(const QString &serial) const;

signals:
    void deviceGroupsChanged();
    void selectedGroupCountChanged();
    void totalDeviceCountChanged();
    void connectedDeviceCountChanged();
    void configPathChanged();
    
    // Device group signals
    void deviceGroupAdded(const QString &groupName);
    void deviceGroupRemoved(const QString &groupName);
    void deviceGroupRenamed(const QString &oldName, const QString &newName);
    
    // Device signals
    void deviceAdded(const QString &serial, const QString &groupName);
    void deviceRemoved(const QString &serial);
    void deviceMoved(const QString &serial, const QString &fromGroup, const QString &toGroup);
    void deviceStatusChanged(const QString &serial, DeviceStatus status);
    void deviceNameChanged(const QString &serial, const QString &name);
    void deviceSelectionChanged(const QString &serial, bool selected);
    
    // Batch operation signals
    void allDevicesSelected();
    void allDevicesDeselected();
    void groupDevicesSelected(const QString &groupName);
    void groupDevicesDeselected(const QString &groupName);

private slots:
    void onAutoSaveTimer();

private:
    void setupAutoSave();
    void updateCounts();
    QJsonObject toJson() const;
    void fromJson(const QJsonObject &json);
    
    // Data members
    QList<DeviceGroup> m_groups;
    QString m_configPath;
    QTimer *m_autoSaveTimer;
    
    // Cache
    mutable QStringList m_cachedGroupNames;
    mutable int m_cachedSelectedCount = 0;
    mutable int m_cachedTotalCount = 0;
    mutable int m_cachedConnectedCount = 0;
    
    // Constants
    static const int AUTO_SAVE_INTERVAL_MS = 5000; // 5 seconds auto save
    static const QString DEFAULT_GROUP_NAME;
    static const QString DEFAULT_CONFIG_FILE;
};

#endif // MODERNDEVICEGROUPMANAGER_H
