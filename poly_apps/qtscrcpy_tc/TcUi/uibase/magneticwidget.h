#ifndef MAGNETICWIDGET_H
#define MAGNETICWIDGET_H

#include <QPointer>
#include <QWidget>

/*
 * a magnetic widget
 * window title bar support not good
*/

class MagneticWidget : public QWidget
{
    Q_OBJECT

public:
    enum AdsorbPosition
    {
        AP_OUTSIDE_LEFT = 0x01,   // Adsorb to outside left border
        AP_OUTSIDE_TOP = 0x02,    // Adsorb to outside top border
        AP_OUTSIDE_RIGHT = 0x04,  // Adsorb to outside right border
        AP_OUTSIDE_BOTTOM = 0x08, // Adsorb to outside bottom border
        AP_INSIDE_LEFT = 0x10,    // Adsorb to inside left border
        AP_INSIDE_TOP = 0x20,     // Adsorb to inside top border
        AP_INSIDE_RIGHT = 0x40,   // Adsorb to inside right border
        AP_INSIDE_BOTTOM = 0x80,  // Adsorb to inside bottom border
        AP_ALL = 0xFF,            // Adsorb to all borders
    };
    Q_DECLARE_FLAGS(AdsorbPositions, AdsorbPosition)

public:
    explicit MagneticWidget(QWidget *adsorbWidget, AdsorbPositions adsorbPos = AP_ALL);
    ~MagneticWidget();

    bool isAdsorbed();

protected:
    bool eventFilter(QObject *watched, QEvent *event) override;
    void moveEvent(QMoveEvent *event) override;

private:
    void getGeometry(QRect &relativeWidgetRect, QRect &targetWidgetRect);

private:
    AdsorbPositions m_adsorbPos = AP_ALL;
    QPoint m_relativePos;
    bool m_adsorbed = false;
    QPointer<QWidget> m_adsorbWidget;
    // Record adsorbWidgetSize separately, because when Widget setGeometry is called, Move event is received first, then Resize event,
    // but when receiving Move event, Widget's size() is already the size specified by setGeometry
    QSize m_adsorbWidgetSize;
    AdsorbPosition m_curAdsorbPosition;
};

Q_DECLARE_OPERATORS_FOR_FLAGS(MagneticWidget::AdsorbPositions)
#endif // MAGNETICWIDGET_H
