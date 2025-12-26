/********************************************************************************
** Form generated from reading UI file 'mainwindow.ui'
**
** Created by: Qt User Interface Compiler version 6.10.1
**
** WARNING! All changes made in this file will be lost when recompiling UI file!
********************************************************************************/

#ifndef UI_MAINWINDOW_H
#define UI_MAINWINDOW_H

#include <QtCore/QVariant>
#include <QtWidgets/QApplication>
#include <QtWidgets/QComboBox>
#include <QtWidgets/QFrame>
#include <QtWidgets/QGridLayout>
#include <QtWidgets/QHBoxLayout>
#include <QtWidgets/QMainWindow>
#include <QtWidgets/QMenuBar>
#include <QtWidgets/QPushButton>
#include <QtWidgets/QStatusBar>
#include <QtWidgets/QVBoxLayout>
#include <QtWidgets/QWidget>
#include <toolform.h>
#include "CustomTreeWidget.h"

QT_BEGIN_NAMESPACE

class Ui_MainWindow
{
public:
    QWidget *centralwidget;
    QVBoxLayout *verticalLayout;
    QWidget *topwidget;
    QHBoxLayout *horizontalLayout_2;
    QPushButton *pushButton_3;
    ToolForm *shortcutwidget;
    QPushButton *configbutton;
    QComboBox *languageComboBox;
    QFrame *line;
    QWidget *middlewidget;
    QHBoxLayout *horizontalLayout;
    QWidget *leftwidget;
    QVBoxLayout *verticalLayout_2;
    CustomTreeWidget *treewidget;
    QWidget *logwidget;
    QVBoxLayout *verticalLayout_3;
    QPushButton *pushButton_2;
    QPushButton *pushButton;
    QFrame *line_2;
    QWidget *centerwidget;
    QHBoxLayout *horizontalLayout_3;
    QGridLayout *gridLayout;
    QMenuBar *menubar;
    QStatusBar *statusbar;

