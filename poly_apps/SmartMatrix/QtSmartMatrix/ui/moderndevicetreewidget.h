#ifndef MODERNDEVICETREEWIDGET_H
#define MODERNDEVICETREEWIDGET_H

#include <QTreeWidget>
#include <QTreeWidgetItem>
#include <QMenu>
#include <QAction>
#include <QDragEnterEvent>
#include <QDropEvent>
#include <QContextMenuEvent>
#include <QProperty>
#include <QTimer>
#include "moderndevicegroupmanager.h"

/**
 * @brief Modern device tree widget
 * 
 * A custom tree widget for managing device groups and devices
 * Based on Qt6.9's modern features with drag-and-drop support
 */
class ModernDeviceTreeWidget : public QTreeWidget
{
    Q_OBJECT

public:
    explicit ModernDeviceTreeWidget(QWidget *parent = nullptr);
    ~ModernDeviceTreeWidget();

    // Using Qt6.9's QProperty system
    Q_PROPERTY(bool dragDropEnabled READ dragDropEnabled WRITE setDragDropEnabled NOTIFY dragDropEnabledChanged)
    Q_PROPERTY(bool contextMenuEnabled READ contextMenuEnabled WRITE setContextMenuEnabled NOTIFY contextMenuEnabledChanged)
    Q_PROPERTY(QString selectedGroupName READ selectedGroupName NOTIFY selectedGroupNameChanged)
    Q_PROPERTY(QStringList selectedDeviceSerials READ selectedDeviceSerials NOTIFY selectedDeviceSerialsChanged)

    // Device group management
    void setDeviceGroupManager(ModernDeviceGroupManager *manager);
    ModernDeviceGroupManager* deviceGroupManager() const { return m_deviceGroupManager; }
    
    // Tree operations
    void refreshTree();
    void expandAllGroups();
    void collapseAllGroups();
    void selectGroup(const QString &groupName);
    void selectDevice(const QString &serial);
    void clearSelection();

    // Drag and drop
    bool dragDropEnabled() const { return m_dragDropEnabled; }
    void setDragDropEnabled(bool enabled);
    bool contextMenuEnabled() const { return m_contextMenuEnabled; }
    void setContextMenuEnabled(bool enabled);

    // Selection
    QString selectedGroupName() const;
    QStringList selectedDeviceSerials() const;
    QList<DeviceInfo> selectedDevices() const;

    // UI customization
    void setShowDeviceCount(bool show);
    void setShowConnectionStatus(bool show);
    void setGroupIcon(const QIcon &icon);
    void setDeviceIcon(const QIcon &icon);
    void setConnectedDeviceIcon(const QIcon &icon);
    void setDisconnectedDeviceIcon(const QIcon &icon);
    
    // Public methods to trigger context menu actions
    void triggerCreateGroup();
    void triggerDeleteGroup();
    void triggerRenameGroup();

protected:
    // Override drag and drop events
    void dragEnterEvent(QDragEnterEvent *event) override;
    void dragMoveEvent(QDragMoveEvent *event) override;
    void dropEvent(QDropEvent *event) override;
    
    // Override context menu event
    void contextMenuEvent(QContextMenuEvent *event) override;
    
    // Override selection events
    void selectionChanged(const QItemSelection &selected, const QItemSelection &deselected) override;

signals:
    void dragDropEnabledChanged();
    void contextMenuEnabledChanged();
    void selectedGroupNameChanged();
    void selectedDeviceSerialsChanged();
    
    // Device group signals
    void deviceGroupSelected(const QString &groupName);
    void deviceGroupDoubleClicked(const QString &groupName);
    void deviceGroupRightClicked(const QString &groupName, const QPoint &globalPos);
    
    // Device signals
    void deviceSelected(const QString &serial);
    void deviceDoubleClicked(const QString &serial);
    void deviceRightClicked(const QString &serial, const QPoint &globalPos);
    
