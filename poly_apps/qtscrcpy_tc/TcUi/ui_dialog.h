/********************************************************************************
** Form generated from reading UI file 'dialog.ui'
**
** Created by: Qt User Interface Compiler version 6.10.1
**
** WARNING! All changes made in this file will be lost when recompiling UI file!
********************************************************************************/

#ifndef UI_DIALOG_H
#define UI_DIALOG_H

#include <QtCore/QVariant>
#include <QtWidgets/QApplication>
#include <QtWidgets/QCheckBox>
#include <QtWidgets/QComboBox>
#include <QtWidgets/QDialog>
#include <QtWidgets/QGridLayout>
#include <QtWidgets/QGroupBox>
#include <QtWidgets/QHBoxLayout>
#include <QtWidgets/QLabel>
#include <QtWidgets/QLineEdit>
#include <QtWidgets/QPushButton>
#include <QtWidgets/QSpacerItem>
#include <QtWidgets/QTextEdit>
#include <QtWidgets/QVBoxLayout>
#include <QtWidgets/QWidget>

QT_BEGIN_NAMESPACE

class Ui_Dialog
{
public:
    QVBoxLayout *verticalLayout_2;
    QGroupBox *configGroupBox;
    QVBoxLayout *verticalLayout_3;
    QWidget *configWidget1;
    QHBoxLayout *horizontalLayout_5;
    QLabel *label_3;
    QComboBox *bitRateBox;
    QLabel *label_4;
    QComboBox *maxSizeBox;
    QLabel *label_6;
    QComboBox *formatBox;
    QWidget *configWidget5;
    QHBoxLayout *horizontalLayout_7;
    QLabel *label_8;
    QComboBox *lockOrientationBox;
    QSpacerItem *horizontalSpacer;
    QWidget *configWidget2;
    QHBoxLayout *horizontalLayout_6;
    QLabel *label_5;
    QLineEdit *recordPathEdt;
    QPushButton *selectRecordPathBtn;
    QWidget *configWidget4;
    QHBoxLayout *horizontalLayout_8;
    QComboBox *gameBox;
    QPushButton *refreshGameScriptBtn;
    QPushButton *applyScriptBtn;
    QWidget *configWidget3;
    QGridLayout *gridLayout;
    QCheckBox *closeScreenCheck;
    QCheckBox *framelessCheck;
    QCheckBox *notDisplayCheck;
    QCheckBox *useReverseCheck;
    QCheckBox *recordScreenCheck;
    QCheckBox *fpsCheck;
    QCheckBox *stayAwakeCheck;
    QGroupBox *usbGroupBox;
    QVBoxLayout *verticalLayout;
    QHBoxLayout *horizontalLayout_10;
    QWidget *usbWidget1;
    QHBoxLayout *horizontalLayout_3;
    QWidget *usbWidget2;
    QHBoxLayout *horizontalLayout_4;
    QPushButton *updateDevice;
    QSpacerItem *horizontalSpacer_2;
    QGroupBox *wirelessGroupBox;
    QHBoxLayout *horizontalLayout;
    QLineEdit *deviceIpEdt;
    QLabel *label;
    QLineEdit *devicePortEdt;
    QPushButton *wirelessConnectBtn;
    QPushButton *wirelessDisConnectBtn;
    QGroupBox *adbGroupBox;
    QHBoxLayout *horizontalLayout_2;
    QLabel *label_7;
    QLineEdit *adbCommandEdt;
    QPushButton *adbCommandBtn;
    QPushButton *stopAdbBtn;
    QPushButton *clearOut;
    QTextEdit *outEdit;