    void setupUi(QMainWindow *MainWindow)
    {
        if (MainWindow->objectName().isEmpty())
            MainWindow->setObjectName("MainWindow");
        MainWindow->resize(905, 554);
        MainWindow->setMaximumSize(QSize(16777215, 16777215));
        centralwidget = new QWidget(MainWindow);
        centralwidget->setObjectName("centralwidget");
        verticalLayout = new QVBoxLayout(centralwidget);
        verticalLayout->setObjectName("verticalLayout");
        verticalLayout->setContentsMargins(9, 9, 9, 9);
        topwidget = new QWidget(centralwidget);
        topwidget->setObjectName("topwidget");
        topwidget->setStyleSheet(QString::fromUtf8("border: 1px solid #CDCDCD; border-radius: 5px;"));
        horizontalLayout_2 = new QHBoxLayout(topwidget);
        horizontalLayout_2->setObjectName("horizontalLayout_2");
        pushButton_3 = new QPushButton(topwidget);
        pushButton_3->setObjectName("pushButton_3");

        horizontalLayout_2->addWidget(pushButton_3);

        shortcutwidget = new ToolForm(topwidget);
        shortcutwidget->setObjectName("shortcutwidget");

        horizontalLayout_2->addWidget(shortcutwidget);

        configbutton = new QPushButton(topwidget);
        configbutton->setObjectName("configbutton");

        horizontalLayout_2->addWidget(configbutton);

        languageComboBox = new QComboBox(topwidget);
        languageComboBox->addItem(QString());
        languageComboBox->addItem(QString());
        languageComboBox->setObjectName("languageComboBox");
        languageComboBox->setMinimumSize(QSize(100, 0));

        horizontalLayout_2->addWidget(languageComboBox);

        horizontalLayout_2->setStretch(0, 2);
        horizontalLayout_2->setStretch(1, 6);
        horizontalLayout_2->setStretch(2, 1);

        verticalLayout->addWidget(topwidget);

        line = new QFrame(centralwidget);
        line->setObjectName("line");
        line->setFrameShape(QFrame::Shape::HLine);
        line->setFrameShadow(QFrame::Shadow::Sunken);

        verticalLayout->addWidget(line);

        middlewidget = new QWidget(centralwidget);
        middlewidget->setObjectName("middlewidget");
        middlewidget->setMaximumSize(QSize(16777215, 16777215));
        middlewidget->setStyleSheet(QString::fromUtf8(""));
        horizontalLayout = new QHBoxLayout(middlewidget);
        horizontalLayout->setObjectName("horizontalLayout");
        leftwidget = new QWidget(middlewidget);
        leftwidget->setObjectName("leftwidget");
        verticalLayout_2 = new QVBoxLayout(leftwidget);
        verticalLayout_2->setSpacing(0);
        verticalLayout_2->setObjectName("verticalLayout_2");
        verticalLayout_2->setContentsMargins(0, 0, 0, 0);
        treewidget = new CustomTreeWidget(leftwidget);
        treewidget->setObjectName("treewidget");

        verticalLayout_2->addWidget(treewidget);

        logwidget = new QWidget(leftwidget);
        logwidget->setObjectName("logwidget");
        verticalLayout_3 = new QVBoxLayout(logwidget);
        verticalLayout_3->setSpacing(0);
        verticalLayout_3->setObjectName("verticalLayout_3");
        verticalLayout_3->setContentsMargins(0, 0, 0, 0);
        pushButton_2 = new QPushButton(logwidget);
        pushButton_2->setObjectName("pushButton_2");

        verticalLayout_3->addWidget(pushButton_2);

        pushButton = new QPushButton(logwidget);
        pushButton->setObjectName("pushButton");

        verticalLayout_3->addWidget(pushButton);


        verticalLayout_2->addWidget(logwidget);

        verticalLayout_2->setStretch(0, 8);
        verticalLayout_2->setStretch(1, 1);

        horizontalLayout->addWidget(leftwidget);

        line_2 = new QFrame(middlewidget);
        line_2->setObjectName("line_2");
        line_2->setFrameShape(QFrame::Shape::VLine);
        line_2->setFrameShadow(QFrame::Shadow::Sunken);

        horizontalLayout->addWidget(line_2);

        centerwidget = new QWidget(middlewidget);
        centerwidget->setObjectName("centerwidget");
        centerwidget->setMaximumSize(QSize(1200, 16777215));
        centerwidget->setStyleSheet(QString::fromUtf8("border: 1px solid #CDCDCD; border-radius: 5px;"));
        horizontalLayout_3 = new QHBoxLayout(centerwidget);
        horizontalLayout_3->setSpacing(0);
        horizontalLayout_3->setObjectName("horizontalLayout_3");
        horizontalLayout_3->setContentsMargins(0, 0, 0, 0);
        gridLayout = new QGridLayout();
        gridLayout->setSpacing(1);
        gridLayout->setObjectName("gridLayout");
        gridLayout->setContentsMargins(1, 1, 1, 1);

        horizontalLayout_3->addLayout(gridLayout);


        horizontalLayout->addWidget(centerwidget);

        horizontalLayout->setStretch(0, 1);
        horizontalLayout->setStretch(2, 6);

        verticalLayout->addWidget(middlewidget);

        verticalLayout->setStretch(0, 1);
        verticalLayout->setStretch(2, 15);
        MainWindow->setCentralWidget(centralwidget);
        menubar = new QMenuBar(MainWindow);
        menubar->setObjectName("menubar");
        menubar->setGeometry(QRect(0, 0, 905, 23));
        MainWindow->setMenuBar(menubar);
        statusbar = new QStatusBar(MainWindow);
        statusbar->setObjectName("statusbar");
        MainWindow->setStatusBar(statusbar);

        retranslateUi(MainWindow);

        QMetaObject::connectSlotsByName(MainWindow);
    } // setupUi

    void retranslateUi(QMainWindow *MainWindow)
    {
        MainWindow->setWindowTitle(QCoreApplication::translate("MainWindow", "MainWindow", nullptr));
        pushButton_3->setText(QCoreApplication::translate("MainWindow", "XingCan Cloud Matrix", nullptr));
        configbutton->setText(QCoreApplication::translate("MainWindow", "Settings", nullptr));
        languageComboBox->setItemText(0, QCoreApplication::translate("MainWindow", "English", nullptr));
        languageComboBox->setItemText(1, QCoreApplication::translate("MainWindow", "\347\256\200\344\275\223\344\270\255\346\226\207", nullptr));

#if QT_CONFIG(tooltip)
        languageComboBox->setToolTip(QCoreApplication::translate("MainWindow", "Switch Language", nullptr));
#endif // QT_CONFIG(tooltip)
        pushButton_2->setText(QCoreApplication::translate("MainWindow", "Save List Info", nullptr));
        pushButton->setText(QCoreApplication::translate("MainWindow", "Add Same Device (Test)", nullptr));
    } // retranslateUi

};

namespace Ui {
    class MainWindow: public Ui_MainWindow {};
} // namespace Ui

QT_END_NAMESPACE

#endif // UI_MAINWINDOW_H
