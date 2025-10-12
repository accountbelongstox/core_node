/****************************************************************************
** Meta object code from reading C++ file 'toolform.h'
**
** Created by: The Qt Meta Object Compiler version 69 (Qt 6.9.3)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "../../../../QtScrcpy/ui/toolform.h"
#include <QtCore/qmetatype.h>

#include <QtCore/qtmochelpers.h>

#include <memory>


#include <QtCore/qxptype_traits.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'toolform.h' doesn't include <QObject>."
#elif Q_MOC_OUTPUT_REVISION != 69
#error "This file was generated using the moc from 6.9.3. It"
#error "cannot be used with the include files from this version of Qt."
#error "(The moc has changed too much.)"
#endif

#ifndef Q_CONSTINIT
#define Q_CONSTINIT
#endif

QT_WARNING_PUSH
QT_WARNING_DISABLE_DEPRECATED
QT_WARNING_DISABLE_GCC("-Wuseless-cast")
namespace {
struct qt_meta_tag_ZN8ToolFormE_t {};
} // unnamed namespace

template <> constexpr inline auto ToolForm::qt_create_metaobjectdata<qt_meta_tag_ZN8ToolFormE_t>()
{
    namespace QMC = QtMocConstants;
    QtMocHelpers::StringRefStorage qt_stringData {
        "ToolForm",
        "on_fullScreenBtn_clicked",
        "",
        "on_returnBtn_clicked",
        "on_homeBtn_clicked",
        "on_menuBtn_clicked",
        "on_appSwitchBtn_clicked",
        "on_powerBtn_clicked",
        "on_screenShotBtn_clicked",
        "on_volumeUpBtn_clicked",
        "on_volumeDownBtn_clicked",
        "on_closeScreenBtn_clicked",
        "on_expandNotifyBtn_clicked",
        "on_touchBtn_clicked",
        "on_groupControlBtn_clicked",
        "on_openScreenBtn_clicked"
    };

    QtMocHelpers::UintData qt_methods {
        // Slot 'on_fullScreenBtn_clicked'
        QtMocHelpers::SlotData<void()>(1, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_returnBtn_clicked'
        QtMocHelpers::SlotData<void()>(3, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_homeBtn_clicked'
        QtMocHelpers::SlotData<void()>(4, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_menuBtn_clicked'
        QtMocHelpers::SlotData<void()>(5, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_appSwitchBtn_clicked'
        QtMocHelpers::SlotData<void()>(6, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_powerBtn_clicked'
        QtMocHelpers::SlotData<void()>(7, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_screenShotBtn_clicked'
        QtMocHelpers::SlotData<void()>(8, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_volumeUpBtn_clicked'
        QtMocHelpers::SlotData<void()>(9, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_volumeDownBtn_clicked'
        QtMocHelpers::SlotData<void()>(10, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_closeScreenBtn_clicked'
        QtMocHelpers::SlotData<void()>(11, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_expandNotifyBtn_clicked'
        QtMocHelpers::SlotData<void()>(12, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_touchBtn_clicked'
        QtMocHelpers::SlotData<void()>(13, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_groupControlBtn_clicked'
        QtMocHelpers::SlotData<void()>(14, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_openScreenBtn_clicked'
        QtMocHelpers::SlotData<void()>(15, 2, QMC::AccessPrivate, QMetaType::Void),
    };
    QtMocHelpers::UintData qt_properties {
    };
    QtMocHelpers::UintData qt_enums {
    };
    return QtMocHelpers::metaObjectData<ToolForm, qt_meta_tag_ZN8ToolFormE_t>(QMC::MetaObjectFlag{}, qt_stringData,
            qt_methods, qt_properties, qt_enums);
}
Q_CONSTINIT const QMetaObject ToolForm::staticMetaObject = { {
    QMetaObject::SuperData::link<MagneticWidget::staticMetaObject>(),
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN8ToolFormE_t>.stringdata,
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN8ToolFormE_t>.data,
    qt_static_metacall,
    nullptr,
    qt_staticMetaObjectRelocatingContent<qt_meta_tag_ZN8ToolFormE_t>.metaTypes,
    nullptr
} };

void ToolForm::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    auto *_t = static_cast<ToolForm *>(_o);
    if (_c == QMetaObject::InvokeMetaMethod) {
        switch (_id) {
        case 0: _t->on_fullScreenBtn_clicked(); break;
        case 1: _t->on_returnBtn_clicked(); break;
        case 2: _t->on_homeBtn_clicked(); break;
        case 3: _t->on_menuBtn_clicked(); break;
        case 4: _t->on_appSwitchBtn_clicked(); break;
        case 5: _t->on_powerBtn_clicked(); break;
        case 6: _t->on_screenShotBtn_clicked(); break;
        case 7: _t->on_volumeUpBtn_clicked(); break;
        case 8: _t->on_volumeDownBtn_clicked(); break;
        case 9: _t->on_closeScreenBtn_clicked(); break;
        case 10: _t->on_expandNotifyBtn_clicked(); break;
        case 11: _t->on_touchBtn_clicked(); break;
        case 12: _t->on_groupControlBtn_clicked(); break;
        case 13: _t->on_openScreenBtn_clicked(); break;
        default: ;
        }
    }
    (void)_a;
}

const QMetaObject *ToolForm::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *ToolForm::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_staticMetaObjectStaticContent<qt_meta_tag_ZN8ToolFormE_t>.strings))
        return static_cast<void*>(this);
    return MagneticWidget::qt_metacast(_clname);
}

int ToolForm::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = MagneticWidget::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        if (_id < 14)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 14;
    }
    if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        if (_id < 14)
            *reinterpret_cast<QMetaType *>(_a[0]) = QMetaType();
        _id -= 14;
    }
    return _id;
}
QT_WARNING_POP
