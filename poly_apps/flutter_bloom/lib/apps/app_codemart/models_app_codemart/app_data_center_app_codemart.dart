import 'package:flutter/foundation.dart';
import 'codemart_types.dart';
import 'codemart_enums.dart';
import 'user_model_app_codemart.dart';
import '../config_app_codemart/debug_config_app_codemart.dart';

/// Unified data center for app_codemart
///
/// This class manages all global app data including:
/// - User authentication state
/// - User profiles (developer/client)
/// - App-wide settings
/// - Debug mode data
class AppDataCenterAppCodemart extends ChangeNotifier {
  // Singleton pattern
  static final AppDataCenterAppCodemart _instance = AppDataCenterAppCodemart._internal();
  factory AppDataCenterAppCodemart() => _instance;
  AppDataCenterAppCodemart._internal();

  // User model
  final UserModelAppCodemart _userModel = UserModelAppCodemart();

  // Debug mode state
  bool _isDebugMode = DebugConfigAppCodemart.isDebugMode;
  UserModeType _currentUserMode = UserModeType.developer;

  // Getters
  UserModelAppCodemart get userModel => _userModel;
  bool get isDebugMode => _isDebugMode;
  UserModeType get currentUserMode => _currentUserMode;

  // User profile getters (delegate to UserModel)
  UserProfile? get userProfile => _userModel.userProfile;
  DeveloperProfile? get developerProfile => _userModel.developerProfile;
  ClientProfile? get clientProfile => _userModel.clientProfile;
  bool get isLoggedIn => _userModel.isLoggedIn;
  String? get token => _userModel.token;
  bool get isDeveloper => _userModel.isDeveloper;
  bool get isClient => _userModel.isClient;
  bool get isArchitect => _userModel.isArchitect;

  /// Set debug mode
  void setDebugMode(bool enabled) {
    _isDebugMode = enabled;
    if (DebugConfigAppCodemart.enableDebugLogging) {
      debugPrint('AppDataCenter: Debug mode ${enabled ? 'enabled' : 'disabled'}');
    }
    notifyListeners();
  }

  /// Set current user mode (developer/client)
  void setUserMode(UserModeType mode) {
    _currentUserMode = mode;
    if (DebugConfigAppCodemart.enableDebugLogging) {
      debugPrint('AppDataCenter: User mode set to ${mode.name}');
    }
    notifyListeners();
  }

  /// Debug login - bypass API and use mock data
  Future<void> debugLogin(String email, String password, UserModeType userMode) async {
    if (!_isDebugMode) {
      throw Exception('Debug login is only available in debug mode');
    }

    if (DebugConfigAppCodemart.enableDebugLogging) {
      debugPrint('AppDataCenter: Debug login with email=$email, mode=${userMode.name}');
    }

    // Simulate network delay
    await Future.delayed(Duration(milliseconds: DebugConfigAppCodemart.mockApiDelayMs));

    // Set user mode
    _currentUserMode = userMode;

    // Create mock user data based on selected mode
    final userData = _createMockUserData(email, userMode);
    final token = 'mock_token_${DateTime.now().millisecondsSinceEpoch}';

    Map<String, dynamic>? developerData;
    Map<String, dynamic>? clientData;

    if (userMode == UserModeType.developer) {
      developerData = _createMockDeveloperData(userData['id'] as int);
    } else {
      clientData = _createMockClientData(userData['id'] as int);
    }

    // Login using UserModel
    _userModel.login(userData, token, developerData, clientData);

    if (DebugConfigAppCodemart.enableDebugLogging) {
      debugPrint('AppDataCenter: Debug login successful');
      debugPrint('AppDataCenter: User profile updated - Email: ${_userModel.userProfile?.email}');
      debugPrint('AppDataCenter: User logged in: ${_userModel.isLoggedIn}');
      debugPrint('AppDataCenter: User mode: ${_currentUserMode.name}');
      debugPrint('AppDataCenter: Is developer: ${_userModel.isDeveloper}');
      debugPrint('AppDataCenter: Is client: ${_userModel.isClient}');
      if (_userModel.isDeveloper && _userModel.developerProfile != null) {
        debugPrint('AppDataCenter: Developer level: ${_userModel.developerProfile!.level.name}');
      }
      if (_userModel.isClient && _userModel.clientProfile != null) {
        debugPrint('AppDataCenter: Client company: ${_userModel.clientProfile!.companyName}');
      }
    }

    // Notify all listeners that state has changed
    notifyListeners();
  }

