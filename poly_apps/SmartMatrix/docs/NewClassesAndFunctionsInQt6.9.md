

New Classes and Functions in Qt 6.9
This page contains a comprehensive list of all new classes and functions introduced in Qt 6.9.

New Classes
New Member Functions
New Macros
New Enum Types
New Enum Values
New Type Aliases
New Properties
New QML Types
New QML Properties
New QML Signals
New QML Methods
New Classes
FQFontVariableAxis
HQHttpServerConfiguration
NNativeShadingRateMap (QRhiShadingRateMap)
OQOAuth2DeviceAuthorizationFlow
PPrimaryPoints (QColorSpace) QPainterStateGuard
RQRhiShadingRateMap QRhiVulkanQueueSubmitParams
SQSpline3DSeries
TTryEmplaceResult (QHash)
WQWebEngineProfileBuilder
New Member Functions
Class QAbstractHttpServer:

(since 6.9) QHttpServerConfiguration	configuration() const
(since 6.9) void	setConfiguration(const QHttpServerConfiguration &config)

Class QAbstractOAuth2:

(since 6.9) void	accessTokenAboutToExpire()
(since 6.9) void	refreshTokens()
(since 6.9) void	refreshTokensImplementation()
(since 6.9) void	serverReportedErrorOccurred(const QString &error, const QString &errorDescription, const QUrl &uri)
(since 6.9) void	setNetworkRequestModifier(const QAbstractOAuth2::ContextTypeForFunctor<Functor> *context, Functor &&callback)

Class QAnyStringView:

(since 6.9) QString	arg(Args &&... args) const

Class QBrush:

(since 6.9) QBrush &	operator=(QColor color)
(since 6.9) QBrush &	operator=(Qt::BrushStyle style)
(since 6.9) QBrush &	operator=(Qt::GlobalColor color)

Class QByteArray:

(since 6.9) QByteArray	operator+(QByteArrayView lhs, const QByteArray &rhs)
(since 6.9) QByteArray	operator+(const QByteArray &lhs, QByteArrayView rhs)

Class QColorSpace:

(since 6.9) QColorSpace::PrimaryPoints	primaryPoints() const
(since 6.9) void	setPrimaryPoints(const QColorSpace::PrimaryPoints &primaryPoints)

Class QCommandLineParser:

(since 6.9) void	showMessageAndExit(QCommandLineParser::MessageType type, const QString &message, int exitCode)

Class QDebug:

(since 6.9) QDebug &	operator<<(const std::tuple<Ts...> &tuple)
(since 6.9) QDebug	operator<<(QDebug debug, T t)
(since 6.9) QDebug	operator<<(QDebug debug, const std::array<T, N> &array)
(since 6.9) QDebug	operator<<(QDebug debug, const std::multiset<Key, Compare, Alloc> &multiset)
(since 6.9) QDebug	operator<<(QDebug debug, const std::set<Key, Compare, Alloc> &set)
(since 6.9) QDebug	operator<<(QDebug debug, const std::unordered_map<Key, T, Hash, KeyEqual, Alloc> &map)
(since 6.9) QDebug	operator<<(QDebug debug, const std::unordered_set<Key, Hash, KeyEqual, Alloc> &unordered_set)
(since 6.9) QByteArray	toBytes(const T &object)

Class QDockWidget:

(since 6.9) void	setDockLocation(Qt::DockWidgetArea area)

Class QDomNodeList:

(since 6.9) QDomNodeList::const_iterator	begin() const
(since 6.9) QDomNodeList::const_iterator	cbegin() const
(since 6.9) QDomNodeList::const_iterator	cend() const
(since 6.9) QDomNodeList::const_iterator	constBegin() const
(since 6.9) QDomNodeList::const_iterator	constEnd() const
(since 6.9) QDomNodeList::const_reverse_iterator	crbegin() const
(since 6.9) QDomNodeList::const_reverse_iterator	crend() const
(since 6.9) QDomNodeList::const_iterator	end() const
(since 6.9) QDomNodeList::const_reverse_iterator	rbegin() const
(since 6.9) QDomNodeList::const_reverse_iterator	rend() const

Class QFile:

(since 6.9) bool	supportsMoveToTrash()

Class QFontDatabase:

