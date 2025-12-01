#ifndef LOGOUT_H
#define LOGOUT_H

#include <QObject>

class LogOut : public QObject
{
    Q_OBJECT

public:
    LogOut(QObject *parent = nullptr);
    ~LogOut();
    void outLog(const QString &log, bool newLine = true);
    bool filterLog(const QString &log);

};

#endif // LOGOUT_H
