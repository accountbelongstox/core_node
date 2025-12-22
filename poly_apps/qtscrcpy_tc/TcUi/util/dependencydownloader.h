#ifndef DEPENDENCYDOWNLOADER_H
#define DEPENDENCYDOWNLOADER_H

#include <QObject>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QString>
#include <QFile>

/**
 * @brief Auto-download dependencies (ADB, scrcpy-server) at runtime
 *
 * This class automatically downloads missing dependencies when the program starts.
 * It uses Qt Network to download ADB and scrcpy-server if they are not present.
 */
class DependencyDownloader : public QObject
{
    Q_OBJECT

public:
    explicit DependencyDownloader(QObject *parent = nullptr);
    ~DependencyDownloader();

    // Check and download all dependencies
    void checkAndDownloadDependencies();

    // Check individual dependencies
    bool isAdbPresent();
    bool isScrcpyServerPresent();

signals:
    void downloadProgress(const QString &dependency, qint64 bytesReceived, qint64 bytesTotal);
    void downloadCompleted(const QString &dependency, bool success);
    void allDependenciesReady();
    void downloadError(const QString &dependency, const QString &errorMessage);

private slots:
    void onDownloadProgress(qint64 bytesReceived, qint64 bytesTotal);
    void onDownloadFinished();
    void onDownloadError(QNetworkReply::NetworkError error);

private:
    QNetworkAccessManager *m_networkManager;
    QNetworkReply *m_currentReply;
    QFile *m_currentFile;
    QString m_currentDependency;

    // Dependency info
    struct DependencyInfo {
        QString name;
        QString url;
        QString localPath;
        bool required;
    };

    QList<DependencyInfo> m_pendingDownloads;
    int m_completedDownloads;
    int m_totalDownloads;

    // Download functions
    void downloadFile(const QString &url, const QString &localPath, const QString &name);
    void processNextDownload();

    // Utility functions
    QString getApplicationDirPath();
    bool extractZipFile(const QString &zipPath, const QString &destPath);
    void createDirectory(const QString &path);
};

#endif // DEPENDENCYDOWNLOADER_H
