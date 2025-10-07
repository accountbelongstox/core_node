import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/network_config.dart';

/// Global loading system for comprehensive UI state management
class GlobalLoadingSystem extends ChangeNotifier {
  static GlobalLoadingSystem? _instance;
  static GlobalLoadingSystem get instance => _instance ??= GlobalLoadingSystem._();
  GlobalLoadingSystem._();

  // Loading states
  LoadingUIState _globalState = LoadingUIState.idle;
  final Map<String, LoadingUIState> _contextualStates = {};
  final Map<String, LoadingConfig> _loadingConfigs = {};

  // UI Configuration
  LoadingTheme _theme = LoadingTheme.defaultTheme();
  bool _isOverlayVisible = false;
  String? _currentMessage;
  LoadingStyle _currentStyle = LoadingStyle.circular;

  // Progress tracking
  final Map<String, double> _progressValues = {};
  final Map<String, String> _statusMessages = {};

  // Queue for managing multiple simultaneous loadings
  final List<LoadingRequest> _loadingQueue = [];

  // Getters
  LoadingUIState get globalState => _globalState;
  Map<String, LoadingUIState> get contextualStates => Map.unmodifiable(_contextualStates);
  bool get isGlobalLoading => _globalState != LoadingUIState.idle;
  bool get isOverlayVisible => _isOverlayVisible;
  String? get currentMessage => _currentMessage;
  LoadingStyle get currentStyle => _currentStyle;
  LoadingTheme get theme => _theme;

  /// Initialize the global loading system
  void initialize({LoadingTheme? theme}) {
    if (theme != null) {
      _theme = theme;
    }

    debugPrint('✅ Global Loading System initialized');
  }

  // ==================== LoadingManager Integration ====================

  /// Start loading for a specific request (LoadingManager compatibility)
  void startLoading(String requestId, {
    String? message,
    LoadingType type = LoadingType.request,
    bool showGlobal = true,
  }) {
    if (!NetworkConfig.instance.enableGlobalLoading) return;

    // FIXED: Removed unused loadingState variable - it was created but never used
    // Just call show() directly instead
    if (showGlobal && message != null) {
      show(message: message, type: type);
    }

    if (showGlobal) {
      _currentMessage = message;
      _globalState = LoadingUIState.loading;
      _isOverlayVisible = true;
    }

    _contextualStates[requestId] = LoadingUIState.loading;
    _statusMessages[requestId] = message ?? '';

    notifyListeners();
  }

  /// Stop loading for a specific request (LoadingManager compatibility)
  void stopLoading(String requestId) {
    _contextualStates.remove(requestId);
    _statusMessages.remove(requestId);
    _progressValues.remove(requestId);

    // Update global state if no more active requests
    if (_contextualStates.values.every((state) => state != LoadingUIState.loading)) {
      _globalState = LoadingUIState.idle;
      _isOverlayVisible = false;
      _currentMessage = null;
    }

    notifyListeners();
  }

  /// Get active request count (LoadingManager compatibility)
  int get activeRequestCount => _contextualStates.values
      .where((state) => state == LoadingUIState.loading)
      .length;

  /// Simple show method for backward compatibility
  /// FIXED: Added show() method required by advanced_network_service.dart
  void show({String? message, LoadingType? type}) {
    showGlobalLoading(message: message);
  }

  /// Simple hide method for backward compatibility
  /// FIXED: Added hide() method required by advanced_network_service.dart
  void hide() {
    hideGlobalLoading();
  }

  /// Show global loading with customizable appearance
  void showGlobalLoading({
    String? message,
    LoadingStyle style = LoadingStyle.circular,
    LoadingConfig? config,
    bool dismissible = false,
    Duration? timeout,
  }) {
    final request = LoadingRequest(
      id: 'global_${DateTime.now().millisecondsSinceEpoch}',
      message: message,
      style: style,
      config: config ?? LoadingConfig.defaultConfig(),
      dismissible: dismissible,
      timeout: timeout,
      isGlobal: true,
    );

    _addLoadingRequest(request);
  }

  /// Hide global loading
  void hideGlobalLoading() {
    _loadingQueue.removeWhere((request) => request.isGlobal);
    _updateGlobalState();
  }

  /// Show contextual loading for specific UI components
  void showContextualLoading(
    String context, {
    String? message,
    LoadingStyle style = LoadingStyle.linear,
    LoadingConfig? config,
  }) {
    final request = LoadingRequest(
      id: context,
      message: message,
      style: style,
      config: config ?? LoadingConfig.defaultConfig(),
      isGlobal: false,
      context: context,
    );

    _contextualStates[context] = LoadingUIState.loading;
    _loadingConfigs[context] = request.config;

    if (message != null) {
      _statusMessages[context] = message;
    }

    notifyListeners();
  }

