#include "moderndevicetreewidget.h"
#include <QHeaderView>
#include <QInputDialog>
#include <QMessageBox>
#include <QMimeData>
#include <QApplication>
#include <QDrag>
#include <QPainter>
#include <QDebug>

// Static constants
const QString ModernDeviceTreeWidget::DRAG_DROP_MIME_TYPE = "application/x-device-item";

ModernDeviceTreeWidget::ModernDeviceTreeWidget(QWidget *parent)
    : QTreeWidget(parent)
    , m_deviceGroupManager(nullptr)
    , m_contextMenu(new QMenu(this))
    , m_createGroupAction(nullptr)
    , m_deleteGroupAction(nullptr)
    , m_renameGroupAction(nullptr)
    , m_deleteDeviceAction(nullptr)
    , m_moveDeviceAction(nullptr)
    , m_refreshDeviceAction(nullptr)
{
    setupUI();
    setupConnections();
    setupContextMenu();
    setupDragDrop();
}

ModernDeviceTreeWidget::~ModernDeviceTreeWidget()
{
    // Cleanup is handled by Qt's parent-child relationship
}

void ModernDeviceTreeWidget::setupUI()
{
    // Set tree widget properties
    setHeaderHidden(true);
    setRootIsDecorated(true);
    setAlternatingRowColors(true);
    setSelectionMode(QAbstractItemView::ExtendedSelection);
    setDragDropMode(QAbstractItemView::DragDrop);
    setDefaultDropAction(Qt::MoveAction);
    setExpandsOnDoubleClick(true);
    setAnimated(true);
    
    // Set icons
    m_groupIcon = QIcon(":/icons/group.png");
    m_deviceIcon = QIcon(":/icons/device.png");
    m_connectedDeviceIcon = QIcon(":/icons/device_connected.png");
    m_disconnectedDeviceIcon = QIcon(":/icons/device_disconnected.png");
    
    // Set default icons if custom icons are not available
    if (m_groupIcon.isNull()) {
        m_groupIcon = style()->standardIcon(QStyle::SP_DirIcon);
    }
    if (m_deviceIcon.isNull()) {
        m_deviceIcon = style()->standardIcon(QStyle::SP_ComputerIcon);
    }
    if (m_connectedDeviceIcon.isNull()) {
        m_connectedDeviceIcon = style()->standardIcon(QStyle::SP_DialogApplyButton);
    }
    if (m_disconnectedDeviceIcon.isNull()) {
        m_disconnectedDeviceIcon = style()->standardIcon(QStyle::SP_DialogCancelButton);
    }
}

void ModernDeviceTreeWidget::setupConnections()
{
    // Connect selection changes
    connect(this, &QTreeWidget::itemSelectionChanged, this, [this]() {
        emit selectedGroupNameChanged();
        emit selectedDeviceSerialsChanged();
    });
    
    // Connect double click
    connect(this, &QTreeWidget::itemDoubleClicked, this, [this](QTreeWidgetItem *item, int column) {
        Q_UNUSED(column)
        
        if (!item) return;
        
        if (item->type() == GROUP_ITEM_TYPE) {
            QString groupName = item->data(0, Qt::UserRole).toString();
            emit deviceGroupDoubleClicked(groupName);
        } else if (item->type() == DEVICE_ITEM_TYPE) {
            QString serial = item->data(0, Qt::UserRole).toString();
            emit deviceDoubleClicked(serial);
        }
    });
}

