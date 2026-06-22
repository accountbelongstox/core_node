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

/// Common Chinese translations
/// Contains common translation content for all APPs
/// All keys have 'common_' prefix to indicate they are shared
class CommonZhTranslations {
  static const Map<String, String> translations = {
    // Common operations
    'common_cancel': '取消',
    'common_confirm': '确认',
    'common_save': '保存',
    'common_delete': '删除',
    'common_edit': '编辑',
    'common_loading': '加载中...',
    'common_error': '错误',
    'common_success': '成功',
    'common_ok': '确定',
    'common_yes': '是',
    'common_no': '否',
    'common_close': '关闭',
    'common_back': '返回',
    'common_next': '下一步',
    'common_previous': '上一步',
    'common_submit': '提交',
    'common_reset': '重置',
    'common_search': '搜索',
    'common_filter': '筛选',
    'common_sort': '排序',
    'common_refresh': '刷新',
    'common_retry': '重试',

    // Common validation
    'common_validation_required': '此字段为必填项',
    'common_validation_email_invalid': '请输入有效的邮箱地址',
    'common_validation_password_length': '密码至少需要8个字符',
    'common_validation_password_match': '密码不匹配',
    'common_validation_phone_invalid': '请输入有效的手机号码',
    'common_validation_min_length': '最小长度为{0}个字符',
    'common_validation_max_length': '最大长度为{0}个字符',

    // Common settings
    'common_settings': '设置',
    'common_language': '语言',
    'common_theme': '主题',
    'common_notifications': '通知',
    'common_privacy': '隐私',
    'common_security': '安全',
    'common_about': '关于',
    'common_help': '帮助',
    'common_feedback': '反馈',
    'common_logout': '退出登录',
    'common_login': '登录',
    'common_register': '注册',
    'common_profile': '个人资料',
    
    // Language options
    'common_english': '英文',
    'common_chinese': '中文',
    'common_language_system': '系统语言',
    
    // Theme options
    'common_light_theme': '浅色主题',
    'common_dark_theme': '深色主题',
    'common_system_theme': '系统主题',
    
    // Font size options
    'common_font_size': '字体大小',
    'common_font_size_small': '小',
    'common_font_size_medium': '中',
    'common_font_size_large': '大',
    'common_font_size_extra_large': '特大',

    // Common status
    'common_online': '在线',
    'common_offline': '离线',
    'common_connecting': '连接中...',
    'common_connected': '已连接',
    'common_disconnected': '已断开',
    'common_syncing': '同步中...',
    'common_synced': '已同步',
    'common_failed': '失败',
    'common_pending': '待处理',
    'common_completed': '已完成',
    'common_in_progress': '进行中',

    // Common time
    'common_today': '今天',
    'common_yesterday': '昨天',
    'common_tomorrow': '明天',
    'common_this_week': '本周',
    'common_this_month': '本月',
    'common_this_year': '今年',
    'common_last_week': '上周',
    'common_last_month': '上月',
    'common_last_year': '去年',

    // Common network
    'common_network_error': '网络错误',
    'common_connection_failed': '连接失败',
    'common_timeout': '超时',
    'common_server_error': '服务器错误',
    'common_no_internet': '无网络连接',
    'common_try_again': '重试',
    'common_check_connection': '检查连接',
    
    // View modes
    'common_grid_view': '网格视图',
    'common_list_view': '列表视图',
    'common_card_view': '卡片视图',
    
    // App info
    'common_app_name': 'Flutter Bloom',
    'common_app_description': '多应用Flutter框架',
    'common_version': '版本',
    'common_build_number': '构建号',
    'common_developer': '开发者',
  };
}
