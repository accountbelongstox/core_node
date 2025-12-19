#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include <QSystemTrayIcon>
#include <QTimer>

#include <iostream>

#include <device.h>

QT_BEGIN_NAMESPACE
namespace Ui { class MainWindow; }
QT_END_NAMESPACE

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

public:
    Ui::MainWindow *ui;
    static MainWindow *mainwin;

private:
    QSystemTrayIcon *m_hideIcon;
};
#endif // MAINWINDOW_H
