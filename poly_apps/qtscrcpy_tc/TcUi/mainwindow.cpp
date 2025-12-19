#include <QDebug>

#include "mainwindow.h"
#include "ui_mainwindow.h"
#include "toolform.h"
#include "dialog.h"
#include "config.h"

using namespace std;

static Dialog *g_mainDlg = Q_NULLPTR;
MainWindow* MainWindow::mainwin = nullptr;

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::MainWindow)
{
    ui->setupUi(this);
    mainwin = this;
    m_hideIcon = new QSystemTrayIcon();
    m_hideIcon->setIcon(QIcon(":/image/tray/logo.png"));
    qInfo("starting...");
}

MainWindow::~MainWindow()
{
    delete ui;
}

void MainWindow::on_configbutton_clicked()
{
    g_mainDlg = new Dialog;
    g_mainDlg->setWindowTitle(Config::getInstance().getTitle());
    g_mainDlg->hide();
    g_mainDlg->show();
}

void MainWindow::on_pushButton_clicked()
{
    ui->treewidget->addMyDevice();
}

void MainWindow::on_pushButton_2_clicked()
{
    ui->treewidget->saveDiviceList();
}