    // Drag and drop signals
    void deviceMoved(const QString &serial, const QString &fromGroup, const QString &toGroup);
    void deviceGroupCreated(const QString &groupName);
    void deviceGroupDeleted(const QString &groupName);
    void deviceGroupRenamed(const QString &oldName, const QString &newName);

private slots:
    void onDeviceGroupAdded(const QString &groupName);
    void onDeviceGroupRemoved(const QString &groupName);
    void onDeviceGroupRenamed(const QString &oldName, const QString &newName);
    void onDeviceAdded(const QString &serial, const QString &groupName);
    void onDeviceRemoved(const QString &serial);
    void onDeviceMoved(const QString &serial, const QString &fromGroup, const QString &toGroup);
    void onDeviceStatusChanged(const QString &serial, DeviceStatus status);
    void onDeviceNameChanged(const QString &serial, const QString &name);
    void onDeviceSelectionChanged(const QString &serial, bool selected);
    
    // Context menu actions
    void onCreateGroup();
    void onDeleteGroup();
    void onRenameGroup();
    void onDeleteDevice();
    void onMoveDeviceToGroup();
    void onRefreshDevice();

private:
    void setupUI();
    void setupConnections();
    void setupContextMenu();
    void setupDragDrop();
    
    // Tree item management
    QTreeWidgetItem* createGroupItem(const QString &groupName);
    QTreeWidgetItem* createDeviceItem(const DeviceInfo &device);
    QTreeWidgetItem* findGroupItem(const QString &groupName) const;
    QTreeWidgetItem* findDeviceItem(const QString &serial) const;
    void updateGroupItem(QTreeWidgetItem *item, const QString &groupName);
    void updateDeviceItem(QTreeWidgetItem *item, const DeviceInfo &device);
    void removeGroupItem(const QString &groupName);
    void removeDeviceItem(const QString &serial);
    
    // Drag and drop helpers
    bool canDropOnItem(QTreeWidgetItem *item, const QMimeData *mimeData) const;
    QString getDropTargetGroup(QTreeWidgetItem *item) const;
    void performDeviceMove(const QString &serial, const QString &targetGroup);
    
    // Context menu helpers
    void showGroupContextMenu(const QString &groupName, const QPoint &globalPos);
    void showDeviceContextMenu(const QString &serial, const QPoint &globalPos);
    void showEmptyContextMenu(const QPoint &globalPos);
    
    // UI helpers
    void updateItemAppearance(QTreeWidgetItem *item);
    void updateGroupItemAppearance(QTreeWidgetItem *item);
    void updateDeviceItemAppearance(QTreeWidgetItem *item);
    QString formatGroupText(const QString &groupName, int deviceCount, int connectedCount) const;
    QString formatDeviceText(const DeviceInfo &device) const;
    QIcon getDeviceIcon(const DeviceInfo &device) const;
    
    // Data members
    ModernDeviceGroupManager *m_deviceGroupManager;
    QMenu *m_contextMenu;
    QAction *m_createGroupAction;
    QAction *m_deleteGroupAction;
    QAction *m_renameGroupAction;
    QAction *m_deleteDeviceAction;
    QAction *m_moveDeviceAction;
    QAction *m_refreshDeviceAction;
    
    // UI settings
    bool m_dragDropEnabled = true;
    bool m_contextMenuEnabled = true;
    bool m_showDeviceCount = true;
    bool m_showConnectionStatus = true;
    
    // Icons
    QIcon m_groupIcon;
    QIcon m_deviceIcon;
    QIcon m_connectedDeviceIcon;
    QIcon m_disconnectedDeviceIcon;
    
    // Drag and drop state
    QString m_dragSourceGroup;
    QString m_dragSourceDevice;
    
    // Constants
    static const int GROUP_ITEM_TYPE = QTreeWidgetItem::UserType + 1;
    static const int DEVICE_ITEM_TYPE = QTreeWidgetItem::UserType + 2;
    static const QString DRAG_DROP_MIME_TYPE;
};

#endif // MODERNDEVICETREEWIDGET_H
