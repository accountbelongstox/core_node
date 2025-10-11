#include "LockerWidget.h"

#include <QApplication>

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);
    LockerWidget w;
    w.show();
    return a.exec();
}