    void setupUi(QDialog *Dialog)
    {
        if (Dialog->objectName().isEmpty())
            Dialog->setObjectName("Dialog");
        Dialog->resize(500, 451);
        Dialog->setMinimumSize(QSize(500, 0));
        Dialog->setMaximumSize(QSize(500, 16777215));
        Dialog->setWindowTitle(QString::fromUtf8("QtScrcpy"));
        verticalLayout_2 = new QVBoxLayout(Dialog);
        verticalLayout_2->setSpacing(3);
        verticalLayout_2->setContentsMargins(11, 11, 11, 11);
        verticalLayout_2->setObjectName("verticalLayout_2");
        verticalLayout_2->setContentsMargins(4, 4, 4, 4);
        configGroupBox = new QGroupBox(Dialog);
        configGroupBox->setObjectName("configGroupBox");
        verticalLayout_3 = new QVBoxLayout(configGroupBox);
        verticalLayout_3->setSpacing(3);
        verticalLayout_3->setContentsMargins(11, 11, 11, 11);
        verticalLayout_3->setObjectName("verticalLayout_3");
        verticalLayout_3->setContentsMargins(5, 2, 5, 2);
        configWidget1 = new QWidget(configGroupBox);
        configWidget1->setObjectName("configWidget1");
        horizontalLayout_5 = new QHBoxLayout(configWidget1);
        horizontalLayout_5->setSpacing(6);
        horizontalLayout_5->setContentsMargins(11, 11, 11, 11);
        horizontalLayout_5->setObjectName("horizontalLayout_5");
        horizontalLayout_5->setContentsMargins(0, 0, 0, 0);
        label_3 = new QLabel(configWidget1);
        label_3->setObjectName("label_3");

        horizontalLayout_5->addWidget(label_3);

        bitRateBox = new QComboBox(configWidget1);
        bitRateBox->setObjectName("bitRateBox");

        horizontalLayout_5->addWidget(bitRateBox);

        label_4 = new QLabel(configWidget1);
        label_4->setObjectName("label_4");

        horizontalLayout_5->addWidget(label_4);

        maxSizeBox = new QComboBox(configWidget1);
        maxSizeBox->setObjectName("maxSizeBox");

        horizontalLayout_5->addWidget(maxSizeBox);

        label_6 = new QLabel(configWidget1);
        label_6->setObjectName("label_6");

        horizontalLayout_5->addWidget(label_6);

        formatBox = new QComboBox(configWidget1);
        formatBox->setObjectName("formatBox");

        horizontalLayout_5->addWidget(formatBox);


        verticalLayout_3->addWidget(configWidget1);

        configWidget5 = new QWidget(configGroupBox);
        configWidget5->setObjectName("configWidget5");
        horizontalLayout_7 = new QHBoxLayout(configWidget5);
        horizontalLayout_7->setSpacing(6);
        horizontalLayout_7->setContentsMargins(11, 11, 11, 11);
        horizontalLayout_7->setObjectName("horizontalLayout_7");
        horizontalLayout_7->setContentsMargins(0, 0, 0, 0);
        label_8 = new QLabel(configWidget5);
        label_8->setObjectName("label_8");

        horizontalLayout_7->addWidget(label_8);

        lockOrientationBox = new QComboBox(configWidget5);
        lockOrientationBox->setObjectName("lockOrientationBox");

        horizontalLayout_7->addWidget(lockOrientationBox);

        horizontalSpacer = new QSpacerItem(40, 20, QSizePolicy::Policy::Expanding, QSizePolicy::Policy::Minimum);

        horizontalLayout_7->addItem(horizontalSpacer);


        verticalLayout_3->addWidget(configWidget5);

        configWidget2 = new QWidget(configGroupBox);
        configWidget2->setObjectName("configWidget2");
        horizontalLayout_6 = new QHBoxLayout(configWidget2);
        horizontalLayout_6->setSpacing(6);
        horizontalLayout_6->setContentsMargins(11, 11, 11, 11);
        horizontalLayout_6->setObjectName("horizontalLayout_6");
        horizontalLayout_6->setContentsMargins(0, 0, 0, 0);
        label_5 = new QLabel(configWidget2);
        label_5->setObjectName("label_5");

        horizontalLayout_6->addWidget(label_5);

        recordPathEdt = new QLineEdit(configWidget2);
        recordPathEdt->setObjectName("recordPathEdt");
        recordPathEdt->setReadOnly(true);

        horizontalLayout_6->addWidget(recordPathEdt);

        selectRecordPathBtn = new QPushButton(configWidget2);
        selectRecordPathBtn->setObjectName("selectRecordPathBtn");
        selectRecordPathBtn->setAutoDefault(false);

        horizontalLayout_6->addWidget(selectRecordPathBtn);


        verticalLayout_3->addWidget(configWidget2);

        configWidget4 = new QWidget(configGroupBox);
        configWidget4->setObjectName("configWidget4");
        horizontalLayout_8 = new QHBoxLayout(configWidget4);
        horizontalLayout_8->setSpacing(6);
        horizontalLayout_8->setContentsMargins(11, 11, 11, 11);
        horizontalLayout_8->setObjectName("horizontalLayout_8");
        horizontalLayout_8->setContentsMargins(0, 0, 0, 0);
        gameBox = new QComboBox(configWidget4);
        gameBox->setObjectName("gameBox");
        QSizePolicy sizePolicy(QSizePolicy::Policy::Expanding, QSizePolicy::Policy::Fixed);
        sizePolicy.setHorizontalStretch(0);
        sizePolicy.setVerticalStretch(0);
        sizePolicy.setHeightForWidth(gameBox->sizePolicy().hasHeightForWidth());
        gameBox->setSizePolicy(sizePolicy);

        horizontalLayout_8->addWidget(gameBox);

        refreshGameScriptBtn = new QPushButton(configWidget4);
        refreshGameScriptBtn->setObjectName("refreshGameScriptBtn");

        horizontalLayout_8->addWidget(refreshGameScriptBtn);

        applyScriptBtn = new QPushButton(configWidget4);
        applyScriptBtn->setObjectName("applyScriptBtn");

        horizontalLayout_8->addWidget(applyScriptBtn);


        verticalLayout_3->addWidget(configWidget4);

        configWidget3 = new QWidget(configGroupBox);
        configWidget3->setObjectName("configWidget3");
        gridLayout = new QGridLayout(configWidget3);
        gridLayout->setSpacing(6);
        gridLayout->setContentsMargins(11, 11, 11, 11);
        gridLayout->setObjectName("gridLayout");
        gridLayout->setContentsMargins(0, 0, 0, 0);
        closeScreenCheck = new QCheckBox(configWidget3);
        closeScreenCheck->setObjectName("closeScreenCheck");
        sizePolicy.setHeightForWidth(closeScreenCheck->sizePolicy().hasHeightForWidth());
        closeScreenCheck->setSizePolicy(sizePolicy);

        gridLayout->addWidget(closeScreenCheck, 1, 1, 1, 1);

        framelessCheck = new QCheckBox(configWidget3);
        framelessCheck->setObjectName("framelessCheck");

        gridLayout->addWidget(framelessCheck, 1, 3, 1, 1);

        notDisplayCheck = new QCheckBox(configWidget3);
        notDisplayCheck->setObjectName("notDisplayCheck");
        sizePolicy.setHeightForWidth(notDisplayCheck->sizePolicy().hasHeightForWidth());
        notDisplayCheck->setSizePolicy(sizePolicy);
        notDisplayCheck->setCheckable(false);

        gridLayout->addWidget(notDisplayCheck, 0, 1, 1, 1);

        useReverseCheck = new QCheckBox(configWidget3);
        useReverseCheck->setObjectName("useReverseCheck");
        sizePolicy.setHeightForWidth(useReverseCheck->sizePolicy().hasHeightForWidth());
        useReverseCheck->setSizePolicy(sizePolicy);
        useReverseCheck->setChecked(true);

        gridLayout->addWidget(useReverseCheck, 0, 3, 1, 1);

        recordScreenCheck = new QCheckBox(configWidget3);
        recordScreenCheck->setObjectName("recordScreenCheck");

        gridLayout->addWidget(recordScreenCheck, 0, 0, 1, 1);

        fpsCheck = new QCheckBox(configWidget3);
        fpsCheck->setObjectName("fpsCheck");

        gridLayout->addWidget(fpsCheck, 0, 4, 1, 1);

        stayAwakeCheck = new QCheckBox(configWidget3);
        stayAwakeCheck->setObjectName("stayAwakeCheck");

        gridLayout->addWidget(stayAwakeCheck, 1, 4, 1, 1);


        verticalLayout_3->addWidget(configWidget3);


        verticalLayout_2->addWidget(configGroupBox);

        usbGroupBox = new QGroupBox(Dialog);
        usbGroupBox->setObjectName("usbGroupBox");
        verticalLayout = new QVBoxLayout(usbGroupBox);
        verticalLayout->setSpacing(6);
        verticalLayout->setContentsMargins(11, 11, 11, 11);
        verticalLayout->setObjectName("verticalLayout");
        verticalLayout->setContentsMargins(-1, 2, -1, 2);
        horizontalLayout_10 = new QHBoxLayout();
        horizontalLayout_10->setSpacing(6);
        horizontalLayout_10->setObjectName("horizontalLayout_10");

        verticalLayout->addLayout(horizontalLayout_10);

        usbWidget1 = new QWidget(usbGroupBox);
        usbWidget1->setObjectName("usbWidget1");
        horizontalLayout_3 = new QHBoxLayout(usbWidget1);
        horizontalLayout_3->setSpacing(6);
        horizontalLayout_3->setContentsMargins(11, 11, 11, 11);
        horizontalLayout_3->setObjectName("horizontalLayout_3");
        horizontalLayout_3->setContentsMargins(0, 0, 0, 0);

        verticalLayout->addWidget(usbWidget1);

        usbWidget2 = new QWidget(usbGroupBox);
        usbWidget2->setObjectName("usbWidget2");
        horizontalLayout_4 = new QHBoxLayout(usbWidget2);
        horizontalLayout_4->setSpacing(6);
        horizontalLayout_4->setContentsMargins(11, 11, 11, 11);
        horizontalLayout_4->setObjectName("horizontalLayout_4");
        horizontalLayout_4->setContentsMargins(0, 0, 0, 0);
        updateDevice = new QPushButton(usbWidget2);
        updateDevice->setObjectName("updateDevice");
        updateDevice->setAutoDefault(false);

        horizontalLayout_4->addWidget(updateDevice);

        horizontalSpacer_2 = new QSpacerItem(40, 20, QSizePolicy::Policy::Expanding, QSizePolicy::Policy::Minimum);

        horizontalLayout_4->addItem(horizontalSpacer_2);


        verticalLayout->addWidget(usbWidget2);


        verticalLayout_2->addWidget(usbGroupBox);

        wirelessGroupBox = new QGroupBox(Dialog);
        wirelessGroupBox->setObjectName("wirelessGroupBox");
        horizontalLayout = new QHBoxLayout(wirelessGroupBox);
        horizontalLayout->setSpacing(3);
        horizontalLayout->setContentsMargins(11, 11, 11, 11);
        horizontalLayout->setObjectName("horizontalLayout");
        horizontalLayout->setContentsMargins(5, 2, 5, 2);
        deviceIpEdt = new QLineEdit(wirelessGroupBox);
        deviceIpEdt->setObjectName("deviceIpEdt");
        deviceIpEdt->setMaxLength(128);
        deviceIpEdt->setPlaceholderText(QString::fromUtf8("192.168.0.1"));

        horizontalLayout->addWidget(deviceIpEdt);

        label = new QLabel(wirelessGroupBox);
        label->setObjectName("label");
        label->setMinimumSize(QSize(5, 0));
        label->setMaximumSize(QSize(5, 16777215));
        label->setText(QString::fromUtf8(":"));

        horizontalLayout->addWidget(label);

        devicePortEdt = new QLineEdit(wirelessGroupBox);
        devicePortEdt->setObjectName("devicePortEdt");
        QSizePolicy sizePolicy1(QSizePolicy::Policy::Maximum, QSizePolicy::Policy::Fixed);
        sizePolicy1.setHorizontalStretch(0);
        sizePolicy1.setVerticalStretch(0);
        sizePolicy1.setHeightForWidth(devicePortEdt->sizePolicy().hasHeightForWidth());
        devicePortEdt->setSizePolicy(sizePolicy1);
        devicePortEdt->setMaximumSize(QSize(60, 16777215));
        devicePortEdt->setMaxLength(6);
        devicePortEdt->setPlaceholderText(QString::fromUtf8("5555"));

        horizontalLayout->addWidget(devicePortEdt);

        wirelessConnectBtn = new QPushButton(wirelessGroupBox);
        wirelessConnectBtn->setObjectName("wirelessConnectBtn");
        QSizePolicy sizePolicy2(QSizePolicy::Policy::Minimum, QSizePolicy::Policy::Fixed);
        sizePolicy2.setHorizontalStretch(0);
        sizePolicy2.setVerticalStretch(0);
        sizePolicy2.setHeightForWidth(wirelessConnectBtn->sizePolicy().hasHeightForWidth());
        wirelessConnectBtn->setSizePolicy(sizePolicy2);
        wirelessConnectBtn->setAutoDefault(false);

        horizontalLayout->addWidget(wirelessConnectBtn);

        wirelessDisConnectBtn = new QPushButton(wirelessGroupBox);
        wirelessDisConnectBtn->setObjectName("wirelessDisConnectBtn");
        sizePolicy2.setHeightForWidth(wirelessDisConnectBtn->sizePolicy().hasHeightForWidth());
        wirelessDisConnectBtn->setSizePolicy(sizePolicy2);
        wirelessDisConnectBtn->setAutoDefault(false);

        horizontalLayout->addWidget(wirelessDisConnectBtn);


        verticalLayout_2->addWidget(wirelessGroupBox);

        adbGroupBox = new QGroupBox(Dialog);
        adbGroupBox->setObjectName("adbGroupBox");
        adbGroupBox->setTitle(QString::fromUtf8("adb"));
        horizontalLayout_2 = new QHBoxLayout(adbGroupBox);
        horizontalLayout_2->setSpacing(3);
        horizontalLayout_2->setContentsMargins(11, 11, 11, 11);
        horizontalLayout_2->setObjectName("horizontalLayout_2");
        horizontalLayout_2->setContentsMargins(5, 2, 5, 2);
        label_7 = new QLabel(adbGroupBox);
        label_7->setObjectName("label_7");

        horizontalLayout_2->addWidget(label_7);

        adbCommandEdt = new QLineEdit(adbGroupBox);
        adbCommandEdt->setObjectName("adbCommandEdt");
        adbCommandEdt->setText(QString::fromUtf8("devices"));

        horizontalLayout_2->addWidget(adbCommandEdt);

        adbCommandBtn = new QPushButton(adbGroupBox);
        adbCommandBtn->setObjectName("adbCommandBtn");
        sizePolicy2.setHeightForWidth(adbCommandBtn->sizePolicy().hasHeightForWidth());
        adbCommandBtn->setSizePolicy(sizePolicy2);

        horizontalLayout_2->addWidget(adbCommandBtn);

        stopAdbBtn = new QPushButton(adbGroupBox);
        stopAdbBtn->setObjectName("stopAdbBtn");
        sizePolicy2.setHeightForWidth(stopAdbBtn->sizePolicy().hasHeightForWidth());
        stopAdbBtn->setSizePolicy(sizePolicy2);

        horizontalLayout_2->addWidget(stopAdbBtn);

        clearOut = new QPushButton(adbGroupBox);
        clearOut->setObjectName("clearOut");
        sizePolicy2.setHeightForWidth(clearOut->sizePolicy().hasHeightForWidth());
        clearOut->setSizePolicy(sizePolicy2);

        horizontalLayout_2->addWidget(clearOut);


        verticalLayout_2->addWidget(adbGroupBox);

        outEdit = new QTextEdit(Dialog);
        outEdit->setObjectName("outEdit");
        outEdit->setMinimumSize(QSize(0, 140));
        outEdit->setFocusPolicy(Qt::ClickFocus);
        outEdit->setReadOnly(true);

        verticalLayout_2->addWidget(outEdit);

#if QT_CONFIG(shortcut)
        label_5->setBuddy(recordPathEdt);
        label_7->setBuddy(adbCommandEdt);
#endif // QT_CONFIG(shortcut)
        QWidget::setTabOrder(deviceIpEdt, devicePortEdt);
        QWidget::setTabOrder(devicePortEdt, wirelessConnectBtn);
        QWidget::setTabOrder(wirelessConnectBtn, wirelessDisConnectBtn);
        QWidget::setTabOrder(wirelessDisConnectBtn, adbCommandEdt);
        QWidget::setTabOrder(adbCommandEdt, adbCommandBtn);
        QWidget::setTabOrder(adbCommandBtn, stopAdbBtn);
        QWidget::setTabOrder(stopAdbBtn, clearOut);

        retranslateUi(Dialog);

        QMetaObject::connectSlotsByName(Dialog);
    } // setupUi

