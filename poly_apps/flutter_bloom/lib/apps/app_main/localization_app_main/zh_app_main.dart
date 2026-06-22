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

/// Chinese localization for Main App
class ZhAppMain {
  static const Map<String, String> values = {
    // App Identity
    'main_app_name': 'Flutter Bloom - 主应用',
    'main_app_description': 'Flutter Bloom 项目的主聚合应用',
    'main_app_slogan': '所有应用，一处访问',
    'main_app_version': '版本 1.0.0',

    // Navigation
    'main_home': '首页',
    'main_showcase': '应用展示',
    'main_settings': '设置',
    'main_about': '关于',
    'main_developer': '开发者',

    // Home Screen
    'main_home_title': 'Flutter Bloom 主应用',
    'main_home_welcome': '欢迎使用 Flutter Bloom',
    'main_home_description': '在一个地方探索所有可用的应用程序',
    'main_home_quick_access': '快速访问',
    'main_home_all_apps': '所有应用',
    'main_home_recent_apps': '最近使用',
    'main_home_featured_apps': '精选应用',

    // Apps Showcase
    'main_showcase_title': '应用展示',
    'main_showcase_description': '浏览和访问所有可用的应用程序',
    'main_showcase_search': '搜索应用...',
    'main_showcase_filter': '筛选',
    'main_showcase_sort': '排序',
    'main_showcase_grid_view': '网格视图',
    'main_showcase_list_view': '列表视图',
    'main_showcase_no_apps': '没有可用的应用',
    'main_showcase_loading': '正在加载应用...',

    // App Cards
    'main_app_card_open': '打开',
    'main_app_card_info': '信息',
    'main_app_card_settings': '设置',
    'main_app_card_version': '版本',
    'main_app_card_last_used': '最后使用',
    'main_app_card_never_used': '从未使用',

    // Settings
    'main_settings_title': '主应用设置',
    'main_settings_general': '常规',
    'main_settings_appearance': '外观',
    'main_settings_apps': '应用',
    'main_settings_developer': '开发者',
    'main_settings_about': '关于',

    // General Settings
    'main_settings_showcase_mode': '展示模式',
    'main_settings_showcase_mode_desc': '启用应用浏览的展示模式',
    'main_settings_app_switching': '应用切换',
    'main_settings_app_switching_desc': '允许在应用之间切换',
    'main_settings_show_all_apps': '显示所有应用',
    'main_settings_show_all_apps_desc': '在展示中显示所有可用的应用',

    // Developer Settings
    'main_settings_developer_mode': '开发者模式',
    'main_settings_developer_mode_desc': '启用开发者功能和调试',
    'main_settings_debug_info': '调试信息',
    'main_settings_debug_info_desc': '在界面中显示调试信息',
    'main_settings_app_stats': '应用统计',
    'main_settings_app_stats_desc': '查看应用使用统计',

    // About
    'main_about_title': '关于 Flutter Bloom',
    'main_about_description': 'Flutter Bloom 是一个多应用聚合平台，将各种应用程序整合在统一的界面中。',
    'main_about_version': '版本',
    'main_about_build': '构建',
    'main_about_developer': '开发者',
    'main_about_license': '许可证',
    'main_about_privacy': '隐私政策',
    'main_about_terms': '服务条款',

    // Common Actions
    'main_open': '打开',
    'main_close': '关闭',
    'main_save': '保存',
    'main_cancel': '取消',
    'main_confirm': '确认',
    'main_delete': '删除',
    'main_edit': '编辑',
    'main_back': '返回',
    'main_next': '下一步',
    'main_previous': '上一步',
    'main_refresh': '刷新',
    'main_search': '搜索',
    'main_filter': '筛选',
    'main_sort': '排序',
    'main_clear': '清除',
    'main_reset': '重置',

    // Status Messages
    'main_success': '成功',
    'main_error': '错误',
    'main_warning': '警告',
    'main_info': '信息',
    'main_loading': '加载中...',
    'main_completed': '已完成',
    'main_pending': '待处理',
    'main_failed': '失败',

    // Error Messages
    'main_error_app_not_found': '未找到应用',
    'main_error_app_load_failed': '应用加载失败',
    'main_error_network': '网络错误',
    'main_error_unknown': '发生未知错误',
  };

  /// Get locales for runCommonApp
  static List<Map<String, String>> get locales => [values];
}
