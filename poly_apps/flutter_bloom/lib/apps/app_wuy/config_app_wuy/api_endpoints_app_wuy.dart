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

/// API Endpoints for Wuy App
/// Contains all API endpoint definitions
class ApiEndpointsAppWuy {
  
  
  /// User login endpoint
  static const String authLogin = '/api/v1/auth/login';
  
  /// User registration endpoint
  static const String authRegister = '/api/v1/auth/register';
  
  /// User logout endpoint
  static const String authLogout = '/api/v1/auth/logout';
  
  /// Token refresh endpoint
  static const String authRefresh = '/api/v1/auth/refresh';
  
  /// Password reset request endpoint
  static const String authPasswordReset = '/api/v1/auth/password/reset';
  
  /// Password reset confirm endpoint
  static const String authPasswordResetConfirm = '/api/v1/auth/password/reset/confirm';
  
  /// Change password endpoint
  static const String authChangePassword = '/api/v1/auth/password/change';
  
  /// Send verification code endpoint
  static const String authSendCode = '/api/v1/auth/send-code';
  
  
  /// User profile endpoint
  static const String userProfile = '/api/v1/user/profile';
  
  /// Update user profile endpoint
  static const String userUpdate = '/api/v1/user/update';
  
  /// User avatar upload endpoint
  static const String userAvatarUpload = '/api/v1/user/avatar';
  
  /// User preferences endpoint
  static const String userPreferences = '/api/v1/user/preferences';
  
  /// User activity endpoint
  static const String userActivity = '/api/v1/user/activity';
  
  
  /// Get content list endpoint
  static const String contentList = '/api/v1/content';
  
  /// Get content by ID endpoint
  static String contentById(String id) => '/api/v1/content/$id';
  
  /// Create content endpoint
  static const String contentCreate = '/api/v1/content';
  
  /// Update content endpoint
  static String contentUpdate(String id) => '/api/v1/content/$id';
  
  /// Delete content endpoint
  static String contentDelete(String id) => '/api/v1/content/$id';
  
  /// Search content endpoint
  static const String contentSearch = '/api/v1/content/search';
  
  /// Content categories endpoint
  static const String contentCategories = '/api/v1/content/categories';
  
  
  /// File upload endpoint
  static const String fileUpload = '/api/v1/files/upload';
  
  /// File download endpoint
  static String fileDownload(String fileId) => '/api/v1/files/$fileId';
  
  /// File delete endpoint
  static String fileDelete(String fileId) => '/api/v1/files/$fileId';
  
  /// File list endpoint
  static const String fileList = '/api/v1/files';
  
  
  /// Get notifications endpoint
  static const String notificationsList = '/api/v1/notifications';
  
  /// Mark notification as read endpoint
  static String notificationMarkRead(String id) => '/api/v1/notifications/$id/read';
  
  /// Mark all notifications as read endpoint
  static const String notificationMarkAllRead = '/api/v1/notifications/read-all';
  
  /// Delete notification endpoint
  static String notificationDelete(String id) => '/api/v1/notifications/$id';
  
  /// Notification settings endpoint
  static const String notificationSettings = '/api/v1/notifications/settings';
  
  
  /// Track event endpoint
  static const String analyticsTrack = '/api/v1/analytics/track';
  
  /// Get analytics data endpoint
  static const String analyticsData = '/api/v1/analytics/data';
  
  /// User statistics endpoint
  static const String analyticsUserStats = '/api/v1/analytics/user/stats';
  
  
  /// Health check endpoint
  static const String systemHealth = '/api/v1/system/health';
  
  /// Version info endpoint
  static const String systemVersion = '/api/v1/system/version';
  
  /// App configuration endpoint
  static const String systemConfig = '/api/v1/system/config';
  
  /// Server time endpoint
  static const String systemTime = '/api/v1/system/time';
  
  
  /// Global search endpoint
  static const String searchGlobal = '/api/v1/search';
  
  /// Search suggestions endpoint
  static const String searchSuggestions = '/api/v1/search/suggestions';
  
  /// Search history endpoint
  static const String searchHistory = '/api/v1/search/history';
  
  /// Clear search history endpoint
  static const String searchHistoryClear = '/api/v1/search/history/clear';
  
  
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