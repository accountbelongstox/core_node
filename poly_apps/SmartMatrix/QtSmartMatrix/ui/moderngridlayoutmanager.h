#ifndef MODERNGRIDLAYOUTMANAGER_H
#define MODERNGRIDLAYOUTMANAGER_H

#include <QObject>
#include <QGridLayout>
#include <QWidget>
#include <QList>
#include <QProperty>
#include <QTimer>
#include <QSize>
#include <QMargins>
#include "moderndevicegroupmanager.h"
#include "devicevideowidget.h"

/**
 * @brief Modern grid layout manager
 * 
 * Manages dynamic grid layout for device video widgets using Qt6.9's modern features
 * Provides responsive layout with automatic column/row adjustment
 */
class ModernGridLayoutManager : public QObject
{
    Q_OBJECT

public:
    explicit ModernGridLayoutManager(QWidget *parent = nullptr);
    ~ModernGridLayoutManager();

    // Using Qt6.9's QProperty system
    Q_PROPERTY(int columnCount READ columnCount WRITE setColumnCount NOTIFY columnCountChanged)
    Q_PROPERTY(int rowCount READ rowCount NOTIFY rowCountChanged)
    Q_PROPERTY(QSize cellSize READ cellSize WRITE setCellSize NOTIFY cellSizeChanged)
    Q_PROPERTY(QMargins margins READ margins WRITE setMargins NOTIFY marginsChanged)
    Q_PROPERTY(int spacing READ spacing WRITE setSpacing NOTIFY spacingChanged)
    Q_PROPERTY(bool autoAdjustColumns READ autoAdjustColumns WRITE setAutoAdjustColumns NOTIFY autoAdjustColumnsChanged)

    // Layout management
    int columnCount() const { return m_columnCount; }
    void setColumnCount(int count);
    int rowCount() const { return m_rowCount; }
    QSize cellSize() const { return m_cellSize; }
    void setCellSize(const QSize &size);
    QMargins margins() const { return m_margins; }
    void setMargins(const QMargins &margins);
    int spacing() const { return m_spacing; }
    void setSpacing(int spacing);
    bool autoAdjustColumns() const { return m_autoAdjustColumns; }
    void setAutoAdjustColumns(bool autoAdjust);

    // Device management
    void addDevice(const DeviceInfo &device);
    void removeDevice(const QString &serial);
    void updateDevice(const DeviceInfo &device);
    void clearDevices();
    void setDevices(const QList<DeviceInfo> &devices);

    // Layout operations
    void updateLayout();
    void refreshLayout();
    void optimizeLayout();
    void setParentWidget(QWidget *parent);
    QWidget* parentWidget() const { return m_parentWidget; }

    // Device widget access
    DeviceVideoWidget* getDeviceWidget(const QString &serial) const;
    QList<DeviceVideoWidget*> getAllDeviceWidgets() const;
    QList<DeviceVideoWidget*> getSelectedDeviceWidgets() const;
    QList<DeviceVideoWidget*> getConnectedDeviceWidgets() const;

    // Layout calculations
    int calculateOptimalColumnCount() const;
    QSize calculateOptimalCellSize() const;
    QSize calculateMinimumSize() const;
    QSize calculateMaximumSize() const;

    // Animation and effects
    void setAnimationEnabled(bool enabled);
    bool isAnimationEnabled() const { return m_animationEnabled; }
    void setAnimationDuration(int duration);
    int animationDuration() const { return m_animationDuration; }

signals:
    void columnCountChanged();
    void rowCountChanged();
    void cellSizeChanged();
    void marginsChanged();
    void spacingChanged();
    void autoAdjustColumnsChanged();
    
    // Device signals
    void deviceAdded(const QString &serial);
    void deviceRemoved(const QString &serial);
    void deviceUpdated(const QString &serial);
    void deviceSelected(const QString &serial, bool selected);
    void deviceClicked(const QString &serial);
    void deviceDoubleClicked(const QString &serial);
    void deviceRightClicked(const QString &serial, const QPoint &globalPos);
    
    // Layout signals
    void layoutUpdated();
    void layoutOptimized();
    void optimalColumnCountChanged(int count);
    void optimalCellSizeChanged(const QSize &size);

private slots:
    void onDeviceClicked(const QString &serial);
    void onDeviceDoubleClicked(const QString &serial);
    void onDeviceRightClicked(const QString &serial, const QPoint &globalPos);
    void onDeviceSelectionChanged(const QString &serial, bool selected);
    void onDeviceHovered(const QString &serial, bool entered);
    void onAutoAdjustTimer();
    void onAnimationTimer();

private:
    void setupLayout();
    void setupConnections();
    void calculateLayout();
    void applyLayout();
    void createDeviceWidget(const DeviceInfo &device);
    void removeDeviceWidget(const QString &serial);
    void updateDeviceWidget(const DeviceInfo &device);
    void updateWidgetPositions();
    void animateLayoutChange();
    
    // Layout calculations
    void calculateOptimalLayout();
    int calculateColumnCountForSize(const QSize &availableSize) const;
    QSize calculateCellSizeForColumns(int columns) const;
    
    // Animation helpers
    void startLayoutAnimation();
    void updateLayoutAnimation();
    void finishLayoutAnimation();
    
    // Data members
    QWidget *m_parentWidget;
    QGridLayout *m_gridLayout;
    QList<DeviceInfo> m_devices;
    QMap<QString, DeviceVideoWidget*> m_deviceWidgets;
    
    // Layout properties
    int m_columnCount = 4;
    int m_rowCount = 0;
    QSize m_cellSize = QSize(200, 150);
    QMargins m_margins = QMargins(8, 8, 8, 8);
    int m_spacing = 8;
    bool m_autoAdjustColumns = true;
    
    // Animation properties
    bool m_animationEnabled = true;
    int m_animationDuration = 300;
    QTimer *m_animationTimer;
    QTimer *m_autoAdjustTimer;
    bool m_isAnimating = false;
    qreal m_animationProgress = 0.0;
    
    // Layout cache
    mutable int m_cachedOptimalColumnCount = -1;
    mutable QSize m_cachedOptimalCellSize;
    mutable bool m_layoutCacheValid = false;
    
    // Constants
    static const int AUTO_ADJUST_DELAY_MS = 500;
    static const int ANIMATION_FRAME_RATE_MS = 16; // ~60 FPS
    static const int MIN_COLUMN_COUNT = 1;
    static const int MAX_COLUMN_COUNT = 10;
    static const QSize MIN_CELL_SIZE;
    static const QSize MAX_CELL_SIZE;
};

#endif // MODERNGRIDLAYOUTMANAGER_H
