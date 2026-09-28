Qt 6.9
Qt OpenGL
Changes to Qt OpenGL
Changes to Qt OpenGL
Qt 6 is a result of the conscious effort to make the framework more efficient and easy to use.

We try to maintain binary and source compatibility for all the public APIs in each release. But some changes were inevitable in an effort to make Qt a better framework.

In this topic we summarize those changes in Qt OpenGL, and provide guidance to handle them.

Deprecated classes removed
The Qt OpenGL module was deprecated for the life time of Qt 5, and the classes it contained have been removed in Qt 6.

This refers specifically to the classes prefixed by QGL.

QOpenGL classes migrated
In Qt 5, a replacement set of OpenGL-support classes were added to Qt Gui. This was in order to support OpenGL as the cross-platform graphics API that served as foundation for graphics in Qt.

In Qt 6, these have been migrated to the Qt OpenGL module. They are still usable and fully supported for applications depending on OpenGL directly. However, they are no longer considered foundational, since Qt has been extended to support other graphics APIs in its foundation, such as Direct3D, Metal and Vulkan.

Existing application code will largely continue working, but should now include Qt OpenGL in project files, as well as include the headers if these were previously included indirectly through Qt Gui.

Note: A notable exception is QOpenGLContext, which still resides in Qt Gui.

The QOpenGLWidgets class
Another exception is the QOpenGLWidget class. This has been moved to a new module named Qt OpenGL Widgets and should be included from there.

Selecting the OpenGL backend for RHI
In addition to adjusting project files and including headers, the application should also manually set the rendering backend to OpenGL in order to use this functionality when working with Qt Quick. By default, Qt will use the most appropriate graphics API on the target platform. See the RHI rendering documentation for more details.

Removal of ANGLE
On Windows, ANGLE, a third-party OpenGL ES to Direct 3D translator, is no longer included in Qt 6. This means Qt::AA_UseOpenGLES and the environment variable QT_OPENGL=angle no longer has any effect. In dynamic OpenGL builds there is no automatic fallback to ANGLE in case OpenGL-proper fails to initialize. For QWindow or QWidget based applications using OpenGL directly, for example via QOpenGLWidget, this means that OpenGL-proper is the only option at runtime. However, the use of a pure software OpenGL implementation, such as Mesa llvmpipe that is shipped with the pre-built Qt packages, is still available.

For Qt Quick and Qt Quick 3D applications, Qt 6 introduces support for Direct 3D 11, Vulkan, and Metal, in addition to OpenGL. On Windows, Qt 6 defaults to Direct 3D, therefore the effect of the removal of ANGLE is lessened by the addition of support to other graphics APIs.

QOpenGLContext Class
The QOpenGLContext class represents a native OpenGL context, enabling OpenGL rendering on a QSurface. More...

Header:	#include <QOpenGLContext>
CMake:	find_package(Qt6 REQUIRED COMPONENTS Gui)
target_link_libraries(mytarget PRIVATE Qt6::Gui)
qmake:	QT += gui
Inherits:	QObject
List of all members, including inherited members
QOpenGLContext is part of Rendering in 3D.
Public Types
enum	OpenGLModuleType { LibGL, LibGLES }
Public Functions
QOpenGLContext(QObject *parent = nullptr)
virtual	~QOpenGLContext()
bool	create()
GLuint	defaultFramebufferObject() const
void	doneCurrent()
QSet<QByteArray>	extensions() const
QOpenGLExtraFunctions *	extraFunctions() const
QSurfaceFormat	format() const
QOpenGLFunctions *	functions() const
QFunctionPointer	getProcAddress(const QByteArray &procName) const
QFunctionPointer	getProcAddress(const char *procName) const
bool	hasExtension(const QByteArray &extension) const
bool	isOpenGLES() const
bool	isValid() const
bool	makeCurrent(QSurface *surface)
QNativeInterface *	nativeInterface() const
QScreen *	screen() const
void	setFormat(const QSurfaceFormat &format)
void	setScreen(QScreen *screen)
void	setShareContext(QOpenGLContext *shareContext)
QOpenGLContext *	shareContext() const
QOpenGLContextGroup *	shareGroup() const
QSurface *	surface() const
void	swapBuffers(QSurface *surface)
Signals
void	aboutToBeDestroyed()
Static Public Members
bool	areSharing(QOpenGLContext *first, QOpenGLContext *second)
QOpenGLContext *	currentContext()
QOpenGLContext *	globalShareContext()
QOpenGLContext::OpenGLModuleType	openGLModuleType()
bool	supportsThreadedOpenGL()
Detailed Description
QOpenGLContext represents the OpenGL state of an underlying OpenGL context. To set up a context, set its screen and format such that they match those of the surface or surfaces with which the context is meant to be used, if necessary make it share resources with other contexts with setShareContext(), and finally call create(). Use the return value or isValid() to check if the context was successfully initialized.

