#include "devicevideowidget.h"
#include <QPainter>
#include <QMouseEvent>
#include <QTimer>
#include <QFontMetrics>
#include <QApplication>
#include <QStyleOption>
#include <QDebug>

// Static constants are defined in the header file

DeviceVideoWidget::DeviceVideoWidget(const DeviceInfo &device, QWidget *parent)
    : QWidget(parent)
    , m_deviceInfo(device)
    , m_animationTimer(new QTimer(this))
{
    setupUI();
    setupConnections();
    updateLayout();
    
    // Set initial properties
    setMouseTracking(true);
    setAttribute(Qt::WA_Hover, true);
    setMinimumSize(200, 150);
    setMaximumSize(400, 300);
}

DeviceVideoWidget::~DeviceVideoWidget()
{
    if (m_animationTimer) {
        m_animationTimer->stop();
    }
}

void DeviceVideoWidget::setupUI()
{
    // Set widget properties
    setAttribute(Qt::WA_OpaquePaintEvent);
    setAttribute(Qt::WA_NoSystemBackground);
    setFocusPolicy(Qt::ClickFocus);
    
    // Initialize animation timer
    m_animationTimer->setInterval(ANIMATION_FRAME_RATE_MS);
    m_animationTimer->setSingleShot(false);
}

void DeviceVideoWidget::setupConnections()
{
    connect(m_animationTimer, &QTimer::timeout, this, &DeviceVideoWidget::updateAnimation);
}

void DeviceVideoWidget::setSelected(bool selected)
{
    if (m_isSelected != selected) {
        m_isSelected = selected;
        startSelectionAnimation();
        emit selectionChanged();
        update();
    }
}

void DeviceVideoWidget::setDeviceScreenshot(const QPixmap &screenshot)
{
    if (m_deviceScreenshot.cacheKey() != screenshot.cacheKey()) {
        m_deviceScreenshot = screenshot;
        m_layoutCacheValid = false;
        emit screenshotChanged();
        update();
    }
}

void DeviceVideoWidget::updateDeviceInfo(const DeviceInfo &device)
{
    if (m_deviceInfo.m_serial != device.m_serial) {
        return; // Different device
    }
    
    bool statusChanged = (m_deviceInfo.m_status != device.m_status);
    bool nameChanged = (m_deviceInfo.m_name != device.m_name);
    
    m_deviceInfo = device;
    
    if (statusChanged) {
        emit connectionChanged();
    }
    
    if (nameChanged || statusChanged) {
        emit deviceInfoChanged();
        update();
    }
}

void DeviceVideoWidget::updateDeviceStatus(DeviceStatus status)
{
    if (m_deviceInfo.m_status != status) {
        m_deviceInfo.m_status = status;
        m_deviceInfo.m_statusColor = m_deviceInfo.getStatusColor();
        emit connectionChanged();
        emit deviceInfoChanged();
        update();
    }
}

void DeviceVideoWidget::updateDeviceName(const QString &name)
{
    if (m_deviceInfo.m_name != name) {
        m_deviceInfo.m_name = name;
        m_layoutCacheValid = false;
        emit deviceInfoChanged();
        update();
    }
}

void DeviceVideoWidget::updateScreenshot(const QPixmap &screenshot)
{
    setDeviceScreenshot(screenshot);
}

void DeviceVideoWidget::setShowDeviceName(bool show)
{
    if (m_showDeviceName != show) {
        m_showDeviceName = show;
        m_layoutCacheValid = false;
        update();
    }
}

void DeviceVideoWidget::setShowStatusIndicator(bool show)
{
    if (m_showStatusIndicator != show) {
        m_showStatusIndicator = show;
        m_layoutCacheValid = false;
        update();
    }
}

void DeviceVideoWidget::setBorderWidth(int width)
{
    if (m_borderWidth != width) {
        m_borderWidth = width;
        m_layoutCacheValid = false;
        update();
    }
}

