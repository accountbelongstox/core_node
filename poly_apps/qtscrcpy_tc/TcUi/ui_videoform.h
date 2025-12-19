/********************************************************************************
** Form generated from reading UI file 'videoform.ui'
**
** Created by: Qt User Interface Compiler version 6.10.1
**
** WARNING! All changes made in this file will be lost when recompiling UI file!
********************************************************************************/

#ifndef UI_VIDEOFORM_H
#define UI_VIDEOFORM_H

#include <QtCore/QVariant>
#include <QtWidgets/QApplication>
#include <QtWidgets/QHBoxLayout>
#include <QtWidgets/QLabel>
#include <QtWidgets/QVBoxLayout>
#include <QtWidgets/QWidget>
#include <keepratiowidget.h>

QT_BEGIN_NAMESPACE

class Ui_videoForm
{
public:
    QVBoxLayout *verticalLayout;
    KeepRatioWidget *keepRatioWidget;
    QWidget *widget;
    QHBoxLayout *horizontalLayout;
    QLabel *nicknameLabel;
    QLabel *nameLabel;
    QLabel *serialLabel;

    void setupUi(QWidget *videoForm)
    {
        if (videoForm->objectName().isEmpty())
            videoForm->setObjectName("videoForm");
        videoForm->resize(300, 800);
        videoForm->setAcceptDrops(true);
        videoForm->setStyleSheet(QString::fromUtf8("#videoForm {\n"
"	border-image: url(:/res/phone-v.png) 150px 142px 85px 142px;\n"
"	border-width: 150px 142px 85px 142px;\n"
"}"));
        verticalLayout = new QVBoxLayout(videoForm);
        verticalLayout->setSpacing(0);
        verticalLayout->setObjectName("verticalLayout");
        verticalLayout->setContentsMargins(0, 0, 0, 0);
        keepRatioWidget = new KeepRatioWidget(videoForm);
        keepRatioWidget->setObjectName("keepRatioWidget");

        verticalLayout->addWidget(keepRatioWidget);

        widget = new QWidget(videoForm);
        widget->setObjectName("widget");
        widget->setEnabled(true);
        horizontalLayout = new QHBoxLayout(widget);
        horizontalLayout->setObjectName("horizontalLayout");
        nicknameLabel = new QLabel(widget);
        nicknameLabel->setObjectName("nicknameLabel");

        horizontalLayout->addWidget(nicknameLabel);

        nameLabel = new QLabel(widget);
        nameLabel->setObjectName("nameLabel");

        horizontalLayout->addWidget(nameLabel);

        serialLabel = new QLabel(widget);
        serialLabel->setObjectName("serialLabel");

        horizontalLayout->addWidget(serialLabel);


        verticalLayout->addWidget(widget);

        verticalLayout->setStretch(0, 30);
        verticalLayout->setStretch(1, 1);

        retranslateUi(videoForm);

        QMetaObject::connectSlotsByName(videoForm);
    } // setupUi

    void retranslateUi(QWidget *videoForm)
    {
        videoForm->setWindowTitle(QString());
        nicknameLabel->setText(QCoreApplication::translate("videoForm", "Nickname", nullptr));
        nameLabel->setText(QCoreApplication::translate("videoForm", "Device Name", nullptr));
        serialLabel->setText(QCoreApplication::translate("videoForm", "Serial Number", nullptr));
    } // retranslateUi

};

namespace Ui {
    class videoForm: public Ui_videoForm {};
} // namespace Ui

QT_END_NAMESPACE

#endif // UI_VIDEOFORM_H
