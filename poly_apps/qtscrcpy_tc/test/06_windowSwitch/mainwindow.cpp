#include "mainwindow.h"
#include "ui_mainwindow.h"
#include <QDebug>
//https://blog.csdn.net/mars_xiaolei/article/details/88815619

int firstIndex=0;

MainWindow::MainWindow(QWidget *parent) :
    QMainWindow(parent),
    ui(new Ui::MainWindow)
{
    ui->setupUi(this);
    //设置窗口名字
    setWindowTitle(tr("LPL战队切换系统"));

    Rng *rngWidget=new Rng(this);
    Edg *edgWidget=new Edg(this);
    Ig *igWidget=new Ig(this);

    //添加页面
    ui->stackedWidget->addWidget(rngWidget);
    ui->stackedWidget->addWidget(edgWidget);
    ui->stackedWidget->addWidget(igWidget);

    //显示页面作为主页
    ui->stackedWidget->setCurrentWidget(rngWidget);
    //获取当前页面的序号
    firstIndex=ui->stackedWidget->currentIndex();
    qDebug()<<"firstIndex:"<<firstIndex;
    //连接信号槽
    connect(ui->pushButton, SIGNAL(clicked()), this, SLOT(ChooseWidgets()));
}

MainWindow::~MainWindow()
{
    delete ui;
}

//切换页面
void MainWindow::ChooseWidgets()
{
    //获取页面的数量
    int nCount = ui->stackedWidget->count();
    //获取当前页面的索引
    int nIndex = ui->stackedWidget->currentIndex();
    //获取下一个需要显示的页面索引
    nIndex++;

    //当需要显示的页面索引大于等于总页面时，切换至首页
    if (nIndex >= nCount)
    {
        nIndex = firstIndex;
    }

    //显示当前页面
    ui->stackedWidget->setCurrentIndex(nIndex);
}
