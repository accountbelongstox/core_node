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
      // Initialize API client for test app
      _apiClient = AChatApiClient(context: 'achat_test_app');

      // Set app start time
      _appStartTime = DateTime.now();

      // Notify backend about app open
      await _notifyAppOpen();

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

  /// Setup connection to chat service
  Future<void> _setupConnection() async {
    // Mock connection setup
    await Future.delayed(Duration(milliseconds: 500));
  }

  // ========================================
  // BankV1 Backend Integration Methods
  // Cross-app data consistency implementation
  // ========================================

  /// Notify backend about app open
  Future<void> _notifyAppOpen() async {
    if (_apiClient == null) return;

    try {
      final response = await _apiClient!.appOpen(
        appVersion: AChatAppConfig.appVersion,
        platform: 'flutter',
      );

      if (response.success && response.data != null) {
        _sessionId = response.data!['session_id'] as String?;
        if (kDebugMode) {
          print('App open notification sent successfully. Session ID: $_sessionId');
        }
      }
    } catch (e) {
      if (kDebugMode) {
        print('Failed to notify app open: $e');
      }
    }
  }

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
      final response = await _apiClient!.heartbeat(
        sessionDuration: sessionDuration?.inSeconds,
      );

      if (kDebugMode) {
        print('Heartbeat sent: ${response.success}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('Failed to send heartbeat: $e');
      }
    }
  }

  /// Update user profile information
  Future<bool> updateUserProfile({
    String? fullName,
    String? email,
    String? phone,
    String? dateOfBirth,
    String? gender,
  }) async {
    if (_apiClient == null || !_isInitialized) {
      throw Exception('AChat service not initialized');
    }

    try {
      final response = await _apiClient!.updateUserProfile(
        fullName: fullName,
        email: email,
        phone: phone,
        dateOfBirth: dateOfBirth,
        gender: gender,
      );

      if (response.success) {
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

  /// Generate test data
  Future<Map<String, dynamic>?> generateTestData({
    required String dataType,
    int? count,
    Map<String, dynamic>? parameters,
  }) async {
    if (_apiClient == null || !_isInitialized) {
      throw Exception('AChat service not initialized');
    }

    try {
      final response = await _apiClient!.generateTestData(
        dataType: dataType,
        count: count,
        parameters: parameters,
      );

      if (response.success) {
        if (kDebugMode) {
          print('Test data generated successfully');
        }
        return response.data;
      } else {
        if (kDebugMode) {
          print('Failed to generate test data: ${response.error}');
        }
        return null;
      }
    } catch (e) {
      if (kDebugMode) {
        print('Failed to generate test data: $e');
      }
      return null;
    }
  }

  /// Upload test information to backend
  Future<bool> uploadTestInfo({
    required String infoType,
    required Map<String, dynamic> data,
  }) async {
    if (_apiClient == null || !_isInitialized) {
      throw Exception('AChat service not initialized');
    }

    try {
      final response = await _apiClient!.uploadTestInfo(
        infoType: infoType,
        data: data,
      );

      if (response.success) {
        if (kDebugMode) {
          print('Test info uploaded successfully');
        }
        return true;
      } else {
        if (kDebugMode) {
          print('Failed to upload test info: ${response.error}');
        }
        return false;
      }
    } catch (e) {
      if (kDebugMode) {
        print('Failed to upload test info: $e');
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
        await _apiClient!.appClose(
          sessionDuration: sessionDuration?.inSeconds,
        );
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
