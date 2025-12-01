#include "moderngridlayoutmanager.h"
#include <QGridLayout>
#include <QWidget>
#include <QTimer>
#include <QResizeEvent>
#include <QApplication>
#include <QDebug>

// Static constants
const QSize ModernGridLayoutManager::MIN_CELL_SIZE = QSize(150, 100);
const QSize ModernGridLayoutManager::MAX_CELL_SIZE = QSize(500, 400);

ModernGridLayoutManager::ModernGridLayoutManager(QWidget *parent)
    : QObject(parent)
    , m_parentWidget(parent)
    , m_gridLayout(nullptr)
    , m_animationTimer(new QTimer(this))
    , m_autoAdjustTimer(new QTimer(this))
{
    setupLayout();
    setupConnections();
}

ModernGridLayoutManager::~ModernGridLayoutManager()
{
    clearDevices();
    
    if (m_animationTimer) {
        m_animationTimer->stop();
    }
    
    if (m_autoAdjustTimer) {
        m_autoAdjustTimer->stop();
    }
}

void ModernGridLayoutManager::setupLayout()
{
    if (!m_parentWidget) {
        return;
    }
    
    // Create grid layout
    m_gridLayout = new QGridLayout(m_parentWidget);
    m_gridLayout->setContentsMargins(m_margins);
    m_gridLayout->setSpacing(m_spacing);
    
    // Set layout properties
    m_gridLayout->setAlignment(Qt::AlignTop | Qt::AlignLeft);
}

void ModernGridLayoutManager::setupConnections()
{
    // Setup animation timer
    m_animationTimer->setInterval(ANIMATION_FRAME_RATE_MS);
    m_animationTimer->setSingleShot(false);
    connect(m_animationTimer, &QTimer::timeout, this, &ModernGridLayoutManager::onAnimationTimer);
    
    // Setup auto-adjust timer
    m_autoAdjustTimer->setInterval(AUTO_ADJUST_DELAY_MS);
    m_autoAdjustTimer->setSingleShot(true);
    connect(m_autoAdjustTimer, &QTimer::timeout, this, &ModernGridLayoutManager::onAutoAdjustTimer);
}

void ModernGridLayoutManager::setColumnCount(int count)
{
    count = qBound(MIN_COLUMN_COUNT, count, MAX_COLUMN_COUNT);
    
    if (m_columnCount != count) {
        m_columnCount = count;
        m_layoutCacheValid = false;
        emit columnCountChanged();
        updateLayout();
    }
}

void ModernGridLayoutManager::setCellSize(const QSize &size)
{
    QSize boundedSize = QSize(
        qBound(MIN_CELL_SIZE.width(), size.width(), MAX_CELL_SIZE.width()),
        qBound(MIN_CELL_SIZE.height(), size.height(), MAX_CELL_SIZE.height())
    );
    
    if (m_cellSize != boundedSize) {
        m_cellSize = boundedSize;
        m_layoutCacheValid = false;
        emit cellSizeChanged();
        updateLayout();
    }
}

void ModernGridLayoutManager::setMargins(const QMargins &margins)
{
    if (m_margins != margins) {
        m_margins = margins;
        if (m_gridLayout) {
            m_gridLayout->setContentsMargins(margins);
        }
        m_layoutCacheValid = false;
        emit marginsChanged();
        updateLayout();
    }
}

void ModernGridLayoutManager::setSpacing(int spacing)
{
    if (m_spacing != spacing) {
        m_spacing = spacing;
        if (m_gridLayout) {
            m_gridLayout->setSpacing(spacing);
        }
        m_layoutCacheValid = false;
        emit spacingChanged();
        updateLayout();
    }
}

void ModernGridLayoutManager::setAutoAdjustColumns(bool autoAdjust)
{
    if (m_autoAdjustColumns != autoAdjust) {
        m_autoAdjustColumns = autoAdjust;
        emit autoAdjustColumnsChanged();
        
        if (autoAdjust) {
            calculateOptimalLayout();
        }
    }
}

