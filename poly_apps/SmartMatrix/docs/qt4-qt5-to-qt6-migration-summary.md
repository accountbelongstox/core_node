直观总结

增加了很多轮子，同时原有模块拆分的也更细致，估计为了方便拓展个管理。
把一些过度封装的东西移除了（比如同样的功能有多个函数），保证了只有一个函数执行该功能。
把一些Qt5中兼容Qt4的方法废弃了，必须用Qt5中对应的新的函数。
跟随时代脚步，增加了不少新特性以满足日益增长的客户需求。
对某些模块和类型及处理进行了革命性的重写，运行效率提高不少。
有参数类型的变化，比如 long * 到 qintptr * 等，更加适应后续的拓展以及同时对32 64位不同系统的兼容。
源码中的double数据类型全部换成了qreal，和Qt内部数据类型高度一致和统一。
我测试的都是QWidget部分，quick部分没有测试，估计quick部分更新可能会更多。
强烈建议暂时不要用Qt6.0到Qt6.2之间的版本，一些模块还缺失，相对来说BUG也比较多，推荐6.2版本开始正式迁移。
经验总结

万能方法：安装5.15版本，定位到报错的函数，切换到源码头文件，可以看到对应提示字样 QT_DEPRECATED_X(“Use sizeInBytes”) 和新函数。按照这个提示类修改就没错，一些函数是从Qt5.7 5.9 5.10等版本新增加的，可能你的项目还用的Qt4的方法，但是Qt6以前都兼容这些旧方法，到了Qt6就彻底需要用新方法了。

Qt6对core这个核心类进行了拆分，多出来core5compat，因此你需要在pro增加对应的模块已经代码中引入对应的头文件。

//pro文件引入模块
greaterThan(QT_MAJOR_VERSION, 4): QT += widgets
greaterThan(QT_MAJOR_VERSION, 5): QT += core5compat


//代码中引入头文件
#if (QT_VERSION >= QT_VERSION_CHECK(5,0,0))
#include <QtWidgets>
#endif
#if (QT_VERSION >= QT_VERSION_CHECK(6,0,0))
#include <QtCore5Compat>
#endif
AI运行代码
cpp

1
2
3
4
5
6
7
8
9
10
11
12
默认Qt6开启了高分屏支持，界面会变得很大，甚至字体发虚，很多人会不习惯，因为这种模式如果程序很多坐标计算没有采用devicePixelRatio进行运算的话，100%会出现奇奇怪怪的问题，因为坐标不准确了。要取消这种效果可以设置高分屏缩放因子。
#if (QT_VERSION >= QT_VERSION_CHECK(6,0,0))
QGuiApplication::setHighDpiScaleFactorRoundingPolicy(Qt::HighDpiScaleFactorRoundingPolicy::Floor);
#endif
AI运行代码
cpp
1
2
3
原有的随机数函数提示用QRandomGenerator替代，为了兼容所有qt版本，改动最小的办法是直接用c++中的随机数，比如qsrand函数换成srand，qrand函数换成rand，查看过源代码，其实封装的就是c++中的随机数，很多类似的封装比如qSin封装的sin。

QColor的 light 改成 lighter ，dark 改成 darker，其实 lighter、darker 这两个方法以前一直有。

QFontMetricsF 中的 fm.width 换成 fm.horizontalAdvance ，从5.11开始用新函数。

QPalette调色板枚举值，Foreground = WindowText, Background = Window，其中 Foreground 和 Background 没有了，要用 WindowText 和 Window 替代，以前就有。类似的还有 setTextColor 改成了 setForeground 。

QWheelEvent的 delta() 改成 angleDelta().y()，pos() 改成 position() 。

svg模块拆分出来了svgwidgets，如果用到了该模块则需要在pro增加 QT += svgwidgets 。

qlayout中的 margin() 函数换成 contentsMargins().left()，查看源码得知以前的 margin() 返回的就是 contentsMargins().left()，在四个数值一样的时候，默认四个数值就是一样。类似的还有setMargin移除了，统统用setContentsMargins。

之前 QChar c = 0xf105 全部要改成强制转换 QChar c = (QChar)0xf105，不再有隐式转换，不然编译报错提示error: conversion from ‘int’ to ‘QChar’ is ambiguous 。

qSort等一些函数用回c++的 std::sort 。

#if (QT_VERSION >= QT_VERSION_CHECK(6,0,0))
std::sort(ipv4s.begin(), ipv4s.end());
#else
qSort(ipv4s);
#endif
AI运行代码
cpp
1
2
3
4
5
Qt::WA_NoBackground 改成 Qt::WA_OpaquePaintEvent 。

QMatrix 类废弃了没有了，换成 QTransform ，函数功能基本一致，QTransform 类在Qt4就一直有。

QTime 计时去掉了，需要改成 QElapsedTimer ，QElapsedTimer 类在Qt4就一直有。

QApplication::desktop()废弃了， 换成了 QApplication::primaryScreen()。

