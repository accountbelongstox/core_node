#ifndef MAINWINDOW_H
#define MAINWINDOW_H

#include <QMainWindow>
#include "rng.h"
#include "edg.h"
#include "ig.h"

namespace Ui {
class MainWindow;
}

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:
    explicit MainWindow(QWidget *parent = 0);
    ~MainWindow();

private slots:
    void ChooseWidgets();
private:
    Ui::MainWindow *ui;
    Rng *rngWidget;
    Edg *edgWidget;
    Ig *igWidget;
};

#endif // MAINWINDOW_H
