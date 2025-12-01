#include "mytcwindow.h"
#include "ui_mytcwindow.h"

MyTcWindow::MyTcWindow(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::MyTcWindow)
{
    ui->setupUi(this);
}

MyTcWindow::~MyTcWindow()
{
    delete ui;
}


void MyTcWindow::on_pushButton_6_clicked()
{
    QWidget *myWidget = new QWidget();
    myWidget->show();
}

void MyTcWindow::on_pushButton_3_clicked()
{
    QWidget *myWidget2 = new QWidget();
    myWidget2->show();
}