(since 6.9) void	addApplicationEmojiFontFamily(const QString &familyName)
(since 6.9) QStringList	applicationEmojiFontFamilies()
(since 6.9) bool	removeApplicationEmojiFontFamily(const QString &familyName)
(since 6.9) void	setApplicationEmojiFontFamilies(const QStringList &familyNames)

Class QFontInfo:

(since 6.9) QList<QFontVariableAxis>	variableAxes() const

Class QHash:

(since 6.9) QHash<Key, T>::TryEmplaceResult	insertOrAssign(K &&key, Value &&value)
(since 6.9) QHash<Key, T>::TryEmplaceResult	insertOrAssign(Key &&key, Value &&value)
(since 6.9) QHash<Key, T>::TryEmplaceResult	insertOrAssign(const Key &key, Value &&value)
(since 6.9) std::pair<QHash<Key, T>::key_value_iterator, bool>	insert_or_assign(K &&key, Value &&value)
(since 6.9) std::pair<QHash<Key, T>::key_value_iterator, bool>	insert_or_assign(Key &&key, Value &&value)
(since 6.9) std::pair<QHash<Key, T>::key_value_iterator, bool>	insert_or_assign(const Key &key, Value &&value)
(since 6.9) QHash<Key, T>::key_value_iterator	insert_or_assign(QHash<Key, T>::const_iterator hint, K &&key, Value &&value)
(since 6.9) QHash<Key, T>::key_value_iterator	insert_or_assign(QHash<Key, T>::const_iterator hint, Key &&key, Value &&value)
(since 6.9) QHash<Key, T>::key_value_iterator	insert_or_assign(QHash<Key, T>::const_iterator hint, const Key &key, Value &&value)
(since 6.9) size_t	qHash(T key, size_t seed)
(since 6.9) QHash<Key, T>::TryEmplaceResult	tryEmplace(K &&key, Args &&... args)
(since 6.9) QHash<Key, T>::TryEmplaceResult	tryEmplace(Key &&key, Args &&... args)
(since 6.9) QHash<Key, T>::TryEmplaceResult	tryEmplace(const Key &key, Args &&... args)
(since 6.9) QHash<Key, T>::TryEmplaceResult	tryInsert(K &&key, const T &value)
(since 6.9) QHash<Key, T>::TryEmplaceResult	tryInsert(const Key &key, const T &value)
(since 6.9) std::pair<QHash<Key, T>::key_value_iterator, bool>	try_emplace(K &&key, Args &&... args)
(since 6.9) std::pair<QHash<Key, T>::key_value_iterator, bool>	try_emplace(Key &&key, Args &&... args)
(since 6.9) std::pair<QHash<Key, T>::key_value_iterator, bool>	try_emplace(const Key &key, Args &&... args)
(since 6.9) QHash<Key, T>::key_value_iterator	try_emplace(QHash<Key, T>::const_iterator hint, K &&key, Args &&... args)
(since 6.9) QHash<Key, T>::key_value_iterator	try_emplace(QHash<Key, T>::const_iterator hint, Key &&key, Args &&... args)
(since 6.9) QHash<Key, T>::key_value_iterator	try_emplace(QHash<Key, T>::const_iterator hint, const Key &key, Args &&... args)

Class QHttp2Configuration:

(since 6.9) unsigned int	maxConcurrentStreams() const
(since 6.9) void	setMaxConcurrentStreams(unsigned int value)

Class QIODevice:

(since 6.9) QByteArrayView	readLineInto(QSpan<char> buffer)
(since 6.9) QByteArrayView	readLineInto(QSpan<std::byte> buffer)
(since 6.9) QByteArrayView	readLineInto(QSpan<uchar> buffer)
(since 6.9) bool	readLineInto(QByteArray *line, qint64 maxSize)

Class QImage:

(since 6.9) void	flip(Qt::Orientations orient)
(since 6.9) QImage	flipped(Qt::Orientations orient) &&
(since 6.9) QImage	flipped(Qt::Orientations orient) const &

Class QJniArray:

(since 6.9) QJniArray<T>::reference	operator[](QJniArrayBase::size_type i)

Class QJsonValue:

(since 6.9) QJsonValue	fromJson(QByteArrayView json, QJsonParseError *error)
(since 6.9) QByteArray	toJson(QJsonValue::JsonFormat format) const