  /// Regular login (production)
  Future<void> login(
    Map<String, dynamic> userData,
    String token,
    Map<String, dynamic>? developerData,
    Map<String, dynamic>? clientData,
  ) async {
    _userModel.login(userData, token, developerData, clientData);

    // Determine user mode based on roles
    if (_userModel.isDeveloper) {
      _currentUserMode = UserModeType.developer;
    } else if (_userModel.isClient) {
      _currentUserMode = UserModeType.client;
    }

    notifyListeners();
  }

  /// Logout
  Future<void> logout() async {
    _userModel.logout();
    _currentUserMode = UserModeType.developer;
    notifyListeners();
  }

  /// Update user profile
  void updateUserProfile(UserProfile profile) {
    _userModel.updateUserProfile(profile);
    notifyListeners();
  }

  /// Update developer profile
  void updateDeveloperProfile(DeveloperProfile profile) {
    _userModel.updateDeveloperProfile(profile);
    notifyListeners();
  }

  /// Update client profile
  void updateClientProfile(ClientProfile profile) {
    _userModel.updateClientProfile(profile);
    notifyListeners();
  }

  /// Create mock user data for debug mode
  Map<String, dynamic> _createMockUserData(String email, UserModeType userMode) {
    final now = DateTime.now().toIso8601String();
    final roles = userMode == UserModeType.developer
        ? [UserRoleType.developer.name]
        : [UserRoleType.client.name];

    return {
      'id': 1,
      'username': email.split('@')[0],
      'email': email,
      'name': userMode == UserModeType.developer ? 'Debug Developer' : 'Debug Client',
      'nickname': 'Debug User',
      'avatar': 'https://api.dicebear.com/7.x/avataaars/svg?seed=${email}',
      'about': 'Debug mode user for testing',
      'website': 'https://codemart.example.com',
      'github': 'https://github.com/debuguser',
      'wechat': null,
      'roles': roles,
      'emailVerifiedAt': now,
      'createdAt': now,
      'updatedAt': now,
    };
  }

  /// Create mock developer data for debug mode
  Map<String, dynamic> _createMockDeveloperData(int userId) {
    return {
      'id': 1,
      'userId': userId,
      'developerType': DeveloperType.regular.name,
      'level': DeveloperLevel.level3.name,
      'points': 1000,
      'companyName': null,
      'bio': 'Experienced full-stack developer specializing in Flutter and Node.js',
      'skills': ['Flutter', 'Dart', 'JavaScript', 'TypeScript', 'Node.js', 'React'],
      'certifications': [
        {
          'id': 1,
          'name': 'Flutter Developer Certification',
          'issuer': 'Google',
          'issuedDate': '2023-01-01',
          'expiryDate': null,
          'status': CertificationStatus.verified.name,
          'credentialUrl': 'https://example.com/cert',
          'credentialId': 'FLUTTER123',
        }
      ],
      'completedProjects': 15,
      'averageRating': 4.8,
      'followersCount': 50,
      'rating': 4.8,
      'verificationStatus': VerificationStatus.approved.name,
      'profileCompletedAt': DateTime.now().toIso8601String(),
    };
  }

  /// Create mock client data for debug mode
  Map<String, dynamic> _createMockClientData(int userId) {
    return {
      'id': 1,
      'userId': userId,
      'clientType': ClientType.individual.name,
      'level': ClientLevel.level2.name,
      'companyName': 'Debug Company Ltd.',
      'companyRegistrationNumber': '123456789',
      'industry': Industry.saas.name,
      'companyDescription': 'Leading SaaS company in the tech industry',
      'contactPerson': 'John Doe',
      'contactPhone': '+1234567890',
      'companyWebsite': 'https://debugcompany.com',
      'postedProjects': 10,
      'totalProjects': 8,
      'totalSpent': 25000.00,
      'averageRating': 4.5,
      'rating': 4.5,
      'verificationStatus': VerificationStatus.approved.name,
      'profileCompletedAt': DateTime.now().toIso8601String(),
    };
  }

  /// Clear all data (for testing)
  void clearAll() {
    _userModel.logout();
    _currentUserMode = UserModeType.developer;
    notifyListeners();
  }

  /// Get debug info as string
  String getDebugInfo() {
    return '''
Debug Mode: $_isDebugMode
Current User Mode: ${_currentUserMode.name}
Is Logged In: ${_userModel.isLoggedIn}
User Email: ${_userModel.userProfile?.email ?? 'N/A'}
Is Developer: ${_userModel.isDeveloper}
Is Client: ${_userModel.isClient}
Token: ${_userModel.token?.substring(0, 20) ?? 'N/A'}...
''';
  }
}

/// User mode type for debug mode
enum UserModeType {
  developer,
  client,
}
