#ifndef AUDIOOUTPUT_H
#define AUDIOOUTPUT_H

#include <QThread>
#include <QProcess>
#include <QPointer>
// Qt5 API: #include <QVector>
// Qt6 API: QVector is an alias for QList, use QList directly for best practice
#include <QList>

class QAudioSink;
class QAudioOutput;
class QIODevice;
class AudioOutput : public QObject
{
    Q_OBJECT
public:
    explicit AudioOutput(QObject *parent = nullptr);
    ~AudioOutput();

    bool start(const QString& serial, int port);
    void stop();
    void installonly(const QString& serial, int port);

private:
    bool runSndcpyProcess(const QString& serial, int port, bool wait = true);
    void startAudioOutput();
    void stopAudioOutput();
    void startRecvData(int port);
    void stopRecvData();

signals:
    void connectTo(int port);

private:
    QPointer<QIODevice> m_outputDevice;
    QThread m_workerThread;
    QProcess m_sndcpy;
    // Qt5: QVector<char> m_buffer;
    // Qt6: Use QList instead of QVector
    QList<char> m_buffer;
    bool m_running = false;
    // Qt5: QAudioOutput* m_audioOutput = nullptr;
    // Qt6: QAudioOutput renamed to QAudioSink in Qt6
    QAudioSink *m_audioSink = nullptr;
};

#endif // AUDIOOUTPUT_H