  /// Hide contextual loading
  void hideContextualLoading(String context) {
    _contextualStates.remove(context);
    _loadingConfigs.remove(context);
    _progressValues.remove(context);
    _statusMessages.remove(context);
    notifyListeners();
  }

  /// Update progress for specific context
  void updateProgress(String context, double progress, {String? message}) {
    if (_contextualStates[context] == LoadingUIState.loading) {
      _progressValues[context] = progress.clamp(0.0, 1.0);

      if (message != null) {
        _statusMessages[context] = message;
      }

      notifyListeners();
    }
  }

  /// Show loading with progress tracking
  void showProgressLoading(
    String context, {
    String? initialMessage,
    LoadingConfig? config,
  }) {
    showContextualLoading(
      context,
      message: initialMessage,
      style: LoadingStyle.progress,
      config: config,
    );
    _progressValues[context] = 0.0;
  }

  /// Show loading for file operations
  void showFileOperationLoading(
    String context, {
    String? fileName,
    FileOperationType type = FileOperationType.upload,
    LoadingConfig? config,
  }) {
    final message = _getFileOperationMessage(type, fileName);
    showContextualLoading(
      context,
      message: message,
      style: LoadingStyle.fileOperation,
      config: config,
    );
  }

  /// Show skeleton loading for lists
  void showSkeletonLoading(String context, {int itemCount = 5}) {
    showContextualLoading(
      context,
      style: LoadingStyle.skeleton,
      config: LoadingConfig(
        showMessage: false,
        customData: {'itemCount': itemCount},
      ),
    );
  }

  /// Show shimmer loading effect
  void showShimmerLoading(String context) {
    showContextualLoading(
      context,
      style: LoadingStyle.shimmer,
      config: LoadingConfig(showMessage: false),
    );
  }

  /// Update loading theme
  void updateTheme(LoadingTheme theme) {
    _theme = theme;
    notifyListeners();
  }

  /// Get loading state for specific context
  LoadingUIState getContextualState(String context) {
    return _contextualStates[context] ?? LoadingUIState.idle;
  }

  /// Get progress value for specific context
  double getProgress(String context) {
    return _progressValues[context] ?? 0.0;
  }

  /// Get status message for specific context
  String? getStatusMessage(String context) {
    return _statusMessages[context];
  }

  /// Get loading configuration for specific context
  LoadingConfig? getLoadingConfig(String context) {
    return _loadingConfigs[context];
  }

  /// Check if specific context is loading
  bool isContextLoading(String context) {
    return _contextualStates[context] == LoadingUIState.loading;
  }

  /// Get all active loading contexts
  List<String> getActiveContexts() {
    return _contextualStates.keys
        .where((context) => _contextualStates[context] == LoadingUIState.loading)
        .toList();
  }

  /// Batch operations for managing multiple loading states
  void showBatchLoading(Map<String, String> contexts) {
    for (final entry in contexts.entries) {
      showContextualLoading(entry.key, message: entry.value);
    }
  }

  void hideBatchLoading(List<String> contexts) {
    for (final context in contexts) {
      hideContextualLoading(context);
    }
  }

  /// Smart loading state management
  void smartLoading(
    String context,
    Future<void> Function() operation, {
    String? message,
    LoadingStyle? style,
    bool showProgress = false,
    Duration? minDuration,
  }) async {
    final loadingStyle = style ?? (showProgress ? LoadingStyle.progress : LoadingStyle.circular);

    if (showProgress) {
      showProgressLoading(context, initialMessage: message);
    } else {
      showContextualLoading(context, message: message, style: loadingStyle);
    }

    final startTime = DateTime.now();

    try {
      await operation();
    } finally {
      final elapsed = DateTime.now().difference(startTime);

      if (minDuration != null && elapsed < minDuration) {
        await Future.delayed(minDuration - elapsed);
      }

      hideContextualLoading(context);
    }
  }

  /// Analytics and monitoring
  LoadingSystemStats getStats() {
    return LoadingSystemStats(
      globalLoadingActive: isGlobalLoading,
      activeContextsCount: getActiveContexts().length,
      totalRequestsProcessed: _loadingQueue.length,
      averageLoadingDuration: _calculateAverageLoadingDuration(),
      mostUsedStyles: _getMostUsedStyles(),
      contextBreakdown: _getContextBreakdown(),
    );
  }

  /// Cleanup method
  void dispose() {
    // FIXED: LoadingManager doesn't exist and was never imported
    // This appears to be self-referential - GlobalLoadingSystem is the loading manager
    // Removed circular listener reference
    _loadingQueue.clear();
    _contextualStates.clear();
    _loadingConfigs.clear();
    _progressValues.clear();
    _statusMessages.clear();
    super.dispose();
  }

