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

/// QY App Constants
/// Contains app-specific constants and enums
class QyAppConstants {
  // Route Names
  static const String routeHome = '/qy/home';
  static const String routeLogin = '/qy/login';
  static const String routeProfile = '/qy/profile';
  static const String routeSettings = '/qy/settings';
  static const String routeAbout = '/qy/about';
  static const String routeDashboard = '/qy/dashboard';
  static const String routeSearch = '/qy/search';
  static const String routeNotifications = '/qy/notifications';
  static const String routeBookmarks = '/qy/bookmarks';
  static const String routeHelp = '/qy/help';

  // Storage Keys
  static const String keyUserToken = 'qy_user_token';
  static const String keyUserProfile = 'qy_user_profile';
  static const String keyAppSettings = 'qy_app_settings';
  static const String keyLastLoginTime = 'qy_last_login_time';
  static const String keyOfflineData = 'qy_offline_data';
  static const String keyNotificationSettings = 'qy_notification_settings';
  static const String keyThemePreference = 'qy_theme_preference';
  static const String keyLanguagePreference = 'qy_language_preference';

  // API Endpoints
  static const String endpointAuth = '/auth';
  static const String endpointLogin = '/auth/login';
  static const String endpointLogout = '/auth/logout';
  static const String endpointRegister = '/auth/register';
  static const String endpointProfile = '/user/profile';
  static const String endpointSettings = '/user/settings';
  static const String endpointNotifications = '/notifications';
  static const String endpointBookmarks = '/bookmarks';
  static const String endpointSearch = '/search';
  static const String endpointUpload = '/upload';

  // Error Messages
  static const String errorNetworkConnection = 'Network connection error';
  static const String errorInvalidCredentials = 'Invalid credentials';
  static const String errorSessionExpired = 'Session expired';
  static const String errorServerError = 'Server error occurred';
  static const String errorUnknown = 'Unknown error occurred';
  static const String errorFileUploadFailed = 'File upload failed';
  static const String errorInvalidFileFormat = 'Invalid file format';
  static const String errorFileSizeExceeded = 'File size exceeded limit';

  // Success Messages
  static const String successLoginCompleted = 'Login completed successfully';
  static const String successLogoutCompleted = 'Logout completed successfully';
  static const String successProfileUpdated = 'Profile updated successfully';
  static const String successSettingsSaved = 'Settings saved successfully';
  static const String successFileUploaded = 'File uploaded successfully';
  static const String successDataSynced = 'Data synced successfully';

  // Validation Messages
  static const String validationEmailRequired = 'Email is required';
  static const String validationEmailInvalid = 'Invalid email format';
  static const String validationPasswordRequired = 'Password is required';
  static const String validationPasswordTooShort = 'Password too short';
  static const String validationPasswordTooWeak = 'Password too weak';
  static const String validationNameRequired = 'Name is required';
  static const String validationPhoneInvalid = 'Invalid phone number';

  // UI Constants
  static const double defaultPadding = 16.0;
  static const double smallPadding = 8.0;
  static const double largePadding = 24.0;
  static const double defaultBorderRadius = 8.0;
  static const double smallBorderRadius = 4.0;
  static const double largeBorderRadius = 16.0;
  static const double defaultElevation = 2.0;
  static const double highElevation = 8.0;

  // Animation Durations
  static const int shortAnimationDuration = 200;
  static const int normalAnimationDuration = 300;
  static const int longAnimationDuration = 500;

  // Pagination
  static const int defaultPageSize = 20;
  static const int maxPageSize = 100;
  static const int minPageSize = 5;

  // File Upload
  static const int maxFileSize = 50 * 1024 * 1024; // 50MB in bytes
  static const int maxImageSize = 10 * 1024 * 1024; // 10MB in bytes
  static const int maxVideoSize = 100 * 1024 * 1024; // 100MB in bytes

  // Cache
  static const int defaultCacheExpiry = 3600; // 1 hour in seconds
  static const int longCacheExpiry = 86400; // 24 hours in seconds
  static const int shortCacheExpiry = 300; // 5 minutes in seconds

  // Timeouts
  static const int networkTimeout = 30000; // 30 seconds
  static const int uploadTimeout = 120000; // 2 minutes
  static const int downloadTimeout = 60000; // 1 minute

  // Limits
  static const int maxSearchResults = 100;
  static const int maxBookmarks = 1000;
  static const int maxNotifications = 500;
  static const int maxHistoryItems = 200;

  // Regular Expressions
  static const String emailRegex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
  static const String phoneRegex = r'^\+?[1-9]\d{1,14}$';
  static const String passwordRegex = r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$';
  static const String usernameRegex = r'^[a-zA-Z0-9_]{3,20}$';

  // Date Formats
  static const String dateFormatShort = 'MM/dd/yyyy';
  static const String dateFormatLong = 'MMMM dd, yyyy';
  static const String dateTimeFormat = 'MM/dd/yyyy HH:mm';
  static const String timeFormat = 'HH:mm';

  // Default Values
  static const String defaultAvatarUrl = 'assets/common/images/default_avatar.png';
  static const String defaultCoverUrl = 'assets/common/images/default_cover.png';
  static const String defaultLanguage = 'en';
  static const String defaultTheme = 'light';
  static const String defaultCurrency = 'USD';
  static const String defaultTimezone = 'UTC';

  // SharedPreferences configuration
  static const String prefsPrefix = 'qy_';
  static const String prefsName = 'qy_prefs';
}

/// QY App Enums
enum QyUserRole {
  guest,
  user,
  moderator,
  admin,
}

enum ExampleContentType {
  text,
  image,
  video,
  audio,
  document,
}

enum ExampleNotificationType {
  info,
  warning,
  error,
  success,
}

enum ExampleSortOrder {
  ascending,
  descending,
}

enum ExampleViewMode {
  list,
  grid,
  card,
}

enum ExampleSyncStatus {
  pending,
  syncing,
  synced,
  failed,
}