A context can be made current against a given surface by calling makeCurrent(). When OpenGL rendering is done, call swapBuffers() to swap the front and back buffers of the surface, so that the newly rendered content becomes visible. To be able to support certain platforms, QOpenGLContext requires that you call makeCurrent() again before starting rendering a new frame, after calling swapBuffers().

If the context is temporarily not needed, such as when the application is not rendering, it can be useful to delete it in order to free resources. You can connect to the aboutToBeDestroyed() signal to clean up any resources that have been allocated with different ownership from the QOpenGLContext itself.

Once a QOpenGLContext has been made current, you can render to it in a platform independent way by using Qt's OpenGL enablers such as QOpenGLFunctions, QOpenGLBuffer, QOpenGLShaderProgram, and QOpenGLFramebufferObject. It is also possible to use the platform's OpenGL API directly, without using the Qt enablers, although potentially at the cost of portability. The latter is necessary when wanting to use OpenGL 1.x or OpenGL ES 1.x.

For more information about the OpenGL API, refer to the official OpenGL documentation.

For an example of how to use QOpenGLContext see the OpenGL Window example.

Thread Affinity
QOpenGLContext can be moved to a different thread with moveToThread(). Do not call makeCurrent() from a different thread than the one to which the QOpenGLContext object belongs. A context can only be current in one thread and against one surface at a time, and a thread only has one context current at a time.

Context Resource Sharing
Resources such as textures and vertex buffer objects can be shared between contexts. Use setShareContext() before calling create() to specify that the contexts should share these resources. QOpenGLContext internally keeps track of a QOpenGLContextGroup object which can be accessed with shareGroup(), and which can be used to find all the contexts in a given share group. A share group consists of all contexts that have been successfully initialized and are sharing with an existing context in the share group. A non-sharing context has a share group consisting of a single context.

Default Framebuffer
On certain platforms, a framebuffer other than 0 might be the default frame buffer depending on the current surface. Instead of calling glBindFramebuffer(0), it is recommended that you use glBindFramebuffer(ctx->defaultFramebufferObject()), to ensure that your application is portable between different platforms. However, if you use QOpenGLFunctions::glBindFramebuffer(), this is done automatically for you.

Warning: WebAssembly

We recommend that only one QOpenGLContext is made current with a QSurface, for the entire lifetime of the QSurface. Should more than once context be used, it is important to understand that multiple QOpenGLContext instances may be backed by the same native context underneath with the WebAssembly platform. Therefore, calling makeCurrent() with the same QSurface on two QOpenGLContext objects may not switch to a different native context in the second call. As a result, any OpenGL state changes done after the second makeCurrent() may alter the state of the first QOpenGLContext as well, as they are all backed by the same native context.

Note: This means that when targeting WebAssembly with existing OpenGL-based Qt code, some porting may be required to cater to these limitations.

See also QOpenGLFunctions, QOpenGLBuffer, QOpenGLShaderProgram, and QOpenGLFramebufferObject.

Member Type Documentation
enum QOpenGLContext::OpenGLModuleType
This enum defines the type of the underlying OpenGL implementation.

