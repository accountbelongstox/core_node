#include "CustomTreeWidget.h"

#include <QApplication>

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);
    CustomTreeWidget w;
    w.show();
    return a.exec();
}