void ModernGridLayoutManager::addDevice(const DeviceInfo &device)
{
    // Check if device already exists
    if (m_deviceWidgets.contains(device.m_serial)) {
        updateDevice(device);
        return;
    }
    
    // Add to devices list
    m_devices.append(device);
    
    // Create device widget
    createDeviceWidget(device);
    
    // Update layout
    updateLayout();
    
    emit deviceAdded(device.m_serial);
}

void ModernGridLayoutManager::removeDevice(const QString &serial)
{
    // Remove from devices list
    for (auto it = m_devices.begin(); it != m_devices.end(); ++it) {
        if (it->m_serial == serial) {
            m_devices.erase(it);
            break;
        }
    }
    
    // Remove device widget
    removeDeviceWidget(serial);
    
    // Update layout
    updateLayout();
    
    emit deviceRemoved(serial);
}

void ModernGridLayoutManager::updateDevice(const DeviceInfo &device)
{
    // Update in devices list
    for (auto &existingDevice : m_devices) {
        if (existingDevice.m_serial == device.m_serial) {
            existingDevice = device;
            break;
        }
    }
    
    // Update device widget
    updateDeviceWidget(device);
    
    emit deviceUpdated(device.m_serial);
}

void ModernGridLayoutManager::clearDevices()
{
    // Clear devices list
    m_devices.clear();
    
    // Remove all device widgets
    for (auto it = m_deviceWidgets.begin(); it != m_deviceWidgets.end(); ++it) {
        DeviceVideoWidget *widget = it.value();
        if (widget) {
            widget->deleteLater();
        }
    }
    m_deviceWidgets.clear();
    
    // Clear layout
    if (m_gridLayout) {
        QLayoutItem *item;
        while ((item = m_gridLayout->takeAt(0)) != nullptr) {
            delete item;
        }
    }
    
    m_rowCount = 0;
    m_layoutCacheValid = false;
    
    emit rowCountChanged();
    emit layoutUpdated();
}

void ModernGridLayoutManager::setDevices(const QList<DeviceInfo> &devices)
{
    clearDevices();
    
    for (const auto &device : devices) {
        addDevice(device);
    }
}

void ModernGridLayoutManager::updateLayout()
{
    if (!m_gridLayout || m_devices.isEmpty()) {
        return;
    }
    
    calculateLayout();
    applyLayout();
    
    emit layoutUpdated();
}

void ModernGridLayoutManager::refreshLayout()
{
    m_layoutCacheValid = false;
    updateLayout();
}

void ModernGridLayoutManager::optimizeLayout()
{
    calculateOptimalLayout();
    updateLayout();
    emit layoutOptimized();
}

void ModernGridLayoutManager::setParentWidget(QWidget *parent)
{
    if (m_parentWidget == parent) {
        return;
    }
    
    m_parentWidget = parent;
    
    if (m_parentWidget) {
        setupLayout();
    }
}

DeviceVideoWidget* ModernGridLayoutManager::getDeviceWidget(const QString &serial) const
{
    return m_deviceWidgets.value(serial, nullptr);
}

QList<DeviceVideoWidget*> ModernGridLayoutManager::getAllDeviceWidgets() const
{
    return m_deviceWidgets.values();
}

QList<DeviceVideoWidget*> ModernGridLayoutManager::getSelectedDeviceWidgets() const
{
    QList<DeviceVideoWidget*> selectedWidgets;
    
    for (auto it = m_deviceWidgets.begin(); it != m_deviceWidgets.end(); ++it) {
        DeviceVideoWidget *widget = it.value();
        if (widget && widget->isSelected()) {
            selectedWidgets.append(widget);
        }
    }
    
    return selectedWidgets;
}