Constant	Value	Description
QOpenGLContext::LibGL	0	OpenGL
QOpenGLContext::LibGLES	1	OpenGL ES 2.0 or higher
Member Function Documentation
[explicit]QOpenGLContext::QOpenGLContext(QObject *parent = nullptr)
Creates a new OpenGL context instance with parent object parent.

Before it can be used you need to set the proper format and call create().

See also create() and makeCurrent().

[virtual noexcept]QOpenGLContext::~QOpenGLContext()
Destroys the QOpenGLContext object.

If this is the current context for the thread, doneCurrent() is also called.

[signal]void QOpenGLContext::aboutToBeDestroyed()
This signal is emitted before the underlying native OpenGL context is destroyed, such that users may clean up OpenGL resources that might otherwise be left dangling in the case of shared OpenGL contexts.

If you wish to make the context current in order to do clean-up, make sure to only connect to the signal using a direct connection.

Note: In Qt for Python, this signal will not be received when emitted from the destructor of QOpenGLWidget or QOpenGLWindow due to the Python instance already being destroyed. We recommend doing cleanups in QWidget::hideEvent() instead.

[static]bool QOpenGLContext::areSharing(QOpenGLContext *first, QOpenGLContext *second)
Returns true if the first and second contexts are sharing OpenGL resources.

bool QOpenGLContext::create()
Attempts to create the OpenGL context with the current configuration.

The current configuration includes the format, the share context, and the screen.

If the OpenGL implementation on your system does not support the requested version of OpenGL context, then QOpenGLContext will try to create the closest matching version. The actual created context properties can be queried using the QSurfaceFormat returned by the format() function. For example, if you request a context that supports OpenGL 4.3 Core profile but the driver and/or hardware only supports version 3.2 Core profile contexts then you will get a 3.2 Core profile context.

Returns true if the native context was successfully created and is ready to be used with makeCurrent(), swapBuffers(), etc.

Note: If the context already exists, this function destroys the existing context first, and then creates a new one.

See also makeCurrent() and format().

[static]QOpenGLContext *QOpenGLContext::currentContext()
Returns the last context which called makeCurrent in the current thread, or nullptr, if no context is current.

GLuint QOpenGLContext::defaultFramebufferObject() const
Call this to get the default framebuffer object for the current surface.

On some platforms (for instance, iOS) the default framebuffer object depends on the surface being rendered to, and might be different from 0. Thus, instead of calling glBindFramebuffer(0), you should call glBindFramebuffer(ctx->defaultFramebufferObject()) if you want your application to work across different Qt platforms.

If you use the glBindFramebuffer() in QOpenGLFunctions you do not have to worry about this, as it automatically binds the current context's defaultFramebufferObject() when 0 is passed.

Note: Widgets that render via framebuffer objects, like QOpenGLWidget and QQuickWidget, will override the value returned from this function when painting is active, because at that time the correct "default" framebuffer is the widget's associated backing framebuffer, not the platform-specific one belonging to the top-level window's surface. This ensures the expected behavior for this function and other classes relying on it (for example, QOpenGLFramebufferObject::bindDefault() or QOpenGLFramebufferObject::release()).

See also QOpenGLFramebufferObject.

void QOpenGLContext::doneCurrent()
Convenience function for calling makeCurrent with a 0 surface.

This results in no context being current in the current thread.

See also makeCurrent() and currentContext().

QSet<QByteArray> QOpenGLContext::extensions() const
Returns the set of OpenGL extensions supported by this context.

The context or a sharing context must be current.

See also hasExtension().

QOpenGLExtraFunctions *QOpenGLContext::extraFunctions() const
Get the QOpenGLExtraFunctions instance for this context.

QOpenGLContext offers this as a convenient way to access QOpenGLExtraFunctions without having to manage it manually.

The context or a sharing context must be current.

The returned QOpenGLExtraFunctions instance is ready to be used and it does not need initializeOpenGLFunctions() to be called.

Note: QOpenGLExtraFunctions contains functionality that is not guaranteed to be available at runtime. Runtime availability depends on the platform, graphics driver, and the OpenGL version requested by the application.

See also QOpenGLFunctions and QOpenGLExtraFunctions.

