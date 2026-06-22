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

import 'dart:async';
import 'package:flutter/foundation.dart';
import '../network/achat_api_client.dart';
import '../config_app_achat/api_config_achat.dart';
import '../config_app_achat/app_config.dart';

/// AChat service layer - Cross-app data consistency implementation
/// Handles business logic and API calls connecting to BankV1 backend
class AChatService {
  static AChatService? _instance;
  static AChatService get instance => _instance ??= AChatService._internal();

  AChatService._internal();

  bool _isInitialized = false;
  AChatApiClient? _apiClient;
  Timer? _heartbeatTimer;
  DateTime? _appStartTime;
  String? _sessionId;

  bool get isInitialized => _isInitialized;
  String? get sessionId => _sessionId;
  Duration? get sessionDuration => _appStartTime != null
      ? DateTime.now().difference(_appStartTime!)
      : null;

  /// Initialize AChat service - Test app mode (no authentication required)
  Future<void> initialize() async {
    try {
      // Fix: Initialize API client with factory method
      _apiClient = AChatApiClient.create(
        config: ApiConfigAChat.testApiConfig,
      );
      await _apiClient!.initialize();

      // Set app start time
      _appStartTime = DateTime.now();

      // Start heartbeat timer
      _startHeartbeat();

      _isInitialized = true;

      if (kDebugMode) {
        print('AChat service initialized successfully (Test App Mode)');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Failed to initialize AChat service: $e');
      }
      rethrow;
    }
  }

  /// Send chat message
  Future<String> sendMessage(String message) async {
    if (!_isInitialized) {
      throw Exception('AChat service not initialized');
    }

    try {
      // Mock API call
      await Future.delayed(Duration(milliseconds: 1000));
      
      // Mock response
      return 'This is a mock response to: $message';
    } catch (e) {
      if (kDebugMode) {
        print('Error sending message: $e');
      }
      rethrow;
    }
  }

  /// Get chat history
  Future<List<Map<String, dynamic>>> getChatHistory() async {
    if (!_isInitialized) {
      throw Exception('AChat service not initialized');
    }

    try {
      // Mock API call
      await Future.delayed(Duration(milliseconds: 500));
      
      // Mock chat history
      return [
        {
          'id': '1',
          'message': 'Hello, how can I help you?',
          'timestamp': DateTime.now().subtract(Duration(minutes: 5)).toIso8601String(),
          'isUser': false,
        },
        {
          'id': '2',
          'message': 'I need help with Flutter development',
          'timestamp': DateTime.now().subtract(Duration(minutes: 4)).toIso8601String(),
          'isUser': true,
        },
      ];
    } catch (e) {
      if (kDebugMode) {
        print('Error getting chat history: $e');
      }
      rethrow;
    }
  }

  /// Clear chat history
  Future<void> clearChatHistory() async {
    if (!_isInitialized) {
      throw Exception('AChat service not initialized');
    }

    try {
      // Mock API call
      await Future.delayed(Duration(milliseconds: 300));
      
      if (kDebugMode) {
        print('Chat history cleared');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error clearing chat history: $e');
      }
      rethrow;
    }
  }

  // ========================================
  // AChatV1 Backend Integration Methods
  // Cross-app data consistency implementation
  // ========================================

  /// Start heartbeat timer
  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(Duration(minutes: 5), (timer) {
      _sendHeartbeat();
    });
  }

  /// Send heartbeat to backend
  Future<void> _sendHeartbeat() async {
    if (_apiClient == null || !_isInitialized) return;

    try {
      // Fix: Use new sendHeartbeat method with required deviceId
      final deviceId = AChatAppConfig.deviceId;
      final response = await _apiClient!.sendHeartbeat(
        deviceId: deviceId,
        sessionDuration: sessionDuration?.inSeconds,
      );

      if (kDebugMode) {
        print('Heartbeat sent: ${response.statusCode == 200}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Failed to send heartbeat: $e');
      }
    }
  }

  /// Update user profile information
  Future<bool> updateUserProfile({
    required String userId,
    String? fullName,
    String? bio,
    String? avatar,
  }) async {
    if (_apiClient == null || !_isInitialized) {
      throw Exception('AChat service not initialized');
    }

    try {
      // Fix: Use new updateUserProfile method signature
      final response = await _apiClient!.updateUserProfile(
        userId: userId,
        fullName: fullName,
        bio: bio,
        avatar: avatar,
      );

      if (response.statusCode == 200) {
        if (kDebugMode) {
          print('User profile updated successfully');
        }
        return true;
      } else {
        if (kDebugMode) {
          print('Failed to update user profile: ${response.error}');
        }
        return false;
      }
    } catch (e) {
      if (kDebugMode) {
        print('Failed to update user profile: $e');
      }
      return false;
    }
  }


  /// Dispose service and notify backend about app close
  Future<void> dispose() async {
    try {
      // Stop heartbeat timer
      _heartbeatTimer?.cancel();

      // Notify backend about app close
      if (_apiClient != null && _isInitialized) {
        // Fix: Use new logout method
        final deviceId = AChatAppConfig.deviceId;
        await _apiClient!.logout(deviceId: deviceId);
      }

      _isInitialized = false;
      _apiClient = null;
      _sessionId = null;
      _appStartTime = null;

      if (kDebugMode) {
        print('AChat service disposed');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error during service disposal: $e');
      }
    }
  }
}
