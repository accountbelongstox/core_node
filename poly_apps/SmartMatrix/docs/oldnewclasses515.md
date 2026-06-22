New Classes and Functions in Qt 5.15
This page contains a comprehensive list of all new classes and functions introduced in Qt 5.15. Links to new APIs in previous Qt 5 releases are found at the bottom of this page.

New Classes
New Member Functions
New Global Functions
New Enum Types
New Properties
New QML Types
New QML Properties
New QML Signals
New QML Methods
New Classes
FFromBase64Result (QByteArray)
HQHelpFilterSettingsWidget QHelpLink
NNativeTexture (QSGTexture)
PQPdfDestination QPdfSelection
QQQuick3D QQuick3DGeometry QQuick3DObject
RQRenderCapabilities (Qt3DRender)
New Member Functions
Class FromBase64Result:

bool	operator!=(const QMetaType &a, const QMetaType &b)
bool	operator==(const QMetaType &a, const QMetaType &b)

Class QChar:

bool	operator!=(const QMetaType &a, const QMetaType &b)
bool	operator==(const QMetaType &a, const QMetaType &b)

Class QConcatenateTablesProxyModel:

QList<QAbstractItemModel *>	sourceModels() const

Class QFileInfo:

bool	isJunction() const

Class QHash:

void	insert(const QHash<K, V> &other)

Class QIdentityProxyModel:

virtual bool	moveColumns(const QModelIndex &sourceParent, int sourceColumn, int count, const QModelIndex &destinationParent, int destinationChild) override
virtual bool	moveRows(const QModelIndex &sourceParent, int sourceRow, int count, const QModelIndex &destinationParent, int destinationChild) override

Class QKeyValueIterator:

bool	operator!=(const QMetaType &a, const QMetaType &b)
QKeyValueIterator::pointer	operator->() const
bool	operator==(const QMetaType &a, const QMetaType &b)

Class QMap:

void	insert(const QMap<Key, T> &map)

Class QMetaProperty:

bool	isRequired() const

Class QMetaType:

QMetaType	fromType()
::QByteArray	name() const
bool	operator!=(const QMetaType &a, const QMetaType &b)
bool	operator==(const QMetaType &a, const QMetaType &b)

Class QPair:

bool	operator!=(const QMetaType &a, const QMetaType &b)
bool	operator==(const QMetaType &a, const QMetaType &b)

Class QProcess:

QStringList	splitCommand(QStringView command)

Class QRegularExpression:

QString	anchoredPattern(QStringView expression)
QString	escape(QStringView str)
QString	wildcardToRegularExpression(QStringView pattern)

Class QResource:

QByteArray	uncompressedData() const
qint64	uncompressedSize() const

Class QScopedPointer:

bool	operator!=(const QMetaType &a, const QMetaType &b)
bool	operator==(const QMetaType &a, const QMetaType &b)

Class QSignalMapper:

void	mappedInt(int i)
void	mappedObject(QObject *object)
void	mappedString(const QString &text)
void	mappedWidget(QWidget *widget)

Class QSocketNotifier:

void	activated(QSocketDescriptor socket, QSocketNotifier::Type type)

Class QSortFilterProxyModel:

void	filterCaseSensitivityChanged(Qt::CaseSensitivity filterCaseSensitivity)
void	filterRoleChanged(int filterRole)
void	recursiveFilteringEnabledChanged(bool recursiveFilteringEnabled)
void	sortCaseSensitivityChanged(Qt::CaseSensitivity sortCaseSensitivity)
void	sortLocaleAwareChanged(bool sortLocaleAware)
void	sortRoleChanged(int sortRole)

Class QStateMachine:

int	postDelayedEvent(QEvent *event, int delay)

Class QString:

bool	isValidUtf16() const

Class QStringView:

bool	isValidUtf16() const

Class QThread:

bool	wait(QDeadlineTimer deadline)

Class QTranslator:

QString	filePath() const
QString	language() const

Class QVarLengthArray:

bool	operator!=(const QMetaType &a, const QMetaType &b)
bool	operator==(const QMetaType &a, const QMetaType &b)

Class QXmlStreamReader:

int	entityExpansionLimit() const
void	setEntityExpansionLimit(int limit)

Class qfloat16:

qfloat16	copySign(qfloat16 sign) const

Class QColorSpace:

QVariant	operator QVariant() const

Class QCursor:

QBitmap	bitmap(Qt::ReturnByValueConstant) const
QBitmap	mask(Qt::ReturnByValueConstant) const

Class QPdfWriter:

void	addFileAttachment(const QString &fileName, const QByteArray &data, const QString &mimeType)
QByteArray	documentXmpMetadata() const
void	setDocumentXmpMetadata(const QByteArray &xmpMetadata)

Class QPlatformWindow:

virtual bool	startSystemMove()
virtual bool	startSystemResize(Qt::Edges edges)

Class QScreen:

QScreen *	virtualSiblingAt(QPoint point)

Class QVulkanInstance:

void	presentAboutToBeQueued(QWindow *window)

Class QVulkanWindow:

