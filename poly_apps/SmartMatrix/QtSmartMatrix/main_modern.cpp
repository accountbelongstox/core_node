#include <QApplication>
#include <QDebug>
#include <QFile>
#include <QSurfaceFormat>
#include <QTcpServer>
#include <QTcpSocket>
#include <QTranslator>
#include <QDateTime>
#include <QMessageBox>
#include <QCommandLineParser>

#include "config.h"
#include "ui/modernmainwindow.h"
#include "mousetap/mousetap.h"
#include "adbprocess.h"

static ModernMainWindow *g_modernMainWindow = Q_NULLPTR;
static QtMessageHandler g_oldMessageHandler = Q_NULLPTR;
void myMessageOutput(QtMsgType type, const QMessageLogContext &context, const QString &msg);
void installTranslator();

static QtMsgType g_msgType = QtInfoMsg;
QtMsgType covertLogLevel(const QString &logLevel);

int main(int argc, char *argv[])
{
    // Parse command line arguments
    QApplication a(argc, argv);
    QCommandLineParser parser;
    parser.setApplicationDescription("QtScrcpy with Modern UI Extension");
    parser.addHelpOption();
    parser.addVersionOption();
    
    // Add command line options
    QCommandLineOption modernUIOption("modern-ui", "Start with modern UI enabled");
    QCommandLineOption legacyUIOption("legacy-ui", "Start with legacy UI only");
    QCommandLineOption hybridUIOption("hybrid-ui", "Start with hybrid UI mode");
    QCommandLineOption uiModeOption("ui-mode", "Set UI mode (legacy, modern, hybrid)", "mode", "legacy");
    
    parser.addOption(modernUIOption);
    parser.addOption(legacyUIOption);
    parser.addOption(hybridUIOption);
    parser.addOption(uiModeOption);
    
    parser.process(a);

    // Set environment variables
#ifdef Q_OS_WIN32
    qputenv("QTSCRCPY_ADB_PATH", "../../../QtScrcpy/QtScrcpyCore/src/third_party/adb/win/adb.exe");
    qputenv("QTSCRCPY_SERVER_PATH", "../../../QtScrcpy/QtScrcpyCore/src/third_party/scrcpy-server");
    qputenv("QTSCRCPY_KEYMAP_PATH", "../../../keymap");
    qputenv("QTSCRCPY_CONFIG_PATH", "../../../config");
#endif

#ifdef Q_OS_OSX
    qputenv("QTSCRCPY_ADB_PATH", "../../../../../../QtScrcpy/QtScrcpyCore/src/third_party/adb/mac/adb");
    qputenv("QTSCRCPY_SERVER_PATH", "../../../../../../QtScrcpy/QtScrcpyCore/src/third_party/scrcpy-server");
    qputenv("QTSCRCPY_KEYMAP_PATH", "../../../../../../keymap");
    qputenv("QTSCRCPY_CONFIG_PATH", "../../../../../../config");
#endif

#ifdef Q_OS_LINUX
    qputenv("QTSCRCPY_ADB_PATH", "../../../QtScrcpy/QtScrcpyCore/src/third_party/adb/linux/adb");
    qputenv("QTSCRCPY_SERVER_PATH", "../../../QtScrcpy/QtScrcpyCore/src/third_party/scrcpy-server");
    qputenv("QTSCRCPY_KEYMAP_PATH", "../../../keymap");
    qputenv("QTSCRCPY_CONFIG_PATH", "../../../config");
#endif

    g_msgType = covertLogLevel(Config::getInstance().getLogLevel());

    // Set OpenGL attributes
    int opengl = Config::getInstance().getDesktopOpenGL();
    if (0 == opengl) {
        QApplication::setAttribute(Qt::AA_UseSoftwareOpenGL);
    } else if (1 == opengl) {
        QApplication::setAttribute(Qt::AA_UseOpenGLES);
    } else if (2 == opengl) {
        QApplication::setAttribute(Qt::AA_UseDesktopOpenGL);
    }

    // Qt6: High DPI scaling is enabled by default
    QGuiApplication::setHighDpiScaleFactorRoundingPolicy(Qt::HighDpiScaleFactorRoundingPolicy::PassThrough);

    // Set OpenGL format
    QSurfaceFormat varFormat = QSurfaceFormat::defaultFormat();
    varFormat.setVersion(2, 0);
    varFormat.setProfile(QSurfaceFormat::NoProfile);
    QSurfaceFormat::setDefaultFormat(varFormat);

    // Install message handler
    g_oldMessageHandler = qInstallMessageHandler(myMessageOutput);

    // Set application properties
    a.setApplicationName("QtScrcpy Modern UI");
    a.setApplicationVersion("2.0.0");
    a.setOrganizationName("QtScrcpy");
    a.setOrganizationDomain("qtscrcpy.com");

    // Update version
    QStringList versionList = QCoreApplication::applicationVersion().split(".");
    if (versionList.size() >= 3) {
        QString version = versionList[0] + "." + versionList[1] + "." + versionList[2];
        a.setApplicationVersion(version);
    }

    // Install translator
    installTranslator();

    // Initialize mouse tap
#if defined(Q_OS_WIN32) || defined(Q_OS_OSX)
    MouseTap::getInstance()->initMouseEventTap();
#endif

    // Load style sheet
    QFile file(":/qss/psblack.css");
    if (file.open(QFile::ReadOnly)) {
        QString qss = QLatin1String(file.readAll());
        QString paletteColor = qss.mid(20, 7);
        qApp->setPalette(QPalette(QColor(paletteColor)));
        qApp->setStyleSheet(qss);
        file.close();
    }

    // Set ADB path
    qsc::AdbProcess::setAdbPath(Config::getInstance().getAdbPath());

    // Create modern main window (hardcoded)
    g_modernMainWindow = new ModernMainWindow();

    // Modern UI is always enabled (hardcoded)
    // No need for UI mode configuration since we only support Modern UI

    // Show the modern main window
    g_modernMainWindow->show();

    // Print application information
    qInfo() << QObject::tr("QtScrcpy Modern UI Extension v2.0.0");
    qInfo() << QObject::tr("Copyright © 2025 QtScrcpy Modern UI Team. All rights reserved.");
    qInfo() << QObject::tr("Professional mirror software with modern UI capabilities.");
    qInfo() << QObject::tr("Built with Qt6.9 and modern C++ features.");

    // Run application
    int ret = a.exec();

    // Cleanup
    delete g_modernMainWindow;

#if defined(Q_OS_WIN32) || defined(Q_OS_OSX)
    MouseTap::getInstance()->quitMouseEventTap();
#endif

    return ret;
}

