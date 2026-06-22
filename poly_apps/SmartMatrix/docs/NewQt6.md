What's New in Qt 6.9
New Features in Qt 6.9
Qt Core Module
QString::arg() now has support for UTF-8 (QUtf8StringView) and QAnyStringView arguments. Passing C string literals or QByteArrays to arg() now no longer implicitly converts to QString first.
QAnyStringView and QUtf8StringView now have a (multi-)arg(), like QStringView and QLatin1StringView already had. These also support QUtf8StringView and QAnyStringView arguments, like the QString version.
QJniArray can now create an empty array of a fixed size, and change values in an array using a non-const iterator or operator[]
QLocale::uiLanguages() now includes fall-back entries obtained by removing later components of names. Callers that have been doing such truncations for themselves are now encouraged to trust that QLocale knows the right things to try and the right order to try them in.
QLocale::bcp47Name() now represents the C locale as "en-POSIX", to distinguish it from plain "en" and better align with the BCP47 spec. The variant POSIX is likewise now recognized as meaning the C locale, when constructing one from its name.
QTimeZone::abbreviation() on Windows now returns an abbreviation rather than the full name.
QTimeZone::displayName() should now actually provide locale-appropriate names for zones on all platforms, where previously some failed to support this.
Converting timestamp strings with a timezone part to QDateTime now recognizes long-form display names of zones.
QMetaEnum and QFlags can now support types requiring up to 64-bits.
QJsonValue can now parse and serialize JSON using fromJson and toJson directly, without going through QJsonDocument. This allows it to parse and serialize primitive values like strings or numbers as well as compound values.
QThread gained the ability to set the OS thread quality of service hint using the new setServiceLevel function.
QThreadPool can also set the quality of service level for its threads using setServiceLevel.
QFile::supportsMoveToTrash() reports whether QFile::moveToTrash() is implemented on the current operating system.
QIODevice::readLineInto() allows reading a line of data into a preallocated buffer.
Use the new Q_STATIC_LOGGING_CATEGORY macro to declare a logging category that is only used in a single translation unit.
Call the new QSortFilterProxyModel::beginFilterChange() method to make sure that changes of the filtered content are recognized correctly.
QTimerEvent::matches() makes it easier to test whether a timer event belongs to a specific QBasicTimer.
QUuid::createUuidV7() allows creating unique identifiers based on RFC9562.
QCommandLineParser::showMessageAndExit() provides a convenient way to display an informative or error message to the user before exiting the application.
QHash got tryEmplace and insertOrAssign APIs to match the respective APIs from the standard library.
QSpan can now chop and slice variable- sized spans.
Qt Graphs Module
Added transparency support to Surface3D, utilizing order-independent transparency from QtQuick3D. Only approximate technique (WeightedBlended) has been implemented to QtQuick3D this far, so no accurate techniques can be used yet.
Added rootNode to allow injecting graphs to a View3D in QtQuick3D applications.
Added another picking method, doRayPicking, to be used with View3D graph injections.
Added QSpline3DSeries class to allow users render their data in splines.
Added valueColoringEnabled property to Bars3D, which allows each bar to be colored separately based on its value.
Added scaleLabelsByCount property to QAbstract3DAxis, allowing users to define whether axis labels should be scaled based on the total amount of labels.
Added labelSize property to QAbstract3DAxis, allowing users to set the sizes of axis labels by each axis.
Added support for setting the minimum and maximum rotations in X and Y directions to Bars3D, Scatter3D, and Surface3D.
Added alignment property to QAbstractAxis, allowing users to align axes left, right, top, or bottom.
Added plotArea property to QGraphsView, allowing users to define the rectangle a graph will be drawn in.
Added zooming and panning support to QGraphsView.
Added custom input handling support to area, line, pie, and scatter graphs.
Qt GRPC Module
Added the Qt GRPC Client Guide overview example.
Improved and refined all documentation and examples.
Optimized streaming RPCs for writing under high load.
Qt GUI Module
QBrush and QPen got optimized operators for comparing with or assigning from color and style values.
QPainter::setBrush() got new optimized overloads for setting a color as a solid brush.
QPainterStateGuard is a new RAII class to ensure balanced save/restore operations on a QPainter.
QColorSpace got APIs for setting and getting the four primary color space points.
Added Qt::ExpandedClientAreaHint to request that the window's client area is expanded to areas where it might be obscured by, or conflicting with other UI elements, such as the window's titlebar controls or other system UIs.
Added Qt::NoTitleBarBackgroundHint to request that the window's title bar is drawn without a background color.
Added QWindow::safeAreaMargins() to reflect the safe area of the window.
Added parsing and automatic detection of emoji sequences in text, ensuring the use of color fonts when needed as according to the Unicode specification. This parser can be disabled per layout using QTextOption::DisableEmojiParsing, or by disabling the emoji segmenter when configuring Qt.
Added QFontDatabase::addApplicationEmojiFontFamily() and related functions for customizing the default emoji font used by the application.
Added QFontInfo::variableAxes() for retrieving information about the variable axes supported by a font.
QImage::flipped() and QImage::flip() provide a Qt::Orientation based API for flipping an image, making code easier to read than the bool- based QImage::mirrored() alternative.
QRhi: when running with OpenGL ES on mobile GPUs with support present, GL_EXT_multisampled_render_to_texture is utilized whenever possible. For clients such as Qt Quick and Qt Quick 3D this potentially brings significant performance improvements in multisampled rendering on tiled GPU architectures.
QRhi: On Windows with Direct 3D 11 and 12, QWindow update requests are now driven by a dedicated vblank watcher thread, reducing CPU load and latency. This means that clients such as Qt Quick are expected to have a reduced lag when interactively dragging items by mouse or touch for example.
QRhi: Added support for variable rate shading, where applicable (Direct 3D 12, Vulkan, Metal). This enables dynamic foveation support with Qt Quick 3D XR on visionOS.
QRhi: Per-render target blending is now optionally supported for OpenGL as well.
QRhi: Added support for a number of integer and depth texture formats.
QRhi: Added support for passing in application-provided wait/signal semaphores when on Vulkan. These are then passed on to to vkQueueSubmit and Present, thus allowing integration of external rendering/compute engines that rely on multiple threads and require appropriate synchronization with the scenegraph renderer.
Use the QPdfWriter::author() property to set the author of the generated PDF document.
Qt HttpServer Module
QHttpServer can now be configured through QHttpServerConfiguration and the configuration property. Currently, this supports setting rateLimitPerSecond.
Qt Multimedia Module
Added VideoOutput::endOfStreamPolicy and Video::endOfStreamPolicy properties, allowing applications to keep the last frame in the output when the video stream is ended.
Added VideoOutput::mirrored and Video::mirrored properties, allowing applications to flip the presented video around the Y-axis.
Qt Network Module
Added setMaxConcurrentStreams which controls the SETTINGS_MAX_CONCURRENT_STREAMS HTTP/2 setting.
Qt Network Auth Module
Added QOAuth2DeviceAuthorizationFlow, implementing the Device Authorization Grant as specified in RFC 8628.
Added convenience support for token refreshing. See QAbstractOAuth2::autoRefresh, QAbstractOAuth2::refreshLeadTime, and QAbstractOAuth2::accessTokenAboutToExpire().
Made it easier to use user-agents other than the system browser. See QOAuthUriSchemeReplyHandler::handleAuthorizationRedirect().
Added QAbstractOAuth2::requestedScopeTokens and QAbstractOAuth2::grantedScopeTokens properties to simplify distinguishing between requested and granted scopes.
Added HTTPS support to QOAuthHttpServerReplyHandler. See QOAuthHttpServerReplyHandler::listen(const QSslConfiguration&, const QHostAddress&, quint16).
Added QOAuthHttpServerReplyHandler::setCallbackHost() allowing customization of the hostname part of the redirect URI.
Added QAbstractOAuth2::setNetworkRequestModifier(), enabling modification of network requests prior to sending.
Improved support for acquiring OpenID Connect ID tokens. See QAbstractOAuth2::idToken, QAbstractOAuth2::nonce, and QAbstractOAuth2::nonceMode.
Added QAbstractOAuth2::serverReportedErrorOccurred() signal which deprecates the previous QAbstractOAuth2::error() signal. The new signal name clearly indicates that these errors correspond specifically to the cases defined in RFC 6749, rather than general errors.
Qt Protobuf Module
Improved and refined all documentation.
Added the HEADER_GUARD option to specify the mechanism used to guard generated header files.
Added the protobuf-unsafe-registry feature to trade safety for performance on accessing custom protobuf serializers.
Qt QML Module
QML Language Server now provides an outline view of the document structure. This allows clients (e.g., IDEs or code editors) to represent a qml document’s structure as an interactive outline, displaying objects, properties, methods and other code elements in a hierarchical view.
Added the maximum line length feature to qmlformat: qmlformat now controls where to break lines based on a maximum allowed line length, ensuring a consistent and readable QML document.
Qt Quick Module
Added SafeArea attached property to manage safe areas of an Item or Window.
Added Shear component for a convenient way of applying shearing transforms to items.
Added FontMetrics::capitalHeight property, which was previously missing from the Qt Quick API.
Added FontInfo type for retrieving the results of font resolution, matching the QFontInfo class in C++.
Reintroduced support for the FramebufferObject rendering mode of QQuickPaintedItem when the graphics API in use is OpenGL. This is provided as a porting aid for Qt 5 era applications that require the use of QPainter's legacy OpenGL paint engine for their QQuickPaintedItems.
Optimized the scenegraph renderer's buffer pooling logic to prevent spikes in memory usage in scenes with large geometries. Additionally, there is a reduction in overhead for scenes with a lot of items, in particular when running with OpenGL.
Qt Quick Controls Module
Added ContextMenu. This can be attached to any item in order to show a context menu upon a platform-specific event, such as a right click or the context menu key.
Qt Quick Effects Module
New RectangularShadow element for fast rounded rectangle shaped shadow/glow. The API is similar to CSS box-shadow, with color, offset, spread and blur values.
Qt Quick 3D Module
Added WeightedBlended Order Independent Transparency (OIT) implementation for rendering transparent objects.
Added support for 32-bit unsigned integer texture formats.
Improved control over shadow map bounds for instancing models, potentially allowing for better performance when calculating becomes expensive.
Added support for 4K shadow maps with a new 'Ultra' resolution setting.
Added the option of forcing medium precision for floats in GLSL ES fragment shaders. Provided mainly as a tool for performance tuning. Set the environment variable QT_QUICK3D_MEDIUM_PRECISION to a non-zero value. Has no effect on other kinds of shaders (and that includes non-ES GLSL too).
DebugView now supports visualizing bounds for point light shadows.
Ported the built-in geometries from Qt 3D to QtQuick3D.Helpers. PlaneGeometry, SphereGeometry, CylinderGeometry, ConeGeometry, and TorusGeometry are now available in QtQuick3D.Helpers.
Added a port of the ExtrudedTextMesh from Qt 3D to QtQuick3D.Helpers.
Added support for using instancing with custom materials in the material editor.
Qt Quick 3D XR Module
Added support for haptic output with controllers using amplitude, duration, and frequency through a new XrHapticFeedback item.
Added new property in XrInputAction to conditionally disable an action without having to test for it in all the handler functions.
Added Metal backend for OpenXR to support running in Meta XR Simulator on macOS.
The property multiViewRenderingEnabled is now read-only and toggling multiview rendering is no longer possible at run-time. If multiview rendering is supported, it is enabled for the lifetime of the application. In porting situations, where multiview rendering is not desired, it can be disabled by setting the environment variable QT_QUICK3D_XR_DISABLE_MULTIVIEW to a non-zero value.
Qt Quick VectorImage Module
Added preliminary support for color animations and transform animations, matching the current support in Qt Svg.
Qt Sql Module
QSqlDriver gained a new function connectionName() which returns the connection name of the associated QSqlDatabase instance.
QSqlQueryModel can now refresh the database with refresh() when e.g. the database was modified from outside of Qt so it needs to be re-read.
Qt SVG Module
Added three new values to QtSvg::Options to disable animations.
Support CSS animation for fill, stroke, and transform properties.
Qt VirtualKeyboard Module
Added a new Japanese layout which uses flick keys.
Added support for adjusting key sound volume.
Qt WebEngine Module
Has switched internal rendering to use ANGLE, also when Qt uses OpenGL RHI. Improving performance and bug similarity to Chrome.
QWebEngineProfileBuilder and QML WebEngineProfilePrototype added to configure profiles before creating them and avoiding race conditions.
QWebEngineLoadingInfo added an isDownload property to indicate the load is related to a download.
QWebEngineUrlRequestInfo also added an isDownload() method to indicate the request is related to a download.
QWebEngineSettings and QML WebEngineSettings added three new settings. PrintHeaderAndFooter, and PreferCSSMarginsForPrinting to configure printing. And TouchEventsApiEnabled to turn off TouchEvents API, which some web sites use as a trigger for mobile mode.
Qt Widgets Module
QAbstractItemView got a new property updateThreshold to specify when a full view update should be done instead trying to figure out the parts where something changed within dataChanged(). This is especially useful when a lot of items change in a large model as the update rect calculation might take longer than a full view update.
QComboBox can draw its label using the item view's delegate by setting the labelDrawingMode property to UseDelegate.
QHeaderView has been optimized to dramatically reduce memory usage for huge models as long as the sections are not resized, hidden or reordered.
The identifier set as the QWidget::accessibleIdentifier can be used by assistive technologies and by automated testing tools to identify a specific widget.
The dock location of a QDockWidget can not be explicitly set using the QDockWidget::dockLocation property.
QStackedWidget now emits the widgetAdded() signal when a new widgets is added to the stack.
Qt XML Module
QDomNodeList got an iterator API.
Tools
QDoc Documentation Generator
QDoc now accepts formatting commands in macro arguments.
Authors can now override the underlying return type of a function that's documented with an fn-command with auto.
QDoc can now generate documentation from comments in C++ headers. This is added as a technical preview in QDoc with Qt 6.9, and we'd love to get feedback from our users. Enable the documentationinheaders QDoc configuration variable to try it out.
QML enumeration documentation can be generated from C++ enumerations with the new qmlenumeratorsfrom command.
The generatelist and annotatedlist commands now support custom sort order for the generated lists.
deprecated accepts future versions, and QDoc generates appropriate text when it recognizes a version as being in the future.
Clang library requirements: QDoc requires Clang libraries from LLVM 17. It's also confirmed to work with Clang libraries from LLVM 18, 19, and 20.
QDoc now supports adjusting the CMake requisites for third-party projects with the cmakecomponent, cmakepackage, and cmaketargetitem commands.
Example-related warnings are now configurable through the new examples.warnaboutmissingimages and examples.warnaboutmissingprojectfiles configuration variables.
QDoc can now generate tooltips for images in your documentation. The documentation for the new usealttextastitle configuration variable describes how to enable this for your project.
Platform Changes
Build System Changes
Building Qt and using Qt in CMake projects now requires CMake version 3.22 or later.
Desktop Platforms
Windows
Added new public CMake API:
Added the qt_add_win_app_sdk CMake function to add Windows App SDK to the project.
Added support for rendering additional emoji font formats, such as CBDT and COLRv1.
Wayland Client on Linux
Added support for the new xdg-toplevel-icon-v1 protocol to make QWindow::setIcon() work if the compositor supports this protocol as well.
The underlying wl_surface of a window now shares its lifetime and is no longer destroyed when the window is hidden.
Mobile Platforms
Android
Support uncompressed native libs within APKs and remove the need for packagingOptions.jniLibs.useLegacyPackaging true.
Introduce qt_add_android_permission() CMake function.
Add QT_ANDROID_COMPILE_SDK_VERSION CMake property to set the SDK level for building Java code.
Add QT_ANDROID_APP_ICON CMake property to set an app's icon.
Add QT_ANDROID_APP_NAME CMake property to set an app's name.
Decouple location and bluetooth permissions for API level 31+.
Allow setting a maximum for queued background UI events.
Add script to easily deploy, run apps and get logs from terminal.
Qt Quick for Android and QtQuickView:
Add setData() and dataChanged() methods to QtAbstractItemModel.
Add OnDataChangedListerner callback interface.
QtQuickViewContent: Add onStatusChanged() overload that passes the underlying QtQuickViewContent object.
Support multiple embedded views from an Android Service.
Embedded Platforms
Boot to Qt
Support was added for Yocto 5.1 (Styhead).
The Support Levels for Target Hardware was updated with new supported boards for Tier 1:
NVIDIA Jetson AGX Orin Developer Kit (Boot to Qt, upgraded from Tier 2).
The Support Levels for Target Hardware was updated with new supported boards for Tier 2:
Toradex Apalis iMX6 (Boot to Qt, downgraded from Tier 1).
The Support Levels for Target Hardware was updated with new supported boards for Tier 3:
Qualcomm RB3 Gen 2 Vision Kit (Boot to Qt).
NXP i.MX 8M Mini LPDDR4 EVK (Boot to Qt, downgraded from Tier 2).
NXP i.MX 8M Nano LPDDR4 EVK (Boot to Qt, downgraded from Tier 2).
NXP i.MX 8M Plus LPDDR4 EVK (Boot to Qt, downgraded from Tier 2).
The following boards are no longer supported:
NVIDIA Jetson AGX Xavier Developer Kit (Boot to Qt).
Amazon AWS EC2 ARM64 (Boot to Qt).
TI SK-AM69 (Boot to Qt).
NXP i.MX 8MQuad EVK (Boot to Qt).
NXP i.MX 8QuadXPlus MEK (Boot to Qt).
Qualcomm Robotics RB5 Development Kit (Boot to Qt).
RealTime OSs