  // Private methods

  void _onLoadingManagerChanged() {
    // FIXED: LoadingManager doesn't exist, using GlobalLoadingSystem itself
    final isLoading = _globalState == LoadingUIState.loading;

    if (isLoading && _globalState == LoadingUIState.idle) {
      _globalState = LoadingUIState.loading;
      _isOverlayVisible = true;
      notifyListeners();
    } else if (!isLoading && _globalState == LoadingUIState.loading) {
      _globalState = LoadingUIState.idle;
      _isOverlayVisible = false;
      _currentMessage = null;
      notifyListeners();
    }
  }

  void _addLoadingRequest(LoadingRequest request) {
    _loadingQueue.add(request);

    if (request.timeout != null) {
      Timer(request.timeout!, () {
        _removeLoadingRequest(request.id);
      });
    }

    _updateGlobalState();
  }

  void _removeLoadingRequest(String id) {
    _loadingQueue.removeWhere((request) => request.id == id);
    _updateGlobalState();
  }

  void _updateGlobalState() {
    final hasGlobalRequests = _loadingQueue.any((request) => request.isGlobal);

    if (hasGlobalRequests && _globalState == LoadingUIState.idle) {
      final primaryRequest = _loadingQueue.firstWhere((request) => request.isGlobal);

      _globalState = LoadingUIState.loading;
      _isOverlayVisible = true;
      _currentMessage = primaryRequest.message;
      _currentStyle = primaryRequest.style;

      notifyListeners();
    } else if (!hasGlobalRequests && _globalState == LoadingUIState.loading) {
      _globalState = LoadingUIState.idle;
      _isOverlayVisible = false;
      _currentMessage = null;

      notifyListeners();
    }
  }

  String _getFileOperationMessage(FileOperationType type, String? fileName) {
    final file = fileName ?? 'file';
    switch (type) {
      case FileOperationType.upload:
        return 'Uploading $file...';
      case FileOperationType.download:
        return 'Downloading $file...';
      case FileOperationType.processing:
        return 'Processing $file...';
    }
  }

  Duration _calculateAverageLoadingDuration() {
    // Implementation would track actual durations
    return const Duration(seconds: 2); // Placeholder
  }

  Map<String, int> _getMostUsedStyles() {
    // Implementation would track style usage
    return {
      'circular': 45,
      'linear': 30,
      'skeleton': 15,
      'shimmer': 10,
    };
  }

  Map<String, int> _getContextBreakdown() {
    final breakdown = <String, int>{};
    for (final context in _contextualStates.keys) {
      final category = _categorizeContext(context);
      breakdown[category] = (breakdown[category] ?? 0) + 1;
    }
    return breakdown;
  }

  String _categorizeContext(String context) {
    if (context.contains('api') || context.contains('network')) return 'Network';
    if (context.contains('file') || context.contains('upload') || context.contains('download')) return 'File Operations';
    if (context.contains('auth') || context.contains('login')) return 'Authentication';
    if (context.contains('list') || context.contains('grid')) return 'List/Grid';
    return 'Other';
  }
}

/// Loading request model
class LoadingRequest {
  final String id;
  final String? message;
  final LoadingStyle style;
  final LoadingConfig config;
  final bool dismissible;
  final Duration? timeout;
  final bool isGlobal;
  final String? context;
  final DateTime createdAt;

  LoadingRequest({
    required this.id,
    this.message,
    required this.style,
    required this.config,
    this.dismissible = false,
    this.timeout,
    this.isGlobal = false,
    this.context,
  }) : createdAt = DateTime.now();
}

/// Loading configuration
class LoadingConfig {
  final bool showMessage;
  final bool showProgress;
  final bool allowInteraction;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final double? elevation;
  final BorderRadius? borderRadius;
  final EdgeInsets? padding;
  final Duration? animationDuration;
  final Map<String, dynamic>? customData;

  const LoadingConfig({
    this.showMessage = true,
    this.showProgress = false,
    this.allowInteraction = false,
    this.backgroundColor,
    this.foregroundColor,
    this.elevation,
    this.borderRadius,
    this.padding,
    this.animationDuration,
    this.customData,
  });

  factory LoadingConfig.defaultConfig() => const LoadingConfig();

  factory LoadingConfig.overlay() => const LoadingConfig(
    showMessage: true,
    allowInteraction: false,
    backgroundColor: Colors.black54,
    elevation: 8.0,
    borderRadius: BorderRadius.all(Radius.circular(12)),
    padding: EdgeInsets.all(24),
  );