void ModernDeviceTreeWidget::setupContextMenu()
{
    // Create context menu actions
    m_createGroupAction = new QAction("Create Group", this);
    m_deleteGroupAction = new QAction("Delete Group", this);
    m_renameGroupAction = new QAction("Rename Group", this);
    m_deleteDeviceAction = new QAction("Delete Device", this);
    m_moveDeviceAction = new QAction("Move Device", this);
    m_refreshDeviceAction = new QAction("Refresh Device", this);
    
    // Connect actions
    connect(m_createGroupAction, &QAction::triggered, this, &ModernDeviceTreeWidget::onCreateGroup);
    connect(m_deleteGroupAction, &QAction::triggered, this, &ModernDeviceTreeWidget::onDeleteGroup);
    connect(m_renameGroupAction, &QAction::triggered, this, &ModernDeviceTreeWidget::onRenameGroup);
    connect(m_deleteDeviceAction, &QAction::triggered, this, &ModernDeviceTreeWidget::onDeleteDevice);
    connect(m_moveDeviceAction, &QAction::triggered, this, &ModernDeviceTreeWidget::onMoveDeviceToGroup);
    connect(m_refreshDeviceAction, &QAction::triggered, this, &ModernDeviceTreeWidget::onRefreshDevice);
    
    // Add actions to context menu
    m_contextMenu->addAction(m_createGroupAction);
    m_contextMenu->addSeparator();
    m_contextMenu->addAction(m_deleteGroupAction);
    m_contextMenu->addAction(m_renameGroupAction);
    m_contextMenu->addSeparator();
    m_contextMenu->addAction(m_deleteDeviceAction);
    m_contextMenu->addAction(m_moveDeviceAction);
    m_contextMenu->addAction(m_refreshDeviceAction);
}

void ModernDeviceTreeWidget::setupDragDrop()
{
    setAcceptDrops(true);
    setDragEnabled(true);
}

void ModernDeviceTreeWidget::setDeviceGroupManager(ModernDeviceGroupManager *manager)
{
    if (m_deviceGroupManager == manager) {
        return;
    }
    
    // Disconnect from old manager
    if (m_deviceGroupManager) {
        disconnect(m_deviceGroupManager, nullptr, this, nullptr);
    }
    
    m_deviceGroupManager = manager;
    
    // Connect to new manager
    if (m_deviceGroupManager) {
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceGroupAdded,
                this, &ModernDeviceTreeWidget::onDeviceGroupAdded);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceGroupRemoved,
                this, &ModernDeviceTreeWidget::onDeviceGroupRemoved);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceGroupRenamed,
                this, &ModernDeviceTreeWidget::onDeviceGroupRenamed);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceAdded,
                this, &ModernDeviceTreeWidget::onDeviceAdded);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceRemoved,
                this, &ModernDeviceTreeWidget::onDeviceRemoved);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceMoved,
                this, &ModernDeviceTreeWidget::onDeviceMoved);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceStatusChanged,
                this, &ModernDeviceTreeWidget::onDeviceStatusChanged);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceNameChanged,
                this, &ModernDeviceTreeWidget::onDeviceNameChanged);
        connect(m_deviceGroupManager, &ModernDeviceGroupManager::deviceSelectionChanged,
                this, &ModernDeviceTreeWidget::onDeviceSelectionChanged);
        
        // Refresh tree with current data
        refreshTree();
    }
}

void ModernDeviceTreeWidget::refreshTree()
{
    clear();
    
    if (!m_deviceGroupManager) {
        return;
    }
    
    // Add all device groups
    QStringList groupNames = m_deviceGroupManager->deviceGroups();
    for (const QString &groupName : groupNames) {
        if (groupName == "Unassigned Devices") {
            continue; // Skip default group for now
        }
        
        QTreeWidgetItem *groupItem = createGroupItem(groupName);
        addTopLevelItem(groupItem);
        
        // Add devices in this group
        QList<DeviceInfo> devices = m_deviceGroupManager->getDevicesInGroup(groupName);
        for (const DeviceInfo &device : devices) {
            QTreeWidgetItem *deviceItem = createDeviceItem(device);
            groupItem->addChild(deviceItem);
        }
        
        updateGroupItemAppearance(groupItem);
    }
    
    // Add unassigned devices
    QList<DeviceInfo> unassignedDevices = m_deviceGroupManager->getDevicesInGroup("Unassigned Devices");
    if (!unassignedDevices.isEmpty()) {
        QTreeWidgetItem *unassignedItem = createGroupItem("Unassigned Devices");
        addTopLevelItem(unassignedItem);
        
        for (const DeviceInfo &device : unassignedDevices) {
            QTreeWidgetItem *deviceItem = createDeviceItem(device);
            unassignedItem->addChild(deviceItem);
        }
        
        updateGroupItemAppearance(unassignedItem);
    }
    
    expandAll();
}

void ModernDeviceTreeWidget::expandAllGroups()
{
    expandAll();
}

