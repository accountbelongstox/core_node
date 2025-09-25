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

/// Common Localization Keys
/// All keys have 'common_' prefix to indicate they are shared across all apps
class TextKey {
  // Common operations
  static const String commonCancel = 'common_cancel';
  static const String commonConfirm = 'common_confirm';
  static const String commonSave = 'common_save';
  static const String commonDelete = 'common_delete';
  static const String commonEdit = 'common_edit';
  static const String commonLoading = 'common_loading';
  static const String commonError = 'common_error';
  static const String commonSuccess = 'common_success';
  static const String commonOk = 'common_ok';
  static const String commonYes = 'common_yes';
  static const String commonNo = 'common_no';
  static const String commonClose = 'common_close';
  static const String commonBack = 'common_back';
  static const String commonNext = 'common_next';
  static const String commonPrevious = 'common_previous';
  static const String commonSubmit = 'common_submit';
  static const String commonReset = 'common_reset';
  static const String commonSearch = 'common_search';
  static const String commonFilter = 'common_filter';
  static const String commonSort = 'common_sort';
  static const String commonRefresh = 'common_refresh';
  static const String commonRetry = 'common_retry';

  // Common validation
  static const String commonValidationRequired = 'common_validation_required';
  static const String commonValidationEmailInvalid = 'common_validation_email_invalid';
  static const String commonValidationPasswordLength = 'common_validation_password_length';
  static const String commonValidationPasswordMatch = 'common_validation_password_match';
  static const String commonValidationPhoneInvalid = 'common_validation_phone_invalid';
  static const String commonValidationMinLength = 'common_validation_min_length';
  static const String commonValidationMaxLength = 'common_validation_max_length';

  // Common settings
  static const String commonSettings = 'common_settings';
  static const String commonLanguage = 'common_language';
  static const String commonTheme = 'common_theme';
  static const String commonNotifications = 'common_notifications';
  static const String commonPrivacy = 'common_privacy';
  static const String commonSecurity = 'common_security';
  static const String commonAbout = 'common_about';
  static const String commonHelp = 'common_help';
  static const String commonFeedback = 'common_feedback';
  static const String commonLogout = 'common_logout';
  static const String commonLogin = 'common_login';
  static const String commonRegister = 'common_register';
  static const String commonProfile = 'common_profile';

  // Common status
  static const String commonOnline = 'common_online';
  static const String commonOffline = 'common_offline';
  static const String commonConnecting = 'common_connecting';
  static const String commonConnected = 'common_connected';
  static const String commonDisconnected = 'common_disconnected';
  static const String commonSyncing = 'common_syncing';
  static const String commonSynced = 'common_synced';
  static const String commonFailed = 'common_failed';
  static const String commonPending = 'common_pending';
  static const String commonCompleted = 'common_completed';
  static const String commonInProgress = 'common_in_progress';

  // Common time
  static const String commonToday = 'common_today';
  static const String commonYesterday = 'common_yesterday';
  static const String commonTomorrow = 'common_tomorrow';
  static const String commonThisWeek = 'common_this_week';
  static const String commonThisMonth = 'common_this_month';
  static const String commonThisYear = 'common_this_year';
  static const String commonLastWeek = 'common_last_week';
  static const String commonLastMonth = 'common_last_month';
  static const String commonLastYear = 'common_last_year';

  // Common network
  static const String commonNetworkError = 'common_network_error';
  static const String commonConnectionFailed = 'common_connection_failed';
  static const String commonTimeout = 'common_timeout';
  static const String commonServerError = 'common_server_error';
  static const String commonNoInternet = 'common_no_internet';
  static const String commonTryAgain = 'common_try_again';
  static const String commonCheckConnection = 'common_check_connection';

  // Common file operations
  static const String fileNotFound = 'file_not_found';
  static const String fileTooLarge = 'file_too_large';
  static const String uploadFailed = 'upload_failed';
  static const String downloadFailed = 'download_failed';
  static const String fileCorrupted = 'file_corrupted';
  static const String permissionDenied = 'permission_denied';

  // Common media
  static const String photo = 'photo';
  static const String video = 'video';
  static const String audio = 'audio';
  static const String document = 'document';
  static const String image = 'image';
  static const String camera = 'camera';
  static const String gallery = 'gallery';
  static const String record = 'record';
  static const String play = 'play';
  static const String pause = 'pause';
  static const String stop = 'stop';
  static const String volume = 'volume';
  static const String mute = 'mute';
  static const String unmute = 'unmute';

  // Common navigation
  static const String home = 'home';
  static const String dashboard = 'dashboard';
  static const String menu = 'menu';
  static const String navigation = 'navigation';
  static const String breadcrumb = 'breadcrumb';
  static const String tab = 'tab';
  static const String page = 'page';
  static const String section = 'section';

  // Common data
  static const String data = 'data';
  static const String information = 'information';
  static const String details = 'details';
  static const String summary = 'summary';
  static const String overview = 'overview';
  static const String statistics = 'statistics';
  static const String analytics = 'analytics';
  static const String report = 'report';
  static const String export = 'export';
  static const String import = 'import';
  static const String backup = 'backup';
  static const String restore = 'restore';

  // Common user interface
  static const String empty = 'empty';
  static const String noData = 'no_data';
  static const String noResults = 'no_results';
  static const String noItems = 'no_items';
  static const String noMessages = 'no_messages';
  static const String noNotifications = 'no_notifications';
  static const String noFiles = 'no_files';
  static const String noPhotos = 'no_photos';
  static const String noVideos = 'no_videos';
  static const String noAudio = 'no_audio';
  static const String noDocuments = 'no_documents';

  // Theme options
  static const String commonLightTheme = 'common_light_theme';
  static const String commonDarkTheme = 'common_dark_theme';
  static const String commonSystemTheme = 'common_system_theme';

  // Language options
  static const String commonEnglish = 'common_english';
  static const String commonChinese = 'common_chinese';
  static const String commonLanguageSystem = 'common_language_system';

  // Font size options
  static const String commonFontSize = 'common_font_size';
  static const String commonFontSizeSmall = 'common_font_size_small';
  static const String commonFontSizeMedium = 'common_font_size_medium';
  static const String commonFontSizeLarge = 'common_font_size_large';
  static const String commonFontSizeExtraLarge = 'common_font_size_extra_large';

  // View modes
  static const String commonGridView = 'common_grid_view';
  static const String commonListView = 'common_list_view';
  static const String commonCardView = 'common_card_view';

  // App info
  static const String commonAppName = 'common_app_name';
  static const String commonAppDescription = 'common_app_description';
  static const String commonVersion = 'common_version';
  static const String commonBuildNumber = 'common_build_number';
  static const String commonDeveloper = 'common_developer';

  /// Extension method to get translation
  /// This will be implemented in localization_manager.dart
  String tr([String? fallback]) {
    // This method will be extended in localization_manager.dart
    return fallback ?? toString();
  }
}