QList<DeviceVideoWidget*> ModernGridLayoutManager::getConnectedDeviceWidgets() const
{
    QList<DeviceVideoWidget*> connectedWidgets;
    
    for (auto it = m_deviceWidgets.begin(); it != m_deviceWidgets.end(); ++it) {
        DeviceVideoWidget *widget = it.value();
        if (widget && widget->isConnected()) {
            connectedWidgets.append(widget);
        }
    }
    
    return connectedWidgets;
}

int ModernGridLayoutManager::calculateOptimalColumnCount() const
{
    if (!m_parentWidget || m_devices.isEmpty()) {
        return m_columnCount;
    }
    
    QSize availableSize = m_parentWidget->size();
    if (availableSize.isEmpty()) {
        return m_columnCount;
    }
    
    return calculateColumnCountForSize(availableSize);
}

QSize ModernGridLayoutManager::calculateOptimalCellSize() const
{
    if (!m_parentWidget || m_devices.isEmpty()) {
        return m_cellSize;
    }
    
    QSize availableSize = m_parentWidget->size();
    if (availableSize.isEmpty()) {
        return m_cellSize;
    }
    
    int optimalColumns = calculateOptimalColumnCount();
    return calculateCellSizeForColumns(optimalColumns);
}

QSize ModernGridLayoutManager::calculateMinimumSize() const
{
    if (m_devices.isEmpty()) {
        return QSize(200, 150);
    }
    
    int minColumns = 1;
    int minRows = (m_devices.size() + minColumns - 1) / minColumns;
    
    int width = minColumns * MIN_CELL_SIZE.width() + (minColumns - 1) * m_spacing + 
                m_margins.left() + m_margins.right();
    int height = minRows * MIN_CELL_SIZE.height() + (minRows - 1) * m_spacing + 
                 m_margins.top() + m_margins.bottom();
    
    return QSize(width, height);
}

QSize ModernGridLayoutManager::calculateMaximumSize() const
{
    if (m_devices.isEmpty()) {
        return QSize(800, 600);
    }
    
    int maxColumns = qMin(m_devices.size(), MAX_COLUMN_COUNT);
    int maxRows = (m_devices.size() + maxColumns - 1) / maxColumns;
    
    int width = maxColumns * MAX_CELL_SIZE.width() + (maxColumns - 1) * m_spacing + 
                m_margins.left() + m_margins.right();
    int height = maxRows * MAX_CELL_SIZE.height() + (maxRows - 1) * m_spacing + 
                 m_margins.top() + m_margins.bottom();
    
    return QSize(width, height);
}

void ModernGridLayoutManager::setAnimationEnabled(bool enabled)
{
    if (m_animationEnabled != enabled) {
        m_animationEnabled = enabled;
        
        if (!enabled && m_animationTimer->isActive()) {
            m_animationTimer->stop();
            finishLayoutAnimation();
        }
    }
}

void ModernGridLayoutManager::setAnimationDuration(int duration)
{
    m_animationDuration = qMax(100, duration);
}

void ModernGridLayoutManager::onDeviceClicked(const QString &serial)
{
    emit deviceClicked(serial);
}

void ModernGridLayoutManager::onDeviceDoubleClicked(const QString &serial)
{
    emit deviceDoubleClicked(serial);
}

void ModernGridLayoutManager::onDeviceRightClicked(const QString &serial, const QPoint &globalPos)
{
    emit deviceRightClicked(serial, globalPos);
}

void ModernGridLayoutManager::onDeviceSelectionChanged(const QString &serial, bool selected)
{
    emit deviceSelected(serial, selected);
}

void ModernGridLayoutManager::onDeviceHovered(const QString &serial, bool entered)
{
    Q_UNUSED(serial)
    Q_UNUSED(entered)
    // Handle hover effects if needed
}

void ModernGridLayoutManager::onAutoAdjustTimer()
{
    if (m_autoAdjustColumns) {
        calculateOptimalLayout();
    }
}

void ModernGridLayoutManager::onAnimationTimer()
{
    updateLayoutAnimation();
}