Class QLatin1StringView:

(since 6.9) QByteArray	toUtf8() const

Class QList:

(since 6.9) auto	operator<=>(const QList<T> &lhs, const QList<T> &rhs)

Class QMediaMetaData:

(since 6.9) auto	asKeyValueRange() const

Class QMetaEnum:

(since 6.9) bool	is64Bit() const
(since 6.9) std::optional<quint64>	keyToValue64(const char *key) const
(since 6.9) std::optional<quint64>	value64(int index) const

Class QMetaMethod:

(since 6.9) QByteArrayView	nameView() const

Class QOAuth2AuthorizationCodeFlow:

(since 6.9) void	refreshTokensImplementation()

Class QOAuth2DeviceAuthorizationFlow:

(since 6.9) void	refreshTokensImplementation()

Class QOAuthHttpServerReplyHandler:

(since 6.9) QString	callbackHost() const
(since 6.9) void	setCallbackHost(const QString &host)

Class QOAuthUriSchemeReplyHandler:

(since 6.9) bool	handleAuthorizationRedirect(const QUrl &url)

Class QOpcUaAuthenticationInformation:

(since 6.9) void	setCertificateAuthentication(const QString &certificatePath, const QString &privateKeyPath)

Class QPainter:

(since 6.9) void	setBrush(QColor color)
(since 6.9) void	setBrush(Qt::GlobalColor color)

Class QPdfWriter:

(since 6.9) QString	author() const
(since 6.9) void	setAuthor(const QString &author)

Class QPen:

(since 6.9) QPen &	operator=(QColor color)
(since 6.9) QPen &	operator=(Qt::PenStyle style)

Class QQuickWidget:

(since 6.9) void	loadFromModule(QAnyStringView uri, QAnyStringView typeName)
(since 6.9) void	setInitialProperties(const QVariantMap &initialProperties)

Class QRhi:

(since 6.9) QRhiShadingRateMap *	newShadingRateMap()
(since 6.9) void	setQueueSubmitParams(QRhiNativeHandles *params)
(since 6.9) QList<QSize>	supportedShadingRates(int sampleCount) const

Class QRhiCommandBuffer:

(since 6.9) void	setShadingRate(const QSize &coarsePixelSize)

Class QRhiSwapChain:

(since 6.9) void	setShadingRateMap(QRhiShadingRateMap *map)
(since 6.9) QRhiShadingRateMap *	shadingRateMap() const

Class QRhiTextureRenderTargetDescription:

(since 6.9) void	setShadingRateMap(QRhiShadingRateMap *map)
(since 6.9) QRhiShadingRateMap *	shadingRateMap() const

Class QSerialPort:

(since 6.9) void	settingsRestoredOnCloseChanged(bool restore)

Class QShaderBaker:

(since 6.9) void	setGlslOptions(QShaderBaker::GlslOptions options)

Class QSharedPointer:

(since 6.9) QSharedPointer<X>	constCast() &&
(since 6.9) QSharedPointer<X>	dynamicCast() &&
(since 6.9) QSharedPointer<X>	objectCast() &&
(since 6.9) QSharedPointer<X>	qSharedPointerCast(QSharedPointer<T> &&other)
(since 6.9) QSharedPointer<X>	qSharedPointerConstCast(QSharedPointer<T> &&src)
(since 6.9) QSharedPointer<X>	qSharedPointerDynamicCast(QSharedPointer<T> &&src)
(since 6.9) QSharedPointer<X>	qSharedPointerObjectCast(QSharedPointer<T> &&src)
(since 6.9) QSharedPointer<X>	staticCast() &&

Class QSortFilterProxyModel:

(since 6.9) void	beginFilterChange()

Class QSpan:

(since 6.9) void	chop(QSpan<T, E>::size_type n)
(since 6.9) auto	chopped(QSpan<T, E>::size_type n) const
(since 6.9) void	slice(QSpan<T, E>::size_type pos)
(since 6.9) void	slice(QSpan<T, E>::size_type pos, QSpan<T, E>::size_type n)

Class QSqlDriver:

(since 6.9) QString	connectionName() const

Class QSqlQueryModel:

(since 6.9) void	refresh()

Class QStackedLayout:

(since 6.9) void	widgetAdded(int index)