void ModernDeviceTreeWidget::collapseAllGroups()
{
    collapseAll();
}

void ModernDeviceTreeWidget::selectGroup(const QString &groupName)
{
    QTreeWidgetItem *item = findGroupItem(groupName);
    if (item) {
        setCurrentItem(item);
        scrollToItem(item);
    }
}

void ModernDeviceTreeWidget::selectDevice(const QString &serial)
{
    QTreeWidgetItem *item = findDeviceItem(serial);
    if (item) {
        setCurrentItem(item);
        scrollToItem(item);
    }
}

void ModernDeviceTreeWidget::clearSelection()
{
    QTreeWidget::clearSelection();
}

void ModernDeviceTreeWidget::setDragDropEnabled(bool enabled)
{
    if (m_dragDropEnabled != enabled) {
        m_dragDropEnabled = enabled;
        setDragEnabled(enabled);
        setAcceptDrops(enabled);
        emit dragDropEnabledChanged();
    }
}

void ModernDeviceTreeWidget::setContextMenuEnabled(bool enabled)
{
    if (m_contextMenuEnabled != enabled) {
        m_contextMenuEnabled = enabled;
        emit contextMenuEnabledChanged();
    }
}

QString ModernDeviceTreeWidget::selectedGroupName() const
{
    QList<QTreeWidgetItem*> items = this->selectedItems();
    for (QTreeWidgetItem *item : items) {
        if (item->type() == GROUP_ITEM_TYPE) {
            return item->data(0, Qt::UserRole).toString();
        }
    }
    return QString();
}

QStringList ModernDeviceTreeWidget::selectedDeviceSerials() const
{
    QStringList serials;
    QList<QTreeWidgetItem*> items = this->selectedItems();
    for (QTreeWidgetItem *item : items) {
        if (item->type() == DEVICE_ITEM_TYPE) {
            serials.append(item->data(0, Qt::UserRole).toString());
        }
    }
    return serials;
}

QList<DeviceInfo> ModernDeviceTreeWidget::selectedDevices() const
{
    QList<DeviceInfo> devices;
    QStringList serials = selectedDeviceSerials();
    
    if (m_deviceGroupManager) {
        for (const QString &serial : serials) {
            DeviceInfo *device = m_deviceGroupManager->getDevice(serial);
            if (device) {
                devices.append(*device);
            }
        }
    }
    
    return devices;
}

void ModernDeviceTreeWidget::setShowDeviceCount(bool show)
{
    if (m_showDeviceCount != show) {
        m_showDeviceCount = show;
        refreshTree();
    }
}

void ModernDeviceTreeWidget::setShowConnectionStatus(bool show)
{
    if (m_showConnectionStatus != show) {
        m_showConnectionStatus = show;
        refreshTree();
    }
}

void ModernDeviceTreeWidget::setGroupIcon(const QIcon &icon)
{
    m_groupIcon = icon;
    refreshTree();
}

void ModernDeviceTreeWidget::setDeviceIcon(const QIcon &icon)
{
    m_deviceIcon = icon;
    refreshTree();
}

void ModernDeviceTreeWidget::setConnectedDeviceIcon(const QIcon &icon)
{
    m_connectedDeviceIcon = icon;
    refreshTree();
}

void ModernDeviceTreeWidget::setDisconnectedDeviceIcon(const QIcon &icon)
{
    m_disconnectedDeviceIcon = icon;
    refreshTree();
}

void ModernDeviceTreeWidget::dragEnterEvent(QDragEnterEvent *event)
{
    if (!m_dragDropEnabled) {
        event->ignore();
        return;
    }
    
    if (event->mimeData()->hasFormat(DRAG_DROP_MIME_TYPE)) {
        event->acceptProposedAction();
    } else {
        event->ignore();
    }
}

void ModernDeviceTreeWidget::dragMoveEvent(QDragMoveEvent *event)
{
    if (!m_dragDropEnabled) {
        event->ignore();
        return;
    }
    
    QTreeWidgetItem *item = itemAt(event->position().toPoint());
    if (item && canDropOnItem(item, event->mimeData())) {
        event->acceptProposedAction();
    } else {
        event->ignore();
    }
}

