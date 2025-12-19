#ifndef DEVICE_H
#define DEVICE_H

#include <QElapsedTimer>
#include <QPointer>
#include <QTime>
#include <QGridLayout>

#include "controlmsg.h"

class QMouseEvent;
class QWheelEvent;
class QKeyEvent;
class Recorder;
class Server;
class VideoBuffer;
class Decoder;
class FileHandler;
class Stream;
class VideoForm;
class Controller;
struct AVFrame;
class Device : public QObject
{
    Q_OBJECT
public:
    struct DeviceParams
    {
        QString recordFileName = "";      // Video recording file name
        QString recordPath = "";          // Video save path
        QString serial = "";              // Device serial number
        quint16 localPort = 27183;        // Local listening port for reverse mode
        quint16 maxSize = 720;            // Video resolution
        quint32 bitRate = 8000000;        // Video bit rate
        quint32 maxFps = 60;              // Maximum video frame rate
        bool closeScreen = false;         // Auto turn off screen at startup
        bool useReverse = true;           // true: use adb reverse first, auto fallback to adb forward on failure; false: use adb forward directly
        bool display = true;              // Whether to display screen (or only record in background)
        QString gameScript = "";          // Game mapping script
        bool renderExpiredFrames = false; // Whether to render expired video frames
        int lockVideoOrientation = -1;    // Whether to lock video orientation
        bool stayAwake = false;           // Whether to keep awake
        bool framelessWindow = false;     // Whether to use frameless window
        QString nickname = "";
    };
    enum GroupControlState
    {
        GCS_FREE = 0,
        GCS_HOST,
        GCS_CLIENT,
    };
    explicit Device(DeviceParams params, QObject *parent = nullptr);
    virtual ~Device();

    VideoForm *getVideoForm();
    Server *getServer();
    const QString &getSerial();
    const QSize frameSize();

    void updateScript(QString script);
    Device::GroupControlState controlState();

    bool isCurrentCustomKeymap();

signals:
    void deviceDisconnect(QString serial);

    // tool bar
    void switchFullScreen();
    void postGoBack();
    void postGoHome();
    void postGoMenu();
    void postAppSwitch();
    void postPower();
    void postVolumeUp();
    void postVolumeDown();
    void postCopy();
    void postCut();
    void setScreenPowerMode(ControlMsg::ScreenPowerMode mode);
    void expandNotificationPanel();
    void collapseNotificationPanel();
    void postBackOrScreenOn();
    void postTextInput(QString &text);
    void requestDeviceClipboard();
    void setDeviceClipboard(bool pause = true);
    void clipboardPaste();
    void pushFileRequest(const QString &file, const QString &devicePath = "");
    void installApkRequest(const QString &apkFile);

    // key map
    void mouseEvent(const QMouseEvent *from, const QSize &frameSize, const QSize &showSize);
    void wheelEvent(const QWheelEvent *from, const QSize &frameSize, const QSize &showSize);
    void keyEvent(const QKeyEvent *from, const QSize &frameSize, const QSize &showSize);

    // self connect signal and slots
    void screenshot();
    void showTouch(bool show);
    void setControlState(Device *device, Device::GroupControlState state);
    void grabCursor(bool grab);

    // for notify
    void controlStateChange(Device *device, Device::GroupControlState oldState, Device::GroupControlState newState);

public slots:
    void onScreenshot();
    void onShowTouch(bool show);
    void onSetControlState(Device *device, Device::GroupControlState state);
    void onGrabCursor(bool grab);

private:
    void initSignals();
    void startServer();
    bool saveFrame(const AVFrame *frame);

private:
    // server relevant
    QPointer<Server> m_server;
    QPointer<Decoder> m_decoder;
    QPointer<Controller> m_controller;
    QPointer<FileHandler> m_fileHandler;
    QPointer<Stream> m_stream;
    VideoBuffer *m_vb = Q_NULLPTR;
    Recorder *m_recorder = Q_NULLPTR;
    QString nickname = "";

    // ui
    QPointer<VideoForm> m_videoForm;

    QElapsedTimer m_startTimeCount;
    DeviceParams m_params;

    GroupControlState m_controlState = GCS_FREE;
};

#endif // DEVICE_H