Class QStackedWidget:

(since 6.9) void	widgetAdded(int index)

Class QString:

(since 6.9) QString	operator+(QStringView lhs, const QString &rhs)
(since 6.9) QString	operator+(const QString &lhs, QStringView rhs)
(since 6.9) QString &	setUnicode(const char16_t *unicode, qsizetype size)
(since 6.9) QString &	setUtf16(const char16_t *unicode, qsizetype size)

Class QStringList:

(since 6.9) QStringList	filter(const QLatin1StringMatcher &matcher) const

Class QThread:

(since 6.9) QThread::QualityOfService	serviceLevel() const
(since 6.9) void	setServiceLevel(QThread::QualityOfService serviceLevel)

Class QThreadPool:

(since 6.9) QThread::QualityOfService	serviceLevel() const
(since 6.9) void	setServiceLevel(QThread::QualityOfService serviceLevel)

Class QTimerEvent:

(since 6.9) bool	matches(const QBasicTimer &timer) const

Class QUtf8StringView:

(since 6.9) QString	arg(Args &&... args) const

Class QUuid:

(since 6.9) QUuid	createUuidV7()

Class QWebEngineUrlRequestInfo:

(since 6.9) bool	isDownload() const

Class QWindow:

(since 6.9) QMargins	safeAreaMargins() const
(since 6.9) void	safeAreaMarginsChanged(QMargins margins)

Class QXYSeries:

(since 6.9) void	pointsAdded(qsizetype start, qsizetype end)

New Macros
(since 6.9)	QCOMPARE_3WAY(lhs, rhs, order)
(since 6.9)	Q_CONSTEXPR_DTOR
(since 6.9)	Q_DECL_CONSTEXPR_DTOR
(since 6.9)	Q_DECL_EQ_DELETE_X(reason)
(since 6.9)	Q_DISABLE_COPY_MOVE_X(Class, reason)
(since 6.9)	Q_DISABLE_COPY_X(Class, reason)
(since 6.9)	Q_LIKELY_BRANCH
(since 6.9)	Q_STATIC_LOGGING_CATEGORY(name, string, msgType)
(since 6.9)	Q_STATIC_LOGGING_CATEGORY(name, string)
(since 6.9)	Q_UNLIKELY_BRANCH
New Enum Types
(since 6.9) enum class	NonceMode { Automatic, Enabled, Disabled }
(since 6.9) enum class	LabelDrawingMode { UseStyle, UseDelegate }
(since 6.9) enum class	MessageType { Information, Error }
(since 6.9) enum class	AccessLevelExBit { None, CurrentRead, CurrentWrite, HistoryRead, HistoryWrite, …, Constant }
(since 6.9) enum class	QualityOfService { Auto, High, Eco }
(since 6.9) enum class	TransparencyTechnique { Default, Approximate, Accurate }
New Enum Values
enum value	Error::ClientError
enum value	Error::ExpiredError
enum value	Flag::DisableEmojiParsing
enum value	Flag::ShowDefaultIgnorables
enum value	Language::KaraKalpak
enum value	Language::SwampyCree
enum value	NodeAttribute::AccessLevelEx
enum value	NodeAttribute::AccessRestrictions
enum value	NodeAttribute::RolePermissions
enum value	NodeAttribute::UserRolePermissions
enum value	Option::DisableAnimations
enum value	Option::DisableCSSAnimations
enum value	Option::DisableSMILAnimations
enum value	ReferenceTypeId::AlarmSuppressionGroupMember
enum value	ReferenceTypeId::HasReferenceDescription
enum value	Role::BlockQuote
enum value	Script::Script_Garay
enum value	Script::Script_GurungKhema
enum value	Script::Script_KiratRai
enum value	Script::Script_OlOnal
enum value	Script::Script_Sunuwar
enum value	Script::Script_Todhri
enum value	Script::Script_TuluTigalari
enum value	TabFeature::MinimumSizeHint
enum value	Type::SafeAreaMarginsChange
enum value	UnicodeVersion::Unicode_16_0
enum value	UnixProcessFlag::DisableCoreDumps
enum value	ViewItemFeature::IsDecoratedRootColumn
enum value	ViewItemFeature::IsDecorationForRootColumn
enum value	WindowType::ExpandedClientAreaHint
enum value	WindowType::NoTitleBarBackgroundHint
enum value	WriteMaskBit::AccessLevelEx
enum value	WriteMaskBit::AccessRestrictions
enum value	WriteMaskBit::DataTypeDefinition
enum value	WriteMaskBit::RolePermissions
New Type Aliases
(since 6.9)	const_iterator
(since 6.9)	const_pointer
(since 6.9)	const_reference
(since 6.9)	const_reverse_iterator
(since 6.9)	difference_type
(since 6.9)	pointer
(since 6.9)	reference
(since 6.9)	value_type
(since 6.9)	JsonFormat
New Properties
(since 6.9) transparencyTechnique : const
(since 6.9) labelSize : const
(since 6.9) scaleLabelsByCount : const
(since 6.9) alignment : const
(since 6.9) updateThreshold : const
(since 6.9) autoRefresh : const
(since 6.9) grantedScopeTokens : const
(since 6.9) idToken : const
(since 6.9) nonce : const
(since 6.9) nonceMode : const
(since 6.9) refreshLeadTime : const
(since 6.9) requestedScopeTokens : const
(since 6.9) tokenUrl : const
(since 6.9) valueColoringEnabled : const
(since 6.9) labelDrawingMode : const
(since 6.9) dockLocation : const
(since 6.9) settingsRestoredOnClose : const
(since 6.9) pan : const
(since 6.9) zoom : const
(since 6.9) isDownload : const
(since 6.9) accessibleIdentifier : const
New QML Types
CConeGeometry ContextMenu CuboidGeometry CylinderGeometry
DDelegateChoice DelegateChooser
EExtrudedTextGeometry
FFontInfo
PPlaneGeometry
SSafeArea Shear SphereGeometry Spline3DSeries
TTableViewDelegate TorusGeometry
XXrHapticEffect XrHapticFeedback XrSimpleHapticEffect
New QML Properties
QML Type Abstract3DAxis:

