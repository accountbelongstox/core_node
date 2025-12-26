/********************************************************************************
** Form generated from reading UI file 'toolform.ui'
**
** Created by: Qt User Interface Compiler version 6.10.1
**
** WARNING! All changes made in this file will be lost when recompiling UI file!
********************************************************************************/

#ifndef UI_TOOLFORM_H
#define UI_TOOLFORM_H

#include <QtCore/QVariant>
#include <QtWidgets/QApplication>
#include <QtWidgets/QHBoxLayout>
#include <QtWidgets/QPushButton>
#include <QtWidgets/QWidget>

QT_BEGIN_NAMESPACE

class Ui_ToolForm
{
public:
    QHBoxLayout *horizontalLayout;
    QPushButton *groupControlBtn;
    QPushButton *fullScreenBtn;
    QPushButton *expandNotifyBtn;
    QPushButton *touchBtn;
    QPushButton *closeScreenBtn;
    QPushButton *powerBtn;
    QPushButton *volumeUpBtn;
    QPushButton *volumeDownBtn;
    QPushButton *appSwitchBtn;
    QPushButton *menuBtn;
    QPushButton *returnBtn;
    QPushButton *homeBtn;
    QPushButton *screenShotBtn;

    void setupUi(QWidget *ToolForm)
    {
        if (ToolForm->objectName().isEmpty())
            ToolForm->setObjectName("ToolForm");
        ToolForm->resize(654, 47);
        ToolForm->setStyleSheet(QString::fromUtf8(""));
        horizontalLayout = new QHBoxLayout(ToolForm);
        horizontalLayout->setObjectName("horizontalLayout");
        horizontalLayout->setContentsMargins(-1, 0, -1, 0);
        groupControlBtn = new QPushButton(ToolForm);
        groupControlBtn->setObjectName("groupControlBtn");

        horizontalLayout->addWidget(groupControlBtn);

        fullScreenBtn = new QPushButton(ToolForm);
        fullScreenBtn->setObjectName("fullScreenBtn");

        horizontalLayout->addWidget(fullScreenBtn);

        expandNotifyBtn = new QPushButton(ToolForm);
        expandNotifyBtn->setObjectName("expandNotifyBtn");

        horizontalLayout->addWidget(expandNotifyBtn);

        touchBtn = new QPushButton(ToolForm);
        touchBtn->setObjectName("touchBtn");

        horizontalLayout->addWidget(touchBtn);

        closeScreenBtn = new QPushButton(ToolForm);
        closeScreenBtn->setObjectName("closeScreenBtn");

        horizontalLayout->addWidget(closeScreenBtn);

        powerBtn = new QPushButton(ToolForm);
        powerBtn->setObjectName("powerBtn");

        horizontalLayout->addWidget(powerBtn);

        volumeUpBtn = new QPushButton(ToolForm);
        volumeUpBtn->setObjectName("volumeUpBtn");

        horizontalLayout->addWidget(volumeUpBtn);

        volumeDownBtn = new QPushButton(ToolForm);
        volumeDownBtn->setObjectName("volumeDownBtn");

        horizontalLayout->addWidget(volumeDownBtn);

        appSwitchBtn = new QPushButton(ToolForm);
        appSwitchBtn->setObjectName("appSwitchBtn");

        horizontalLayout->addWidget(appSwitchBtn);

        menuBtn = new QPushButton(ToolForm);
        menuBtn->setObjectName("menuBtn");

        horizontalLayout->addWidget(menuBtn);

        returnBtn = new QPushButton(ToolForm);
        returnBtn->setObjectName("returnBtn");

        horizontalLayout->addWidget(returnBtn);

        homeBtn = new QPushButton(ToolForm);
        homeBtn->setObjectName("homeBtn");

        horizontalLayout->addWidget(homeBtn);

        screenShotBtn = new QPushButton(ToolForm);
        screenShotBtn->setObjectName("screenShotBtn");

        horizontalLayout->addWidget(screenShotBtn);


        retranslateUi(ToolForm);

        QMetaObject::connectSlotsByName(ToolForm);
    } // setupUi

    void retranslateUi(QWidget *ToolForm)
    {
        ToolForm->setWindowTitle(QCoreApplication::translate("ToolForm", "Tool", nullptr));
        groupControlBtn->setText(QString());
#if QT_CONFIG(tooltip)
        fullScreenBtn->setToolTip(QCoreApplication::translate("ToolForm", "full screen", nullptr));
#endif // QT_CONFIG(tooltip)
        fullScreenBtn->setText(QString());
#if QT_CONFIG(tooltip)
        expandNotifyBtn->setToolTip(QCoreApplication::translate("ToolForm", "expand notify", nullptr));
#endif // QT_CONFIG(tooltip)
        expandNotifyBtn->setText(QString());
#if QT_CONFIG(tooltip)
        touchBtn->setToolTip(QCoreApplication::translate("ToolForm", "touch switch", nullptr));
#endif // QT_CONFIG(tooltip)
        touchBtn->setText(QString());
#if QT_CONFIG(tooltip)
        closeScreenBtn->setToolTip(QCoreApplication::translate("ToolForm", "close screen", nullptr));
#endif // QT_CONFIG(tooltip)
        closeScreenBtn->setText(QString());
#if QT_CONFIG(tooltip)
        powerBtn->setToolTip(QCoreApplication::translate("ToolForm", "power", nullptr));
#endif // QT_CONFIG(tooltip)
        powerBtn->setText(QString());
#if QT_CONFIG(tooltip)
        volumeUpBtn->setToolTip(QCoreApplication::translate("ToolForm", "volume up", nullptr));
#endif // QT_CONFIG(tooltip)
        volumeUpBtn->setText(QString());
#if QT_CONFIG(tooltip)
        volumeDownBtn->setToolTip(QCoreApplication::translate("ToolForm", "volume down", nullptr));
#endif // QT_CONFIG(tooltip)
        volumeDownBtn->setText(QString());
#if QT_CONFIG(tooltip)
        appSwitchBtn->setToolTip(QCoreApplication::translate("ToolForm", "app switch", nullptr));
#endif // QT_CONFIG(tooltip)
        appSwitchBtn->setText(QString());
#if QT_CONFIG(tooltip)
        menuBtn->setToolTip(QCoreApplication::translate("ToolForm", "menu", nullptr));
#endif // QT_CONFIG(tooltip)
        menuBtn->setText(QString());
#if QT_CONFIG(tooltip)
        returnBtn->setToolTip(QCoreApplication::translate("ToolForm", "return", nullptr));
#endif // QT_CONFIG(tooltip)
        returnBtn->setText(QString());
#if QT_CONFIG(tooltip)
        homeBtn->setToolTip(QCoreApplication::translate("ToolForm", "home", nullptr));
#endif // QT_CONFIG(tooltip)
        homeBtn->setText(QString());
#if QT_CONFIG(tooltip)
        screenShotBtn->setToolTip(QCoreApplication::translate("ToolForm", "screen shot", nullptr));
#endif // QT_CONFIG(tooltip)
        screenShotBtn->setText(QString());
    } // retranslateUi

};

namespace Ui {
    class ToolForm: public Ui_ToolForm {};
} // namespace Ui

QT_END_NAMESPACE

#endif // UI_TOOLFORM_H
