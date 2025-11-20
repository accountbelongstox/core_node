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

/// Localization keys for Main App
/// 
/// This class contains all the localization keys used in the Main app.
/// Keys follow the pattern: main_{category}_{specific_key}
/// 
/// USAGE:
/// - Use these constants instead of hardcoded strings
/// - Import this file when you need to reference localization keys
/// - All keys must have corresponding entries in en_app_main.dart and zh_app_main.dart
class LocalizationKeysAppMain {
  // App Identity
  static const String appName = 'main_app_name';
  static const String appDescription = 'main_app_description';
  static const String appSlogan = 'main_app_slogan';
  static const String appVersion = 'main_app_version';

  // Navigation
  static const String home = 'main_home';
  static const String showcase = 'main_showcase';
  static const String settings = 'main_settings';
  static const String about = 'main_about';
  static const String developer = 'main_developer';

  // Home Screen
  static const String homeTitle = 'main_home_title';
  static const String homeWelcome = 'main_home_welcome';
  static const String homeDescription = 'main_home_description';
  static const String homeQuickAccess = 'main_home_quick_access';
  static const String homeAllApps = 'main_home_all_apps';
  static const String homeRecentApps = 'main_home_recent_apps';
  static const String homeFeaturedApps = 'main_home_featured_apps';

  // Apps Showcase
  static const String showcaseTitle = 'main_showcase_title';
  static const String showcaseDescription = 'main_showcase_description';
  static const String showcaseSearch = 'main_showcase_search';
  static const String showcaseFilter = 'main_showcase_filter';
  static const String showcaseSort = 'main_showcase_sort';
  static const String showcaseGridView = 'main_showcase_grid_view';
  static const String showcaseListView = 'main_showcase_list_view';
  static const String showcaseNoApps = 'main_showcase_no_apps';
  static const String showcaseLoading = 'main_showcase_loading';

  // App Cards
  static const String appCardOpen = 'main_app_card_open';
  static const String appCardInfo = 'main_app_card_info';
  static const String appCardSettings = 'main_app_card_settings';
  static const String appCardVersion = 'main_app_card_version';
  static const String appCardLastUsed = 'main_app_card_last_used';
  static const String appCardNeverUsed = 'main_app_card_never_used';

  // Settings
  static const String settingsTitle = 'main_settings_title';
  static const String settingsGeneral = 'main_settings_general';
  static const String settingsAppearance = 'main_settings_appearance';
  static const String settingsApps = 'main_settings_apps';
  static const String settingsDeveloper = 'main_settings_developer';
  static const String settingsAbout = 'main_settings_about';

  // General Settings
  static const String settingsShowcaseMode = 'main_settings_showcase_mode';
  static const String settingsShowcaseModeDesc = 'main_settings_showcase_mode_desc';
  static const String settingsAppSwitching = 'main_settings_app_switching';
  static const String settingsAppSwitchingDesc = 'main_settings_app_switching_desc';
  static const String settingsShowAllApps = 'main_settings_show_all_apps';
  static const String settingsShowAllAppsDesc = 'main_settings_show_all_apps_desc';

  // Developer Settings
  static const String settingsDeveloperMode = 'main_settings_developer_mode';
  static const String settingsDeveloperModeDesc = 'main_settings_developer_mode_desc';
  static const String settingsDebugInfo = 'main_settings_debug_info';
  static const String settingsDebugInfoDesc = 'main_settings_debug_info_desc';
  static const String settingsAppStats = 'main_settings_app_stats';
  static const String settingsAppStatsDesc = 'main_settings_app_stats_desc';

  // About
  static const String aboutTitle = 'main_about_title';
  static const String aboutDescription = 'main_about_description';
  static const String aboutVersion = 'main_about_version';
  static const String aboutBuild = 'main_about_build';
  static const String aboutDeveloper = 'main_about_developer';
  static const String aboutLicense = 'main_about_license';
  static const String aboutPrivacy = 'main_about_privacy';
  static const String aboutTerms = 'main_about_terms';

  // Common Actions
  static const String open = 'main_open';
  static const String close = 'main_close';
  static const String save = 'main_save';
  static const String cancel = 'main_cancel';
  static const String confirm = 'main_confirm';
  static const String delete = 'main_delete';
  static const String edit = 'main_edit';
  static const String back = 'main_back';
  static const String next = 'main_next';
  static const String previous = 'main_previous';
  static const String refresh = 'main_refresh';
  static const String search = 'main_search';
  static const String filter = 'main_filter';
  static const String sort = 'main_sort';
  static const String clear = 'main_clear';
  static const String reset = 'main_reset';

  // Status Messages
  static const String success = 'main_success';
  static const String error = 'main_error';
  static const String warning = 'main_warning';
  static const String info = 'main_info';
  static const String loading = 'main_loading';
  static const String completed = 'main_completed';
  static const String pending = 'main_pending';
  static const String failed = 'main_failed';

  // Error Messages
  static const String errorAppNotFound = 'main_error_app_not_found';
  static const String errorAppLoadFailed = 'main_error_app_load_failed';
  static const String errorNetwork = 'main_error_network';
  static const String errorUnknown = 'main_error_unknown';
}
