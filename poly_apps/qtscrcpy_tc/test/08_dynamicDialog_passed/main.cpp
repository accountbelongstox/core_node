#include "dialog.h"

//https://www.freesion.com/article/18791401673/
#include <QApplication>
#include <QTextCodec>

int main(int argc, char *argv[])
{

    //在main()函数中添加
    QTextCodec::setCodecForLocale(QTextCodec::codecForName("GB2312"));
    QApplication a(argc, argv);
    Dialog w;
    w.show();
    return a.exec();
}
