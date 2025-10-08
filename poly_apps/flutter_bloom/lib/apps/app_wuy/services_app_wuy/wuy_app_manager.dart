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
import 'wuy_data_center.dart';
import 'wuy_network_manager.dart';
import 'wuy_api_center.dart';

/// Wuy App Manager
/// Central manager for all Wuy app services
/// Provides unified access to all core services
class WuyAppManager extends ChangeNotifier {
  static final WuyAppManager _instance = WuyAppManager._internal();
  factory WuyAppManager() => _instance;
  WuyAppManager._internal();

  final WuyDataCenter _dataCenter = WuyDataCenter();
  final WuyNetworkManager _networkManager = WuyNetworkManager();
  final WuyApiCenter _apiCenter = WuyApiCenter();

  bool _isInitialized = false;

  // Getters
  bool get isInitialized => _isInitialized;
  WuyDataCenter get dataCenter => _dataCenter;
  WuyNetworkManager get networkManager => _networkManager;
  WuyApiCenter get apiCenter => _apiCenter;

  /// Initialize all services
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // Initialize data center
      await _dataCenter.initialize();

      // Initialize network manager
      await _networkManager.initialize();

      // Initialize API center
      // API center doesn't need explicit initialization

      _isInitialized = true;
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to initialize WuyAppManager: $e');
      rethrow;
    }
  }

  /// Get app status
  Map<String, dynamic> getAppStatus() {
    return {
      'isInitialized': _isInitialized,
      'isNetworkAvailable': _networkManager.isNetworkAvailable,
      'isOfflineMode': _networkManager.isOfflineMode,
      'isLoggedIn': _dataCenter.isLoggedIn,
      'currentUser': _dataCenter.currentUser?.displayName,
      'friendsCount': _dataCenter.friends.length,
      'networkStatus': _networkManager.isNetworkAvailable ? 'Connected' : 'Disconnected',
    };
  }

  /// Dispose all services
  @override
  void dispose() {
    _dataCenter.dispose();
    super.dispose();
  }
}
