/********************************************************************************
** Form generated from reading UI file 'CustomTreeWidget.ui'
**
** Created by: Qt User Interface Compiler version 6.10.1
**
** WARNING! All changes made in this file will be lost when recompiling UI file!
********************************************************************************/

#ifndef UI_CUSTOMTREEWIDGET_H
#define UI_CUSTOMTREEWIDGET_H

#include <QtCore/QVariant>
#include <QtWidgets/QApplication>
#include <QtWidgets/QWidget>

QT_BEGIN_NAMESPACE

class Ui_CustomTreeWidget
{
public:

    void setupUi(QWidget *CustomTreeWidget)
    {
        if (CustomTreeWidget->objectName().isEmpty())
            CustomTreeWidget->setObjectName("CustomTreeWidget");
        CustomTreeWidget->resize(200, 600);

        retranslateUi(CustomTreeWidget);

        QMetaObject::connectSlotsByName(CustomTreeWidget);
    } // setupUi

    void retranslateUi(QWidget *CustomTreeWidget)
    {
        CustomTreeWidget->setWindowTitle(QCoreApplication::translate("CustomTreeWidget", "CustomTreeWidget", nullptr));
    } // retranslateUi

};

namespace Ui {
    class CustomTreeWidget: public Ui_CustomTreeWidget {};
} // namespace Ui

QT_END_NAMESPACE

#endif // UI_CUSTOMTREEWIDGET_H
