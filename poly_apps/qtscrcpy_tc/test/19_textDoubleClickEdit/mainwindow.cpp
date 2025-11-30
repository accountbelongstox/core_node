#include <QKeyEvent>
#include <QInputDialog>

#include "mainwindow.h"
#include "ui_mainwindow.h"

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::MainWindow)
{
    ui->setupUi(this);
    ui->label->setStyleSheet("background:yellow");
    ui->label->installEventFilter(this);
}

bool MainWindow::eventFilter(QObject* obj, QEvent* evt)
{
    if (obj == ui->label)
    {
        if (evt->type() == QEvent::MouseButtonDblClick)
        {
            QString text = QInputDialog::getText(NULL, "Input Dialog",
                                   "Please input your comment",
                                   QLineEdit::Normal,
                                   ui->label->text());
            ui->label->setText(text);
            ui->label->adjustSize();
        }
    }

    return QMainWindow::eventFilter(obj, evt);
}

MainWindow::~MainWindow()
{
    delete ui;
}

