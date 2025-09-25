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

/// English localization for Main App
class EnAppMain {
  static const Map<String, String> values = {
    // App Identity
    'main_app_name': 'Flutter Bloom - Main',
    'main_app_description': 'Main aggregation app for Flutter Bloom project',
    'main_app_slogan': 'All Apps in One Place',
    'main_app_version': 'Version 1.0.0',

    // Navigation
    'main_home': 'Home',
    'main_showcase': 'Apps Showcase',
    'main_settings': 'Settings',
    'main_about': 'About',
    'main_developer': 'Developer',

    // Home Screen
    'main_home_title': 'Flutter Bloom Main',
    'main_home_welcome': 'Welcome to Flutter Bloom',
    'main_home_description': 'Explore all available applications in one place',
    'main_home_quick_access': 'Quick Access',
    'main_home_all_apps': 'All Apps',
    'main_home_recent_apps': 'Recent Apps',
    'main_home_featured_apps': 'Featured Apps',

    // Apps Showcase
    'main_showcase_title': 'Apps Showcase',
    'main_showcase_description': 'Browse and access all available applications',
    'main_showcase_search': 'Search apps...',
    'main_showcase_filter': 'Filter',
    'main_showcase_sort': 'Sort',
    'main_showcase_grid_view': 'Grid View',
    'main_showcase_list_view': 'List View',
    'main_showcase_no_apps': 'No apps available',
    'main_showcase_loading': 'Loading apps...',

    // App Cards
    'main_app_card_open': 'Open',
    'main_app_card_info': 'Info',
    'main_app_card_settings': 'Settings',
    'main_app_card_version': 'Version',
    'main_app_card_last_used': 'Last Used',
    'main_app_card_never_used': 'Never Used',

    // Settings
    'main_settings_title': 'Main App Settings',
    'main_settings_general': 'General',
    'main_settings_appearance': 'Appearance',
    'main_settings_apps': 'Apps',
    'main_settings_developer': 'Developer',
    'main_settings_about': 'About',

    // General Settings
    'main_settings_showcase_mode': 'Showcase Mode',
    'main_settings_showcase_mode_desc': 'Enable showcase mode for app browsing',
    'main_settings_app_switching': 'App Switching',
    'main_settings_app_switching_desc': 'Allow switching between apps',
    'main_settings_show_all_apps': 'Show All Apps',
    'main_settings_show_all_apps_desc': 'Display all available apps in showcase',

    // Developer Settings
    'main_settings_developer_mode': 'Developer Mode',
    'main_settings_developer_mode_desc': 'Enable developer features and debugging',
    'main_settings_debug_info': 'Debug Information',
    'main_settings_debug_info_desc': 'Show debug information in UI',
    'main_settings_app_stats': 'App Statistics',
    'main_settings_app_stats_desc': 'View app usage statistics',

    // About
    'main_about_title': 'About Flutter Bloom',
    'main_about_description': 'Flutter Bloom is a multi-app aggregation platform that brings together various applications in a unified interface.',
    'main_about_version': 'Version',
    'main_about_build': 'Build',
    'main_about_developer': 'Developer',
    'main_about_license': 'License',
    'main_about_privacy': 'Privacy Policy',
    'main_about_terms': 'Terms of Service',

    // Common Actions
    'main_open': 'Open',
    'main_close': 'Close',
    'main_save': 'Save',
    'main_cancel': 'Cancel',
    'main_confirm': 'Confirm',
    'main_delete': 'Delete',
    'main_edit': 'Edit',
    'main_back': 'Back',
    'main_next': 'Next',
    'main_previous': 'Previous',
    'main_refresh': 'Refresh',
    'main_search': 'Search',
    'main_filter': 'Filter',
    'main_sort': 'Sort',
    'main_clear': 'Clear',
    'main_reset': 'Reset',

    // Status Messages
    'main_success': 'Success',
    'main_error': 'Error',
    'main_warning': 'Warning',
    'main_info': 'Information',
    'main_loading': 'Loading...',
    'main_completed': 'Completed',
    'main_pending': 'Pending',
    'main_failed': 'Failed',

    // Error Messages
    'main_error_app_not_found': 'App not found',
    'main_error_app_load_failed': 'Failed to load app',
    'main_error_network': 'Network error',
    'main_error_unknown': 'Unknown error occurred',
  };

  /// Get locales for runCommonApp
  static List<Map<String, String>> get locales => [values];
}