#if (QT_VERSION > QT_VERSION_CHECK(5,0,0))
#include "qscreen.h"
#define deskGeometry qApp->primaryScreen()->geometry()
#define deskGeometry2 qApp->primaryScreen()->availableGeometry()
#else
#include "qdesktopwidget.h"
#define deskGeometry qApp->desktop()->geometry()
#define deskGeometry2 qApp->desktop()->availableGeometry()
#endif
AI运行代码
cpp
1
2
3
4
5
6
7
8
9
获取当前屏幕索引以及尺寸需要分别处理。
//获取当前屏幕索引
int QUIHelper::getScreenIndex()
{
//需要对多个屏幕进行处理
int screenIndex = 0;
#if (QT_VERSION >= QT_VERSION_CHECK(5,0,0))
int screenCount = qApp->screens().count();
#else
int screenCount = qApp->desktop()->screenCount();
#endif


if (screenCount > 1) {
//找到当前鼠标所在屏幕
QPoint pos = QCursor::pos();
for (int i = 0; i < screenCount; ++i) {
#if (QT_VERSION >= QT_VERSION_CHECK(5,0,0))
if (qApp->screens().at(i)->geometry().contains(pos)) {
#else
if (qApp->desktop()->screenGeometry(i).contains(pos)) {
#endif
screenIndex = i;
break;
}
}
}
return screenIndex;
}


//获取当前屏幕尺寸区域
QRect QUIHelper::getScreenRect(bool available)
{
QRect rect;
int screenIndex = QUIHelper::getScreenIndex();
if (available) {
#if (QT_VERSION >= QT_VERSION_CHECK(5,0,0))
rect = qApp->screens().at(screenIndex)->availableGeometry();
#else
rect = qApp->desktop()->availableGeometry(screenIndex);
#endif
} else {
#if (QT_VERSION >= QT_VERSION_CHECK(5,0,0))
rect = qApp->screens().at(screenIndex)->geometry();
#else
rect = qApp->desktop()->screenGeometry(screenIndex);
#endif
}
return rect;
}
AI运行代码
cpp

1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
QRegExp类移到了core5compat模块，需要主动引入头文件 #include 。

QWheelEvent构造参数和对应的计算方位函数变了。

//模拟鼠标滚轮
#if (QT_VERSION < QT_VERSION_CHECK(6,0,0))
QWheelEvent wheelEvent(QPoint(0, 0), -scal, Qt::LeftButton, Qt::NoModifier);
#else
QWheelEvent wheelEvent(QPointF(0, 0), QPointF(0, 0), QPoint(0, 0), QPoint(0, -scal), Qt::LeftButton, Qt::NoModifier, Qt::ScrollBegin, false);
#endif
QApplication::sendEvent(widget, &wheelEvent);


//鼠标滚轮直接修改值
QWheelEvent *whellEvent = (QWheelEvent *)event;
//滚动的角度,*8就是鼠标滚动的距离
#if (QT_VERSION < QT_VERSION_CHECK(6,0,0))
int degrees = whellEvent->delta() / 8;
#else
int degrees = whellEvent->angleDelta().x() / 8;
#endif
//滚动的步数,*15就是鼠标滚动的角度
int steps = degrees / 15;
AI运行代码
cpp

1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
qVariantValue 改成 qvariant_cast ，qVariantSetValue(v, value) 改成了 v.setValue(val)。相当于退回到最原始的方法，查看qVariantValue源码封装的就是qvariant_cast。

QStyleOption的init改成了initFrom。

QVariant::Type 换成了 QMetaType::Type ，本身以前的 QVariant::Type 封装的就是 QMetaType::Type 。

QStyleOptionViewItemV2 V3 V4 之类的全部没有了，暂时可以用 QStyleOptionViewItem 替代。

QFont的 resolve 的一个重载函数换成了 resolveMask。

QSettings的 setIniCodec 方法移除了，默认就是utf8，不需要设置。

qcombobox 的 activated(QString) 和 currentIndexChanged(QString) 信号删除了，用int索引参数的那个，然后自己通过索引获取值。个人觉得这个没必要删除。

qtscript模块彻底没有了，尽管从Qt5时代的后期版本就提示为废弃模块，一致坚持到Qt6才正式废弃，各种json数据解析全部换成qjson类解析。

QByteArray 的 append indexOf lastIndexOf 等众多方法的QString参数重载函数废弃了，要直接传 QByteArray，就在原来参数基础上加上 .toUtf8() 。查看源码也看得到以前的QString参数也是转成.toUtf8()再去比较。

QDateTime的时间转换函数 toTime_t + setTime_t 名字改了，对应改成了 toSecsSinceEpoch + setSecsSinceEpoch ，这两个方法在Qt5.8时候新增加的。

QLabel的 pixmap 函数之前是指针 *pixmap() 现在换成了引用 pixmap()。

QTableWidget的 sortByColumn 方法移除了默认升序的方法，必须要填入第二个参数表示升序还是降序。

qtnetwork中的错误信号error换成了errorOccurred。

XmlPatterns模块木有了，全部用xml模块重新解析。

nativeEvent的参数类型变了。

#if (QT_VERSION >= QT_VERSION_CHECK(6,0,0))
bool nativeEvent(const QByteArray &eventType, void *message, qintptr *result);
#else
bool nativeEvent(const QByteArray &eventType, void *message, long *result);
#endif