void installTranslator()
{
    static QTranslator translator;
    QLocale locale;
    QLocale::Language language = locale.language();

    if (Config::getInstance().getLanguage() == "zh_CN") {
        language = QLocale::Chinese;
    } else if (Config::getInstance().getLanguage() == "en_US") {
        language = QLocale::English;
    } else if (Config::getInstance().getLanguage() == "ja_JP") {
        language = QLocale::Japanese;
    }

    QString languagePath = ":/i18n/";
    switch (language) {
    case QLocale::Chinese:
        languagePath += "zh_CN.qm";
        break;
    case QLocale::Japanese:
        languagePath += "ja_JP.qm";
        break;
    case QLocale::English:
    default:
        languagePath += "en_US.qm";
        break;
    }

    auto loaded = translator.load(languagePath);
    if (!loaded) {
        qWarning() << "Failed to load translation file:" << languagePath;
    }
    qApp->installTranslator(&translator);
}

QtMsgType covertLogLevel(const QString &logLevel)
{
    if ("debug" == logLevel) {
        return QtDebugMsg;
    }

    if ("info" == logLevel) {
        return QtInfoMsg;
    }

    if ("warn" == logLevel) {
        return QtWarningMsg;
    }

    if ("error" == logLevel) {
        return QtCriticalMsg;
    }

#ifdef QT_NO_DEBUG
    return QtInfoMsg;
#else
    return QtDebugMsg;
#endif
}

void myMessageOutput(QtMsgType type, const QMessageLogContext &context, const QString &msg)
{
    QString outputMsg;
    
#ifdef ENABLE_DETAILED_LOGS
    QString timestamp = QDateTime::currentDateTime().toString("yyyy-MM-dd hh:mm:ss.zzz");
    
    if (context.file && context.line > 0) {
        QString fileName = QString::fromUtf8(context.file);

        int lastSlash = fileName.lastIndexOf('/');
        if (lastSlash >= 0) {
            fileName = fileName.mid(lastSlash + 1);
        }
        lastSlash = fileName.lastIndexOf('\\');
        if (lastSlash >= 0) {
            fileName = fileName.mid(lastSlash + 1);
        }
        
        outputMsg = QString("[ %1 %2: %3 ] %4").arg(timestamp).arg(fileName).arg(context.line).arg(msg);
    } else {
        outputMsg = QString("[%1] %2").arg(timestamp).arg(msg);
    }

    switch (type) {
    case QtDebugMsg:
        outputMsg.prepend("[debug] ");
        break;
    case QtInfoMsg:
        outputMsg.prepend("[info] ");
        break;
    case QtWarningMsg:
        outputMsg.prepend("[warning] ");
        break;
    case QtCriticalMsg:
        outputMsg.prepend("[critical] ");
        break;
    case QtFatalMsg:
        outputMsg.prepend("[fatal] ");
        break;
    }

    fprintf(stderr, "%s\n", outputMsg.toUtf8().constData());
#else
    outputMsg = msg;
    if (g_oldMessageHandler) {
        g_oldMessageHandler(type, context, outputMsg);
    }
#endif

    // Check log level
    float fLogLevel = g_msgType;
    if (QtInfoMsg == g_msgType) {
        fLogLevel = QtDebugMsg + 0.5f;
    }
    float fLogLevel2 = type;
    if (QtInfoMsg == type) {
        fLogLevel2 = QtDebugMsg + 0.5f;
    }

    if (fLogLevel <= fLogLevel2) {
        // Modern UI: Log output is handled internally by ModernMainWindow
        // No need to call external log methods
    }

    if (QtFatalMsg == type) {
        //abort();
    }
}