void ModernDeviceTreeWidget::dropEvent(QDropEvent *event)
{
    if (!m_dragDropEnabled) {
        event->ignore();
        return;
    }
    
    QTreeWidgetItem *item = itemAt(event->position().toPoint());
    if (!item || !canDropOnItem(item, event->mimeData())) {
        event->ignore();
        return;
    }
    
    QString targetGroup = getDropTargetGroup(item);
    if (targetGroup.isEmpty()) {
        event->ignore();
        return;
    }
    
    // Get dragged device serial from mime data
    QString serial = event->mimeData()->data(DRAG_DROP_MIME_TYPE);
    if (serial.isEmpty()) {
        event->ignore();
        return;
    }
    
    // Perform the move
    performDeviceMove(serial, targetGroup);
    event->acceptProposedAction();
}

void ModernDeviceTreeWidget::contextMenuEvent(QContextMenuEvent *event)
{
    if (!m_contextMenuEnabled) {
        return;
    }
    
    QTreeWidgetItem *item = itemAt(event->pos());
    if (!item) {
        showEmptyContextMenu(event->globalPos());
        return;
    }
    
    if (item->type() == GROUP_ITEM_TYPE) {
        QString groupName = item->data(0, Qt::UserRole).toString();
        showGroupContextMenu(groupName, event->globalPos());
    } else if (item->type() == DEVICE_ITEM_TYPE) {
        QString serial = item->data(0, Qt::UserRole).toString();
        showDeviceContextMenu(serial, event->globalPos());
    }
}

void ModernDeviceTreeWidget::selectionChanged(const QItemSelection &selected, const QItemSelection &deselected)
{
    QTreeWidget::selectionChanged(selected, deselected);
    
    // Emit signals for selected items
    QList<QTreeWidgetItem*> selectedItems = this->selectedItems();
    for (QTreeWidgetItem *item : selectedItems) {
        if (item->type() == GROUP_ITEM_TYPE) {
            QString groupName = item->data(0, Qt::UserRole).toString();
            emit deviceGroupSelected(groupName);
        } else if (item->type() == DEVICE_ITEM_TYPE) {
            QString serial = item->data(0, Qt::UserRole).toString();
            emit deviceSelected(serial);
        }
    }
}

void ModernDeviceTreeWidget::onDeviceGroupAdded(const QString &groupName)
{
    QTreeWidgetItem *item = createGroupItem(groupName);
    addTopLevelItem(item);
    updateGroupItemAppearance(item);
    expandItem(item);
}

void ModernDeviceTreeWidget::onDeviceGroupRemoved(const QString &groupName)
{
    removeGroupItem(groupName);
}

void ModernDeviceTreeWidget::onDeviceGroupRenamed(const QString &oldName, const QString &newName)
{
    QTreeWidgetItem *item = findGroupItem(oldName);
    if (item) {
        updateGroupItem(item, newName);
    }
}

void ModernDeviceTreeWidget::onDeviceAdded(const QString &serial, const QString &groupName)
{
    if (!m_deviceGroupManager) {
        return;
    }
    
    DeviceInfo *device = m_deviceGroupManager->getDevice(serial);
    if (!device) {
        return;
    }
    
    QTreeWidgetItem *groupItem = findGroupItem(groupName);
    if (groupItem) {
        QTreeWidgetItem *deviceItem = createDeviceItem(*device);
        groupItem->addChild(deviceItem);
        updateGroupItemAppearance(groupItem);
    }
}

void ModernDeviceTreeWidget::onDeviceRemoved(const QString &serial)
{
    removeDeviceItem(serial);
}

void ModernDeviceTreeWidget::onDeviceMoved(const QString &serial, const QString &fromGroup, const QString &toGroup)
{
    Q_UNUSED(fromGroup)
    
    // Remove from old location
    removeDeviceItem(serial);
    
    // Add to new location
    onDeviceAdded(serial, toGroup);
}

void ModernDeviceTreeWidget::onDeviceStatusChanged(const QString &serial, DeviceStatus status)
{
    Q_UNUSED(status)
    
    QTreeWidgetItem *item = findDeviceItem(serial);
    if (item) {
        updateItemAppearance(item);
    }
}

