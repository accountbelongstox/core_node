/****************************************************************************
** Meta object code from reading C++ file 'keymap.h'
**
** Created by: The Qt Meta Object Compiler version 69 (Qt 6.9.3)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "../../../../../QtScrcpy/QtScrcpyCore/src/device/controller/inputconvert/keymap/keymap.h"
#include <QtCore/qmetatype.h>

#include <QtCore/qtmochelpers.h>

#include <memory>


#include <QtCore/qxptype_traits.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'keymap.h' doesn't include <QObject>."
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
struct qt_meta_tag_ZN6KeyMapE_t {};
} // unnamed namespace

template <> constexpr inline auto KeyMap::qt_create_metaobjectdata<qt_meta_tag_ZN6KeyMapE_t>()
{
    namespace QMC = QtMocConstants;
    QtMocHelpers::StringRefStorage qt_stringData {
        "KeyMap",
        "KeyMapType",
        "KMT_INVALID",
        "KMT_CLICK",
        "KMT_CLICK_TWICE",
        "KMT_CLICK_MULTI",
        "KMT_STEER_WHEEL",
        "KMT_DRAG",
        "KMT_MOUSE_MOVE",
        "KMT_ANDROID_KEY",
        "ActionType",
        "AT_INVALID",
        "AT_KEY",
        "AT_MOUSE"
    };

    QtMocHelpers::UintData qt_methods {
    };
    QtMocHelpers::UintData qt_properties {
    };
    QtMocHelpers::UintData qt_enums {
        // enum 'KeyMapType'
        QtMocHelpers::EnumData<enum KeyMapType>(1, 1, QMC::EnumFlags{}).add({
            {    2, KeyMapType::KMT_INVALID },
            {    3, KeyMapType::KMT_CLICK },
            {    4, KeyMapType::KMT_CLICK_TWICE },
            {    5, KeyMapType::KMT_CLICK_MULTI },
            {    6, KeyMapType::KMT_STEER_WHEEL },
            {    7, KeyMapType::KMT_DRAG },
            {    8, KeyMapType::KMT_MOUSE_MOVE },
            {    9, KeyMapType::KMT_ANDROID_KEY },
        }),
        // enum 'ActionType'
        QtMocHelpers::EnumData<enum ActionType>(10, 10, QMC::EnumFlags{}).add({
            {   11, ActionType::AT_INVALID },
            {   12, ActionType::AT_KEY },
            {   13, ActionType::AT_MOUSE },
        }),
    };
    return QtMocHelpers::metaObjectData<KeyMap, qt_meta_tag_ZN6KeyMapE_t>(QMC::MetaObjectFlag{}, qt_stringData,
            qt_methods, qt_properties, qt_enums);
}
Q_CONSTINIT const QMetaObject KeyMap::staticMetaObject = { {
    QMetaObject::SuperData::link<QObject::staticMetaObject>(),
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN6KeyMapE_t>.stringdata,
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN6KeyMapE_t>.data,
    qt_static_metacall,
    nullptr,
    qt_staticMetaObjectRelocatingContent<qt_meta_tag_ZN6KeyMapE_t>.metaTypes,
    nullptr
} };

void KeyMap::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    auto *_t = static_cast<KeyMap *>(_o);
    (void)_t;
    (void)_c;
    (void)_id;
    (void)_a;
}

const QMetaObject *KeyMap::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *KeyMap::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_staticMetaObjectStaticContent<qt_meta_tag_ZN6KeyMapE_t>.strings))
        return static_cast<void*>(this);
    return QObject::qt_metacast(_clname);
}

int KeyMap::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QObject::qt_metacall(_c, _id, _a);
    return _id;
}
QT_WARNING_POP
