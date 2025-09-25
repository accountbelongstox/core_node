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

/// Common English translations
/// Contains common translation content for all APPs
/// All keys have 'common_' prefix to indicate they are shared
class CommonEnTranslations {
  static const Map<String, String> translations = {
    // Common operations
    'common_cancel': 'Cancel',
    'common_confirm': 'Confirm',
    'common_save': 'Save',
    'common_delete': 'Delete',
    'common_edit': 'Edit',
    'common_loading': 'Loading...',
    'common_error': 'Error',
    'common_success': 'Success',
    'common_ok': 'OK',
    'common_yes': 'Yes',
    'common_no': 'No',
    'common_close': 'Close',
    'common_back': 'Back',
    'common_next': 'Next',
    'common_previous': 'Previous',
    'common_submit': 'Submit',
    'common_reset': 'Reset',
    'common_search': 'Search',
    'common_filter': 'Filter',
    'common_sort': 'Sort',
    'common_refresh': 'Refresh',
    'common_retry': 'Retry',

    // Common validation
    'common_validation_required': 'This field is required',
    'common_validation_email_invalid': 'Please enter a valid email',
    'common_validation_password_length': 'Password must be at least 8 characters',
    'common_validation_password_match': 'Passwords do not match',
    'common_validation_phone_invalid': 'Please enter a valid phone number',
    'common_validation_min_length': 'Minimum length is {0} characters',
    'common_validation_max_length': 'Maximum length is {0} characters',

    // Common settings
    'common_settings': 'Settings',
    'common_language': 'Language',
    'common_theme': 'Theme',
    'common_notifications': 'Notifications',
    'common_privacy': 'Privacy',
    'common_security': 'Security',
    'common_about': 'About',
    'common_help': 'Help',
    'common_feedback': 'Feedback',
    'common_logout': 'Logout',
    'common_login': 'Login',
    'common_register': 'Register',
    'common_profile': 'Profile',
    
    // Language options
    'common_english': 'English',
    'common_chinese': 'Chinese',
    'common_language_system': 'System Language',
    
    // Theme options
    'common_light_theme': 'Light Theme',
    'common_dark_theme': 'Dark Theme',
    'common_system_theme': 'System Theme',
    
    // Font size options
    'common_font_size': 'Font Size',
    'common_font_size_small': 'Small',
    'common_font_size_medium': 'Medium',
    'common_font_size_large': 'Large',
    'common_font_size_extra_large': 'Extra Large',

    // Common status
    'common_online': 'Online',
    'common_offline': 'Offline',
    'common_connecting': 'Connecting...',
    'common_connected': 'Connected',
    'common_disconnected': 'Disconnected',
    'common_syncing': 'Syncing...',
    'common_synced': 'Synced',
    'common_failed': 'Failed',
    'common_pending': 'Pending',
    'common_completed': 'Completed',
    'common_in_progress': 'In Progress',

    // Common time
    'common_today': 'Today',
    'common_yesterday': 'Yesterday',
    'common_tomorrow': 'Tomorrow',
    'common_this_week': 'This Week',
    'common_this_month': 'This Month',
    'common_this_year': 'This Year',
    'common_last_week': 'Last Week',
    'common_last_month': 'Last Month',
    'common_last_year': 'Last Year',

    // Common network
    'common_network_error': 'Network Error',
    'common_connection_failed': 'Connection Failed',
    'common_timeout': 'Timeout',
    'common_server_error': 'Server Error',
    'common_no_internet': 'No Internet Connection',
    'common_try_again': 'Try Again',
    'common_check_connection': 'Check Connection',
    
    // View modes
    'common_grid_view': 'Grid View',
    'common_list_view': 'List View',
    'common_card_view': 'Card View',
    
    // App info
    'common_app_name': 'Flutter Bloom',
    'common_app_description': 'Multi-App Flutter Framework',
    'common_version': 'Version',
    'common_build_number': 'Build Number',
    'common_developer': 'Developer',
  };
}