void ModernDeviceTreeWidget::onDeviceNameChanged(const QString &serial, const QString &name)
{
    Q_UNUSED(name)
    
    QTreeWidgetItem *item = findDeviceItem(serial);
    if (item) {
        updateItemAppearance(item);
    }
}

void ModernDeviceTreeWidget::onDeviceSelectionChanged(const QString &serial, bool selected)
{
    Q_UNUSED(selected)
    
    QTreeWidgetItem *item = findDeviceItem(serial);
    if (item) {
        updateItemAppearance(item);
    }
}

void ModernDeviceTreeWidget::triggerCreateGroup()
{
    onCreateGroup();
}

void ModernDeviceTreeWidget::onCreateGroup()
{
    bool ok;
    QString groupName = QInputDialog::getText(this, "Create Group", "Group name:", 
                                              QLineEdit::Normal, "", &ok);
    if (ok && !groupName.isEmpty()) {
        if (m_deviceGroupManager) {
            m_deviceGroupManager->addDeviceGroup(groupName);
            emit deviceGroupCreated(groupName);
        }
    }
}

void ModernDeviceTreeWidget::triggerDeleteGroup()
{
    onDeleteGroup();
}

void ModernDeviceTreeWidget::onDeleteGroup()
{
    QString groupName = selectedGroupName();
    if (groupName.isEmpty() || groupName == "Unassigned Devices") {
        return;
    }
    
    int ret = QMessageBox::question(this, "Delete Group", 
                                   QString("Are you sure you want to delete group '%1'?").arg(groupName),
                                   QMessageBox::Yes | QMessageBox::No);
    if (ret == QMessageBox::Yes && m_deviceGroupManager) {
        m_deviceGroupManager->removeDeviceGroup(groupName);
        emit deviceGroupDeleted(groupName);
    }
}

void ModernDeviceTreeWidget::triggerRenameGroup()
{
    onRenameGroup();
}

void ModernDeviceTreeWidget::onRenameGroup()
{
    QString oldName = selectedGroupName();
    if (oldName.isEmpty() || oldName == "Unassigned Devices") {
        return;
    }
    
    bool ok;
    QString newName = QInputDialog::getText(this, "Rename Group", "New group name:",
                                            QLineEdit::Normal, oldName, &ok);
    if (ok && !newName.isEmpty() && newName != oldName) {
        if (m_deviceGroupManager) {
            m_deviceGroupManager->renameDeviceGroup(oldName, newName);
            emit deviceGroupRenamed(oldName, newName);
        }
    }
}

void ModernDeviceTreeWidget::onDeleteDevice()
{
    QStringList serials = selectedDeviceSerials();
    if (serials.isEmpty()) {
        return;
    }
    
    int ret = QMessageBox::question(this, "Delete Device", 
                                   QString("Are you sure you want to delete %1 device(s)?").arg(serials.size()),
                                   QMessageBox::Yes | QMessageBox::No);
    if (ret == QMessageBox::Yes && m_deviceGroupManager) {
        for (const QString &serial : serials) {
            m_deviceGroupManager->removeDevice(serial);
        }
    }
}

void ModernDeviceTreeWidget::onMoveDeviceToGroup()
{
    QStringList serials = selectedDeviceSerials();
    if (serials.isEmpty() || !m_deviceGroupManager) {
        return;
    }
    
    QStringList groupNames = m_deviceGroupManager->deviceGroups();
    if (groupNames.isEmpty()) {
        return;
    }
    
    bool ok;
    QString groupName = QInputDialog::getItem(this, "Move Device", "Select target group:", 
                                              groupNames, 0, false, &ok);
    if (ok && !groupName.isEmpty()) {
        for (const QString &serial : serials) {
            m_deviceGroupManager->moveDevice(serial, groupName);
        }
    }
}

void ModernDeviceTreeWidget::onRefreshDevice()
{
    QStringList serials = selectedDeviceSerials();
    if (serials.isEmpty()) {
        return;
    }
    
    // Emit refresh signal for each device
    for (const QString &serial : serials) {
        // This would typically trigger a device refresh operation
        qDebug() << "Refreshing device:" << serial;
    }
}

