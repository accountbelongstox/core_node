Obsolete Members for QtWin
The following members of class QtWin are obsolete. They are provided to keep old source code working. We strongly advise against using them in new code.

Functions
(obsolete) QColor	colorizationColor(bool *opaqueBlend = nullptr)
(obsolete) HBITMAP	createMask(const QBitmap &bitmap)
(obsolete) void	disableBlurBehindWindow(QWindow *window)
(obsolete) void	disableBlurBehindWindow(QWidget *window)
(obsolete) void	enableBlurBehindWindow(QWindow *window, const QRegion &region)
(obsolete) void	enableBlurBehindWindow(QWindow *window)
(obsolete) void	enableBlurBehindWindow(QWidget *window, const QRegion &region)
(obsolete) void	enableBlurBehindWindow(QWidget *window)
(obsolete) QString	errorStringFromHresult(int hresult)
(obsolete) void	extendFrameIntoClientArea(QWindow *window, int left, int top, int right, int bottom)
(obsolete) void	extendFrameIntoClientArea(QWindow *window, const QMargins &margins)
(obsolete) void	extendFrameIntoClientArea(QWidget *window, const QMargins &margins)
(obsolete) void	extendFrameIntoClientArea(QWidget *window, int left, int top, int right, int bottom)
(obsolete) QPixmap	fromHBITMAP(HBITMAP bitmap, QtWin::HBitmapFormat format = HBitmapNoAlpha)
(obsolete) QPixmap	fromHICON(HICON icon)
(obsolete) QRegion	fromHRGN(HRGN hrgn)
(obsolete) QImage	imageFromHBITMAP(int hdc, HBITMAP bitmap, int width, int height)
(obsolete) QImage	imageFromHBITMAP(HBITMAP bitmap, QtWin::HBitmapFormat format = HBitmapNoAlpha)
(obsolete) HBITMAP	imageToHBITMAP(const QImage &image, QtWin::HBitmapFormat format = HBitmapNoAlpha)
(obsolete) bool	isCompositionEnabled()
(obsolete) bool	isCompositionOpaque()
(obsolete) bool	isWindowExcludedFromPeek(QWindow *window)
(obsolete) bool	isWindowExcludedFromPeek(QWidget *window)
(obsolete) bool	isWindowPeekDisallowed(QWindow *window)
(obsolete) bool	isWindowPeekDisallowed(QWidget *window)
(obsolete) void	markFullscreenWindow(QWindow *window, bool fullscreen = true)
(obsolete) void	markFullscreenWindow(QWidget *window, bool fullscreen = true)
(obsolete) QColor	realColorizationColor()
(obsolete) void	resetExtendedFrame(QWindow *window)
(obsolete) void	resetExtendedFrame(QWidget *window)
(obsolete) void	setCompositionEnabled(bool enabled)
(obsolete) void	setCurrentProcessExplicitAppUserModelID(const QString &id)
(obsolete) void	setWindowDisallowPeek(QWindow *window, bool disallow)
(obsolete) void	setWindowDisallowPeek(QWidget *window, bool disallow)
(obsolete) void	setWindowExcludedFromPeek(QWindow *window, bool exclude)
(obsolete) void	setWindowExcludedFromPeek(QWidget *window, bool exclude)
(obsolete) void	setWindowFlip3DPolicy(QWindow *window, QtWin::WindowFlip3DPolicy policy)
(obsolete) QString	stringFromHresult(int hresult)
(obsolete) void	taskbarActivateTab(QWindow *window)
(obsolete) void	taskbarActivateTab(QWidget *window)
(obsolete) void	taskbarActivateTabAlt(QWindow *window)
(obsolete) void	taskbarActivateTabAlt(QWidget *window)
(obsolete) void	taskbarAddTab(QWindow *window)
(obsolete) void	taskbarAddTab(QWidget *window)
(obsolete) void	taskbarDeleteTab(QWindow *window)
(obsolete) void	taskbarDeleteTab(QWidget *window)
(obsolete) HBITMAP	toHBITMAP(const QPixmap &p, QtWin::HBitmapFormat format = HBitmapNoAlpha)
(obsolete) HICON	toHICON(const QPixmap &p)
(obsolete) HRGN	toHRGN(const QRegion &region)
(obsolete) QtWin::WindowFlip3DPolicy	windowFlip3DPolicy(QWindow *window)
(obsolete) QtWin::WindowFlip3DPolicy	windowFlip3DPolicy(QWidget *window)
Function Documentation
QColor QtWin::colorizationColor(bool *opaqueBlend = nullptr)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns the DWM colorization color. After the function returns, the optional opaqueBlend will contain true if the color is an opaque blend and false otherwise.

