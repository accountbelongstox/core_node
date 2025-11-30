Qt Extras Modules in Qt 6
July 20, 2021 by Tor Arne Vestbø | Comments

Qt 6 is a result of the conscious effort to make the framework more efficient and easy to use.

We try to maintain binary and source compatibility for all the public APIs in each release, but some changes were inevitable in an effort to make Qt a better framework. One of those changes was to remove the platform-specific Extras modules, to ensure a cohesive cross-platform story and future for Qt 6.


Most of the the functionality offered by these modules have been replaced by a similar functionality in other Qt modules, for example through the new platform APIs.

The remaining APIs typically fell in one of three categories:

The functionality was deprecated in the relevant platform.
The API  had no known internal or external clients.
The API was overlapping with similar APIs on other platforms, warranting a cross-platform API.
For the latter two cases we will continue to survey the need for replacement APIs for future releases. Please see the linked bug reports below for details, or let us know if you have use-cases that are no longer covered.

Note: Snippets of code from the 5.15 branch of each module can often be incorporated directly into your application, as a stopgap solution.

The following is a quick run-down of the various changes to the modules.

Changes to Qt Mac Extras
QtMac namespace
Most members of the QtMac namespace have explicit replacements. The QtMac::fromCGImageRef function has been removed due to lack of known clients of the API.

QMacPasteboardMime
The QMacPasteboardMime class has been removed due to warranting a cross-platform solution. See QTBUG-93632 for details.

QMacToolBar
The QMacToolBar and QMacToolBarItem classes have been removed. Use QToolBar as a replacement.

There are also third party solution such as the MacHelper library.

Changes to Qt Windows Extras
QtWin namespace
Many members of the QtWin namespace have explicit replacements. To use these replacements with Qt Widgets or Qt Quick, operate on the QWindow representation of the relevant widget or control.

The remaining functions have been removed:

errorStringFromHresult
Only used internally in WinExtras. No other known clients of the API.

colorizationColor/isCompositionOpaque
Concept exists on other platforms (tint/accent color). Warrants new cross-platform API, for example a new QPalette role or platform theme property.

setWindowFlip3DPolicy
Windows 7 feature. No longer supported in Windows 10.

extendFrameIntoClientArea
Similar functionality exists on other platforms. Warrants cross-platform QWindow API to control the relationship between the client area and the non-client area (frame/titlebar). See QTBUG-94010 for details.

enableBlurBehind
Deprecated as of Windows 8.

taskbarActivateTab and taskbar(Add/Delete)Tab
No known clients of the API.

QWinMime
The QWinMime class has been removed due to warranting a cross-platform solution. See QTBUG-93632 for details.

Clients that still rely on the functionality can include the private header <QtGui/private/qtguiapplication_p.h> and <QtGui/private/qwindowsmime_p.h> and use the QWindowsApplication native interface to register new MIME types.

To enable private headers use QT += gui-private with qmake, or add a project dependency to Qt::GuiPrivate with CMake.

QWinJumpList
The QWinJumpList, QWinJumpListCategory, and QWinJumpListItem classes have been removed due to warranting a cross-platform solution. See QTBUG-94007 for details.

QWinTaskbarButton
The QWinTaskbarButton and QWinTaskbarProgress classes have been removed due to warranting a cross-platform solution. See QTBUG-94009 and QTBUG-94008 for details.

QWinThumbnailToolBar
The QWinThumbnailToolBar and QWinThumbnailToolBarButton classes have been removed due to lack of known clients of the API.

Changes to Qt X11 Extras
The QX11Info class has been removed.

The QX11Info::connection() and QX11Info::display() methods have been replaced by a QX11Application native interface for QGuiApplication.

Clients that still rely on the functionality can include the private header <QtGui/private/qtx11extras_p.h> as a stopgap solution.

To enable private headers use QT += core-private with qmake, or add a project dependency to Qt::CorePrivate with CMake.

Changes to Qt Android Extras
Key functionality from the module has been brought over to other Qt modules.

Clients that still rely on missing functionality can include the private header <QtCore/private/qandroidextras_p.h> as a stopgap solution.

To enable private headers use QT += core-private with qmake, or add a project dependency to Qt::CorePrivate with CMake.

QAndroidJniObject and QAndroidJniEnvironment
The QAndroidJniObject and QAndroidJniEnvironment classes have been replaced by QJniObject and QJniEnvironment respectively.

The QAndroidJniExceptionCleaner class has been replaced by QJniEnvironment::checkAndClearExceptions().

QtAndroid namespace
Many members of the QtAndroid namespace have replacements in the QAndroidApplication native interface.

The permission request APIs have been replaced by the cross-platform QCoreApplication::requestPermission() API.

