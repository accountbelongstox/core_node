#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>

#include "ClockView.h"

namespace Ui{
    class MainWindow;
}

class QLayout;

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:

    explicit MainWindow(QWidget *parent = 0);

    ~MainWindow();

    void populateViewGrid();

private:

    Ui::MainWindow *ui;

    ClockView *clockView_1;
    ClockView *clockView_2;
    ClockView *clockView_3;
    ClockView *clockView_4;

    QLayout *layout_1;
    QLayout *layout_2;
    QLayout *layout_3;
    QLayout *layout_4;
};

#endif // MAINWINDOW_H
