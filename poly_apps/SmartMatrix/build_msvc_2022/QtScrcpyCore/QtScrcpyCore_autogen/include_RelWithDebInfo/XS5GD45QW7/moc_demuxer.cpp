/****************************************************************************
** Meta object code from reading C++ file 'demuxer.h'
**
** Created by: The Qt Meta Object Compiler version 69 (Qt 6.9.3)
**
** WARNING! All changes made in this file will be lost!
*****************************************************************************/

#include "../../../../../QtScrcpy/QtScrcpyCore/src/device/demuxer/demuxer.h"
#include <QtCore/qmetatype.h>

#include <QtCore/qtmochelpers.h>

#include <memory>


#include <QtCore/qxptype_traits.h>
#if !defined(Q_MOC_OUTPUT_REVISION)
#error "The header file 'demuxer.h' doesn't include <QObject>."
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
struct qt_meta_tag_ZN7DemuxerE_t {};
} // unnamed namespace

template <> constexpr inline auto Demuxer::qt_create_metaobjectdata<qt_meta_tag_ZN7DemuxerE_t>()
{
    namespace QMC = QtMocConstants;
    QtMocHelpers::StringRefStorage qt_stringData {
        "Demuxer",
        "onStreamStop",
        "",
        "getFrame",
        "AVPacket*",
        "packet",
        "getConfigFrame"
    };

    QtMocHelpers::UintData qt_methods {
        // Signal 'onStreamStop'
        QtMocHelpers::SignalData<void()>(1, 2, QMC::AccessPublic, QMetaType::Void),
        // Signal 'getFrame'
        QtMocHelpers::SignalData<void(AVPacket *)>(3, 2, QMC::AccessPublic, QMetaType::Void, {{
            { 0x80000000 | 4, 5 },
        }}),
        // Signal 'getConfigFrame'
        QtMocHelpers::SignalData<void(AVPacket *)>(6, 2, QMC::AccessPublic, QMetaType::Void, {{
            { 0x80000000 | 4, 5 },
        }}),
    };
    QtMocHelpers::UintData qt_properties {
    };
    QtMocHelpers::UintData qt_enums {
    };
    return QtMocHelpers::metaObjectData<Demuxer, qt_meta_tag_ZN7DemuxerE_t>(QMC::MetaObjectFlag{}, qt_stringData,
            qt_methods, qt_properties, qt_enums);
}
Q_CONSTINIT const QMetaObject Demuxer::staticMetaObject = { {
    QMetaObject::SuperData::link<QThread::staticMetaObject>(),
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN7DemuxerE_t>.stringdata,
    qt_staticMetaObjectStaticContent<qt_meta_tag_ZN7DemuxerE_t>.data,
    qt_static_metacall,
    nullptr,
    qt_staticMetaObjectRelocatingContent<qt_meta_tag_ZN7DemuxerE_t>.metaTypes,
    nullptr
} };

void Demuxer::qt_static_metacall(QObject *_o, QMetaObject::Call _c, int _id, void **_a)
{
    auto *_t = static_cast<Demuxer *>(_o);
    if (_c == QMetaObject::InvokeMetaMethod) {
        switch (_id) {
        case 0: _t->onStreamStop(); break;
        case 1: _t->getFrame((*reinterpret_cast< std::add_pointer_t<AVPacket*>>(_a[1]))); break;
        case 2: _t->getConfigFrame((*reinterpret_cast< std::add_pointer_t<AVPacket*>>(_a[1]))); break;
        default: ;
        }
    }
    if (_c == QMetaObject::IndexOfMethod) {
        if (QtMocHelpers::indexOfMethod<void (Demuxer::*)()>(_a, &Demuxer::onStreamStop, 0))
            return;
        if (QtMocHelpers::indexOfMethod<void (Demuxer::*)(AVPacket * )>(_a, &Demuxer::getFrame, 1))
            return;
        if (QtMocHelpers::indexOfMethod<void (Demuxer::*)(AVPacket * )>(_a, &Demuxer::getConfigFrame, 2))
            return;
    }
}

const QMetaObject *Demuxer::metaObject() const
{
    return QObject::d_ptr->metaObject ? QObject::d_ptr->dynamicMetaObject() : &staticMetaObject;
}

void *Demuxer::qt_metacast(const char *_clname)
{
    if (!_clname) return nullptr;
    if (!strcmp(_clname, qt_staticMetaObjectStaticContent<qt_meta_tag_ZN7DemuxerE_t>.strings))
        return static_cast<void*>(this);
    return QThread::qt_metacast(_clname);
}

int Demuxer::qt_metacall(QMetaObject::Call _c, int _id, void **_a)
{
    _id = QThread::qt_metacall(_c, _id, _a);
    if (_id < 0)
        return _id;
    if (_c == QMetaObject::InvokeMetaMethod) {
        if (_id < 3)
            qt_static_metacall(this, _c, _id, _a);
        _id -= 3;
    }
    if (_c == QMetaObject::RegisterMethodArgumentMetaType) {
        if (_id < 3)
            *reinterpret_cast<QMetaType *>(_a[0]) = QMetaType();
        _id -= 3;
    }
    return _id;
}

// SIGNAL 0
void Demuxer::onStreamStop()
{
    QMetaObject::activate(this, &staticMetaObject, 0, nullptr);
}

// SIGNAL 1
void Demuxer::getFrame(AVPacket * _t1)
{
    QMetaObject::activate<void>(this, &staticMetaObject, 1, nullptr, _t1);
}

// SIGNAL 2
void Demuxer::getConfigFrame(AVPacket * _t1)
{
    QMetaObject::activate<void>(this, &staticMetaObject, 2, nullptr, _t1);
}
QT_WARNING_POP
