#ifndef MYTCWINDOW_H
#define MYTCWINDOW_H

#include <QMainWindow>

QT_BEGIN_NAMESPACE
namespace Ui { class MyTcWindow; }
QT_END_NAMESPACE

class MyTcWindow : public QMainWindow
{
    Q_OBJECT

public:
    MyTcWindow(QWidget *parent = nullptr);
    ~MyTcWindow();

private slots:
    void on_pushButton_6_clicked();

    void on_pushButton_3_clicked();

private:
    Ui::MyTcWindow *ui;
};
#endif // MYTCWINDOW_H