QTreeWidgetItem* ModernDeviceTreeWidget::createGroupItem(const QString &groupName)
{
    QTreeWidgetItem *item = new QTreeWidgetItem(GROUP_ITEM_TYPE);
    item->setData(0, Qt::UserRole, groupName);
    item->setIcon(0, m_groupIcon);
    item->setText(0, groupName);
    item->setFlags(Qt::ItemIsEnabled | Qt::ItemIsSelectable | Qt::ItemIsDropEnabled);
    return item;
}

QTreeWidgetItem* ModernDeviceTreeWidget::createDeviceItem(const DeviceInfo &device)
{
    QTreeWidgetItem *item = new QTreeWidgetItem(DEVICE_ITEM_TYPE);
    item->setData(0, Qt::UserRole, device.m_serial);
    item->setIcon(0, getDeviceIcon(device));
    item->setText(0, formatDeviceText(device));
    item->setFlags(Qt::ItemIsEnabled | Qt::ItemIsSelectable | Qt::ItemIsDragEnabled);
    return item;
}

QTreeWidgetItem* ModernDeviceTreeWidget::findGroupItem(const QString &groupName) const
{
    for (int i = 0; i < topLevelItemCount(); ++i) {
        QTreeWidgetItem *item = topLevelItem(i);
        if (item && item->type() == GROUP_ITEM_TYPE) {
            if (item->data(0, Qt::UserRole).toString() == groupName) {
                return item;
            }
        }
    }
    return nullptr;
}

QTreeWidgetItem* ModernDeviceTreeWidget::findDeviceItem(const QString &serial) const
{
    for (int i = 0; i < topLevelItemCount(); ++i) {
        QTreeWidgetItem *groupItem = topLevelItem(i);
        if (groupItem) {
            for (int j = 0; j < groupItem->childCount(); ++j) {
                QTreeWidgetItem *deviceItem = groupItem->child(j);
                if (deviceItem && deviceItem->type() == DEVICE_ITEM_TYPE) {
                    if (deviceItem->data(0, Qt::UserRole).toString() == serial) {
                        return deviceItem;
                    }
                }
            }
        }
    }
    return nullptr;
}

void ModernDeviceTreeWidget::updateGroupItem(QTreeWidgetItem *item, const QString &groupName)
{
    if (!item || item->type() != GROUP_ITEM_TYPE) {
        return;
    }
    
    item->setData(0, Qt::UserRole, groupName);
    item->setText(0, groupName);
    updateGroupItemAppearance(item);
}

void ModernDeviceTreeWidget::updateDeviceItem(QTreeWidgetItem *item, const DeviceInfo &device)
{
    if (!item || item->type() != DEVICE_ITEM_TYPE) {
        return;
    }
    
    item->setData(0, Qt::UserRole, device.m_serial);
    item->setIcon(0, getDeviceIcon(device));
    item->setText(0, formatDeviceText(device));
    updateDeviceItemAppearance(item);
}

void ModernDeviceTreeWidget::removeGroupItem(const QString &groupName)
{
    QTreeWidgetItem *item = findGroupItem(groupName);
    if (item) {
        delete item;
    }
}

void ModernDeviceTreeWidget::removeDeviceItem(const QString &serial)
{
    QTreeWidgetItem *item = findDeviceItem(serial);
    if (item) {
        QTreeWidgetItem *parent = item->parent();
        if (parent) {
            parent->removeChild(item);
            updateGroupItemAppearance(parent);
        }
        delete item;
    }
}

bool ModernDeviceTreeWidget::canDropOnItem(QTreeWidgetItem *item, const QMimeData *mimeData) const
{
    if (!item || !mimeData->hasFormat(DRAG_DROP_MIME_TYPE)) {
        return false;
    }
    
    // Can drop on group items
    return item->type() == GROUP_ITEM_TYPE;
}

QString ModernDeviceTreeWidget::getDropTargetGroup(QTreeWidgetItem *item) const
{
    if (!item || item->type() != GROUP_ITEM_TYPE) {
        return QString();
    }
    
    return item->data(0, Qt::UserRole).toString();
}

void ModernDeviceTreeWidget::performDeviceMove(const QString &serial, const QString &targetGroup)
{
    if (!m_deviceGroupManager) {
        return;
    }
    
    DeviceInfo *device = m_deviceGroupManager->getDevice(serial);
    if (!device) {
        return;
    }
    
    QString currentGroup = device->m_groupName;
    if (currentGroup != targetGroup) {
        m_deviceGroupManager->moveDevice(serial, targetGroup);
        emit deviceMoved(serial, currentGroup, targetGroup);
    }
}

