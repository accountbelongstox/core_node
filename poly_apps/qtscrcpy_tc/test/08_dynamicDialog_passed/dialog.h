#ifndef DIALOG_H
#define DIALOG_H

#include <QDialog>
#include <QGridLayout>

class Dialog : public QDialog
{
    Q_OBJECT

public:
    Dialog(QWidget *parent = nullptr);
    ~Dialog();

public slots:
    void slot_btnClicked();
private:
    QGridLayout layout;
    QGridLayout layout1;
    QWidget *widget;
    uint16_t n;
    uint16_t row;
};
#endif // DIALOG_H
