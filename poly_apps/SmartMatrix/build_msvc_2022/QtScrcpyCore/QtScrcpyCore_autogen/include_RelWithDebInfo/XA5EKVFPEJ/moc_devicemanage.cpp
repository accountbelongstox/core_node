/****************************************************************************
** Meta object code from reading C++ file 'devicemanage.h'
**
** Created by: The Qt Meta Object Compiler version 69 (Qt 6.9.3)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "../../../../../QtScrcpy/QtScrcpyCore/src/devicemanage/devicemanage.h"
#include <QtCore/qmetatype.h>

#include <QtCore/qtmochelpers.h>

#include <memory>


#include <QtCore/qxptype_traits.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'devicemanage.h' doesn't include <QObject>."
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
struct qt_meta_tag_ZN3qsc12DeviceManageE_t {};
} // unnamed namespace

template <> constexpr inline auto qsc::DeviceManage::qt_create_metaobjectdata<qt_meta_tag_ZN3qsc12DeviceManageE_t>()
{
    namespace QMC = QtMocConstants;
    QtMocHelpers::StringRefStorage qt_stringData {
        "qsc::DeviceManage",
        "onDeviceConnected",
        "",
        "success",
        "serial",
        "deviceName",
        "size",
        "onDeviceDisconnected"
    };

    QtMocHelpers::UintData qt_methods {
        // Slot 'onDeviceConnected'
        QtMocHelpers::SlotData<void(bool, const QString &, const QString &, const QSize &)>(1, 2, QMC::AccessProtected, QMetaType::Void, {{
            { QMetaType::Bool, 3 }, { QMetaType::QString, 4 }, { QMetaType::QString, 5 }, { QMetaType::QSize, 6 },
        }}),
        // Slot 'onDeviceDisconnected'
        QtMocHelpers::SlotData<void(QString)>(7, 2, QMC::AccessProtected, QMetaType::Void, {{
            { QMetaType::QString, 4 },
        }}),
    };
    QtMocHelpers::UintData qt_properties {
    };
    QtMocHelpers::UintData qt_enums {
    };
    return QtMocHelpers::metaObjectData<DeviceManage, qt_meta_tag_ZN3qsc12DeviceManageE_t>(QMC::MetaObjectFlag{}, qt_stringData,
            qt_methods, qt_properties, qt_enums);
}
Q_CONSTINIT const QMetaObject qsc::DeviceManage::staticMetaObject = { {
    QMetaObject::SuperData::link<IDeviceManage::staticMetaObject>(),
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN3qsc12DeviceManageE_t>.stringdata,
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN3qsc12DeviceManageE_t>.data,
    qt_static_metacall,
    nullptr,
    qt_staticMetaObjectRelocatingContent<qt_meta_tag_ZN3qsc12DeviceManageE_t>.metaTypes,
    nullptr
} };

void qsc::DeviceManage::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    auto *_t = static_cast<DeviceManage *>(_o);
    if (_c == QMetaObject::InvokeMetaMethod) {
        switch (_id) {
        case 0: _t->onDeviceConnected((*reinterpret_cast< std::add_pointer_t<bool>>(_a[1])),(*reinterpret_cast< std::add_pointer_t<QString>>(_a[2])),(*reinterpret_cast< std::add_pointer_t<QString>>(_a[3])),(*reinterpret_cast< std::add_pointer_t<QSize>>(_a[4]))); break;
        case 1: _t->onDeviceDisconnected((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1]))); break;
        default: ;
        }
    }
}

const QMetaObject *qsc::DeviceManage::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *qsc::DeviceManage::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_staticMetaObjectStaticContent<qt_meta_tag_ZN3qsc12DeviceManageE_t>.strings))
        return static_cast<void*>(this);
    return IDeviceManage::qt_metacast(_clname);
}

int qsc::DeviceManage::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = IDeviceManage::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        if (_id < 2)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 2;
    }
    if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        if (_id < 2)
            *reinterpret_cast<QMetaType *>(_a[0]) = QMetaType();
        _id -= 2;
    }
    return _id;
}
QT_WARNING_POP
