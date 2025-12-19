#include "dependencydownloader.h"
#include <QCoreApplication>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QDebug>
#include <QProcess>

DependencyDownloader::DependencyDownloader(QObject *parent)
    : QObject(parent)
    , m_networkManager(new QNetworkAccessManager(this))
    , m_currentReply(nullptr)
    , m_currentFile(nullptr)
    , m_completedDownloads(0)
    , m_totalDownloads(0)
{
}

DependencyDownloader::~DependencyDownloader()
{
    if (m_currentReply) {
        m_currentReply->abort();
        m_currentReply->deleteLater();
    }
    if (m_currentFile) {
        m_currentFile->close();
        delete m_currentFile;
    }
}

QString DependencyDownloader::getApplicationDirPath()
{
    return QCoreApplication::applicationDirPath();
}

bool DependencyDownloader::isAdbPresent()
{
    QString adbPath = getApplicationDirPath() + "/adb/adb.exe";
    return QFile::exists(adbPath);
}

bool DependencyDownloader::isScrcpyServerPresent()
{
    QString scrcpyPath = getApplicationDirPath() + "/scrcpy-server";
    QDir scrcpyDir(scrcpyPath);

    // Check if any scrcpy-server file exists
    QStringList filters;
    filters << "scrcpy-server*";
    QFileInfoList files = scrcpyDir.entryInfoList(filters, QDir::Files);

    return !files.isEmpty();
}

void DependencyDownloader::checkAndDownloadDependencies()
{
    qInfo() << "[DependencyDownloader] Checking dependencies...";

    m_pendingDownloads.clear();
    m_completedDownloads = 0;

    // Check ADB
    if (!isAdbPresent()) {
        qWarning() << "[DependencyDownloader] ADB not found, will download";

        DependencyInfo adb;
        adb.name = "ADB Platform Tools";
        adb.url = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip";
        adb.localPath = QDir::tempPath() + "/platform-tools.zip";
        adb.required = true;

        m_pendingDownloads.append(adb);
    } else {
        qInfo() << "[DependencyDownloader] ADB already present";
    }

    // Check scrcpy-server
    if (!isScrcpyServerPresent()) {
        qWarning() << "[DependencyDownloader] scrcpy-server not found, will download";

        DependencyInfo scrcpy;
        scrcpy.name = "scrcpy-server";
        scrcpy.url = "https://github.com/Genymobile/scrcpy/releases/download/v3.3.3/scrcpy-server-v3.3.3";
        scrcpy.localPath = getApplicationDirPath() + "/scrcpy-server/scrcpy-server-v3.3.3";
        scrcpy.required = true;

        m_pendingDownloads.append(scrcpy);
    } else {
        qInfo() << "[DependencyDownloader] scrcpy-server already present";
    }

    // Start downloading
    m_totalDownloads = m_pendingDownloads.size();

    if (m_totalDownloads == 0) {
        qInfo() << "[DependencyDownloader] All dependencies present";
        emit allDependenciesReady();
    } else {
        qInfo() << "[DependencyDownloader] Need to download" << m_totalDownloads << "dependencies";
        processNextDownload();
    }
}

void DependencyDownloader::processNextDownload()
{
    if (m_pendingDownloads.isEmpty()) {
        // All downloads completed
        qInfo() << "[DependencyDownloader] All downloads completed";
        emit allDependenciesReady();
        return;
    }

    DependencyInfo dep = m_pendingDownloads.takeFirst();
    m_currentDependency = dep.name;

    qInfo() << "[DependencyDownloader] Downloading:" << dep.name;
    qInfo() << "[DependencyDownloader] URL:" << dep.url;
    qInfo() << "[DependencyDownloader] Target:" << dep.localPath;

    downloadFile(dep.url, dep.localPath, dep.name);
}

void DependencyDownloader::createDirectory(const QString &path)
{
    QDir dir;
    if (!dir.exists(path)) {
        dir.mkpath(path);
    }
}