This function was introduced in Qt 5.2.

HBITMAP QtWin::createMask(const QBitmap &bitmap)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Creates a HBITMAP equivalent of the QBitmap bitmap.

It is the caller's responsibility to free the HBITMAP data after use.

Use image.convertToFormat(QImage::Format_Mono).invertPixels().toHBITMAP() instead.

This function was introduced in Qt 5.2.

See also toHBITMAP().

void QtWin::disableBlurBehindWindow(QWindow *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Disables the previously enabled blur effect for the specified window.

This function was introduced in Qt 5.2.

See also enableBlurBehindWindow().

void QtWin::disableBlurBehindWindow(QWidget *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::disableBlurBehindWindow().

This function was introduced in Qt 5.2.

void QtWin::enableBlurBehindWindow(QWindow *window, const QRegion &region)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Enables the blur effect for the specified region of the specified window.

This function was introduced in Qt 5.2.

See also disableBlurBehindWindow().

void QtWin::enableBlurBehindWindow(QWindow *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Enables the blur effect for the specified window.

This function was introduced in Qt 5.2.

See also disableBlurBehindWindow().

void QtWin::enableBlurBehindWindow(QWidget *window, const QRegion &region)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::enableBlurBehindWindow().

This function was introduced in Qt 5.2.

void QtWin::enableBlurBehindWindow(QWidget *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::enableBlurBehindWindow().

This function was introduced in Qt 5.2.

QString QtWin::errorStringFromHresult(int hresult)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns the code name of the hresult error id specified (usually the name of the WinAPI macro) or an empty string if the message is unknown.

This function was introduced in Qt 5.2.

void QtWin::extendFrameIntoClientArea(QWindow *window, int left, int top, int right, int bottom)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Extends the glass frame into the client area of the specified window using the left, top, right, and bottom margin values.

Pass -1 as values for any of the four margins to fully extend the frame, creating a sheet of glass effect.

If you want the extended frame to act like a standard window border, you should handle that yourself.

Note: Qt::WA_NoSystemBackground must not be set on widgets for extendFrameIntoClientArea() to work.

This function was introduced in Qt 5.2.

See also resetExtendedFrame().

void QtWin::extendFrameIntoClientArea(QWindow *window, const QMargins &margins)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::extendFrameIntoClientArea().

Extends the glass frame into the client area of the specified window using the specified margins.

This function was introduced in Qt 5.2.

void QtWin::extendFrameIntoClientArea(QWidget *window, const QMargins &margins)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::extendFrameIntoClientArea().

Convenience overload that allows passing frame sizes in a margins structure.

This function was introduced in Qt 5.2.

void QtWin::extendFrameIntoClientArea(QWidget *window, int left, int top, int right, int bottom)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::extendFrameIntoClientArea().

This function was introduced in Qt 5.2.

QPixmap QtWin::fromHBITMAP(HBITMAP bitmap, QtWin::HBitmapFormat format = HBitmapNoAlpha)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns a QPixmap that is equivalent to the given bitmap. The conversion is based on the specified format.

Use QImage::fromHBITMAP() instead.

This function was introduced in Qt 5.2.

See also toHBITMAP().

QPixmap QtWin::fromHICON(HICON icon)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns a QPixmap that is equivalent to the given icon.

Use QImage::fromHICON() instead.

This function was introduced in Qt 5.2.

See also toHICON().

QRegion QtWin::fromHRGN(HRGN hrgn)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns a QRegion that is equivalent to the given hrgn.

Use QRegion::fromHRGN() instead.

This function was introduced in Qt 5.2.

QImage QtWin::imageFromHBITMAP(int hdc, HBITMAP bitmap, int width, int height)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns a QImage that is equivalent to the given bitmap. The conversion is based on the specified HDC context hdc using the specified width and height.

Use QImage::fromHBITMAP() instead.

This function was introduced in Qt 5.2.

See also toHBITMAP().

QImage QtWin::imageFromHBITMAP(HBITMAP bitmap, QtWin::HBitmapFormat format = HBitmapNoAlpha)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns a QImage that is equivalent to the given bitmap. The conversion is based on the specified format.

Use QImage::fromHBITMAP() instead.

This function was introduced in Qt 5.12.

See also imageToHBITMAP().

HBITMAP QtWin::imageToHBITMAP(const QImage &image, QtWin::HBitmapFormat format = HBitmapNoAlpha)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Creates a HBITMAP equivalent of the QImage image, based on the given format. Returns the HBITMAP handle.

It is the caller's responsibility to free the HBITMAP data after use.

Use QImage::toHBITMAP() instead.

This function was introduced in Qt 5.12.

See also imageFromHBITMAP().

bool QtWin::isCompositionEnabled()
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns the DWM composition state.

This function was introduced in Qt 5.2.

bool QtWin::isCompositionOpaque()
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns whether the colorization color is an opaque blend.

This function was introduced in Qt 5.2.

bool QtWin::isWindowExcludedFromPeek(QWindow *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns true if the specified window is excluded from Aero Peek.

Check DwmGetWindowAttribute with DWMWA_EXCLUDED_FROM_PEEK instead.

This function was introduced in Qt 5.2.

bool QtWin::isWindowExcludedFromPeek(QWidget *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::isWindowExcludedFromPeek().

This function was introduced in Qt 5.2.

bool QtWin::isWindowPeekDisallowed(QWindow *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns true if Aero Peek is disallowed on the thumbnail of the specified window.

Check DwmGetWindowAttribute with DWMWA_DISALLOW_PEEK instead.

This function was introduced in Qt 5.2.

bool QtWin::isWindowPeekDisallowed(QWidget *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::isWindowPeekDisallowed().

This function was introduced in Qt 5.2.

void QtWin::markFullscreenWindow(QWindow *window, bool fullscreen = true)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Marks the specified window as running in the full-screen mode if fullscreen is true, so that the shell handles it correctly. Otherwise, removes the mark.

Note: You do not usually need to call this function, because the Windows taskbar always tries to determine whether a window is running in the full-screen mode.

Use QWidget::showFullScreen() instead.

This function was introduced in Qt 5.2.

void QtWin::markFullscreenWindow(QWidget *window, bool fullscreen = true)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::markFullscreenWindow().

Use QWidget::showFullScreen() instead.

This function was introduced in Qt 5.2.

QColor QtWin::realColorizationColor()
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns the real colorization color, set by the user, using an undocumented registry key. The API-based function getColorizationColor() returns an alpha-blended color which often turns out a semitransparent gray rather than something similar to what is chosen by the user.

This function was introduced in Qt 5.2.

See also colorizationColor().

void QtWin::resetExtendedFrame(QWindow *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Resets the glass frame and restores the window attributes.

This convenience function calls extendFrameIntoClientArea() with margins set to 0.

Note: Qt::WA_NoSystemBackground must not be set on widgets for extendFrameIntoClientArea() to work.

This function was introduced in Qt 5.2.

See also extendFrameIntoClientArea().

void QtWin::resetExtendedFrame(QWidget *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::resetExtendedFrame().

This function was introduced in Qt 5.2.

void QtWin::setCompositionEnabled(bool enabled)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Sets whether the Windows Desktop composition is enabled.

Note: The underlying function was declared deprecated as of Windows 8 and takes no effect.

This function was introduced in Qt 5.2.

See also isCompositionEnabled().

void QtWin::setCurrentProcessExplicitAppUserModelID(const QString &id)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Sets the Application User Model ID id.

For more information, see Application User Model IDs.

Use SetCurrentProcessExplicitAppUserModelID(id.toStdWString().c_str()) instead.

This function was introduced in Qt 5.2.

void QtWin::setWindowDisallowPeek(QWindow *window, bool disallow)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Disables Aero Peek for the specified window when hovering over the taskbar thumbnail of the window with the mouse pointer if disallow is true; otherwise allows it.

The default is false.

Use DwmSetWindowAttribute with DWMWA_DISALLOW_PEEK instead.

This function was introduced in Qt 5.2.

void QtWin::setWindowDisallowPeek(QWidget *window, bool disallow)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::setWindowDisallowPeek().

This function was introduced in Qt 5.2.

void QtWin::setWindowExcludedFromPeek(QWindow *window, bool exclude)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Excludes the specified window from Aero Peek if exclude is true.

Use DwmSetWindowAttribute with DWMWA_EXCLUDED_FROM_PEEK instead.

This function was introduced in Qt 5.2.

See also isWindowExcludedFromPeek().

void QtWin::setWindowExcludedFromPeek(QWidget *window, bool exclude)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::setWindowExcludedFromPeek().

This function was introduced in Qt 5.2.

void QtWin::setWindowFlip3DPolicy(QWindow *window, QtWin::WindowFlip3DPolicy policy)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Sets the Flip3D policy policy for the specified window.

This function was introduced in Qt 5.2.

See also windowFlip3DPolicy().

QString QtWin::stringFromHresult(int hresult)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns a message string that explains the hresult error id specified or an empty string if the explanation cannot be found.

Use qt_error_string() instead.

This function was introduced in Qt 5.2.

void QtWin::taskbarActivateTab(QWindow *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Activates an item on the taskbar without activating the window itself.

This function was introduced in Qt 5.2.

void QtWin::taskbarActivateTab(QWidget *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::taskbarActivateTab().

This function was introduced in Qt 5.2.

void QtWin::taskbarActivateTabAlt(QWindow *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Marks the item that represents the specified window on the taskbar as active, but does not activate it visually.

This function was introduced in Qt 5.2.

void QtWin::taskbarActivateTabAlt(QWidget *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::taskbarActivateTabAlt().

This function was introduced in Qt 5.2.

void QtWin::taskbarAddTab(QWindow *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Adds an item for the specified window to the taskbar.

This function was introduced in Qt 5.2.

void QtWin::taskbarAddTab(QWidget *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::taskbarAddTab().

This function was introduced in Qt 5.2.

void QtWin::taskbarDeleteTab(QWindow *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Removes the specified window from the taskbar.

This function was introduced in Qt 5.2.

void QtWin::taskbarDeleteTab(QWidget *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::taskbarDeleteTab().

This function was introduced in Qt 5.2.

HBITMAP QtWin::toHBITMAP(const QPixmap &p, QtWin::HBitmapFormat format = HBitmapNoAlpha)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Creates a HBITMAP equivalent of the QPixmap p, based on the given format. Returns the HBITMAP handle.

It is the caller's responsibility to free the HBITMAP data after use.

Use QImage::toHBITMAP() instead.

This function was introduced in Qt 5.2.

See also fromHBITMAP().

HICON QtWin::toHICON(const QPixmap &p)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Creates a HICON equivalent of the QPixmap p. Returns the HICON handle.

It is the caller's responsibility to free the HICON data after use.

Use QImage::toHICON() instead.

This function was introduced in Qt 5.2.

See also fromHICON().

HRGN QtWin::toHRGN(const QRegion &region)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns a HRGN that is equivalent to the given region.

Use QRegion::toHRGN() instead.

This function was introduced in Qt 5.2.

QtWin::WindowFlip3DPolicy QtWin::windowFlip3DPolicy(QWindow *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

Returns the current Flip3D policy for the specified window.

This function was introduced in Qt 5.2.

See also setWindowFlip3DPolicy().

QtWin::WindowFlip3DPolicy QtWin::windowFlip3DPolicy(QWidget *window)
This function is obsolete. It is provided to keep old source code working. We strongly advise against using it in new code.

This function overloads QtWin::windowFlip3DPolicy().

This function was introduced in Qt 5.2.

© 2024 The Qt Company Ltd. Documentation contributions included herein are the copyrights of their respective owners. The documentation provided herein is licensed under the terms of the GNU Free Documentation License version 1.3 as published by the Free Software Foundation. Qt and respective logos are trademarks of The Qt Company Ltd. in Finland and/or other countries worldwide. All other trademarks are property of their respective owners.