void DeviceVideoWidget::setSelectedBorderColor(const QColor &color)
{
    if (m_selectedBorderColor != color) {
        m_selectedBorderColor = color;
        update();
    }
}

void DeviceVideoWidget::setNormalBorderColor(const QColor &color)
{
    if (m_normalBorderColor != color) {
        m_normalBorderColor = color;
        update();
    }
}

void DeviceVideoWidget::paintEvent(QPaintEvent *event)
{
    Q_UNUSED(event)
    
    QPainter painter(this);
    painter.setRenderHint(QPainter::Antialiasing);
    painter.setRenderHint(QPainter::SmoothPixmapTransform);
    
    // Draw background
    drawBackground(painter);
    
    // Draw screenshot
    drawScreenshot(painter);
    
    // Draw device name
    if (m_showDeviceName) {
        drawDeviceName(painter);
    }
    
    // Draw status indicator
    if (m_showStatusIndicator) {
        drawStatusIndicator(painter);
    }
    
    // Draw selection border
    drawSelectionBorder(painter);
    
    // Draw hover effect
    if (m_isHovered) {
        drawHoverEffect(painter);
    }
}

void DeviceVideoWidget::mousePressEvent(QMouseEvent *event)
{
    if (event->button() == Qt::LeftButton) {
        setSelected(!m_isSelected);
        emit deviceClicked(m_deviceInfo.m_serial);
    } else if (event->button() == Qt::RightButton) {
        emit deviceRightClicked(m_deviceInfo.m_serial, event->globalPosition().toPoint());
    }
    
    QWidget::mousePressEvent(event);
}

void DeviceVideoWidget::mouseDoubleClickEvent(QMouseEvent *event)
{
    if (event->button() == Qt::LeftButton) {
        emit deviceDoubleClicked(m_deviceInfo.m_serial);
    }
    
    QWidget::mouseDoubleClickEvent(event);
}

void DeviceVideoWidget::mouseReleaseEvent(QMouseEvent *event)
{
    QWidget::mouseReleaseEvent(event);
}

void DeviceVideoWidget::enterEvent(QEnterEvent *event)
{
    Q_UNUSED(event)
    
    if (!m_isHovered) {
        m_isHovered = true;
        startHoverAnimation();
        emit deviceHovered(m_deviceInfo.m_serial, true);
        update();
    }
    
    QWidget::enterEvent(event);
}

void DeviceVideoWidget::leaveEvent(QEvent *event)
{
    Q_UNUSED(event)
    
    if (m_isHovered) {
        m_isHovered = false;
        startHoverAnimation();
        emit deviceHovered(m_deviceInfo.m_serial, false);
        update();
    }
    
    QWidget::leaveEvent(event);
}

void DeviceVideoWidget::resizeEvent(QResizeEvent *event)
{
    QWidget::resizeEvent(event);
    m_layoutCacheValid = false;
    updateLayout();
}

void DeviceVideoWidget::onSelectionAnimationFinished()
{
    m_isAnimating = false;
    m_animationTimer->stop();
}

