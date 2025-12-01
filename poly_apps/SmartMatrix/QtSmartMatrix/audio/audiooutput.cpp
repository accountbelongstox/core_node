// Qt5: #include <QAudioOutput>  (renamed to QAudioSink in Qt6)
// Qt6: QAudioOutput is deprecated, use QAudioSink
#include <QAudioSink>
#include <QAudioDevice>
#include <QMediaDevices>
#include <QCoreApplication>
#include <QElapsedTimer>
#include <QHostAddress>
#include <QTcpSocket>
// Qt5: #include <QTime>  (for time operations)
// Qt6: Already using QElapsedTimer which is the recommended way

#include "audiooutput.h"

AudioOutput::AudioOutput(QObject *parent)
    : QObject(parent)
{
    m_running = false;
    // Qt5: m_audioOutput = nullptr;
    // Qt6: QAudioOutput renamed to QAudioSink
    m_audioSink = nullptr;
    connect(&m_sndcpy, &QProcess::readyReadStandardOutput, this, [this]() {
        qInfo() << QString("AudioOutput::") << QString(m_sndcpy.readAllStandardOutput());
    });
    connect(&m_sndcpy, &QProcess::readyReadStandardError, this, [this]() {
        qInfo() << QString("AudioOutput::") << QString(m_sndcpy.readAllStandardError());
    });
}

AudioOutput::~AudioOutput()
{
    if (QProcess::NotRunning != m_sndcpy.state()) {
        m_sndcpy.kill();
    }
    stop();
}

bool AudioOutput::start(const QString& serial, int port)
{
    if (m_running) {
        stop();
    }

    QElapsedTimer timeConsumeCount;
    timeConsumeCount.start();
    bool ret = runSndcpyProcess(serial, port);
    qInfo() << "AudioOutput::run sndcpy cost:" << timeConsumeCount.elapsed() << "milliseconds";
    if (!ret) {
        return ret;
    }

    startAudioOutput();
    startRecvData(port);

    m_running = true;
    return true;
}

void AudioOutput::stop()
{
    if (!m_running) {
        return;
    }
    m_running = false;

    stopRecvData();
    stopAudioOutput();
}

void AudioOutput::installonly(const QString &serial, int port)
{
    runSndcpyProcess(serial, port, false);
}

bool AudioOutput::runSndcpyProcess(const QString &serial, int port, bool wait)
{
    if (QProcess::NotRunning != m_sndcpy.state()) {
        m_sndcpy.kill();
    }

#ifdef Q_OS_WIN32
    QStringList params{serial, QString::number(port)};
    m_sndcpy.start("sndcpy.bat", params);
#else
    QStringList params{"sndcpy.sh", serial, QString::number(port)};
    m_sndcpy.setWorkingDirectory(QCoreApplication::applicationDirPath());
    m_sndcpy.start("bash", params);
#endif

    if (!wait) {
        return true;
    }

    if (!m_sndcpy.waitForStarted()) {
        qWarning() << "AudioOutput::start sndcpy process failed";
        return false;
    }
    if (!m_sndcpy.waitForFinished()) {
        qWarning() << "AudioOutput::sndcpy process crashed";
        return false;
    }

    return true;
}

void AudioOutput::startAudioOutput()
{
    // Qt5: QAudioOutput API with QAudioDeviceInfo, setSampleSize(), setCodec(), setByteOrder(), setSampleType()
    //      QAudioDeviceInfo info(QAudioDeviceInfo::defaultOutputDevice());
    //      format.setSampleSize(16); format.setCodec("audio/pcm");
    //      m_audioOutput = new QAudioOutput(format, this);
    // Qt6: QAudioSink with QMediaDevices, simplified QAudioFormat using setSampleFormat()
    //      QAudioDevice defaultDevice = QMediaDevices::defaultAudioOutput();
    //      format.setSampleFormat(QAudioFormat::Int16);
    //      m_audioSink = new QAudioSink(defaultDevice, format, this);

    if (m_audioSink) {
        return;
    }

    QAudioFormat format;
    format.setSampleRate(48000);
    format.setChannelCount(2);
    format.setSampleFormat(QAudioFormat::Int16);
    QAudioDevice defaultDevice = QMediaDevices::defaultAudioOutput();
    if (!defaultDevice.isFormatSupported(format)) {
        qWarning() << "AudioOutput::audio format not supported, cannot play audio.";
        return;
    }
    m_audioSink = new QAudioSink(defaultDevice, format, this);
    m_outputDevice = m_audioSink->start();
    if (!m_outputDevice) {
        qWarning() << "AudioOutput::audio output device not available, cannot play audio.";
        delete m_audioSink;
        m_audioSink = nullptr;
        return;
    }
}

void AudioOutput::stopAudioOutput()
{
    // Qt5: if (m_audioOutput) { m_audioOutput->stop(); delete m_audioOutput; m_audioOutput = nullptr; }
    // Qt6: QAudioOutput renamed to QAudioSink
    if (m_audioSink) {
        m_audioSink->stop();
        delete m_audioSink;
        m_audioSink = nullptr;
    }
    m_outputDevice = nullptr;
}

void AudioOutput::startRecvData(int port)
{
    if (m_workerThread.isRunning()) {
        stopRecvData();
    }

    auto audioSocket = new QTcpSocket();
    audioSocket->moveToThread(&m_workerThread);
    connect(&m_workerThread, &QThread::finished, audioSocket, &QObject::deleteLater);

    connect(this, &AudioOutput::connectTo, audioSocket, [audioSocket](int port) {
        audioSocket->connectToHost(QHostAddress::LocalHost, port);
        if (!audioSocket->waitForConnected(500)) {
            qWarning("AudioOutput::audio socket connect failed");
            return;
        }
        qInfo("AudioOutput::audio socket connect success");
    });
    connect(audioSocket, &QIODevice::readyRead, audioSocket, [this, audioSocket]() {
        qint64 recv = audioSocket->bytesAvailable();
        //qDebug() << "AudioOutput::recv data:" << recv;

        if (!m_outputDevice) {
            return;
        }
        if (m_buffer.capacity() < recv) {
            m_buffer.reserve(recv);
        }

        qint64 count = audioSocket->read(m_buffer.data(), recv);
        m_outputDevice->write(m_buffer.data(), count);
    });
    connect(audioSocket, &QTcpSocket::stateChanged, audioSocket, [](QAbstractSocket::SocketState state) {
        qInfo() << "AudioOutput::audio socket state changed:" << state;

    });
    // Qt5 (< 5.15): QAbstractSocket::error signal (deprecated)
    //    connect(audioSocket, QOverload<QAbstractSocket::SocketError>::of(&QAbstractSocket::error), ...)
    // Qt5 (>= 5.15) & Qt6: errorOccurred signal replaces error signal
    connect(audioSocket, &QTcpSocket::errorOccurred, audioSocket, [](QAbstractSocket::SocketError error) {
        qInfo() << "AudioOutput::audio socket error occurred:" << error;
    });

    m_workerThread.start();
    emit connectTo(port);
}

void AudioOutput::stopRecvData()
{
    if (!m_workerThread.isRunning()) {
        return;
    }

    m_workerThread.quit();
    m_workerThread.wait();
}
