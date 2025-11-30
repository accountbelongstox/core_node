/*
* @file                 LockerWidget.h
* @brief                抽屉式Widget
* @auther               Tree
* @version              0.0
* @date                 2019.12.31
* @copyright
*/

#ifndef LOCKER_WIDGET_H
#define LOCKER_WIDGET_H

#include "LockerButton.h"

#include <QWidget>
#include <QLabel>

class LockerWidget : public QWidget
{
    Q_OBJECT
public:
    /// @brief 构造方法
    explicit LockerWidget(QWidget* parent = nullptr);

private:
    void SetUpUI();
    LockerButton* m_sizeButton;
    LockerButton* m_positionButton;
    QWidget* m_sizeWidget;
    QWidget* m_positionWidget;
    quint8 m_sizeList;
    quint8 m_positionList;
};

#endif // LOCKER_WIDGET_H
