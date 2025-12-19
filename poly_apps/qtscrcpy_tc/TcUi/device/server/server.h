#ifndef SERVER_H
#define SERVER_H

#include <QObject>
#include <QPointer>
#include <QSize>

#include "adbprocess.h"
#include "tcpserver.h"
#include "videosocket.h"

class Server : public QObject
{
    Q_OBJECT

    enum SERVER_START_STEP
    {
        SSS_NULL,
        SSS_PUSH,
        SSS_ENABLE_TUNNEL_REVERSE,
        SSS_ENABLE_TUNNEL_FORWARD,
        SSS_EXECUTE_SERVER,
        SSS_RUNNING,
    };

public:
    struct ServerParams
    {
        QString serial = "";           // Device serial number
        quint16 localPort = 27183;     // Local listening port for reverse mode
        quint16 maxSize = 720;         // Video resolution
        quint32 bitRate = 8000000;     // Video bit rate
        quint32 maxFps = 60;           // Maximum video frame rate
        QString crop = "-";            // Video crop
        bool control = true;           // Whether Android side receives keyboard/mouse control
        bool useReverse = true;        // true: use adb reverse first, auto fallback to adb forward on failure; false: use adb forward directly
        int lockVideoOrientation = -1; // Whether to lock video orientation
        int stayAwake = false;         // Whether to keep awake
    };

    explicit Server(QObject *parent = nullptr);
    virtual ~Server();

    bool start(Server::ServerParams params);
    bool connectTo();
    bool isReverse();
    Server::ServerParams getParams();

    VideoSocket *getVideoSocket();
    QTcpSocket *getControlSocket();

    void stop();

signals:
    void serverStartResult(bool success);
    void connectToResult(bool success, const QString &deviceName = "", const QSize &size = QSize());
    void onServerStop();

private slots:
    void onWorkProcessResult(AdbProcess::ADB_EXEC_RESULT processResult);

protected:
    void timerEvent(QTimerEvent *event);

private:
    const QString &getServerPath();
    bool pushServer();
    bool enableTunnelReverse();
    bool disableTunnelReverse();
    bool enableTunnelForward();
    bool disableTunnelForward();
    bool execute();
    bool startServerByStep();
    bool readInfo(VideoSocket *videoSocket, QString &deviceName, QSize &size);
    void startAcceptTimeoutTimer();
    void stopAcceptTimeoutTimer();
    void startConnectTimeoutTimer();
    void stopConnectTimeoutTimer();
    void onConnectTimer();

private:
    QString m_serverPath = "";
    AdbProcess m_workProcess;
    AdbProcess m_serverProcess;
    TcpServer m_serverSocket; // only used if !tunnel_forward
    QPointer<VideoSocket> m_videoSocket = Q_NULLPTR;
    QPointer<QTcpSocket> m_controlSocket = Q_NULLPTR;
    bool m_tunnelEnabled = false;
    bool m_tunnelForward = false; // use "adb forward" instead of "adb reverse"
    int m_acceptTimeoutTimer = 0;
    int m_connectTimeoutTimer = 0;
    quint32 m_connectCount = 0;
    quint32 m_restartCount = 0;
    QString m_deviceName = "";
    QSize m_deviceSize = QSize();
    ServerParams m_params;

    SERVER_START_STEP m_serverStartStep = SSS_NULL;
};

#endif // SERVER_H