  factory LoadingConfig.inline() => const LoadingConfig(
    showMessage: false,
    allowInteraction: true,
    backgroundColor: Colors.transparent,
  );

  factory LoadingConfig.minimal() => const LoadingConfig(
    showMessage: false,
    showProgress: false,
    allowInteraction: true,
    backgroundColor: Colors.transparent,
  );
}

/// Loading theme configuration
class LoadingTheme {
  final Color primaryColor;
  final Color backgroundColor;
  final Color textColor;
  final Color progressColor;
  final double indicatorSize;
  final double strokeWidth;
  final TextStyle textStyle;
  final Duration animationDuration;

  const LoadingTheme({
    required this.primaryColor,
    required this.backgroundColor,
    required this.textColor,
    required this.progressColor,
    this.indicatorSize = 40.0,
    this.strokeWidth = 4.0,
    required this.textStyle,
    this.animationDuration = const Duration(milliseconds: 300),
  });

  factory LoadingTheme.defaultTheme() => const LoadingTheme(
    primaryColor: Colors.blue,
    backgroundColor: Colors.white,
    textColor: Colors.grey,
    progressColor: Colors.blue,
    textStyle: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w500,
      color: Colors.grey,
    ),
  );

  factory LoadingTheme.dark() => const LoadingTheme(
    primaryColor: Colors.tealAccent,
    backgroundColor: Colors.grey,
    textColor: Colors.white,
    progressColor: Colors.tealAccent,
    textStyle: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w500,
      color: Colors.white,
    ),
  );

  factory LoadingTheme.banking() => const LoadingTheme(
    primaryColor: Color(0xFF1B5E20),
    backgroundColor: Colors.white,
    textColor: Color(0xFF424242),
    progressColor: Color(0xFF4CAF50),
    textStyle: TextStyle(
      fontSize: 14,
      fontWeight: FontWeight.w600,
      color: Color(0xFF424242),
    ),
  );
}

/// Loading system statistics
class LoadingSystemStats {
  final bool globalLoadingActive;
  final int activeContextsCount;
  final int totalRequestsProcessed;
  final Duration averageLoadingDuration;
  final Map<String, int> mostUsedStyles;
  final Map<String, int> contextBreakdown;

  const LoadingSystemStats({
    required this.globalLoadingActive,
    required this.activeContextsCount,
    required this.totalRequestsProcessed,
    required this.averageLoadingDuration,
    required this.mostUsedStyles,
    required this.contextBreakdown,
  });
}

/// Loading UI states
enum LoadingUIState {
  idle,
  loading,
  error,
  success,
}

/// Loading styles
enum LoadingStyle {
  circular,       // Circular progress indicator
  linear,         // Linear progress indicator
  progress,       // Progress with percentage
  skeleton,       // Skeleton loading effect
  shimmer,        // Shimmer loading effect
  dots,           // Animated dots
  pulse,          // Pulsing effect
  fileOperation,  // File upload/download specific
  custom,         // Custom implementation
}

/// File operation types
enum FileOperationType {
  upload,
  download,
  processing,
}

/// Provider wrapper for easy integration
class GlobalLoadingProvider extends ChangeNotifierProvider<GlobalLoadingSystem> {
  GlobalLoadingProvider({
    Key? key,
    required Widget child,
    LoadingTheme? theme,
  }) : super(
    key: key,
    create: (context) {
      final system = GlobalLoadingSystem.instance;
      system.initialize(theme: theme);
      return system;
    },
    child: child,
  );
}

/// Extension for easy access from BuildContext
extension GlobalLoadingExtension on BuildContext {
  GlobalLoadingSystem get globalLoading => read<GlobalLoadingSystem>();

  void showLoading([String? message]) {
    globalLoading.showGlobalLoading(message: message);
  }

  void hideLoading() {
    globalLoading.hideGlobalLoading();
  }

  void showContextLoading(String context, [String? message]) {
    globalLoading.showContextualLoading(context, message: message);
  }

  void hideContextLoading(String context) {
    globalLoading.hideContextualLoading(context);
  }
}

/// Loading types (LoadingManager compatibility)
enum LoadingType {
  request,    // Network request
  operation,  // General operation
  ui,         // UI operation
  background, // Background task
}

/// Basic loading state (LoadingManager compatibility)
class BasicLoadingState {
  final String requestId;
  final String? message;
  final LoadingType type;
  final DateTime startTime;
  final bool showGlobal;

  const BasicLoadingState({
    required this.requestId,
    this.message,
    required this.type,
    required this.startTime,
    required this.showGlobal,
  });

  Duration get duration => DateTime.now().difference(startTime);
}