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

/// Base UserProvider class that apps should extend
/// This provides a common interface for user management
/// Each app must implement its own UserProvider with app-specific UserModel
abstract class BaseUserProvider with ChangeNotifier {
  /// Check if user is authenticated
  bool get isAuthenticated;
  
  /// Get authentication token
  String? get token;
  
  /// Get user token (alternative token field)
  String? get userToken;
  
  /// Get token type
  String? get tokenType;
  
  /// Get user data (to be implemented by each app)
  dynamic get user;
  
  /// Set user data (to be implemented by each app)
  void setUser(dynamic user);
  
  /// Clear user data (to be implemented by each app)
  void clearUser();
  
  /// Update token
  void updateToken(String? token, {String? tokenType});
}

/// Default implementation that can be used as a fallback
/// Apps should extend this or implement BaseUserProvider directly
class DefaultUserProvider extends BaseUserProvider {
  dynamic _user;
  String? _token;
  String? _userToken;
  String? _tokenType;

  @override
  bool get isAuthenticated => (_token != null) || (_userToken != null);

  @override
  String? get token => _token;

  @override
  String? get userToken => _userToken;

  @override
  String? get tokenType => _tokenType;
  
  @override
  dynamic get user => _user;

  @override
  void setUser(dynamic user) {
    _user = user;
    notifyListeners();
  }

  @override
  void clearUser() {
    _user = null;
    _token = null;
    _userToken = null;
    _tokenType = null;
    notifyListeners();
  }

  @override
  void updateToken(String? token, {String? tokenType}) {
    _token = token;
    _tokenType = tokenType ?? "Bearer";
    notifyListeners();
  }
}
