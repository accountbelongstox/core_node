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

import 'localization_keys_app_wuy.dart';

/// Chinese translations for Wuy App
/// All keys must match LocalizationKeysAppWuy constants
class WuyZhTranslations {
  static const Map<String, String> translations = {
    LocalizationKeysAppWuy.wuyHomeTitle: '乌语测试应用',
    LocalizationKeysAppWuy.wuyHomeWelcome: '欢迎来到乌语应用',
    LocalizationKeysAppWuy.wuyHomeDescription: '这是乌语应用的测试页面。',
    LocalizationKeysAppWuy.wuyHomeTestButton: '测试按钮',

    LocalizationKeysAppWuy.wuyMenuHome: '首页',
    LocalizationKeysAppWuy.wuyMenuProfile: '个人资料',
    LocalizationKeysAppWuy.wuyMenuSettings: '设置',
    LocalizationKeysAppWuy.wuyMenuNotifications: '通知',
    LocalizationKeysAppWuy.wuyMenuMessages: '消息',
    LocalizationKeysAppWuy.wuyMenuSearch: '搜索',

    LocalizationKeysAppWuy.wuyActionSave: '保存',
    LocalizationKeysAppWuy.wuyActionCancel: '取消',
    LocalizationKeysAppWuy.wuyActionDelete: '删除',
    LocalizationKeysAppWuy.wuyActionEdit: '编辑',
    LocalizationKeysAppWuy.wuyActionConfirm: '确认',
    LocalizationKeysAppWuy.wuyActionBack: '返回',

    LocalizationKeysAppWuy.wuyStatusLoading: '加载中...',
    LocalizationKeysAppWuy.wuyStatusSuccess: '成功！',
    LocalizationKeysAppWuy.wuyStatusError: '发生错误',
    LocalizationKeysAppWuy.wuyStatusNoData: '暂无数据',

    LocalizationKeysAppWuy.wuyValidationRequired: '此字段为必填项',
    LocalizationKeysAppWuy.wuyValidationInvalidEmail: '请输入有效的邮箱地址',
    LocalizationKeysAppWuy.wuyValidationPasswordTooShort: '密码至少需要8个字符',
    LocalizationKeysAppWuy.wuyValidationPasswordsNoMatch: '密码不匹配',
  };
}

/// Alias for compatibility with locales provider
class ZhAppWuy {
  static Map<String, dynamic> get locales => WuyZhTranslations.translations;
}