void DeviceVideoWidget::updateLayout()
{
    if (m_layoutCacheValid) {
        return;
    }
    
    QRect widgetRect = rect();
    
    // Calculate screenshot rect
    int screenshotY = m_showDeviceName ? DEVICE_NAME_HEIGHT + PADDING : PADDING;
    int screenshotHeight = widgetRect.height() - screenshotY - PADDING;
    m_cachedScreenshotRect = QRect(PADDING, screenshotY, 
                                   widgetRect.width() - 2 * PADDING, screenshotHeight);
    
    // Calculate device name rect
    if (m_showDeviceName) {
        m_cachedDeviceNameRect = QRect(PADDING, PADDING, 
                                       widgetRect.width() - 2 * PADDING, DEVICE_NAME_HEIGHT);
    }
    
    // Calculate status indicator rect
    if (m_showStatusIndicator) {
        int indicatorX = widgetRect.width() - STATUS_INDICATOR_SIZE - PADDING;
        int indicatorY = m_showDeviceName ? PADDING + (DEVICE_NAME_HEIGHT - STATUS_INDICATOR_SIZE) / 2 
                                          : PADDING;
        m_cachedStatusIndicatorRect = QRect(indicatorX, indicatorY, 
                                            STATUS_INDICATOR_SIZE, STATUS_INDICATOR_SIZE);
    }
    
    // Calculate selection border rect
    m_cachedSelectionBorderRect = widgetRect.adjusted(m_borderWidth / 2, m_borderWidth / 2,
                                                      -m_borderWidth / 2, -m_borderWidth / 2);
    
    m_layoutCacheValid = true;
}

void DeviceVideoWidget::drawBackground(QPainter &painter)
{
    painter.fillRect(rect(), m_backgroundColor);
}

void DeviceVideoWidget::drawScreenshot(QPainter &painter)
{
    if (m_deviceScreenshot.isNull()) {
        // Draw placeholder
        QRect screenshotRect = getScreenshotRect();
        painter.fillRect(screenshotRect, QColor("#E0E0E0"));
        
        // Draw placeholder text
        painter.setPen(QColor("#999999"));
        painter.setFont(QFont("Arial", 12));
        painter.drawText(screenshotRect, Qt::AlignCenter, "No Screenshot");
    } else {
        // Draw screenshot
        QRect screenshotRect = getScreenshotRect();
        QPixmap scaledScreenshot = m_deviceScreenshot.scaled(screenshotRect.size(), 
                                                             Qt::KeepAspectRatio, 
                                                             Qt::SmoothTransformation);
        
        // Center the screenshot
        QRect drawRect = scaledScreenshot.rect();
        drawRect.moveCenter(screenshotRect.center());
        
        painter.drawPixmap(drawRect, scaledScreenshot);
    }
}

void DeviceVideoWidget::drawDeviceName(QPainter &painter)
{
    if (!m_showDeviceName) {
        return;
    }
    
    QRect nameRect = getDeviceNameRect();
    
    // Draw background
    painter.fillRect(nameRect, QColor(0, 0, 0, 50));
    
    // Draw device name
    painter.setPen(m_textColor);
    painter.setFont(QFont("Arial", 10, QFont::Bold));
    
    QString displayName = m_deviceInfo.m_name;
    if (displayName.isEmpty()) {
        displayName = m_deviceInfo.m_serial;
    }
    
    // Truncate text if too long
    QFontMetrics metrics(painter.font());
    if (metrics.horizontalAdvance(displayName) > nameRect.width() - 20) {
        displayName = metrics.elidedText(displayName, Qt::ElideRight, nameRect.width() - 20);
    }
    
    painter.drawText(nameRect, Qt::AlignLeft | Qt::AlignVCenter, displayName);
}

void DeviceVideoWidget::drawStatusIndicator(QPainter &painter)
{
    if (!m_showStatusIndicator) {
        return;
    }
    
    QRect indicatorRect = getStatusIndicatorRect();
    
    // Draw status indicator
    QColor statusColor = m_deviceInfo.getStatusColor();
    painter.setBrush(statusColor);
    painter.setPen(Qt::NoPen);
    painter.drawEllipse(indicatorRect);
    
    // Draw border
    painter.setPen(QColor(255, 255, 255, 200));
    painter.setBrush(Qt::NoBrush);
    painter.drawEllipse(indicatorRect.adjusted(1, 1, -1, -1));
}

