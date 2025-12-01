#include "mywidget.h"
#include <qgridlayout.h>
#include <qlabel.h>
#include <qpushbutton.h>
#include <qstackedwidget.h>
#include <QHBoxLayout>
#include <QVBoxLayout>
MyWidget::MyWidget(QWidget *parent)
    : QWidget(parent)
{
    ui.setupUi(this);
    stackWidget = new QStackedWidget;//创建QStackedWidget对象
    //创建几个QPushButton来控制widget的显示
    pageButton = new QPushButton();
    page2Button = new QPushButton();
    page3Button = new QPushButton();
    pageButton->setText(u8"button1");
    page2Button->setText(u8"button2");
    page3Button->setText(u8"button3");
    connect(pageButton, &QPushButton::clicked, this, &MyWidget::slt_setPageWidget);
    connect(page2Button, &QPushButton::clicked, this, &MyWidget::slt_setPageWidget);
    connect(page3Button, &QPushButton::clicked, this, &MyWidget::slt_setPageWidget);
    QWidget *widget[3];//创建三个QWidget对象
    for (int i = 0; i < 3; ++i)//按照下标进行一下QWidget的区分
    {
        widget[i] = new QWidget;
        widget[i]->resize(400, 400);
        QHBoxLayout *layout = new QHBoxLayout;
        for (int j = i; j < 3; ++j)
        {
            QLabel *label = new QLabel();
            label->setText(u8"123");
            layout->addWidget(label);
        }
        widget[i]->setLayout(layout);
        stackWidget->addWidget(widget[i]);
    }
    QVBoxLayout *layout = new QVBoxLayout;
    layout->addWidget(pageButton);
    layout->addWidget(page2Button);
    layout->addWidget(page3Button);
    QHBoxLayout *mainLayout = new QHBoxLayout;
    mainLayout->addLayout(layout);
    mainLayout->addWidget(stackWidget);
    setLayout(mainLayout);
}

void MyWidget::slt_setPageWidget()
{
    //获取触发槽的是哪个部件所发出的信号，并获取到那个指针
    QPushButton *widget = static_cast<QPushButton*>(sender());
    if (widget == pageButton)
    {
        stackWidget->setCurrentIndex(0);//根据触发的按钮来进行所要显示的QWidget
    }
    else if (widget == page2Button)
    {
        stackWidget->setCurrentIndex(1);
    }
    else if (widget == page3Button)
    {
        stackWidget->setCurrentIndex(2);
    }
}
MyWidget::~MyWidget()
{

}
