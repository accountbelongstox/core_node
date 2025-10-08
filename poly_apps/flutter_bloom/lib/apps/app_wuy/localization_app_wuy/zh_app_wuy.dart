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

    // Friends related
    LocalizationKeysAppWuy.wuyFriendsTitle: '好友&群聊',
    LocalizationKeysAppWuy.wuyFriendsSearch: '搜索好友',
    LocalizationKeysAppWuy.wuyFriendsNoFriends: '暂无好友',
    LocalizationKeysAppWuy.wuyFriendsAddFriend: '添加好友',
    LocalizationKeysAppWuy.wuyFriendsOnline: '在线',
    LocalizationKeysAppWuy.wuyFriendsOffline: '离线',

    // Chat related
    LocalizationKeysAppWuy.wuyChatTitle: '聊天',
    LocalizationKeysAppWuy.wuyChatTypeMessage: '输入消息...',
    LocalizationKeysAppWuy.wuyChatSend: '发送',
    LocalizationKeysAppWuy.wuyChatSending: '发送中',
    LocalizationKeysAppWuy.wuyChatSent: '已发送',
    LocalizationKeysAppWuy.wuyChatRead: '已读',

    // Search related
    LocalizationKeysAppWuy.wuySearchTitle: '搜索好友',
    LocalizationKeysAppWuy.wuySearchName: '姓名',
    LocalizationKeysAppWuy.wuySearchSignature: '个性签名',
    LocalizationKeysAppWuy.wuySearchPhone: '电话号码',
    LocalizationKeysAppWuy.wuySearchGender: '性别',
    LocalizationKeysAppWuy.wuySearchMale: '男',
    LocalizationKeysAppWuy.wuySearchFemale: '女',
    LocalizationKeysAppWuy.wuySearchReset: '重置',
    LocalizationKeysAppWuy.wuySearchNoResults: '未找到相关好友',

    // Profile related
    LocalizationKeysAppWuy.wuyProfileTitle: '个人资料',
    LocalizationKeysAppWuy.wuyProfilePersonalInfo: '个人信息',
    LocalizationKeysAppWuy.wuyProfileAbout: '关于我们',
    LocalizationKeysAppWuy.wuyProfileEdit: '编辑',
    LocalizationKeysAppWuy.wuyProfileSave: '保存',
    LocalizationKeysAppWuy.wuyProfileSignOut: '退出登录',

    // About related
    LocalizationKeysAppWuy.wuyAboutTitle: '关于我们',
    LocalizationKeysAppWuy.wuyAboutFeatures: '功能介绍',
    LocalizationKeysAppWuy.wuyAboutVersion: '版本更新',
    LocalizationKeysAppWuy.wuyAboutAppInfo: '应用信息',
    LocalizationKeysAppWuy.wuyAboutVersionInfo: '查看最新版本信息',
    LocalizationKeysAppWuy.wuyAboutFeatureInfo: '了解应用的主要功能',

    // History related
    LocalizationKeysAppWuy.wuyHistoryTitle: '历史轨迹',
    LocalizationKeysAppWuy.wuyHistoryActivity: '活动历史',
    LocalizationKeysAppWuy.wuyHistoryLogin: '登录',
    LocalizationKeysAppWuy.wuyHistorySuccess: '成功',
    LocalizationKeysAppWuy.wuyHistoryAction: '操作',
    LocalizationKeysAppWuy.wuyHistoryMessage: '消息',
    LocalizationKeysAppWuy.wuyHistoryUpdate: '更新',

    // Network related
    LocalizationKeysAppWuy.wuyNetworkTitle: '网络记录',
    LocalizationKeysAppWuy.wuyNetworkActivity: '网络活动',
    LocalizationKeysAppWuy.wuyNetworkSuccess: '成功',
    LocalizationKeysAppWuy.wuyNetworkError: '错误',
    LocalizationKeysAppWuy.wuyNetworkPending: '等待中',

    // Map related
    LocalizationKeysAppWuy.wuyMapTitle: '地图',
    LocalizationKeysAppWuy.wuyMapLocation: '位置',
    LocalizationKeysAppWuy.wuyMapSearch: '搜索',

    // Authentication related
    LocalizationKeysAppWuy.wuyAuthLogin: '登录',
    LocalizationKeysAppWuy.wuyAuthRegister: '注册',
    LocalizationKeysAppWuy.wuyAuthEmail: '邮箱',
    LocalizationKeysAppWuy.wuyAuthPassword: '密码',
    LocalizationKeysAppWuy.wuyAuthConfirmPassword: '确认密码',
    LocalizationKeysAppWuy.wuyAuthPhone: '手机号',
    LocalizationKeysAppWuy.wuyAuthForgotPassword: '忘记密码？',
    LocalizationKeysAppWuy.wuyAuthSignIn: '登录',
    LocalizationKeysAppWuy.wuyAuthSignUp: '注册',
    LocalizationKeysAppWuy.wuyAuthAlreadyHaveAccount: '已有账户？',
    LocalizationKeysAppWuy.wuyAuthDontHaveAccount: '没有账户？',

    // Common actions
    LocalizationKeysAppWuy.wuyCommonOk: '确定',
    LocalizationKeysAppWuy.wuyCommonCancel: '取消',
    LocalizationKeysAppWuy.wuyCommonYes: '是',
    LocalizationKeysAppWuy.wuyCommonNo: '否',
    LocalizationKeysAppWuy.wuyCommonClose: '关闭',
    LocalizationKeysAppWuy.wuyCommonDone: '完成',
    LocalizationKeysAppWuy.wuyCommonNext: '下一步',
    LocalizationKeysAppWuy.wuyCommonPrevious: '上一步',
    LocalizationKeysAppWuy.wuyCommonRefresh: '刷新',
    LocalizationKeysAppWuy.wuyCommonRetry: '重试',
  };
}

/// Alias for compatibility with locales provider
class ZhAppWuy {
  static Map<String, dynamic> get locales => WuyZhTranslations.translations;
}
