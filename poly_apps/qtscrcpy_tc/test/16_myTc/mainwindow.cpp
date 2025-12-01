#include "mainwindow.h"
#include "ui_mainwindow.h"
#include "device.h"
#include "dialog.h"
#include "config.h"

using namespace std;

static Dialog *g_mainDlg = Q_NULLPTR;
static QtMessageHandler g_oldMessageHandler = Q_NULLPTR;
static QtMsgType g_msgType = QtInfoMsg;
void myMessageOutput(QtMsgType type, const QMessageLogContext &context, const QString &msg);
QtMsgType covertLogLevel(const QString &logLevel);

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::MainWindow)
{
    ui->setupUi(this);

    autoStartTimer = new QTimer(this);
    autoStartTimer->start(1); // units: ms
    connect(autoStartTimer, &QTimer::timeout, this, &MainWindow::on_autoStartTimer_timeout);

    countTimer = new QTimer(this);
    countTimer->start(1000);
    connect(countTimer, &QTimer::timeout, this, &MainWindow::on_countTimer_timeout);

    connect(&m_adb, &AdbProcess::adbProcessResult, this, [this](AdbProcess::ADB_EXEC_RESULT processResult) {
        QString log = "";
        bool newLine = true;
        QStringList args = m_adb.arguments();

        switch (processResult) {
        case AdbProcess::AER_ERROR_START:
            break;
        case AdbProcess::AER_SUCCESS_START:
            log = "adb run";
            newLine = false;
            break;
        case AdbProcess::AER_ERROR_EXEC:
            //log = m_adb.getErrorOut();
            if (args.contains("ifconfig") && args.contains("wlan0")) {
//                getIPbyIp();
            }
            break;
        case AdbProcess::AER_ERROR_MISSING_BINARY:
            log = "adb not find";
            break;
        case AdbProcess::AER_SUCCESS_EXEC:
            //log = m_adb.getStdOut();
            log = "adb exec success";
            if (args.contains("devices")) {
                QStringList devices = m_adb.getDevicesSerialFromStdOut();
                ui->serialBox->clear();
//                ui->connectedPhoneList->clear();
//                std::sort(devices.begin(), devices.end(), [](const QString &s1, const QString &s2){
//                    return Config::getInstance().getNickName(s1) <= Config::getInstance().getNickName(s2);
//                });
                for (auto &item : devices) {
                    log = "get phone";
                    ui->serialBox->addItem(item);
//                    ui->connectedPhoneList->addItem(item+"-"+Config::getInstance().getNickName(item));
                }
//            } else if (args.contains("show") && args.contains("wlan0")) {
//                QString ip = m_adb.getDeviceIPFromStdOut();
//                if (ip.isEmpty()) {
//                    log = "ip not find, connect to wifi?";
//                    break;
//                }
//                ui->deviceIpEdt->setText(ip);
//            } else if (args.contains("ifconfig") && args.contains("wlan0")) {
//                QString ip = m_adb.getDeviceIPFromStdOut();
//                if (ip.isEmpty()) {
//                    log = "ip not find, connect to wifi?";
//                    break;
//                }
//                ui->deviceIpEdt->setText(ip);
//            } else if (args.contains("ip -o a")) {
//                QString ip = m_adb.getDeviceIPByIpFromStdOut();
//                if (ip.isEmpty()) {
//                    log = "ip not find, connect to wifi?";
//                    break;
//                }
//                ui->deviceIpEdt->setText(ip);
            }
            on_startServerBtn_clicked();
            break;
        }
        if (!log.isEmpty()) {
            outLog(log, newLine);
        }
    });
}

MainWindow::~MainWindow()
{
    delete ui;
}

QLCDNumber *mylcdNumber;
void MainWindow::on_autoStartTimer_timeout()
{
    autoStartTimer->stop();
    this->on_updateDevice_clicked();
#if 0
    g_oldMessageHandler = qInstallMessageHandler(myMessageOutput);
    g_msgType = covertLogLevel(Config::getInstance().getLogLevel());
#endif
#if 1
    g_mainDlg = new Dialog;
    g_mainDlg->setWindowTitle(Config::getInstance().getTitle());
    g_mainDlg->hide();
#endif
}

void MainWindow::on_countTimer_timeout()
{
    static int i = 0;

    ui->lcdNumber->display(i++);
}

void MainWindow::on_pushButton_clicked()
{

}

void MainWindow::outLog(const QString &log, bool newLine)
{
    // avoid sub thread update ui
    QString backLog = log;
    QTimer::singleShot(0, this, [this, backLog, newLine]() {
        ui->outEdit->append(backLog);
        if (newLine) {
            ui->outEdit->append("<br/>");
        }
    });
}

bool MainWindow::checkAdbRun()
{
    if (m_adb.isRuning()) {
        outLog("wait for the end of the current command to run");
    }
    return m_adb.isRuning();
}

void MainWindow::on_updateDevice_clicked()
{
    if (checkAdbRun()) {
        return;
    }
    outLog("update devices...", false);
    m_adb.execute("", QStringList() << "devices");
}

void MainWindow::on_startServerBtn_clicked()
{
    outLog("start server...", false);
    QString absFilePath;
#if 0
    if (ui->recordScreenCheck->isChecked()) {
        QString fileDir(ui->recordPathEdt->text().trimmed());
        if (!fileDir.isEmpty()) {
            QDateTime dateTime = QDateTime::currentDateTime();
            QString fileName = dateTime.toString("_yyyyMMdd_hhmmss_zzz");
            QString ext = ui->formatBox->currentText().trimmed();
            fileName = windowTitle() + fileName + "." + ext;
            QDir dir(fileDir);
            absFilePath = dir.absoluteFilePath(fileName);
        }
    }
#endif
#if 0
    quint32 bitRate = ui->bitRateBox->currentText().trimmed().toUInt();
    // this is ok that "native" toUshort is 0
    quint16 videoSize = ui->maxSizeBox->currentText().trimmed().toUShort();
#endif
    Device::DeviceParams params;
    params.serial = ui->serialBox->currentText().trimmed();
#if 0
    params.maxSize = videoSize;
    params.bitRate = bitRate;
    // on devices with Android >= 10, the capture frame rate can be limited
    params.maxFps = static_cast<quint32>(Config::getInstance().getMaxFps());
    params.recordFileName = absFilePath;
    params.closeScreen = ui->closeScreenCheck->isChecked();
    params.useReverse = ui->useReverseCheck->isChecked();
    params.display = !ui->notDisplayCheck->isChecked();
    params.renderExpiredFrames = Config::getInstance().getRenderExpiredFrames();
    params.lockVideoOrientation = ui->lockOrientationBox->currentIndex() - 1;
    params.stayAwake = ui->stayAwakeCheck->isChecked();
    params.framelessWindow = ui->framelessCheck->isChecked();
    params.recordPath = ui->recordPathEdt->text().trimmed();
#endif
    m_deviceManage = new DeviceManage(nullptr, ui);
    m_deviceManage->connectDevice(params);
#if 0
    if (ui->alwaysTopCheck->isChecked()) {
        m_deviceManage.staysOnTop(params.serial);
    }
    m_deviceManage.showFPS(params.serial, ui->fpsCheck->isChecked());
#endif
}

void MainWindow::on_pushButton_2_clicked()
{
//    QWidget *widget = new QWidget();
//    widget->show();
#if 1
    g_mainDlg->show();
#endif
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
        if (g_mainDlg && g_mainDlg->isVisible() && !g_mainDlg->filterLog(msg)) {
            g_mainDlg->outLog(msg);
        }
    }

    if (QtFatalMsg == type) {
        //abort();
    }
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