void ModernGridLayoutManager::calculateLayout()
{
    if (m_devices.isEmpty()) {
        m_rowCount = 0;
        return;
    }
    
    // Calculate row count
    m_rowCount = (m_devices.size() + m_columnCount - 1) / m_columnCount;
    
    // Update row count signal if changed
    static int lastRowCount = 0;
    if (m_rowCount != lastRowCount) {
        lastRowCount = m_rowCount;
        emit rowCountChanged();
    }
}

void ModernGridLayoutManager::applyLayout()
{
    if (!m_gridLayout) {
        return;
    }
    
    // Clear existing layout items
    QLayoutItem *item;
    while ((item = m_gridLayout->takeAt(0)) != nullptr) {
        delete item;
    }
    
    // Add device widgets to layout
    for (int i = 0; i < m_devices.size(); ++i) {
        const DeviceInfo &device = m_devices[i];
        DeviceVideoWidget *widget = m_deviceWidgets.value(device.m_serial);
        
        if (widget) {
            int row = i / m_columnCount;
            int col = i % m_columnCount;
            
            m_gridLayout->addWidget(widget, row, col);
            
            // Set widget size
            widget->setFixedSize(m_cellSize);
        }
    }
    
    // Start animation if enabled
    if (m_animationEnabled) {
        startLayoutAnimation();
    }
}

void ModernGridLayoutManager::createDeviceWidget(const DeviceInfo &device)
{
    if (m_deviceWidgets.contains(device.m_serial)) {
        return;
    }
    
    DeviceVideoWidget *widget = new DeviceVideoWidget(device, m_parentWidget);
    
    // Connect signals
    connect(widget, &DeviceVideoWidget::deviceClicked, 
            this, &ModernGridLayoutManager::onDeviceClicked);
    connect(widget, &DeviceVideoWidget::deviceDoubleClicked, 
            this, &ModernGridLayoutManager::onDeviceDoubleClicked);
    connect(widget, &DeviceVideoWidget::deviceRightClicked, 
            this, &ModernGridLayoutManager::onDeviceRightClicked);
    connect(widget, &DeviceVideoWidget::selectionChanged, 
            this, [this, device]() {
                DeviceVideoWidget *widget = m_deviceWidgets.value(device.m_serial);
                if (widget) {
                    onDeviceSelectionChanged(device.m_serial, widget->isSelected());
                }
            });
    connect(widget, &DeviceVideoWidget::deviceHovered, 
            this, &ModernGridLayoutManager::onDeviceHovered);
    
    m_deviceWidgets.insert(device.m_serial, widget);
}

void ModernGridLayoutManager::removeDeviceWidget(const QString &serial)
{
    DeviceVideoWidget *widget = m_deviceWidgets.take(serial);
    if (widget) {
        widget->deleteLater();
    }
}

void ModernGridLayoutManager::updateDeviceWidget(const DeviceInfo &device)
{
    DeviceVideoWidget *widget = m_deviceWidgets.value(device.m_serial);
    if (widget) {
        widget->updateDeviceInfo(device);
    }
}

void ModernGridLayoutManager::updateWidgetPositions()
{
    // This method can be used for smooth position transitions
    // Implementation depends on specific animation requirements
}

void ModernGridLayoutManager::animateLayoutChange()
{
    if (m_animationEnabled) {
        startLayoutAnimation();
    }
}

void ModernGridLayoutManager::calculateOptimalLayout()
{
    if (!m_autoAdjustColumns || !m_parentWidget) {
        return;
    }
    
    int optimalColumns = calculateOptimalColumnCount();
    QSize optimalCellSize = calculateOptimalCellSize();
    
    if (optimalColumns != m_cachedOptimalColumnCount) {
        m_cachedOptimalColumnCount = optimalColumns;
        emit optimalColumnCountChanged(optimalColumns);
    }
    
    if (optimalCellSize != m_cachedOptimalCellSize) {
        m_cachedOptimalCellSize = optimalCellSize;
        emit optimalCellSizeChanged(optimalCellSize);
    }
    
    // Apply optimal settings
    setColumnCount(optimalColumns);
    setCellSize(optimalCellSize);
}

