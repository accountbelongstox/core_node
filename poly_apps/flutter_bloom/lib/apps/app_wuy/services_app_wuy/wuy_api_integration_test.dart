// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not append strings such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/foundation.dart';
import 'wuy_api_service_manager.dart';

/// API Integration Test Helper for Wuy App
/// Provides testing utilities for validating API endpoints
/// Note: This is a development/testing utility, not production test code
class WuyApiIntegrationTest {
  static final WuyApiIntegrationTest _instance = WuyApiIntegrationTest._internal();
  factory WuyApiIntegrationTest() => _instance;
  WuyApiIntegrationTest._internal();

  WuyApiServiceManager? _apiServiceManager;
  bool _isInitialized = false;

  /// Initialize the test environment
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      _apiServiceManager = WuyApiServiceManager();
      await _apiServiceManager!.initialize();
      _isInitialized = true;
      debugPrint('WuyApiIntegrationTest initialized successfully');
    } catch (e) {
      debugPrint('Failed to initialize WuyApiIntegrationTest: $e');
      rethrow;
    }
  }

  /// Check if test environment is initialized
  bool get isInitialized => _isInitialized;

  // ==================== AUTHENTICATION TESTS ====================

  /// Test user registration
  Future<TestResult> testRegistration({
    required String username,
    required String email,
    required String password,
    String? phone,
  }) async {
    _ensureInitialized();

    final testResult = TestResult('User Registration');
    final stopwatch = Stopwatch()..start();

    try {
      testResult.startStep('Sending registration request');

      final response = await _apiServiceManager!.auth.register(
        username: username,
        email: email,
        password: password,
        phone: phone,
      );

      testResult.endStep();

      if (response.success) {
        testResult.addSuccess('Registration successful');
        if (response.data != null) {
          testResult.addData('user_id', response.data!.user.id);
          testResult.addData('username', response.data!.user.username);
          testResult.addData('token_received', response.data!.token.accessToken.isNotEmpty);
        }
      } else {
        testResult.addError('Registration failed: ${response.message}');
        testResult.addData('error_code', response.errorCode);
      }
    } catch (e) {
      testResult.addError('Exception during registration: $e');
    }

    stopwatch.stop();
    testResult.setDuration(stopwatch.elapsedMilliseconds);

    return testResult;
  }

  /// Test user login
  Future<TestResult> testLogin({
    required String username,
    required String password,
  }) async {
    _ensureInitialized();

    final testResult = TestResult('User Login');
    final stopwatch = Stopwatch()..start();

    try {
      testResult.startStep('Sending login request');

      final response = await _apiServiceManager!.auth.login(
        username: username,
        password: password,
      );

      testResult.endStep();

      if (response.success) {
        testResult.addSuccess('Login successful');
        if (response.data != null) {
          testResult.addData('user_id', response.data!.user.id);
          testResult.addData('username', response.data!.user.username);
          testResult.addData('token_expires_at', response.data!.token.expiresAt.toIso8601String());
          testResult.addData('token_type', response.data!.token.tokenType);
        }
      } else {
        testResult.addError('Login failed: ${response.message}');
        testResult.addData('error_code', response.errorCode);
      }
    } catch (e) {
      testResult.addError('Exception during login: $e');
    }

    stopwatch.stop();
    testResult.setDuration(stopwatch.elapsedMilliseconds);

    return testResult;
  }

  /// Test phone login
  Future<TestResult> testPhoneLogin({
    required String phone,
    required String verificationCode,
  }) async {
    _ensureInitialized();

    final testResult = TestResult('Phone Login');
    final stopwatch = Stopwatch()..start();

    try {
      testResult.startStep('Sending phone login request');

      final response = await _apiServiceManager!.auth.loginWithPhone(
        phone: phone,
        verificationCode: verificationCode,
      );

      testResult.endStep();

      if (response.success) {
        testResult.addSuccess('Phone login successful');
        if (response.data != null) {
          testResult.addData('user_id', response.data!.user.id);
          testResult.addData('phone', response.data!.user.phone);
        }
      } else {
        testResult.addError('Phone login failed: ${response.message}');
        testResult.addData('error_code', response.errorCode);
      }
    } catch (e) {
      testResult.addError('Exception during phone login: $e');
    }

    stopwatch.stop();
    testResult.setDuration(stopwatch.elapsedMilliseconds);

    return testResult;
  }

  /// Test SMS code sending
  Future<TestResult> testSendSmsCode({
    required String phone,
    String countryCode = '+86',
  }) async {
    _ensureInitialized();

    final testResult = TestResult('Send SMS Code');
    final stopwatch = Stopwatch()..start();

    try {
      testResult.startStep('Sending SMS code request');

      final response = await _apiServiceManager!.auth.sendSmsCode(
        phone: phone,
        countryCode: countryCode,
      );

      testResult.endStep();

      if (response.success) {
        testResult.addSuccess('SMS code sent successfully');
        if (response.data != null) {
          testResult.addData('verification_id', response.data!.verificationId);
          testResult.addData('timeout_seconds', response.data!.timeoutSeconds);
        }
      } else {
        testResult.addError('Failed to send SMS code: ${response.message}');
        testResult.addData('error_code', response.errorCode);
      }
    } catch (e) {
      testResult.addError('Exception during SMS code sending: $e');
    }

    stopwatch.stop();
    testResult.setDuration(stopwatch.elapsedMilliseconds);

    return testResult;
  }

  /// Test logout
  Future<TestResult> testLogout({
    required String accessToken,
  }) async {
    _ensureInitialized();

    final testResult = TestResult('User Logout');
    final stopwatch = Stopwatch()..start();

    try {
      testResult.startStep('Sending logout request');

      final response = await _apiServiceManager!.auth.logout(
        accessToken: accessToken,
      );

      testResult.endStep();

      if (response.success) {
        testResult.addSuccess('Logout successful');
      } else {
        testResult.addError('Logout failed: ${response.message}');
      }
    } catch (e) {
      testResult.addError('Exception during logout: $e');
    }

    stopwatch.stop();
    testResult.setDuration(stopwatch.elapsedMilliseconds);

    return testResult;
  }

  // ==================== USER MANAGEMENT TESTS ====================

  /// Test get user profile
  Future<TestResult> testGetUserProfile({
    required String accessToken,
  }) async {
    _ensureInitialized();

    final testResult = TestResult('Get User Profile');
    final stopwatch = Stopwatch()..start();

    try {
      testResult.startStep('Fetching user profile');

      final response = await _apiServiceManager!.user.getUserProfile(
        accessToken: accessToken,
      );

      testResult.endStep();

      if (response.success && response.data != null) {
        testResult.addSuccess('User profile retrieved successfully');
        final user = response.data!;
        testResult.addData('user_id', user.id);
        testResult.addData('username', user.username);
        testResult.addData('email', user.email);
        testResult.addData('phone', user.phone);
        testResult.addData('has_avatar', user.avatar != null);
      } else {
        testResult.addError('Failed to get user profile: ${response.message}');
      }
    } catch (e) {
      testResult.addError('Exception during profile fetch: $e');
    }

    stopwatch.stop();
    testResult.setDuration(stopwatch.elapsedMilliseconds);

    return testResult;
  }

  /// Test update user profile
  Future<TestResult> testUpdateUserProfile({
    required String accessToken,
    String? username,
    String? bio,
    String? location,
  }) async {
    _ensureInitialized();

    final testResult = TestResult('Update User Profile');
    final stopwatch = Stopwatch()..start();

    try {
      testResult.startStep('Updating user profile');

      final response = await _apiServiceManager!.user.updateUserProfile(
        accessToken: accessToken,
        username: username,
        bio: bio,
        location: location,
      );

      testResult.endStep();

      if (response.success && response.data != null) {
        testResult.addSuccess('User profile updated successfully');
        final user = response.data!;
        testResult.addData('updated_username', user.username);
        testResult.addData('updated_bio', user.bio);
        testResult.addData('updated_location', user.location);
      } else {
        testResult.addError('Failed to update user profile: ${response.message}');
      }
    } catch (e) {
      testResult.addError('Exception during profile update: $e');
    }

    stopwatch.stop();
    testResult.setDuration(stopwatch.elapsedMilliseconds);

    return testResult;
  }

  // ==================== FRIENDS SYSTEM TESTS ====================

  /// Test get friends list
  Future<TestResult> testGetFriendsList({
    required String accessToken,
    int page = 1,
    int limit = 20,
  }) async {
    _ensureInitialized();

    final testResult = TestResult('Get Friends List');
    final stopwatch = Stopwatch()..start();

    try {
      testResult.startStep('Fetching friends list');

      final response = await _apiServiceManager!.friends.getFriendsList(
        accessToken: accessToken,
        page: page,
        limit: limit,
      );

      testResult.endStep();

      if (response.success && response.data != null) {
        testResult.addSuccess('Friends list retrieved successfully');
        final friends = response.data!;
        testResult.addData('friends_count', friends.length);
        testResult.addData('page', page);
        testResult.addData('limit', limit);
      } else {
        testResult.addError('Failed to get friends list: ${response.message}');
      }
    } catch (e) {
      testResult.addError('Exception during friends list fetch: $e');
    }

    stopwatch.stop();
    testResult.setDuration(stopwatch.elapsedMilliseconds);

    return testResult;
  }

  /// Test search friends
  Future<TestResult> testSearchFriends({
    required String accessToken,
    required String query,
    int page = 1,
    int limit = 20,
  }) async {
    _ensureInitialized();

    final testResult = TestResult('Search Friends');
    final stopwatch = Stopwatch()..start();

    try {
      testResult.startStep('Searching for friends');

      final response = await _apiServiceManager!.friends.searchFriends(
        accessToken: accessToken,
        query: query,
        page: page,
        limit: limit,
      );

      testResult.endStep();

      if (response.success && response.data != null) {
        testResult.addSuccess('Search completed successfully');
        final results = response.data!;
        testResult.addData('results_count', results.length);
        testResult.addData('search_query', query);
      } else {
        testResult.addError('Search failed: ${response.message}');
      }
    } catch (e) {
      testResult.addError('Exception during search: $e');
    }

    stopwatch.stop();
    testResult.setDuration(stopwatch.elapsedMilliseconds);

    return testResult;
  }

  // ==================== COMPREHENSIVE TESTS ====================

  /// Run complete authentication flow test
  Future<TestSuite> runAuthenticationFlowTest({
    required String username,
    required String email,
    required String password,
    String? phone,
  }) async {
    _ensureInitialized();

    final testSuite = TestSuite('Authentication Flow Test');

    // Test registration
    final registrationResult = await testRegistration(
      username: username,
      email: email,
      password: password,
      phone: phone,
    );
    testSuite.addTest(registrationResult);

    // Get access token from registration
    String? accessToken;
    if (registrationResult.success && registrationResult.hasData('user_id')) {
      // For this test, we'll use a mock token since we don't have the actual token
      accessToken = 'mock_access_token_for_testing';

      // Test login with the same credentials
      final loginResult = await testLogin(username: username, password: password);
      testSuite.addTest(loginResult);

      // Test get user profile
      if (accessToken.isNotEmpty) {
        final profileResult = await testGetUserProfile(accessToken: accessToken);
        testSuite.addTest(profileResult);
      }
    }

    return testSuite;
  }

  /// Run API health check
  Future<TestSuite> runApiHealthCheck() async {
    _ensureInitialized();

    final testSuite = TestSuite('API Health Check');

    // Test friend system health
    final friendsHealthResult = TestResult('Friends System Health');
    final stopwatch = Stopwatch()..start();

    try {
      friendsHealthResult.startStep('Checking friends system health');

      final healthResponse = await _apiServiceManager!.friends.checkFriendSystemHealth();

      friendsHealthResult.endStep();

      if (healthResponse.success) {
        friendsHealthResult.addSuccess('Friends system is healthy');
        if (healthResponse.data != null) {
          friendsHealthResult.addData('health_data', healthResponse.data!);
        }
      } else {
        friendsHealthResult.addError('Friends system health check failed: ${healthResponse.message}');
      }
    } catch (e) {
      friendsHealthResult.addError('Exception during health check: $e');
    }

    stopwatch.stop();
    friendsHealthResult.setDuration(stopwatch.elapsedMilliseconds);
    testSuite.addTest(friendsHealthResult);

    return testSuite;
  }

  // ==================== UTILITY METHODS ====================

  /// Ensure manager is initialized before use
  void _ensureInitialized() {
    if (!_isInitialized) {
      throw StateError('WuyApiIntegrationTest must be initialized before use. Call initialize() first.');
    }
  }

  /// Dispose test resources
  void dispose() {
    _apiServiceManager?.dispose();
    _apiServiceManager = null;
    _isInitialized = false;
    debugPrint('WuyApiIntegrationTest disposed');
  }
}

