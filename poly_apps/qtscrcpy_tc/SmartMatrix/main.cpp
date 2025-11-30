#include "mainwindow.h"

#include <QApplication>
#include <QWidget>
#include <QDebug>
#include <QFile>
#include <QSurfaceFormat>
#include <QTcpServer>
#include <QTcpSocket>
#include <QTranslator>

#include "config.h"
#include "mousetap/mousetap.h"
#include "stream.h"

void installTranslator();

int main(int argc, char *argv[])
{
    // set env
#ifdef Q_OS_WIN32
#if 1
    qputenv("QTSCRCPY_ADB_PATH", "../../../../third_party/adb/win/adb.exe");
    qputenv("QTSCRCPY_SERVER_PATH", "../../../../third_party/scrcpy-server");
    qputenv("QTSCRCPY_KEYMAP_PATH", "../../../../keymap");
    qputenv("QTSCRCPY_CONFIG_PATH", "../../../../config");
    qputenv("TC_CONFIG_PATH", "../../../../config");
#else
    qputenv("QTSCRCPY_ADB_PATH", "third_party/adb/win/adb.exe");
    qputenv("QTSCRCPY_SERVER_PATH", "third_party/scrcpy-server");
    qputenv("QTSCRCPY_KEYMAP_PATH", "keymap");
    qputenv("QTSCRCPY_CONFIG_PATH", "config");
    qputenv("TC_CONFIG_PATH", "config");
#endif
#endif

#ifdef Q_OS_OSX
    qputenv("QTSCRCPY_KEYMAP_PATH", "../../../../../../keymap");
#endif

#ifdef Q_OS_LINUX
    qputenv("QTSCRCPY_ADB_PATH", "../../../third_party/adb/linux/adb");
    qputenv("QTSCRCPY_SERVER_PATH", "../../../third_party/scrcpy-server");
    qputenv("QTSCRCPY_CONFIG_PATH", "../../../config");
    qputenv("QTSCRCPY_KEYMAP_PATH", "../../../keymap");
#endif
#if 1
    // set on QApplication before
    // bug: config path is error on mac
    int opengl = Config::getInstance().getDesktopOpenGL();
    if (0 == opengl) {
        QApplication::setAttribute(Qt::AA_UseSoftwareOpenGL);
    } else if (1 == opengl) {
        QApplication::setAttribute(Qt::AA_UseOpenGLES);
    } else if (2 == opengl) {
        QApplication::setAttribute(Qt::AA_UseDesktopOpenGL);
    }

    // Qt 6.0+ enables High DPI scaling by default, no need to set explicitly
#if QT_VERSION < QT_VERSION_CHECK(6, 0, 0)
    QCoreApplication::setAttribute(Qt::AA_EnableHighDpiScaling);
#endif

    QSurfaceFormat varFormat = QSurfaceFormat::defaultFormat();
    varFormat.setVersion(2, 0);
    varFormat.setProfile(QSurfaceFormat::NoProfile);
    /*
    varFormat.setSamples(4);
    varFormat.setAlphaBufferSize(8);
    varFormat.setBlueBufferSize(8);
    varFormat.setRedBufferSize(8);
    varFormat.setGreenBufferSize(8);
    varFormat.setDepthBufferSize(24);
    */
    QSurfaceFormat::setDefaultFormat(varFormat);

    Stream::init();
#endif
    QApplication a(argc, argv);

#if 1
    // windows下通过qmake VERSION变量或者rc设置版本号和应用名称后，这里可以直接拿到
    // mac下拿到的是CFBundleVersion的值
    qDebug() << a.applicationVersion();
    qDebug() << a.applicationName();

    //update version
    QStringList versionList = QCoreApplication::applicationVersion().split(".");
    if (versionList.size() >= 3) {
        QString version = versionList[0] + "." + versionList[1] + "." + versionList[2];
        a.setApplicationVersion(version);
    }

    installTranslator();
#if defined(Q_OS_WIN32) || defined(Q_OS_OSX)
    MouseTap::getInstance()->initMouseEventTap();
#endif

    // load style sheet
    QFile file(":/qss/psblack.css");
    if (file.open(QFile::ReadOnly)) {
        QString qss = QLatin1String(file.readAll());
        QString paletteColor = qss.mid(20, 7);
        qApp->setPalette(QPalette(QColor(paletteColor)));
        qApp->setStyleSheet(qss);
        file.close();
    }
#endif
    MainWindow w;
    w.setWindowTitle("灿烂传媒-智云矩阵");

    // Set frameless window for custom title bar
    w.setWindowFlags(Qt::Window | Qt::FramelessWindowHint);

    // Start maximized to cover full screen
    // The custom title bar provides window controls
    w.showMaximized();

    // Alternative: For true fullscreen that covers taskbar, uncomment below
    // QScreen *screen = QApplication::primaryScreen();
    // w.setGeometry(screen->geometry());
    // w.show();

    int ret = a.exec();
#if defined(Q_OS_WIN32) || defined(Q_OS_OSX)
    MouseTap::getInstance()->quitMouseEventTap();
#endif

    Stream::deInit();
    return ret;
}
void installTranslator()
{
    static QTranslator translator;
    QLocale locale;
    QLocale::Language language = locale.language();
    //language = QLocale::English;
    QString languagePath = ":/i18n/";
    switch (language) {
    case QLocale::Chinese:
        languagePath += "QtScrcpy_zh.qm";
        break;
    case QLocale::English:
    default:
        languagePath += "QtScrcpy_en.qm";
    }

    if (!translator.load(languagePath)) {
        qWarning() << "Failed to load translation:" << languagePath;
    }
    qApp->installTranslator(&translator);
}