int ModernGridLayoutManager::calculateColumnCountForSize(const QSize &availableSize) const
{
    if (m_devices.isEmpty()) {
        return 1;
    }
    
    int availableWidth = availableSize.width() - m_margins.left() - m_margins.right();
    int availableHeight = availableSize.height() - m_margins.top() - m_margins.bottom();
    
    if (availableWidth <= 0 || availableHeight <= 0) {
        return 1;
    }
    
    // Calculate maximum possible columns
    int maxColumns = availableWidth / (MIN_CELL_SIZE.width() + m_spacing);
    maxColumns = qMax(1, qMin(maxColumns, MAX_COLUMN_COUNT));
    
    // Calculate optimal columns based on aspect ratio
    int deviceCount = m_devices.size();
    int optimalColumns = 1;
    qreal bestAspectRatio = 1.0;
    
    for (int cols = 1; cols <= maxColumns; ++cols) {
        int rows = (deviceCount + cols - 1) / cols;
        
        int totalWidth = cols * MIN_CELL_SIZE.width() + (cols - 1) * m_spacing;
        int totalHeight = rows * MIN_CELL_SIZE.height() + (rows - 1) * m_spacing;
        
        if (totalWidth <= availableWidth && totalHeight <= availableHeight) {
            qreal aspectRatio = static_cast<qreal>(totalWidth) / totalHeight;
            qreal targetAspectRatio = static_cast<qreal>(availableWidth) / availableHeight;
            qreal ratioDiff = qAbs(aspectRatio - targetAspectRatio);
            
            if (ratioDiff < qAbs(bestAspectRatio - targetAspectRatio)) {
                bestAspectRatio = aspectRatio;
                optimalColumns = cols;
            }
        }
    }
    
    return qMax(1, optimalColumns);
}

QSize ModernGridLayoutManager::calculateCellSizeForColumns(int columns) const
{
    if (!m_parentWidget || columns <= 0) {
        return m_cellSize;
    }
    
    QSize availableSize = m_parentWidget->size();
    if (availableSize.isEmpty()) {
        return m_cellSize;
    }
    
    int availableWidth = availableSize.width() - m_margins.left() - m_margins.right();
    int availableHeight = availableSize.height() - m_margins.top() - m_margins.bottom();
    
    if (availableWidth <= 0 || availableHeight <= 0) {
        return m_cellSize;
    }
    
    // Calculate cell size based on available space
    int cellWidth = (availableWidth - (columns - 1) * m_spacing) / columns;
    int cellHeight = cellWidth * 0.75; // 4:3 aspect ratio
    
    // Ensure minimum and maximum constraints
    cellWidth = qBound(MIN_CELL_SIZE.width(), cellWidth, MAX_CELL_SIZE.width());
    cellHeight = qBound(MIN_CELL_SIZE.height(), cellHeight, MAX_CELL_SIZE.height());
    
    return QSize(cellWidth, cellHeight);
}

void ModernGridLayoutManager::startLayoutAnimation()
{
    if (!m_animationEnabled || m_animationTimer->isActive()) {
        return;
    }
    
    m_isAnimating = true;
    m_animationProgress = 0.0;
    m_animationTimer->start();
}

void ModernGridLayoutManager::updateLayoutAnimation()
{
    if (!m_isAnimating) {
        return;
    }
    
    m_animationProgress += static_cast<qreal>(ANIMATION_FRAME_RATE_MS) / m_animationDuration;
    
    if (m_animationProgress >= 1.0) {
        m_animationProgress = 1.0;
        finishLayoutAnimation();
    }
    
    // Update widget positions/animation here
    // This is a placeholder for actual animation implementation
}

void ModernGridLayoutManager::finishLayoutAnimation()
{
    m_isAnimating = false;
    m_animationProgress = 0.0;
    m_animationTimer->stop();
}