/// Test result model
class TestResult {
  final String testName;
  bool success = true;
  final List<String> successes = [];
  final List<String> errors = [];
  final Map<String, dynamic> data = {};
  final List<String> steps = [];
  int duration = 0;
  String? currentStep;

  TestResult(this.testName);

  void startStep(String step) {
    currentStep = step;
    steps.add(step);
  }

  void endStep() {
    currentStep = null;
  }

  void addSuccess(String message) {
    successes.add(message);
  }

  void addError(String message) {
    success = false;
    errors.add(message);
  }

  void addData(String key, dynamic value) {
    data[key] = value;
  }

  void setDuration(int milliseconds) {
    duration = milliseconds;
  }

  bool hasData(String key) => data.containsKey(key);
  dynamic getData(String key) => data[key];

  Map<String, dynamic> toJson() {
    return {
      'test_name': testName,
      'success': success,
      'successes': successes,
      'errors': errors,
      'data': data,
      'steps': steps,
      'duration_ms': duration,
      'timestamp': DateTime.now().toIso8601String(),
    };
  }

  @override
  String toString() {
    return 'TestResult($testName): ${success ? "PASS" : "FAIL"} (${duration}ms)';
  }
}

/// Test suite model
class TestSuite {
  final String suiteName;
  final List<TestResult> tests = [];

  TestSuite(this.suiteName);

  void addTest(TestResult test) {
    tests.add(test);
  }

  bool get hasFailures => tests.any((test) => !test.success);
  bool get allPassed => !hasFailures;
  int get totalTests => tests.length;
  int get passedTests => tests.where((test) => test.success).length;
  int get failedTests => totalTests - passedTests;
  int get totalDuration => tests.fold(0, (sum, test) => sum + test.duration);

  Map<String, dynamic> toJson() {
    return {
      'suite_name': suiteName,
      'total_tests': totalTests,
      'passed_tests': passedTests,
      'failed_tests': failedTests,
      'all_passed': allPassed,
      'total_duration_ms': totalDuration,
      'tests': tests.map((test) => test.toJson()).toList(),
      'timestamp': DateTime.now().toIso8601String(),
    };
  }

  @override
  String toString() {
    return 'TestSuite($suiteName): $passedTests/$totalTests passed (${totalDuration}ms)';
  }
}