(since 6.9)	labelSize : real
(since 6.9)	scaleLabelsByCount : bool

QML Type AbstractAxis:

(since 6.9)	alignment : alignment

QML Type ApplicationWindow:

(since 6.9)	bottomPadding : real
(since 6.9)	leftPadding : real
(since 6.9)	rightPadding : real
(since 6.9)	topPadding : real

QML Type DebugSettings:

(since 6.9)	drawPointLightShadowBoxes : bool

QML Type DirectionalLight:

(since 6.9)	lockShadowmapTexels : bool

QML Type DynamicRigidBody:

(since 6.9)	isSleeping : bool

QML Type Flickable:

(since 6.9)	acceptedButtons : flags

QML Type FontMetrics:

(since 6.9)	capitalHeight : real

QML Type GraphsItem3D:

(since 6.9)	maxCameraXRotation : real
(since 6.9)	maxCameraYRotation : real
(since 6.9)	minCameraXRotation : real
(since 6.9)	minCameraYRotation : real
(since 6.9)	rootNode : Node
(since 6.9)	transparencyTechnique : Graphs3D.TransparencyTechnique

QML Type GraphsView:

(since 6.9)	plotArea : rect

QML Type Light:

(since 6.9)	use32BitShadowmap : bool

QML Type OrbitCameraController:

(since 6.9)	acceptedButtons : Qt::MouseButtons
(since 6.9)	automaticClipping : bool

QML Type Path:

(since 6.9)	asynchronous : bool

QML Type RandomInstancing:

(since 6.9)	gridSpacing : vector3d

QML Type SceneEnvironment:

(since 6.9)	oitMethod : enumeration

QML Type ValueAxis:

(since 6.9)	pan : real
(since 6.9)	zoom : real

QML Type Video:

(since 6.9)	endOfStreamPolicy : enumeration
(since 6.9)	orientation : int

QML Type VideoOutput:

(since 6.9)	endOfStreamPolicy : enumeration
(since 6.9)	mirrored : bool

QML Type XrInputAction:

(since 6.9)	enabled : bool

New QML Signals
(since 6.9)	pointsAdded(int start, int end)
(since 6.9)	textEdited()
New QML Methods
QML Type Video:

(since 6.9)	clearOutput()

QML Type VideoOutput:

(since 6.9) void	clearOutput()