QSurfaceFormat QOpenGLContext::format() const
Returns the format of the underlying platform context, if create() has been called.

Otherwise, returns the requested format.

The requested and the actual format may differ. Requesting a given OpenGL version does not mean the resulting context will target exactly the requested version. It is only guaranteed that the version/profile/options combination for the created context is compatible with the request, as long as the driver is able to provide such a context.

For example, requesting an OpenGL version 3.x core profile context may result in an OpenGL 4.x core profile context. Similarly, a request for OpenGL 2.1 may result in an OpenGL 3.0 context with deprecated functions enabled. Finally, depending on the driver, unsupported versions may result in either a context creation failure or in a context for the highest supported version.

Similar differences are possible in the buffer sizes, for example, the resulting context may have a larger depth buffer than requested. This is perfectly normal.

See also setFormat().

QOpenGLFunctions *QOpenGLContext::functions() const
Get the QOpenGLFunctions instance for this context.

QOpenGLContext offers this as a convenient way to access QOpenGLFunctions without having to manage it manually.

The context or a sharing context must be current.

The returned QOpenGLFunctions instance is ready to be used and it does not need initializeOpenGLFunctions() to be called.

QFunctionPointer QOpenGLContext::getProcAddress(const QByteArray &procName) const
Resolves the function pointer to an OpenGL extension function, identified by procName

Returns nullptr if no such function can be found.

QFunctionPointer QOpenGLContext::getProcAddress(const char *procName) const
This is an overloaded function.

[static]QOpenGLContext *QOpenGLContext::globalShareContext()
Returns the application-wide shared OpenGL context, if present. Otherwise, returns nullptr.

This is useful if you need to upload OpenGL objects (buffers, textures, etc.) before creating or showing a QOpenGLWidget or QQuickWidget.

Note: You must set the Qt::AA_ShareOpenGLContexts flag on QGuiApplication before creating the QGuiApplication object, otherwise Qt may not create a global shared context.

Warning: Do not attempt to make the context returned by this function current on any surface. Instead, you can create a new context which shares with the global one, and then make the new context current.

See also Qt::AA_ShareOpenGLContexts, setShareContext(), and makeCurrent().

bool QOpenGLContext::hasExtension(const QByteArray &extension) const
Returns true if this OpenGL context supports the specified OpenGL extension, false otherwise.

The context or a sharing context must be current.

See also extensions().

bool QOpenGLContext::isOpenGLES() const
Returns true if the context is an OpenGL ES context.

If the context has not yet been created, the result is based on the requested format set via setFormat().

See also create(), format(), and setFormat().

bool QOpenGLContext::isValid() const
Returns if this context is valid, i.e. has been successfully created.

On some platforms the return value of false for a context that was successfully created previously indicates that the OpenGL context was lost.

The typical way to handle context loss scenarios in applications is to check via this function whenever makeCurrent() fails and returns false. If this function then returns false, recreate the underlying native OpenGL context by calling create(), call makeCurrent() again and then reinitialize all OpenGL resources.

On some platforms context loss situations is not something that can avoided. On others however, they may need to be opted-in to. This can be done by enabling ResetNotification in the QSurfaceFormat. This will lead to setting RESET_NOTIFICATION_STRATEGY_EXT to LOSE_CONTEXT_ON_RESET_EXT in the underlying native OpenGL context. QOpenGLContext will then monitor the status via glGetGraphicsResetStatusEXT() in every makeCurrent().

See also create().

bool QOpenGLContext::makeCurrent(QSurface *surface)
Makes the context current in the current thread, against the given surface. Returns true if successful; otherwise returns false. The latter may happen if the surface is not exposed, or the graphics hardware is not available due to e.g. the application being suspended.

If surface is nullptr this is equivalent to calling doneCurrent().

Avoid calling this function from a different thread than the one the QOpenGLContext instance lives in. If you wish to use QOpenGLContext from a different thread you should first make sure it's not current in the current thread, by calling doneCurrent() if necessary. Then call moveToThread(otherThread) before using it in the other thread.

