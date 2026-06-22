#ifndef DEVICEVIDEOWIDGET_H
#define DEVICEVIDEOWIDGET_H

#include <QWidget>
#include <QPixmap>
#include <QPainter>
#include <QMouseEvent>
#include <QProperty>
#include "moderndevicegroupmanager.h"

/**
 * @brief Modern device video widget
 * 
 * A custom widget for displaying device video streams with modern UI features
 * Based on Qt6.9's QProperty system and modern rendering techniques
 */
class DeviceVideoWidget : public QWidget
{
    Q_OBJECT

public:
    explicit DeviceVideoWidget(const DeviceInfo &device, QWidget *parent = nullptr);
    ~DeviceVideoWidget();

    // Using Qt6.9's QProperty system
    Q_PROPERTY(DeviceInfo deviceInfo READ deviceInfo NOTIFY deviceInfoChanged)
    Q_PROPERTY(bool isSelected READ isSelected WRITE setSelected NOTIFY selectionChanged)
    Q_PROPERTY(bool isConnected READ isConnected NOTIFY connectionChanged)
    Q_PROPERTY(QPixmap deviceScreenshot READ deviceScreenshot WRITE setDeviceScreenshot NOTIFY screenshotChanged)

    // Getters and setters
    DeviceInfo deviceInfo() const { return m_deviceInfo; }
    bool isSelected() const { return m_isSelected; }
    void setSelected(bool selected);
    bool isConnected() const { return m_deviceInfo.m_status == DeviceStatus::Connected; }
    QPixmap deviceScreenshot() const { return m_deviceScreenshot; }
    void setDeviceScreenshot(const QPixmap &screenshot);

    // Device operations
    void updateDeviceInfo(const DeviceInfo &device);
    void updateDeviceStatus(DeviceStatus status);
    void updateDeviceName(const QString &name);
    void updateScreenshot(const QPixmap &screenshot);

    // UI customization
    void setShowDeviceName(bool show);
    void setShowStatusIndicator(bool show);
    void setBorderWidth(int width);
    void setSelectedBorderColor(const QColor &color);
    void setNormalBorderColor(const QColor &color);

protected:
    // Override paint event for custom rendering
    void paintEvent(QPaintEvent *event) override;
    
    // Override mouse events for interaction
    void mousePressEvent(QMouseEvent *event) override;
    void mouseDoubleClickEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;
    void enterEvent(QEnterEvent *event) override;
    void leaveEvent(QEvent *event) override;
    
    // Override resize event for layout updates
    void resizeEvent(QResizeEvent *event) override;

signals:
    void deviceInfoChanged();
    void selectionChanged();
    void connectionChanged();
    void screenshotChanged();
    
    // Interaction signals
    void deviceClicked(const QString &serial);
    void deviceDoubleClicked(const QString &serial);
    void deviceRightClicked(const QString &serial, const QPoint &globalPos);
    void deviceHovered(const QString &serial, bool entered);

private slots:
    void onSelectionAnimationFinished();

private:
    void setupUI();
    void setupConnections();
    void updateLayout();
    void drawBackground(QPainter &painter);
    void drawScreenshot(QPainter &painter);
    void drawDeviceName(QPainter &painter);
    void drawStatusIndicator(QPainter &painter);
    void drawSelectionBorder(QPainter &painter);
    void drawHoverEffect(QPainter &painter);
    void startSelectionAnimation();
    void startHoverAnimation();
    
    // Calculate layout positions
    QRect getScreenshotRect() const;
    QRect getDeviceNameRect() const;
    QRect getStatusIndicatorRect() const;
    QRect getSelectionBorderRect() const;
    
    // Animation helpers
    void updateAnimation();
    QColor interpolateColor(const QColor &from, const QColor &to, qreal progress) const;
    
    // Data members
    DeviceInfo m_deviceInfo;
    bool m_isSelected = false;
    bool m_isHovered = false;
    QPixmap m_deviceScreenshot;
    
    // UI settings
    bool m_showDeviceName = true;
    bool m_showStatusIndicator = true;
    int m_borderWidth = 2;
    QColor m_selectedBorderColor = QColor("#2196F3");
    QColor m_normalBorderColor = QColor("#E0E0E0");
    QColor m_hoverBorderColor = QColor("#1976D2");
    QColor m_backgroundColor = QColor("#FAFAFA");
    QColor m_textColor = QColor("#333333");
    
    // Animation properties
    QTimer *m_animationTimer;
    qreal m_selectionProgress = 0.0;
    qreal m_hoverProgress = 0.0;
    bool m_isAnimating = false;
    
    // Layout cache
    mutable QRect m_cachedScreenshotRect;
    mutable QRect m_cachedDeviceNameRect;
    mutable QRect m_cachedStatusIndicatorRect;
    mutable QRect m_cachedSelectionBorderRect;
    mutable bool m_layoutCacheValid = false;
    
    // Constants
    static const int ANIMATION_DURATION_MS = 200;
    static const int ANIMATION_FRAME_RATE_MS = 16; // ~60 FPS
    static const int STATUS_INDICATOR_SIZE = 12;
    static const int DEVICE_NAME_HEIGHT = 24;
    static const int PADDING = 8;
};

#endif // DEVICEVIDEOWIDGET_H