uint32_t	graphicsQueueFamilyIndex() const
void	setQueueCreateInfoModifier(const QVulkanWindow::QueueCreateInfoModifier &modifier)

Class QWindow:

bool	startSystemMove()
bool	startSystemResize(Qt::Edges edges)

Class QHelpEngineCore:

QList<QHelpLink>	documentsForIdentifier(const QString &id) const
QList<QHelpLink>	documentsForIdentifier(const QString &id, const QString &filterName) const
QList<QHelpLink>	documentsForKeyword(const QString &keyword) const
QList<QHelpLink>	documentsForKeyword(const QString &keyword, const QString &filterName) const

Class QHelpFilterEngine:

QList<QVersionNumber>	availableVersions() const
QStringList	indices() const
QStringList	indices(const QString &filterName) const

Class QHelpIndexModel:

QHelpEngineCore *	helpEngine() const

Class QHelpIndexWidget:

void	documentActivated(const QHelpLink &document, const QString &keyword)
void	documentsActivated(const QList<QHelpLink> &documents, const QString &keyword)

Class QCamera:

void	errorOccurred(QCamera::Error value)

Class QMediaPlayer:

void	setVideoOutput(const QVector<QAbstractVideoSurface *> &surfaces)

Class QVideoFrame:

QImage	image() const

Class QAbstractSocket:

void	errorOccurred(QAbstractSocket::SocketError socketError)

Class QLocalSocket:

void	errorOccurred(QLocalSocket::LocalSocketError socketError)

Class QNetworkAccessManager:

void	setTransferTimeout(int timeout)
int	transferTimeout() const

Class QNetworkReply:

void	errorOccurred(QNetworkReply::NetworkError code)

Class QNetworkRequest:

void	setTransferTimeout(int timeout)
int	transferTimeout() const

Class QSslCertificate:

QList<QSslCertificate>	fromPath(const QString &path, QSsl::EncodingFormat format, QSslCertificate::PatternSyntax syntax)

Class QSslConfiguration:

void	addCaCertificate(const QSslCertificate &certificate)
bool	addCaCertificates(const QString &path, QSsl::EncodingFormat format, QSslCertificate::PatternSyntax syntax)
void	addCaCertificates(const QList<QSslCertificate> &certificates)

Class QSslSocket:

void	newSessionTicketReceived()
QList<QSslError>	sslHandshakeErrors() const

Class QSGTexture:

QSGTexture::NativeTexture	nativeTexture() const

Class QSvgRenderer:

QTransform	transformForElement(const QString &id) const

Class QWebSocket:

quint64	maxAllowedIncomingFrameSize() const
quint64	maxAllowedIncomingMessageSize() const
quint64	maxIncomingFrameSize()
quint64	maxIncomingMessageSize()
quint64	maxOutgoingFrameSize()
quint64	outgoingFrameSize() const
void	setMaxAllowedIncomingFrameSize(quint64 maxAllowedIncomingFrameSize)
void	setMaxAllowedIncomingMessageSize(quint64 maxAllowedIncomingMessageSize)
void	setOutgoingFrameSize(quint64 outgoingFrameSize)

Class QButtonGroup:

void	idClicked(int id)
void	idPressed(int id)
void	idReleased(int id)
void	idToggled(int id, bool checked)

Class QLabel:

QPicture	picture(Qt::ReturnByValueConstant) const
QPixmap	pixmap(Qt::ReturnByValueConstant) const

Class QTabBar:

bool	isTabVisible(int index) const
void	setTabVisible(int index, bool visible)

Class QTabWidget:

bool	isTabVisible(int index) const
void	setTabVisible(int index, bool visible)

Class QWizard:

QList<int>	visitedIds() const

Class QDomDocument:

bool	setContent(QXmlStreamReader *reader, bool namespaceProcessing, QString *errorMsg, int *errorLine, int *errorColumn)

New Global Functions
bool	operator!=(const QMetaType &a, const QMetaType &b)
bool	operator==(const QMetaType &a, const QMetaType &b)
New Enum Types
enum	TransferTimeoutConstant { DefaultTransferTimeoutConstant }
enum	Format { GLSL, SPIRV }
enum class	PatternSyntax { RegularExpression, Wildcard, FixedString }
enum	ReturnByValueConstant { ReturnByValue }
New Properties
placeholderText : const
showDebugOverlay : const
uiLanguage : const
updateAxesContinuously : const
renderCapabilities : const
format : const
aspectRatioMode : const
videoSurface : const
New QML Types
BBounds
CCullMode
DDepthInput
PPdfDocument PdfLinkModel PdfNavigationStack PdfSearchModel PdfSelection
QQuaternion QuaternionAnimation
RRenderCapabilities
SSetUniformValue SpotLight
New QML Properties
antialiasingMode
antialiasingQuality
backend
backend
backend
backend
cursorShape
cursorShape
dragThreshold
effects
flushMode
format
renderCapabilities
reuseItems
reuseItems
showDebugOverlay
sourceClipRect
staticFlags
temporalAAStrength
uiLanguage
updateAxesContinuously
videoOutput
videoSurface
New QML Signals
errorOccurred()
New QML Methods
lookAt()
lookAt()
start()
stop()
