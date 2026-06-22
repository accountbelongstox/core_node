// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// API Endpoints for Wuy App
/// Updated to match backend AwyV0 API specification from bridge documentation
class ApiEndpointsAppWuy {

  // ==================== AUTHENTICATION ENDPOINTS ====================

  /// User registration endpoint
  static const String authRegister = '/api/awy-v0/auth/register';

  /// User login endpoint
  static const String authLogin = '/api/awy-v0/auth/login';

  /// Phone number login endpoint
  static const String authPhoneLogin = '/api/awy-v0/auth/phone-login';

  /// Send SMS verification code endpoint
  static const String authSendSms = '/api/awy-v0/auth/send-sms';

  /// Email verification endpoint
  static const String authVerifyEmail = '/api/awy-v0/auth/verify-email';

  /// Forgot password endpoint
  static const String authForgotPassword = '/api/awy-v0/auth/forgot-password';

  /// Reset password endpoint
  static const String authResetPassword = '/api/awy-v0/auth/reset-password';

  /// User logout endpoint
  static const String authLogout = '/api/awy-v0/auth/logout';

  // ==================== USER MANAGEMENT ENDPOINTS ====================

  /// Get user profile endpoint
  static const String userProfile = '/api/awy-v0/user/profile';

  /// Update user profile endpoint
  static const String userProfileUpdate = '/api/awy-v0/user/profile';

  /// Upload user avatar endpoint
  static const String userAvatar = '/api/awy-v0/user/avatar';

  /// Change password endpoint
  static const String userChangePassword = '/api/awy-v0/user/change-password';

  /// Bind phone number endpoint
  static const String userBindPhone = '/api/awy-v0/user/bind-phone';

  /// Bind email endpoint
  static const String userBindEmail = '/api/awy-v0/user/bind-email';

  // ==================== FRIEND SYSTEM ENDPOINTS ====================

  /// Get friends list endpoint
  static const String friendsList = '/api/awy-v0/friend/list';

  /// Add friend endpoint
  static const String friendsAdd = '/api/awy-v0/friend/add';

  /// Remove friend endpoint
  static const String friendsRemove = '/api/awy-v0/friend/remove';

  /// Get friend info endpoint
  static const String friendsInfo = '/api/awy-v0/friend/info';

  /// Friend system health check endpoint
  static const String friendsHealth = '/api/awy-v0/friend/health';

  /// Search friends endpoint
  static const String friendsSearch = '/api/awy-v0/friend/search';

  // ==================== CHAT SYSTEM ENDPOINTS ====================

  /// Get chat history with friend endpoint
  static String chatHistory(String friendId) => '/api/awy-v0/chat/history/$friendId';

  /// Send message endpoint
  static const String chatSend = '/api/awy-v0/chat/send';

  /// Delete message endpoint
  static String chatDelete(String messageId) => '/api/awy-v0/chat/delete/$messageId';

  /// Mark message as read endpoint
  static String chatRead(String messageId) => '/api/awy-v0/chat/read/$messageId';

  // ==================== SEARCH ENDPOINTS ====================

  /// Global search endpoint
  static const String searchGlobal = '/api/awy-v0/search';

  /// Search suggestions endpoint
  static const String searchSuggestions = '/api/awy-v0/search/suggestions';

  // ==================== DASHBOARD ENDPOINTS ====================

  /// Get dashboard statistics endpoint
  static const String dashboardStats = '/api/awy-v0/dashboard/stats';

  // ==================== DEVICE MANAGEMENT ENDPOINTS ====================

  /// Register device endpoint
  static const String deviceRegister = '/api/awy-v0/device/register';

  /// Unregister device endpoint
  static const String deviceUnregister = '/api/awy-v0/device/unregister';

  /// Get device list endpoint
  static const String deviceList = '/api/awy-v0/device/list';

  /// Update device endpoint
  static const String deviceUpdate = '/api/awy-v0/device/update';

  // ==================== UTILITY METHODS ====================

  /// Build endpoint with query parameters
  static String buildEndpoint(String endpoint, Map<String, dynamic>? queryParams) {
    if (queryParams == null || queryParams.isEmpty) {
      return endpoint;
    }

    final uri = Uri.parse(endpoint);
    final newUri = uri.replace(queryParameters: {
      ...uri.queryParameters,
      ...queryParams.map((key, value) => MapEntry(key, value.toString())),
    });

    return newUri.toString();
  }

  /// Build paginated endpoint
  static String buildPaginatedEndpoint(
    String endpoint, {
    int page = 1,
    int limit = 20,
    Map<String, dynamic>? additionalParams,
  }) {
    final params = <String, dynamic>{
      'page': page,
      'limit': limit,
      ...?additionalParams,
    };

    return buildEndpoint(endpoint, params);
  }

  /// Validate endpoint format
  static bool isValidEndpoint(String endpoint) {
    return endpoint.startsWith('/api/') && endpoint.length > 5;
  }
}