void DependencyDownloader::downloadFile(const QString &url, const QString &localPath, const QString &name)
{
    // Create directory if needed
    QFileInfo fileInfo(localPath);
    createDirectory(fileInfo.absolutePath());

    // Open file for writing
    m_currentFile = new QFile(localPath, this);
    if (!m_currentFile->open(QIODevice::WriteOnly)) {
        qCritical() << "[DependencyDownloader] Failed to open file for writing:" << localPath;
        emit downloadError(name, "Failed to open file for writing");
        delete m_currentFile;
        m_currentFile = nullptr;
        processNextDownload();
        return;
    }

    // Create network request
    QNetworkRequest request(url);
    request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::NoLessSafeRedirectPolicy);

    // Start download
    m_currentReply = m_networkManager->get(request);

    // Connect signals
    connect(m_currentReply, &QNetworkReply::downloadProgress,
            this, &DependencyDownloader::onDownloadProgress);
    connect(m_currentReply, &QNetworkReply::finished,
            this, &DependencyDownloader::onDownloadFinished);
    connect(m_currentReply, QOverload<QNetworkReply::NetworkError>::of(&QNetworkReply::errorOccurred),
            this, &DependencyDownloader::onDownloadError);

    // Qt 6: readyRead signal to write data
    connect(m_currentReply, &QNetworkReply::readyRead, this, [this]() {
        if (m_currentFile) {
            m_currentFile->write(m_currentReply->readAll());
        }
    });
}

void DependencyDownloader::onDownloadProgress(qint64 bytesReceived, qint64 bytesTotal)
{
    emit downloadProgress(m_currentDependency, bytesReceived, bytesTotal);

    if (bytesTotal > 0) {
        int progress = (bytesReceived * 100) / bytesTotal;
        qInfo() << "[DependencyDownloader]" << m_currentDependency << ":" << progress << "%";
    }
}

void DependencyDownloader::onDownloadFinished()
{
    if (!m_currentReply) {
        return;
    }

    bool success = (m_currentReply->error() == QNetworkReply::NoError);

    // Close file
    if (m_currentFile) {
        m_currentFile->write(m_currentReply->readAll());
        m_currentFile->close();
        delete m_currentFile;
        m_currentFile = nullptr;
    }

    QString localPath = m_currentReply->request().url().toString();

    if (success) {
        qInfo() << "[DependencyDownloader] Download completed successfully:" << m_currentDependency;

        // Post-processing for ADB (extract ZIP)
        if (m_currentDependency == "ADB Platform Tools") {
            QString zipPath = QDir::tempPath() + "/platform-tools.zip";
            QString adbDir = getApplicationDirPath() + "/adb";

            qInfo() << "[DependencyDownloader] Extracting ADB...";

            // Use PowerShell to extract (cross-platform alternative: QZipReader if available)
            QString psCommand = QString("Expand-Archive -Path '%1' -DestinationPath '%2' -Force")
                                    .arg(zipPath)
                                    .arg(QDir::tempPath() + "/platform-tools-extract");

            QProcess::execute("powershell", QStringList() << "-Command" << psCommand);

            // Copy files
            createDirectory(adbDir);
            QString ptDir = QDir::tempPath() + "/platform-tools-extract/platform-tools";

            QFile::copy(ptDir + "/adb.exe", adbDir + "/adb.exe");
            QFile::copy(ptDir + "/AdbWinApi.dll", adbDir + "/AdbWinApi.dll");
            QFile::copy(ptDir + "/AdbWinUsbApi.dll", adbDir + "/AdbWinUsbApi.dll");

            qInfo() << "[DependencyDownloader] ADB extracted to:" << adbDir;

            // Cleanup
            QFile::remove(zipPath);
            QDir(QDir::tempPath() + "/platform-tools-extract").removeRecursively();
        }

        emit downloadCompleted(m_currentDependency, true);
    } else {
        qCritical() << "[DependencyDownloader] Download failed:" << m_currentDependency;
        emit downloadCompleted(m_currentDependency, false);
    }

    m_currentReply->deleteLater();
    m_currentReply = nullptr;

    m_completedDownloads++;

    // Process next download
    processNextDownload();
}

void DependencyDownloader::onDownloadError(QNetworkReply::NetworkError error)
{
    QString errorString = m_currentReply ? m_currentReply->errorString() : "Unknown error";
    qCritical() << "[DependencyDownloader] Download error:" << errorString;
    emit downloadError(m_currentDependency, errorString);
}
