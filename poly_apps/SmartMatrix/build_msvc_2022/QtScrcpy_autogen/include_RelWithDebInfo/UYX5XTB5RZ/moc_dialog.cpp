/****************************************************************************
** Meta object code from reading C++ file 'dialog.h'
**
** Created by: The Qt Meta Object Compiler version 69 (Qt 6.9.3)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "../../../../QtScrcpy/ui/dialog.h"
#include <QtCore/qmetatype.h>

#include <QtCore/qtmochelpers.h>

#include <memory>


#include <QtCore/qxptype_traits.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'dialog.h' doesn't include <QObject>."
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
struct qt_meta_tag_ZN6DialogE_t {};
} // unnamed namespace

template <> constexpr inline auto Dialog::qt_create_metaobjectdata<qt_meta_tag_ZN6DialogE_t>()
{
    namespace QMC = QtMocConstants;
    QtMocHelpers::StringRefStorage qt_stringData {
        "Dialog",
        "onDeviceConnected",
        "",
        "success",
        "serial",
        "deviceName",
        "size",
        "onDeviceDisconnected",
        "on_updateDevice_clicked",
        "on_startServerBtn_clicked",
        "on_stopServerBtn_clicked",
        "on_wirelessConnectBtn_clicked",
        "on_startAdbdBtn_clicked",
        "on_getIPBtn_clicked",
        "on_wirelessDisConnectBtn_clicked",
        "on_selectRecordPathBtn_clicked",
        "on_recordPathEdt_textChanged",
        "arg1",
        "on_adbCommandBtn_clicked",
        "on_stopAdbBtn_clicked",
        "on_clearOut_clicked",
        "on_stopAllServerBtn_clicked",
        "on_refreshGameScriptBtn_clicked",
        "on_applyScriptBtn_clicked",
        "on_recordScreenCheck_clicked",
        "checked",
        "on_usbConnectBtn_clicked",
        "on_wifiConnectBtn_clicked",
        "on_connectedPhoneList_itemDoubleClicked",
        "QListWidgetItem*",
        "item",
        "on_updateNameBtn_clicked",
        "on_useSingleModeCheck_clicked",
        "on_serialBox_currentIndexChanged",
        "on_startAudioBtn_clicked",
        "on_stopAudioBtn_clicked",
        "on_installSndcpyBtn_clicked",
        "on_autoUpdatecheckBox_toggled",
        "showIpEditMenu",
        "pos",
        "on_languageComboBox_currentIndexChanged",
        "language"
    };

    QtMocHelpers::UintData qt_methods {
        // Slot 'onDeviceConnected'
        QtMocHelpers::SlotData<void(bool, const QString &, const QString &, const QSize &)>(1, 2, QMC::AccessPrivate, QMetaType::Void, {{
            { QMetaType::Bool, 3 }, { QMetaType::QString, 4 }, { QMetaType::QString, 5 }, { QMetaType::QSize, 6 },
        }}),
        // Slot 'onDeviceDisconnected'
        QtMocHelpers::SlotData<void(QString)>(7, 2, QMC::AccessPrivate, QMetaType::Void, {{
            { QMetaType::QString, 4 },
        }}),
        // Slot 'on_updateDevice_clicked'
        QtMocHelpers::SlotData<void()>(8, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_startServerBtn_clicked'
        QtMocHelpers::SlotData<void()>(9, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_stopServerBtn_clicked'
        QtMocHelpers::SlotData<void()>(10, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_wirelessConnectBtn_clicked'
        QtMocHelpers::SlotData<void()>(11, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_startAdbdBtn_clicked'
        QtMocHelpers::SlotData<void()>(12, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_getIPBtn_clicked'
        QtMocHelpers::SlotData<void()>(13, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_wirelessDisConnectBtn_clicked'
        QtMocHelpers::SlotData<void()>(14, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_selectRecordPathBtn_clicked'
        QtMocHelpers::SlotData<void()>(15, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_recordPathEdt_textChanged'
        QtMocHelpers::SlotData<void(const QString &)>(16, 2, QMC::AccessPrivate, QMetaType::Void, {{
            { QMetaType::QString, 17 },
        }}),
        // Slot 'on_adbCommandBtn_clicked'
        QtMocHelpers::SlotData<void()>(18, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_stopAdbBtn_clicked'
        QtMocHelpers::SlotData<void()>(19, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_clearOut_clicked'
        QtMocHelpers::SlotData<void()>(20, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_stopAllServerBtn_clicked'
        QtMocHelpers::SlotData<void()>(21, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_refreshGameScriptBtn_clicked'
        QtMocHelpers::SlotData<void()>(22, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_applyScriptBtn_clicked'
        QtMocHelpers::SlotData<void()>(23, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_recordScreenCheck_clicked'
        QtMocHelpers::SlotData<void(bool)>(24, 2, QMC::AccessPrivate, QMetaType::Void, {{
            { QMetaType::Bool, 25 },
        }}),
        // Slot 'on_usbConnectBtn_clicked'
        QtMocHelpers::SlotData<void()>(26, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_wifiConnectBtn_clicked'
        QtMocHelpers::SlotData<void()>(27, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_connectedPhoneList_itemDoubleClicked'
        QtMocHelpers::SlotData<void(QListWidgetItem *)>(28, 2, QMC::AccessPrivate, QMetaType::Void, {{
            { 0x80000000 | 29, 30 },
        }}),
        // Slot 'on_updateNameBtn_clicked'
        QtMocHelpers::SlotData<void()>(31, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_useSingleModeCheck_clicked'
        QtMocHelpers::SlotData<void()>(32, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_serialBox_currentIndexChanged'
        QtMocHelpers::SlotData<void(const QString &)>(33, 2, QMC::AccessPrivate, QMetaType::Void, {{
            { QMetaType::QString, 17 },
        }}),
        // Slot 'on_startAudioBtn_clicked'
        QtMocHelpers::SlotData<void()>(34, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_stopAudioBtn_clicked'
        QtMocHelpers::SlotData<void()>(35, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_installSndcpyBtn_clicked'
        QtMocHelpers::SlotData<void()>(36, 2, QMC::AccessPrivate, QMetaType::Void),
        // Slot 'on_autoUpdatecheckBox_toggled'
        QtMocHelpers::SlotData<void(bool)>(37, 2, QMC::AccessPrivate, QMetaType::Void, {{
            { QMetaType::Bool, 25 },
        }}),
        // Slot 'showIpEditMenu'
        QtMocHelpers::SlotData<void(const QPoint &)>(38, 2, QMC::AccessPrivate, QMetaType::Void, {{
            { QMetaType::QPoint, 39 },
        }}),
        // Slot 'on_languageComboBox_currentIndexChanged'
        QtMocHelpers::SlotData<void(const QString &)>(40, 2, QMC::AccessPrivate, QMetaType::Void, {{
            { QMetaType::QString, 41 },
        }}),
    };
    QtMocHelpers::UintData qt_properties {
    };
    QtMocHelpers::UintData qt_enums {
    };
    return QtMocHelpers::metaObjectData<Dialog, qt_meta_tag_ZN6DialogE_t>(QMC::MetaObjectFlag{}, qt_stringData,
            qt_methods, qt_properties, qt_enums);
}
Q_CONSTINIT const QMetaObject Dialog::staticMetaObject = { {
    QMetaObject::SuperData::link<QWidget::staticMetaObject>(),
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN6DialogE_t>.stringdata,
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN6DialogE_t>.data,
    qt_static_metacall,
    nullptr,
    qt_staticMetaObjectRelocatingContent<qt_meta_tag_ZN6DialogE_t>.metaTypes,
    nullptr
} };

void Dialog::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    auto *_t = static_cast<Dialog *>(_o);
    if (_c == QMetaObject::InvokeMetaMethod) {
        switch (_id) {
        case 0: _t->onDeviceConnected((*reinterpret_cast< std::add_pointer_t<bool>>(_a[1])),(*reinterpret_cast< std::add_pointer_t<QString>>(_a[2])),(*reinterpret_cast< std::add_pointer_t<QString>>(_a[3])),(*reinterpret_cast< std::add_pointer_t<QSize>>(_a[4]))); break;
        case 1: _t->onDeviceDisconnected((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1]))); break;
        case 2: _t->on_updateDevice_clicked(); break;
        case 3: _t->on_startServerBtn_clicked(); break;
        case 4: _t->on_stopServerBtn_clicked(); break;
        case 5: _t->on_wirelessConnectBtn_clicked(); break;
        case 6: _t->on_startAdbdBtn_clicked(); break;
        case 7: _t->on_getIPBtn_clicked(); break;
        case 8: _t->on_wirelessDisConnectBtn_clicked(); break;
        case 9: _t->on_selectRecordPathBtn_clicked(); break;
        case 10: _t->on_recordPathEdt_textChanged((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1]))); break;
        case 11: _t->on_adbCommandBtn_clicked(); break;
        case 12: _t->on_stopAdbBtn_clicked(); break;
        case 13: _t->on_clearOut_clicked(); break;
        case 14: _t->on_stopAllServerBtn_clicked(); break;
        case 15: _t->on_refreshGameScriptBtn_clicked(); break;
        case 16: _t->on_applyScriptBtn_clicked(); break;
        case 17: _t->on_recordScreenCheck_clicked((*reinterpret_cast< std::add_pointer_t<bool>>(_a[1]))); break;
        case 18: _t->on_usbConnectBtn_clicked(); break;
        case 19: _t->on_wifiConnectBtn_clicked(); break;
        case 20: _t->on_connectedPhoneList_itemDoubleClicked((*reinterpret_cast< std::add_pointer_t<QListWidgetItem*>>(_a[1]))); break;
        case 21: _t->on_updateNameBtn_clicked(); break;
        case 22: _t->on_useSingleModeCheck_clicked(); break;
        case 23: _t->on_serialBox_currentIndexChanged((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1]))); break;
        case 24: _t->on_startAudioBtn_clicked(); break;
        case 25: _t->on_stopAudioBtn_clicked(); break;
        case 26: _t->on_installSndcpyBtn_clicked(); break;
        case 27: _t->on_autoUpdatecheckBox_toggled((*reinterpret_cast< std::add_pointer_t<bool>>(_a[1]))); break;
        case 28: _t->showIpEditMenu((*reinterpret_cast< std::add_pointer_t<QPoint>>(_a[1]))); break;
        case 29: _t->on_languageComboBox_currentIndexChanged((*reinterpret_cast< std::add_pointer_t<QString>>(_a[1]))); break;
        default: ;
        }
    }
}

const QMetaObject *Dialog::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *Dialog::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_staticMetaObjectStaticContent<qt_meta_tag_ZN6DialogE_t>.strings))
        return static_cast<void*>(this);
    return QWidget::qt_metacast(_clname);
}

int Dialog::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QWidget::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        if (_id < 30)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 30;
    }
    if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        if (_id < 30)
            *reinterpret_cast<QMetaType *>(_a[0]) = QMetaType();
        _id -= 30;
    }
    return _id;
}
QT_WARNING_POP