void ModernDeviceTreeWidget::showGroupContextMenu(const QString &groupName, const QPoint &globalPos)
{
    Q_UNUSED(globalPos)
    
    // Update action states
    m_deleteGroupAction->setEnabled(groupName != "Unassigned Devices");
    m_renameGroupAction->setEnabled(groupName != "Unassigned Devices");
    
    m_contextMenu->exec(globalPos);
}

void ModernDeviceTreeWidget::showDeviceContextMenu(const QString &serial, const QPoint &globalPos)
{
    Q_UNUSED(serial)
    Q_UNUSED(globalPos)
    
    // Update action states
    m_deleteDeviceAction->setEnabled(true);
    m_moveDeviceAction->setEnabled(true);
    m_refreshDeviceAction->setEnabled(true);
    
    m_contextMenu->exec(globalPos);
}

void ModernDeviceTreeWidget::showEmptyContextMenu(const QPoint &globalPos)
{
    // Update action states
    m_createGroupAction->setEnabled(true);
    m_deleteGroupAction->setEnabled(false);
    m_renameGroupAction->setEnabled(false);
    m_deleteDeviceAction->setEnabled(false);
    m_moveDeviceAction->setEnabled(false);
    m_refreshDeviceAction->setEnabled(false);
    
    m_contextMenu->exec(globalPos);
}

void ModernDeviceTreeWidget::updateItemAppearance(QTreeWidgetItem *item)
{
    if (!item) {
        return;
    }
    
    if (item->type() == GROUP_ITEM_TYPE) {
        updateGroupItemAppearance(item);
    } else if (item->type() == DEVICE_ITEM_TYPE) {
        updateDeviceItemAppearance(item);
    }
}

void ModernDeviceTreeWidget::updateGroupItemAppearance(QTreeWidgetItem *item)
{
    if (!item || item->type() != GROUP_ITEM_TYPE || !m_deviceGroupManager) {
        return;
    }
    
    QString groupName = item->data(0, Qt::UserRole).toString();
    QList<DeviceInfo> devices = m_deviceGroupManager->getDevicesInGroup(groupName);
    
    int deviceCount = devices.size();
    int connectedCount = 0;
    for (const DeviceInfo &device : devices) {
        if (device.m_status == DeviceStatus::Connected) {
            connectedCount++;
        }
    }
    
    QString displayText = formatGroupText(groupName, deviceCount, connectedCount);
    item->setText(0, displayText);
}

void ModernDeviceTreeWidget::updateDeviceItemAppearance(QTreeWidgetItem *item)
{
    if (!item || item->type() != DEVICE_ITEM_TYPE || !m_deviceGroupManager) {
        return;
    }
    
    QString serial = item->data(0, Qt::UserRole).toString();
    DeviceInfo *device = m_deviceGroupManager->getDevice(serial);
    if (device) {
        item->setIcon(0, getDeviceIcon(*device));
        item->setText(0, formatDeviceText(*device));
    }
}

QString ModernDeviceTreeWidget::formatGroupText(const QString &groupName, int deviceCount, int connectedCount) const
{
    QString text = groupName;
    
    if (m_showDeviceCount) {
        text += QString(" (%1").arg(deviceCount);
        if (m_showConnectionStatus && connectedCount != deviceCount) {
            text += QString(", %1 connected").arg(connectedCount);
        }
        text += ")";
    }
    
    return text;
}

QString ModernDeviceTreeWidget::formatDeviceText(const DeviceInfo &device) const
{
    QString text = device.m_name.isEmpty() ? device.m_serial : device.m_name;
    
    if (m_showConnectionStatus) {
        text += QString(" [%1]").arg(device.getStatusText());
    }
    
    return text;
}

QIcon ModernDeviceTreeWidget::getDeviceIcon(const DeviceInfo &device) const
{
    if (device.m_status == DeviceStatus::Connected) {
        return m_connectedDeviceIcon;
    } else {
        return m_disconnectedDeviceIcon;
    }
}
