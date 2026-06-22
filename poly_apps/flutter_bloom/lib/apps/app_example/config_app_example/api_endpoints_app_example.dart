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

/// API endpoints configuration for app_example
/// Contains all API paths that will be combined with base URL
class ApiEndpointsAppExample {
  static const String authLogin = '/auth/login';
  static const String authRegister = '/auth/register';
  static const String authLogout = '/auth/logout';
  static const String authRefresh = '/auth/refresh';
  static const String authForgotPassword = '/auth/forgot-password';
  static const String authResetPassword = '/auth/reset-password';
  static const String authVerifyEmail = '/auth/verify-email';
  static const String authChangePassword = '/auth/change-password';

  static const String userProfile = '/user/profile';
  static const String userUpdate = '/user/update';
  static const String userSettings = '/user/settings';
  static const String userPreferences = '/user/preferences';
  static const String userAvatar = '/user/avatar';
  static const String userNotifications = '/user/notifications';
  static const String userSessions = '/user/sessions';
  static const String userActivity = '/user/activity';

  static const String contentList = '/content';
  static const String contentDetail = '/content/{id}';
  static const String contentCreate = '/content/create';
  static const String contentUpdate = '/content/{id}/update';
  static const String contentDelete = '/content/{id}/delete';
  static const String contentSearch = '/content/search';
  static const String contentCategories = '/content/categories';
  static const String contentFavorites = '/content/favorites';

  static const String publicNews = '/public/news';
  static const String publicAnnouncements = '/public/announcements';
  static const String publicFaq = '/public/faq';
  static const String publicContact = '/public/contact';
  static const String publicFeedback = '/public/feedback';
  static const String publicHealth = '/public/health';
  static const String publicVersion = '/public/version';
  static const String publicConfig = '/public/config';

  static const String fileUpload = '/files/upload';
  static const String fileDownload = '/files/{id}/download';
  static const String fileDelete = '/files/{id}/delete';
  static const String fileList = '/files';
  static const String fileInfo = '/files/{id}/info';

  static const String notificationsList = '/notifications';
  static const String notificationsMarkRead = '/notifications/{id}/read';
  static const String notificationsMarkAllRead = '/notifications/read-all';
  static const String notificationsSettings = '/notifications/settings';
  static const String notificationsSubscribe = '/notifications/subscribe';
  static const String notificationsUnsubscribe = '/notifications/unsubscribe';

  static const String analyticsEvent = '/analytics/event';
  static const String analyticsPageView = '/analytics/pageview';
  static const String analyticsUserAction = '/analytics/action';
  static const String analyticsSession = '/analytics/session';

  static const String adminUsers = '/admin/users';
  static const String adminUserDetail = '/admin/users/{id}';
  static const String adminUserBlock = '/admin/users/{id}/block';
  static const String adminUserUnblock = '/admin/users/{id}/unblock';
  static const String adminStats = '/admin/stats';
  static const String adminLogs = '/admin/logs';
  static const String adminSettings = '/admin/settings';

  
  /// Replace path parameters with actual values
  /// Example: replacePathParams('/content/{id}', {'id': '123'}) -> '/content/123'
  static String replacePathParams(String path, Map<String, String> params) {
    String result = path;
    params.forEach((key, value) {
      result = result.replaceAll('{$key}', value);
    });
    return result;
  }

  /// Get endpoint with replaced parameters
  static String getContentDetail(String id) => replacePathParams(contentDetail, {'id': id});
  static String getContentUpdate(String id) => replacePathParams(contentUpdate, {'id': id});
  static String getContentDelete(String id) => replacePathParams(contentDelete, {'id': id});
  static String getFileDownload(String id) => replacePathParams(fileDownload, {'id': id});
  static String getFileDelete(String id) => replacePathParams(fileDelete, {'id': id});
  static String getFileInfo(String id) => replacePathParams(fileInfo, {'id': id});
  static String getNotificationMarkRead(String id) => replacePathParams(notificationsMarkRead, {'id': id});
  static String getAdminUserDetail(String id) => replacePathParams(adminUserDetail, {'id': id});
  static String getAdminUserBlock(String id) => replacePathParams(adminUserBlock, {'id': id});
  static String getAdminUserUnblock(String id) => replacePathParams(adminUserUnblock, {'id': id});

  /// Get all endpoints as a map for debugging/documentation
  static Map<String, String> getAllEndpoints() {
    return {
      // Authentication
      'authLogin': authLogin,
      'authRegister': authRegister,
      'authLogout': authLogout,
      'authRefresh': authRefresh,
      'authForgotPassword': authForgotPassword,
      'authResetPassword': authResetPassword,
      'authVerifyEmail': authVerifyEmail,
      'authChangePassword': authChangePassword,
      
      // User Management
      'userProfile': userProfile,
      'userUpdate': userUpdate,
      'userSettings': userSettings,
      'userPreferences': userPreferences,
      'userAvatar': userAvatar,
      'userNotifications': userNotifications,
      'userSessions': userSessions,
      'userActivity': userActivity,
      
      // Content
      'contentList': contentList,
      'contentDetail': contentDetail,
      'contentCreate': contentCreate,
      'contentUpdate': contentUpdate,
      'contentDelete': contentDelete,
      'contentSearch': contentSearch,
      'contentCategories': contentCategories,
      'contentFavorites': contentFavorites,
      
      // Public
      'publicNews': publicNews,
      'publicAnnouncements': publicAnnouncements,
      'publicFaq': publicFaq,
      'publicContact': publicContact,
      'publicFeedback': publicFeedback,
      'publicHealth': publicHealth,
      'publicVersion': publicVersion,
      'publicConfig': publicConfig,
      
      // File Management
      'fileUpload': fileUpload,
      'fileDownload': fileDownload,
      'fileDelete': fileDelete,
      'fileList': fileList,
      'fileInfo': fileInfo,
      
      // Notifications
      'notificationsList': notificationsList,
      'notificationsMarkRead': notificationsMarkRead,
      'notificationsMarkAllRead': notificationsMarkAllRead,
      'notificationsSettings': notificationsSettings,
      'notificationsSubscribe': notificationsSubscribe,
      'notificationsUnsubscribe': notificationsUnsubscribe,
      
      // Analytics
      'analyticsEvent': analyticsEvent,
      'analyticsPageView': analyticsPageView,
      'analyticsUserAction': analyticsUserAction,
      'analyticsSession': analyticsSession,
      
      // Admin
      'adminUsers': adminUsers,
      'adminUserDetail': adminUserDetail,
      'adminUserBlock': adminUserBlock,
      'adminUserUnblock': adminUserUnblock,
      'adminStats': adminStats,
      'adminLogs': adminLogs,
      'adminSettings': adminSettings,
    };
  }

  /// Validate if endpoint exists
  static bool isValidEndpoint(String endpoint) {
    return getAllEndpoints().containsValue(endpoint);
  }

  /// Get endpoint by name
  static String? getEndpointByName(String name) {
    return getAllEndpoints()[name];
  }
}
