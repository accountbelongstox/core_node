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

/// Chinese localization for Example App
class ZhAppExample {
  static const Map<String, String> values = {
    // App Identity
    'example_app_name': '示例应用',
    'example_app_description': '综合示例应用程序',
    'example_app_slogan': '学习、构建、成长',
    'example_app_version': '版本 1.0.0',

    // Common Actions
    'example_home': '首页',
    'example_next': '下一步',
    'example_previous': '上一步',
    'example_skip': '跳过',
    'example_cancel': '取消',
    'example_confirm': '确认',
    'example_save': '保存',
    'example_delete': '删除',
    'example_edit': '编辑',
    'example_back': '返回',
    'example_close': '关闭',
    'example_ok': '确定',
    'example_yes': '是',
    'example_no': '否',
    'example_continue': '继续',
    'example_submit': '提交',
    'example_retry': '重试',
    'example_refresh': '刷新',
    'example_search': '搜索',
    'example_filter': '筛选',
    'example_sort': '排序',
    'example_clear': '清除',
    'example_reset': '重置',

    // Status Messages
    'example_success': '成功',
    'example_error': '错误',
    'example_warning': '警告',
    'example_info': '信息',
    'example_loading': '加载中...',
    'example_completed': '已完成',
    'example_pending': '待处理',
    'example_failed': '失败',

    // Authentication
    'example_sign_in': '登录',
    'example_sign_up': '注册',
    'example_sign_out': '退出',
    'example_logout': '退出登录',
    'example_login': '登录',
    'example_register': '注册',
    'example_forgot_password': '忘记密码',
    'example_reset_password': '重置密码',
    'example_change_password': '修改密码',
    'example_email': '邮箱',
    'example_password': '密码',
    'example_confirm_password': '确认密码',
    'example_username': '用户名',
    'example_remember_me': '记住我',
    'example_create_account': '创建账号',
    'example_have_account': '已有账号？',
    'example_no_account': '还没有账号？',

    // Settings
    'example_settings': '设置',
    'example_dark_mode': '深色模式',
    'example_light_mode': '浅色模式',
    'example_language': '语言',
    'example_notifications': '通知',
    'example_privacy': '隐私',
    'example_security': '安全',
    'example_help': '帮助',
    'example_about': '关于',
  };

  /// Get locales for runCommonApp
  static List<Map<String, String>> get locales => [values];
}