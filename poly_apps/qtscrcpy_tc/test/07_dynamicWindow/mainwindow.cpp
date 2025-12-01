#include <QVBoxLayout>

#include "MainWindow.h"
#include "ui_MainWindow.h"

//http://cn.voidcc.com/question/p-cpnnzbbi-wk.html

MainWindow::MainWindow(QWidget *parent) :
    QMainWindow(parent),
    ui(new Ui::MainWindow)
{
    ui->setupUi(this);
    populateViewGrid();
}

MainWindow::~MainWindow()
{
    delete ui;
}

void MainWindow::populateViewGrid()
{
    clockView_1 = new ClockView(ui->frame_1);
    clockView_2 = new ClockView(ui->frame_2);
    clockView_3 = new ClockView(ui->frame_3);
    clockView_4 = new ClockView(ui->frame_4);

    /*
    layout_1 = new QVBoxLayout;
    layout_2 = new QVBoxLayout;
    layout_3 = new QVBoxLayout;
    layout_4 = new QVBoxLayout;

    layout1->addWidget(clockView_1);
    layout2->addWidget(clockView_2);
    layout3->addWidget(clockView_3);
    layout4->addWidget(clockView_4);

    ui->frame_1->setLayout(layout_1);
    ui->frame_2->setLayout(layout_2);
    ui->frame_3->setLayout(layout_3);
    ui->frame_3->setLayout(layout_4);
    */
}