void DeviceVideoWidget::drawSelectionBorder(QPainter &painter)
{
    QRect borderRect = getSelectionBorderRect();
    
    QColor borderColor = m_isSelected ? m_selectedBorderColor : m_normalBorderColor;
    
    // Apply animation
    if (m_isAnimating) {
        borderColor = interpolateColor(m_normalBorderColor, m_selectedBorderColor, m_selectionProgress);
    }
    
    painter.setPen(QPen(borderColor, m_borderWidth));
    painter.setBrush(Qt::NoBrush);
    painter.drawRect(borderRect);
}

void DeviceVideoWidget::drawHoverEffect(QPainter &painter)
{
    QRect hoverRect = getSelectionBorderRect();
    
    QColor hoverColor = m_hoverBorderColor;
    hoverColor.setAlpha(static_cast<int>(100 * m_hoverProgress));
    
    painter.setPen(QPen(hoverColor, m_borderWidth + 2));
    painter.setBrush(Qt::NoBrush);
    painter.drawRect(hoverRect);
}

QRect DeviceVideoWidget::getScreenshotRect() const
{
    if (!m_layoutCacheValid) {
        const_cast<DeviceVideoWidget*>(this)->updateLayout();
    }
    return m_cachedScreenshotRect;
}

QRect DeviceVideoWidget::getDeviceNameRect() const
{
    if (!m_layoutCacheValid) {
        const_cast<DeviceVideoWidget*>(this)->updateLayout();
    }
    return m_cachedDeviceNameRect;
}

QRect DeviceVideoWidget::getStatusIndicatorRect() const
{
    if (!m_layoutCacheValid) {
        const_cast<DeviceVideoWidget*>(this)->updateLayout();
    }
    return m_cachedStatusIndicatorRect;
}

QRect DeviceVideoWidget::getSelectionBorderRect() const
{
    if (!m_layoutCacheValid) {
        const_cast<DeviceVideoWidget*>(this)->updateLayout();
    }
    return m_cachedSelectionBorderRect;
}

void DeviceVideoWidget::startSelectionAnimation()
{
    if (!m_animationTimer->isActive()) {
        m_isAnimating = true;
        m_animationTimer->start();
    }
}

void DeviceVideoWidget::startHoverAnimation()
{
    if (!m_animationTimer->isActive()) {
        m_animationTimer->start();
    }
}

void DeviceVideoWidget::updateAnimation()
{
    bool needsUpdate = false;
    
    // Update selection animation
    if (m_isAnimating) {
        m_selectionProgress += static_cast<qreal>(ANIMATION_FRAME_RATE_MS) / ANIMATION_DURATION_MS;
        if (m_selectionProgress >= 1.0) {
            m_selectionProgress = 1.0;
            onSelectionAnimationFinished();
        }
        needsUpdate = true;
    }
    
    // Update hover animation
    if (m_isHovered) {
        m_hoverProgress += static_cast<qreal>(ANIMATION_FRAME_RATE_MS) / ANIMATION_DURATION_MS;
        if (m_hoverProgress >= 1.0) {
            m_hoverProgress = 1.0;
        }
        needsUpdate = true;
    } else if (m_hoverProgress > 0.0) {
        m_hoverProgress -= static_cast<qreal>(ANIMATION_FRAME_RATE_MS) / ANIMATION_DURATION_MS;
        if (m_hoverProgress <= 0.0) {
            m_hoverProgress = 0.0;
        }
        needsUpdate = true;
    }
    
    if (needsUpdate) {
        update();
    } else {
        m_animationTimer->stop();
    }
}

QColor DeviceVideoWidget::interpolateColor(const QColor &from, const QColor &to, qreal progress) const
{
    progress = qBound(0.0, progress, 1.0);
    
    int r = static_cast<int>(from.red() + (to.red() - from.red()) * progress);
    int g = static_cast<int>(from.green() + (to.green() - from.green()) * progress);
    int b = static_cast<int>(from.blue() + (to.blue() - from.blue()) * progress);
    int a = static_cast<int>(from.alpha() + (to.alpha() - from.alpha()) * progress);
    
    return QColor(r, g, b, a);
}
