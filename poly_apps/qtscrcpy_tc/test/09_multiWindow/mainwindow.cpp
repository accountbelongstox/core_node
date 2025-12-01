#include "mainwindow.h"
#include "ui_mainwindow.h"

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::MainWindow)
{
    ui->setupUi(this);
    widget = new QWidget(this);
    widget->show();
    widget->setObjectName("Parent");
    widget->setStyleSheet("QWidget#Parent{background-color:green;}");
    layout.setSpacing(15);//设置布局中控件之间的垂直距离
    layout.addWidget(widget,1,0,10,10);//为了彼此之间有参照
    setLayout(&layout);

    QWidget *dlg = new QWidget(widget);
    dlg->show();
    dlg->setObjectName("child");
    dlg->setStyleSheet("QWidget#child{background-color:blue;}");
    QWidget *dlg2 = new QWidget(widget);
    dlg2->show();
    dlg2->setObjectName("child");
    dlg2->setStyleSheet("QWidget#child{background-color:red;}");

    layout.addWidget(dlg,1,0,1,1);
    layout.addWidget(dlg2,2,0,1,1);
    widget->setLayout(&layout);




}

MainWindow::~MainWindow()
{
    delete ui;
}

