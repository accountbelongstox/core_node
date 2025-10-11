#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <iostream>
#include <QTimer>

#include "adbprocess.h"
#include "devicemanage.h"

QT_BEGIN_NAMESPACE
namespace Ui { class MainWindow; }
QT_END_NAMESPACE

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

    void outLog(const QString &log, bool newLine = true);

private slots:
    void on_pushButton_clicked();
    void on_countTimer_timeout(); // 定时溢出处理槽函数
    void on_autoStartTimer_timeout();
    void on_updateDevice_clicked();
    bool checkAdbRun();

    void on_startServerBtn_clicked();

    void on_pushButton_2_clicked();

public:
    Ui::MainWindow *ui;

private:
    QTimer *countTimer;// 定义定时器对象
    QTimer *autoStartTimer;
    int times = 0;
    AdbProcess m_adb;
    DeviceManage *m_deviceManage;
};
#endif // MAINWINDOW_H
