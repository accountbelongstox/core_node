#include "logout.h"

static QtMessageHandler g_oldMessageHandler = Q_NULLPTR;
static QtMsgType g_msgType = QtInfoMsg;
QtMsgType covertLogLevel(const QString &logLevel);
void myMessageOutput(QtMsgType type, const QMessageLogContext &context, const QString &msg);

LogOut::LogOut(QObject *parent) : QObject(parent)
{
    g_oldMessageHandler = qInstallMessageHandler(myMessageOutput);
//    g_msgType = covertLogLevel(Config::getInstance().getLogLevel());
}

LogOut::~LogOut()
{

}

void LogOut::outLog(const QString &log, bool newLine)
{
    if(newLine){}
    // avoid sub thread update ui
    QString backLog = log;
//    QTimer::singleShot(0, this, [this, backLog, newLine]() {
//        ui->outEdit->append(backLog);
//        if (newLine) {
//            ui->outEdit->append("<br/>");
//        }
//    });
}

bool LogOut::filterLog(const QString &log)
{
    if (log.contains("app_proces")) {
        return true;
    }
    if (log.contains("Unable to set geometry")) {
        return true;
    }
    return false;
}

void myMessageOutput(QtMsgType type, const QMessageLogContext &context, const QString &msg)
{
    if (g_oldMessageHandler) {
        g_oldMessageHandler(type, context, msg);
    }

    // qt log info big than warning?
    float fLogLevel = 1.0f * g_msgType;
    if (QtInfoMsg == g_msgType) {
        fLogLevel = QtDebugMsg + 0.5f;
    }
    float fLogLevel2 = 1.0f * type;
    if (QtInfoMsg == type) {
        fLogLevel2 = QtDebugMsg + 0.5f;
    }

    if (fLogLevel <= fLogLevel2) {
//        if (g_mainDlg && g_mainDlg->isVisible() && !g_mainDlg->filterLog(msg)) {
//            g_mainDlg->outLog(msg);
//        }
    }

    if (QtFatalMsg == type) {
        //abort();
    }
}
