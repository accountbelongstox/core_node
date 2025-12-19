QT += core gui
QT += network
QT += widgets
QT += opengl openglwidgets  # Qt 6: OpenGL classes moved to separate modules

CONFIG += c++17
TEMPLATE = app

# The following define makes your compiler emit warnings if you use
# any Qt feature that has been marked deprecated (the exact warnings
# depend on your compiler). Please consult the documentation of the
# deprecated API in order to know how to port your code away from it.
DEFINES += QT_DEPRECATED_WARNINGS

# You can also make your code fail to compile if it uses deprecated APIs.
# In order to do so, uncomment the following line.
# You can also select to disable deprecated APIs only up to a certain version of Qt.
DEFINES += QT_DISABLE_DEPRECATED_UP_TO=0x060A00    # disables all the APIs deprecated before Qt 6.10.0

# Qt 6.10+ automatically adds -utf-8 flag, no need to add -source-charset:utf-8
# Removed to avoid conflict: "error D8016: '/source-charset:utf-8' and '/utf-8' command-line options are incompatible"

# warning as error
#4566 https://github.com/Chuyu-Team/VC-LTL/issues/27
*g++*: QMAKE_CXXFLAGS += -Werror
*msvc*: QMAKE_CXXFLAGS += /WX /wd4566

# Source files
SOURCES += \
    main.cpp \
    mainwindow.cpp \
    dialog.cpp

HEADERS += \
    mainwindow.h \
    dialog.h

FORMS += \
    mainwindow.ui \
    dialog.ui

TRANSLATIONS = \
    $$PWD/translations/XingCanMatrix_zh_CN.ts \
    $$PWD/translations/XingCanMatrix_en.ts

# Sub-projects
include ($$PWD/groupmanage/customtreewidget/customtreewidget.pri)
include ($$PWD/groupmanage/devicegroups/devicegroups.pri)
include ($$PWD/common/common.pri)
include ($$PWD/adb/adb.pri)
include ($$PWD/uibase/uibase.pri)
include ($$PWD/fontawesome/fontawesome.pri)
include ($$PWD/util/util.pri)
include ($$PWD/device/device.pri)
include ($$PWD/devicemanage/devicemanage.pri)

# Additional include paths
INCLUDEPATH += \
        $$PWD/groupmanage/customtreewidget \
        $$PWD/groupmanage/devicegroups \
        $$PWD/common \
        $$PWD/adb \
        $$PWD/uibase \
        $$PWD/util \
        $$PWD/device \
        $$PWD/devicemanage \
        $$PWD/fontawesome

# Read version from file
CAT_VERSION = $$cat($$PWD/version.txt)
# Extract version components
VERSION_MAJOR = $$section(CAT_VERSION, ., 0, 0)
VERSION_MINOR = $$section(CAT_VERSION, ., 1, 1)
VERSION_PATCH = $$section(CAT_VERSION, ., 2, 2)
message("version:" $${VERSION_MAJOR}.$${VERSION_MINOR}.$${VERSION_PATCH})

# Define version using qmake variables
VERSION = $${VERSION_MAJOR}.$${VERSION_MINOR}.$${VERSION_PATCH}

