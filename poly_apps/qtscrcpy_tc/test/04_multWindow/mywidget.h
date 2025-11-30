//mywidget.h文件
#ifndef MYWIDGET_H
#define MYWIDGET_H

#include <QtWidgets/QWidget>
#include "ui_mywidget.h"
class QStackedWidget;
class QPushButton;
class MyWidget : public QWidget
{
    Q_OBJECT

public:
    MyWidget(QWidget *parent = 0);
    ~MyWidget();
public slots:
void slt_setPageWidget();//根据所点击的按钮来进行相应widget显示的槽

private:
    Ui::MyWidgetClass ui;
    QStackedWidget *stackWidget;
    QPushButton *pageButton;
    QPushButton *page2Button;
    QPushButton *page3Button;
};

#endif // MYWIDGET_H