By default Qt employs a check that enforces the above condition on the thread affinity. It is still possible to disable this check by setting the Qt::AA_DontCheckOpenGLContextThreadAffinity application attribute. Be sure to understand the consequences of using QObjects from outside the thread they live in, as explained in the QObject thread affinity documentation.

See also functions(), doneCurrent(), and Qt::AA_DontCheckOpenGLContextThreadAffinity.

template <typename QNativeInterface> QNativeInterface *QOpenGLContext::nativeInterface() const
Returns a native interface of the given type for the context.

This function provides access to platform specific functionality of QOpenGLContext, as defined in the QNativeInterface namespace:

QNativeInterface::QCocoaGLContext

Native interface to an NSOpenGLContext on macOS

QNativeInterface::QEGLContext

Native interface to an EGL context

QNativeInterface::QGLXContext

Native interface to a GLX context

QNativeInterface::QWGLContext

Native interface to a WGL context on Windows

If the requested interface is not available a nullptr is returned.

[static]QOpenGLContext::OpenGLModuleType QOpenGLContext::openGLModuleType()
Returns the underlying OpenGL implementation type.

On platforms where the OpenGL implementation is not dynamically loaded, the return value is determined during compile time and never changes.

Note: A desktop OpenGL implementation may be capable of creating ES-compatible contexts too. Therefore in most cases it is more appropriate to check QSurfaceFormat::renderableType() or use the convenience function isOpenGLES().

Note: This function requires that the QGuiApplication instance is already created.

QScreen *QOpenGLContext::screen() const
Returns the screen the context was created for.

See also setScreen().

void QOpenGLContext::setFormat(const QSurfaceFormat &format)
Sets the format the OpenGL context should be compatible with. You need to call create() before it takes effect.

When the format is not explicitly set via this function, the format returned by QSurfaceFormat::defaultFormat() will be used. This means that when having multiple contexts, individual calls to this function can be replaced by one single call to QSurfaceFormat::setDefaultFormat() before creating the first context.

See also format().

void QOpenGLContext::setScreen(QScreen *screen)
Sets the screen the OpenGL context should be valid for. You need to call create() before it takes effect.

See also screen().

void QOpenGLContext::setShareContext(QOpenGLContext *shareContext)
Makes this context share textures, shaders, and other OpenGL resources with shareContext. You need to call create() before it takes effect.

See also shareContext().

QOpenGLContext *QOpenGLContext::shareContext() const
Returns the share context this context was created with.

If the underlying platform was not able to support the requested sharing, this will return 0.

See also setShareContext().

QOpenGLContextGroup *QOpenGLContext::shareGroup() const
Returns the share group this context belongs to.

[static]bool QOpenGLContext::supportsThreadedOpenGL()
Returns true if the platform supports OpenGL rendering outside the main (gui) thread.

The value is controlled by the platform plugin in use and may also depend on the graphics drivers.

QSurface *QOpenGLContext::surface() const
Returns the surface the context has been made current with.

This is the surface passed as an argument to makeCurrent().

void QOpenGLContext::swapBuffers(QSurface *surface)
Swap the back and front buffers of surface.

Call this to finish a frame of OpenGL rendering, and make sure to call makeCurrent() again before issuing any further OpenGL commands, for example as part of a new frame.

Qt OpenGL
Qt has two main approaches to UI development: Qt Quick and Qt Widgets. They exist to support different types of user interfaces, and build on separate graphics engines that have been optimized for each of these types.

It is possible to combine code written in the OpenGL graphics API with both of these user interface types in Qt. This can be useful when the application has its own OpenGL-dependent code, or when it is integrating with a third-party OpenGL-based renderer.

The Qt OpenGL module contains convenience classes to make this type of integration easier and faster.

Qt OpenGL and Qt Widgets
Qt Widgets is typically rendered by a highly optimized and accurate software rasterizer, and the final content reproduced on screen using a method appropriate for the platform where the application is running.

But it is also possible to combine Qt Widgets with OpenGL. The main entry point for this is the QOpenGLWidget class. This class can be used to enable OpenGL rendering for a certain part of the widget tree, and the classes in the Qt OpenGL module can be used to facilitate any application-side OpenGL code.

