#include "dialog.h"
#include <QPushButton>
#include <QMessageBox>
#include <QDebug>

/*问题描述：
 * 动态实现新增加界面的布局*/

Dialog::Dialog(QWidget *parent)
    : QDialog(parent)
{
    resize(600,500);
//    setContentsMargins(2,2,2,2);//设置窗口内容到边框的距离
    QPushButton *addBtn = new QPushButton(tr("增加界面"),this);
//    addBtn->move(5,5);//有布局的情况下不能再设置位置
//    addBtn->setGeometry(0,0,120,40);
    widget = new QWidget(this);
//    widget->setGeometry(5,50,600,400);//有布局的情况下似乎没有用
    widget->show();//非模态对话框
    widget->setObjectName("Parent");
    widget->setStyleSheet("QWidget#Parent{background-color:green;}");

    layout.setSpacing(15);//设置布局中控件之间的垂直距离
    layout.addWidget(addBtn,0,0,1,1);
    layout.addWidget(widget,1,0,10,10);//为了彼此之间有参照
    setLayout(&layout);

    connect(addBtn,&QPushButton::clicked,this,&Dialog::slot_btnClicked);
    n = 0;
    row = 0;
}

Dialog::~Dialog()
{
}

void Dialog::slot_btnClicked()//没有实现动态布局
{
    if(row == 5)
    {
        qDebug()<<"不能再添加窗口";
        QMessageBox::information(this,tr("警告"),tr("不能添加窗口了"));
        return ;
    }
    QWidget *dlg = new QWidget(widget);
//    QDialog *dlg = new QDialog(widget);//QDialog是不被嵌入到父窗口部件的窗口，为顶级窗口
    dlg->show();
    dlg->setObjectName("child");//QWidget#Parent>
    dlg->setStyleSheet("QWidget#child{background-color:blue;}");
//    dlg->setStyleSheet("QDialog#child{background-color:blue;}");

    layout1.addWidget(dlg,row+1,(int)n%4,1,1);//栅格布局没有参照的情况下，先设置占一行一列

    n++;
    if(n%4 == 0)
    {
        row++;
    }
    widget->setLayout(&layout1);
}
