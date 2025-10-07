import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/network_types.dart';

/// Loading manager for handling loading states across the application
class LoadingManager {
  static LoadingManager? _instance;
  static LoadingManager get instance => _instance ??= LoadingManager._();
  LoadingManager._();

  final Map<String, LoadingState> _loadingStates = {};
  final StreamController<Map<String, LoadingState>> _stateController = 
      StreamController<Map<String, LoadingState>>.broadcast();

  /// Stream of loading states
  Stream<Map<String, LoadingState>> get stateStream => _stateController.stream;

  /// Set loading state for a specific key
  void setLoading(String key, {
    bool isLoading = true,
    String? message,
    LoadingType type = LoadingType.general,
    double? progress,
  }) {
    final state = LoadingState(
      isLoading: isLoading,
      message: message,
      type: type,
      progress: progress,
      timestamp: DateTime.now(),
    );

    _loadingStates[key] = state;
    _stateController.add(Map.from(_loadingStates));

    if (kDebugMode) {
      print('Loading state changed: $key -> $isLoading');
    }
  }

  /// Start loading for a specific key
  void startLoading(String key, {
    String? message,
    LoadingType type = LoadingType.general,
  }) {
    setLoading(key, isLoading: true, message: message, type: type);
  }

  /// Stop loading for a specific key
  void stopLoading(String key) {
    setLoading(key, isLoading: false);
  }

  /// Update progress for a specific key
  void updateProgress(String key, double progress, {String? message}) {
    final currentState = _loadingStates[key];
    if (currentState != null) {
      setLoading(
        key,
        isLoading: currentState.isLoading,
        message: message ?? currentState.message,
        type: currentState.type,
        progress: progress,
      );
    }
  }

  /// Get loading state for a specific key
  LoadingState? getLoadingState(String key) {
    return _loadingStates[key];
  }

  /// Check if any loading is active
  bool get hasActiveLoading {
    return _loadingStates.values.any((state) => state.isLoading);
  }

  /// Check if specific key is loading
  bool isLoading(String key) {
    return _loadingStates[key]?.isLoading ?? false;
  }

  /// Get all active loading states
  Map<String, LoadingState> get activeLoadingStates {
    return Map.fromEntries(
      _loadingStates.entries.where((entry) => entry.value.isLoading),
    );
  }

  /// Clear specific loading state
  void clear(String key) {
    _loadingStates.remove(key);
    _stateController.add(Map.from(_loadingStates));
  }

  /// Clear all loading states
  void clearAll() {
    _loadingStates.clear();
    _stateController.add(Map.from(_loadingStates));
  }

  /// Get loading statistics
  LoadingStats getStats() {
    final activeCount = _loadingStates.values.where((s) => s.isLoading).length;
    final totalCount = _loadingStates.length;
    
    return LoadingStats(
      activeLoadings: activeCount,
      totalLoadings: totalCount,
      loadingTypes: _loadingStates.values
          .where((s) => s.isLoading)
          .map((s) => s.type)
          .toSet()
          .toList(),
    );
  }

  /// Dispose resources
  void dispose() {
    _stateController.close();
    _loadingStates.clear();
  }
}

/// Loading state data structure
class LoadingState {
  final bool isLoading;
  final String? message;
  final LoadingType type;
  final double? progress;
  final DateTime timestamp;

  const LoadingState({
    required this.isLoading,
    this.message,
    required this.type,
    this.progress,
    required this.timestamp,
  });

  LoadingState copyWith({
    bool? isLoading,
    String? message,
    LoadingType? type,
    double? progress,
    DateTime? timestamp,
  }) {
    return LoadingState(
      isLoading: isLoading ?? this.isLoading,
      message: message ?? this.message,
      type: type ?? this.type,
      progress: progress ?? this.progress,
      timestamp: timestamp ?? this.timestamp,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'isLoading': isLoading,
      'message': message,
      'type': type.toString(),
      'progress': progress,
      'timestamp': timestamp.toIso8601String(),
    };
  }

  @override
  String toString() {
    return 'LoadingState(isLoading: $isLoading, message: $message, type: $type, progress: $progress)';
  }
}

/// Loading statistics
class LoadingStats {
  final int activeLoadings;
  final int totalLoadings;
  final List<LoadingType> loadingTypes;

  const LoadingStats({
    required this.activeLoadings,
    required this.totalLoadings,
    required this.loadingTypes,
  });

  Map<String, dynamic> toJson() {
    return {
      'activeLoadings': activeLoadings,
      'totalLoadings': totalLoadings,
      'loadingTypes': loadingTypes.map((t) => t.toString()).toList(),
    };
  }
}
