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

/// Chinese localization for QY App
class ZhAppQy {
  static const Map<String, String> values = {
    // App Identity
    'qy_app_name': '示例应用',
    'qy_app_description': '综合示例应用程序',
    'qy_app_slogan': '学习、构建、成长',
    'qy_app_version': '版本 1.0.0',

    // Common Actions
    'qy_home': '首页',
    'qy_next': '下一步',
    'qy_previous': '上一步',
    'qy_skip': '跳过',
    'qy_cancel': '取消',
    'qy_confirm': '确认',
    'qy_save': '保存',
    'qy_delete': '删除',
    'qy_edit': '编辑',
    'qy_back': '返回',
    'qy_close': '关闭',
    'qy_ok': '确定',
    'qy_yes': '是',
    'qy_no': '否',
    'qy_continue': '继续',
    'qy_submit': '提交',
    'qy_retry': '重试',
    'qy_refresh': '刷新',
    'qy_search': '搜索',
    'qy_filter': '筛选',
    'qy_sort': '排序',
    'qy_clear': '清除',
    'qy_reset': '重置',

    // Status Messages
    'qy_success': '成功',
    'qy_error': '错误',
    'qy_warning': '警告',
    'qy_info': '信息',
    'qy_loading': '加载中...',
    'qy_completed': '已完成',
    'qy_pending': '待处理',
    'qy_failed': '失败',

    // Authentication
    'qy_sign_in': '登录',
    'qy_sign_up': '注册',
    'qy_sign_out': '退出',
    'qy_logout': '退出登录',
    'qy_login': '登录',
    'qy_register': '注册',
    'qy_forgot_password': '忘记密码',
    'qy_reset_password': '重置密码',
    'qy_change_password': '修改密码',
    'qy_email': '邮箱',
    'qy_password': '密码',
    'qy_confirm_password': '确认密码',
    'qy_username': '用户名',
    'qy_remember_me': '记住我',
    'qy_create_account': '创建账号',
    'qy_have_account': '已有账号？',
    'qy_no_account': '还没有账号？',

    // Settings
    'qy_settings': '设置',
    'qy_dark_mode': '深色模式',
    'qy_light_mode': '浅色模式',
    'qy_language': '语言',
    'qy_notifications': '通知',
    'qy_privacy': '隐私',
    'qy_security': '安全',
    'qy_help': '帮助',
    'qy_about': '关于',
  };

  /// Get locales for runCommonApp
  static List<Map<String, String>> get locales => [values];
}