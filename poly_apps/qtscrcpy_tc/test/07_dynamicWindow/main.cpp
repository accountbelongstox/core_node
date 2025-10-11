#include "mainwindow.h"

#include <QApplication>

//http://cn.voidcc.com/question/p-cpnnzbbi-wk.html

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);
    MainWindow w;
    w.show();
    return a.exec();
}
