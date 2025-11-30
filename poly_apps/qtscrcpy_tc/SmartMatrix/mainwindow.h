#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QSystemTrayIcon>
#include <QTimer>
#include <QCloseEvent>

#include <iostream>

#include <device.h>

QT_BEGIN_NAMESPACE
namespace Ui { class MainWindow; }
QT_END_NAMESPACE

class CustomTitleBar;

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    MainWindow(QWidget *parent = nullptr);
    ~MainWindow();

private slots:
    void on_configbutton_clicked();
    void on_pushButton_clicked();
    void on_pushButton_2_clicked();

    // 自定义标题栏槽函数
    void onMinimizeClicked();
    void onMaximizeClicked();
    void onRestartClicked();
    void onCloseClicked();

protected:
    void changeEvent(QEvent *event) override;  // 监听窗口状态变化
    void closeEvent(QCloseEvent *event) override;  // 重写关闭事件

private:
    void setupCustomTitleBar();
    void shutdownApplication();  // 完整关闭逻辑
    void restartApplication();   // 重启逻辑
    bool hasActiveDevices();     // 检查是否有活动设备

public:
    Ui::MainWindow *ui;
    static MainWindow *mainwin;

private:
    QSystemTrayIcon *m_hideIcon;
    CustomTitleBar *m_customTitleBar;
};
#endif // MAINWINDOW_H