# ***********************************************************
# Windows platform configuration
# ***********************************************************
win32 {
    # Define version as macros for use in rc file (VERSION variable is not available in rc)
    DEFINES += VERSION_MAJOR=$${VERSION_MAJOR}
    DEFINES += VERSION_MINOR=$${VERSION_MINOR}
    DEFINES += VERSION_PATCH=$${VERSION_PATCH}
    DEFINES += VERSION_RC_STR=\\\"$${VERSION_MAJOR}.$${VERSION_MINOR}.$${VERSION_PATCH}\\\"

    contains(QT_ARCH, x86_64) {
        message("x64")
        # Output directory
        CONFIG(debug, debug|release) {
            DESTDIR = $$PWD/output/win/x64/debug
        } else {
            DESTDIR = $$PWD/output/win/x64/release
        }

        # Dependencies
        LIBS += \
                -L$$PWD/third_party/ffmpeg/lib/x64 -lavformat \
                -L$$PWD/third_party/ffmpeg/lib/x64 -lavcodec \
                -L$$PWD/third_party/ffmpeg/lib/x64 -lavutil \
                -L$$PWD/third_party/ffmpeg/lib/x64 -lswscale

        WIN_FFMPEG_SRC = $$PWD/third_party/ffmpeg/bin/x64/*.dll
    } else {
        message("x86")
        # Output directory
        CONFIG(debug, debug|release) {
            DESTDIR = $$PWD/output/win/x86/debug
        } else {
            DESTDIR = $$PWD/output/win/x86/release
        }

        # Dependencies
        LIBS += \
                -L$$PWD/third_party/ffmpeg/lib/x86 -lavformat \
                -L$$PWD/third_party/ffmpeg/lib/x86 -lavcodec \
                -L$$PWD/third_party/ffmpeg/lib/x86 -lavutil \
                -L$$PWD/third_party/ffmpeg/lib/x86 -lswscale

        WIN_FFMPEG_SRC = $$PWD/third_party/ffmpeg/bin/x86/*.dll
    }

    # Copy dependency libraries
    WIN_DST = $$DESTDIR

    WIN_FFMPEG_SRC ~= s,/,\\,g
    WIN_DST ~= s,/,\\,g

    QMAKE_POST_LINK += $$quote($$QMAKE_COPY $$WIN_FFMPEG_SRC $$WIN_DST$$escape_expand(\n\t))

    # Windows rc file
    RC_FILE = $$PWD/res/TcUi.rc
}

# ***********************************************************
# macOS platform configuration
# ***********************************************************
macos {
    # Output directory
    CONFIG(debug, debug|release) {
        DESTDIR = $$PWD/output/mac/debug
    } else {
        DESTDIR = $$PWD/output/mac/release
    }

    # Dependencies
    LIBS += \
            -L$$PWD/third_party/ffmpeg/lib -lavformat.58 \
            -L$$PWD/third_party/ffmpeg/lib -lavcodec.58 \
            -L$$PWD/third_party/ffmpeg/lib -lavutil.56 \
            -L$$PWD/third_party/ffmpeg/lib -lswscale.5

    # macOS bundle files
    APP_SCRCPY_SERVER.files = $$files($$PWD/third_party/scrcpy-server)
    APP_SCRCPY_SERVER.path = Contents/MacOS
    QMAKE_BUNDLE_DATA += APP_SCRCPY_SERVER

    APP_ADB.files = $$files($$PWD/third_party/adb/mac/adb)
    APP_ADB.path = Contents/MacOS
    QMAKE_BUNDLE_DATA += APP_ADB

    APP_FFMPEG.files = $$files($$PWD/third_party/ffmpeg/lib/*.dylib)
    APP_FFMPEG.path = Contents/MacOS
    QMAKE_BUNDLE_DATA += APP_FFMPEG

    APP_CONFIG.files = $$files($$PWD/config/config.ini)
    APP_CONFIG.path = Contents/MacOS/config
    QMAKE_BUNDLE_DATA += APP_CONFIG
    # macOS application icon
    ICON = $$PWD/res/QtScrcpy.icns
    QMAKE_INFO_PLIST = $$PWD/res/Info_Mac.plist

    # Define target command (update version fields)
    plistupdate.commands = /usr/libexec/PlistBuddy -c \"Set :CFBundleShortVersionString $$VERSION\" \
    -c \"Set :CFBundleVersion $$VERSION\" \
    $$DESTDIR/$${TARGET}.app/Contents/Info.plist

    # Add extra target
    QMAKE_EXTRA_TARGETS += plistupdate
    # Set as pre-dependency
    PRE_TARGETDEPS += plistupdate
}

# ***********************************************************
# Linux platform configuration
# ***********************************************************
linux {
    # Output directory
    CONFIG(debug, debug|release) {
        DESTDIR = $$PWD/output/linux/debug
    } else {
        DESTDIR = $$PWD/output/linux/release
    }

    # Dependencies
    LIBS += \
            -L$$PWD/third_party/ffmpeg/lib -lavformat \
            -L$$PWD/third_party/ffmpeg/lib -lavcodec \
            -L$$PWD/third_party/ffmpeg/lib -lavutil \
            -L$$PWD/third_party/ffmpeg/lib -lswscale
}

RESOURCES += \
    res/res.qrc

# Default rules for deployment.
#qnx: target.path = /tmp/$${TARGET}/bin
#else: unix:!android: target.path = /opt/$${TARGET}/bin
#!isEmpty(target.path): INSTALLS += target
