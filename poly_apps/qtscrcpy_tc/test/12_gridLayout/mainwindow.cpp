#include "mainwindow.h"
#include "ui_mainwindow.h"
#include <QWidget>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::MainWindow)
{
    ui->setupUi(this);
    QWidget *widget = new QWidget;
    widget->setObjectName("Parent");
    widget->setStyleSheet("QWidget#Parent{background-color:red;}");
    ui->gridLayout->addWidget(widget,0,0);

    QWidget *widget2 = new QWidget;
    widget2->setObjectName("Parent");
    widget2->setStyleSheet("QWidget#Parent{background-color:yellow;}");
    ui->gridLayout->addWidget(widget2,0,1);
}

MainWindow::~MainWindow()
{
    delete ui;
}