    void retranslateUi(QDialog *Dialog)
    {
        configGroupBox->setTitle(QCoreApplication::translate("Dialog", "Start Config", nullptr));
        label_3->setText(QCoreApplication::translate("Dialog", "bit rate:", nullptr));
#if QT_CONFIG(tooltip)
        bitRateBox->setToolTip(QString());
#endif // QT_CONFIG(tooltip)
        bitRateBox->setCurrentText(QString());
        label_4->setText(QCoreApplication::translate("Dialog", "max size:", nullptr));
#if QT_CONFIG(tooltip)
        maxSizeBox->setToolTip(QString());
#endif // QT_CONFIG(tooltip)
        label_6->setText(QCoreApplication::translate("Dialog", "record format\357\274\232", nullptr));
        label_8->setText(QCoreApplication::translate("Dialog", "lock orientation:", nullptr));
        label_5->setText(QCoreApplication::translate("Dialog", "record save path:", nullptr));
        selectRecordPathBtn->setText(QCoreApplication::translate("Dialog", "select path", nullptr));
        refreshGameScriptBtn->setText(QCoreApplication::translate("Dialog", "refresh script", nullptr));
        applyScriptBtn->setText(QCoreApplication::translate("Dialog", "apply", nullptr));
        closeScreenCheck->setText(QCoreApplication::translate("Dialog", "screen-off", nullptr));
        framelessCheck->setText(QCoreApplication::translate("Dialog", "frameless", nullptr));
        notDisplayCheck->setText(QCoreApplication::translate("Dialog", "background record", nullptr));
        useReverseCheck->setText(QCoreApplication::translate("Dialog", "reverse connection", nullptr));
        recordScreenCheck->setText(QCoreApplication::translate("Dialog", "record screen", nullptr));
        fpsCheck->setText(QCoreApplication::translate("Dialog", "show fps", nullptr));
        stayAwakeCheck->setText(QCoreApplication::translate("Dialog", "stay awake", nullptr));
        usbGroupBox->setTitle(QCoreApplication::translate("Dialog", "USB line", nullptr));
        updateDevice->setText(QCoreApplication::translate("Dialog", "refresh devices", nullptr));
        wirelessGroupBox->setTitle(QCoreApplication::translate("Dialog", "Wireless", nullptr));
        deviceIpEdt->setText(QString());
        devicePortEdt->setText(QString());
        wirelessConnectBtn->setText(QCoreApplication::translate("Dialog", "wireless connect", nullptr));
        wirelessDisConnectBtn->setText(QCoreApplication::translate("Dialog", "wireless disconnect", nullptr));
        label_7->setText(QCoreApplication::translate("Dialog", "adb command:", nullptr));
        adbCommandBtn->setText(QCoreApplication::translate("Dialog", "execute", nullptr));
        stopAdbBtn->setText(QCoreApplication::translate("Dialog", "terminate", nullptr));
        clearOut->setText(QCoreApplication::translate("Dialog", "clear", nullptr));
        outEdit->setDocumentTitle(QString());
        (void)Dialog;
    } // retranslateUi

};

namespace Ui {
    class Dialog: public Ui_Dialog {};
} // namespace Ui

QT_END_NAMESPACE

#endif // UI_DIALOG_H
