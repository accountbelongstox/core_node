// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/foundation.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

/// Wuy Network Manager
/// Manages network connectivity and offline mode for Wuy app.
class WuyNetworkManager {
  static final WuyNetworkManager _instance = WuyNetworkManager._internal();

  factory WuyNetworkManager() {
    return _instance;
  }

  WuyNetworkManager._internal();

  bool _isOfflineMode = false;
  bool _isNetworkAvailable = true;
  final Connectivity _connectivity = Connectivity();

  /// Initialize network manager
  Future<void> initialize() async {
    _connectivity.onConnectivityChanged.listen((List<ConnectivityResult> results) {
      _updateNetworkStatus(results.first);
    });
    
    final connectivityResults = await _connectivity.checkConnectivity();
    _updateNetworkStatus(connectivityResults.first);
    
    debugPrint('WuyNetworkManager initialized. Network available: $_isNetworkAvailable');
  }

  /// Update network status based on connectivity result
  void _updateNetworkStatus(ConnectivityResult result) {
    final wasAvailable = _isNetworkAvailable;
    _isNetworkAvailable = result != ConnectivityResult.none;
    
    if (wasAvailable != _isNetworkAvailable) {
      debugPrint('Network status changed: $_isNetworkAvailable');
    }
  }

  /// Check if network is available
  bool get isNetworkAvailable => _isNetworkAvailable;

  /// Check if offline mode is enabled
  bool get isOfflineMode => _isOfflineMode;

  /// Enable offline mode (for testing)
  void enableOfflineMode() {
    _isOfflineMode = true;
    debugPrint('Offline mode enabled');
  }

  /// Disable offline mode
  void disableOfflineMode() {
    _isOfflineMode = false;
    debugPrint('Offline mode disabled');
  }

  /// Toggle offline mode
  void toggleOfflineMode() {
    _isOfflineMode = !_isOfflineMode;
    debugPrint('Offline mode toggled: $_isOfflineMode');
  }

  /// Check if we should use offline mode
  bool shouldUseOfflineMode() {
    return _isOfflineMode || !_isNetworkAvailable;
  }

  /// Get current connectivity status
  Future<ConnectivityResult> getConnectivityStatus() async {
    final results = await _connectivity.checkConnectivity();
    return results.first;
  }
}