Qt OpenGL and Qt Quick
Qt Quick is optimized for hardware-accelerated rendering. By default, it will be built on the low-level graphics API most appropriate for the target platform.

For instance, it will default to Direct3D on Windows, whereas on macOS, it will default to Metal. But it is also possible to manually select OpenGL as the active graphics API on platforms where this is supported.

For more details on enabling OpenGL with Qt Quick, see scenegraph renderer documentation.

Using the Module
Using a Qt module's C++ API requires linking against the module library, either directly or through other dependencies. Several build tools have dedicated support for this, including CMake and qmake.

Building with CMake
Use the find_package() command to locate the needed module component in the Qt6 package:

find_package(Qt6 REQUIRED COMPONENTS OpenGL)
target_link_libraries(mytarget PRIVATE Qt6::OpenGL)

For more details, see the Build with CMake overview.

Building with qmake
To configure the module for building with qmake, add the module as a value of the QT variable in the project's .pro file:

QT += opengl

Examples
Qt OpenGL Examples
Reference
C++ Classes
Module Evolution
Changes to Qt OpenGL lists important changes in the module API and functionality that were done for the Qt 6 series of Qt.

Licenses and Trademarks

QSG_VISUALIZE=overdraw

Rendering via the Qt Rendering Hardware Interface
From Qt 6.0 onwards, the default adaptation always renders via a graphics abstraction layer, the Qt Rendering Hardware Interface (RHI), provided by the Qt GUI module. This means that, unlike Qt 5, no direct OpenGL calls are made by the scene graph. Rather, it records resource and draw commands by using the RHI APIs, which then translate the command stream into OpenGL, Vulkan, Metal, or Direct 3D calls. Shader handling is also unified by writing shader code once, compiling to SPIR-V, and then translating to the language appropriate for the various graphics APIs.

To control the behavior, the following environment variables can be used:

Environment Variable	Possible Values	Description
QSG_RHI_BACKEND	vulkan, metal, opengl, d3d11, d3d12	Requests the specific RHI backend. By default the targeted graphics API is chosen based on the platform, unless overridden by this variable or the equivalent C++ APIs. The defaults are currently Direct3D 11 for Windows, Metal for macOS, OpenGL elsewhere.
QSG_INFO	1	Like with the OpenGL-based rendering path, setting this enables printing system information when initializing the Qt Quick scene graph. This can be very useful for troubleshooting.
QSG_RHI_DEBUG_LAYER	1	Where applicable (Vulkan, Direct3D), enables the graphics API implementation's debug or validation layers, if available, either on the graphics device or the instance object. For Metal on macOS, set the environment variable METAL_DEVICE_WRAPPER_TYPE=1 instead.
QSG_RHI_PREFER_SOFTWARE_RENDERER	1	Requests choosing an adapter or physical device that uses software-based rasterization. Applicable only when the underlying API has support for enumerating adapters (for example, Direct3D or Vulkan), and is ignored otherwise.
Applications wishing to always run with a single given graphics API, can request this via C++ as well. For example, the following call made early in main(), before constructing any QQuickWindow, forces the use of Vulkan (and will fail otherwise):

QQuickWindow::setGraphicsApi(QSGRendererInterface::Vulkan);

See QSGRendererInterface::GraphicsApi. The enum values OpenGL, Vulkan, Metal, Direct3D11, Direct3D12 are equivalent in effect to running with QSG_RHI_BACKEND set to the equivalent string key.

All QRhi backends will choose the system default GPU adapter or physical device, unless overridden by QSG_RHI_PREFER_SOFTWARE_RENDERER or a backend-specific variable, such as, QT_D3D_ADAPTER_INDEX or QT_VK_PHYSICAL_DEVICE_INDEX. No further adapter configurability is provided at this time.

Starting with Qt 6.5, some of the settings that were previously only exposed as environment variables are available as C++ APIs in QQuickGraphicsConfiguration. For example, setting QSG_RHI_DEBUG_LAYER and calling setDebugLayer(true) are equivalent.