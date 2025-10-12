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
    LocalizationKeysAppWuy.wuyAlreadyHaveAccount: '已有账户？',
    LocalizationKeysAppWuy.wuyNeedAccount: '需要账户？',
    
    // Login Entry Page
    LocalizationKeysAppWuy.wuyAppName: '安无忧',
    LocalizationKeysAppWuy.wuyAppSlogan: '为您精心守护',
    LocalizationKeysAppWuy.wuyPhoneLoginRegister: '手机号登录/注册',
    LocalizationKeysAppWuy.wuyUserAgreement: '注册即表示同意《用户服务与隐私协议》',
    LocalizationKeysAppWuy.wuyOtherLoginMethods: '其他登录方式',
    LocalizationKeysAppWuy.wuyWeChatLogin: '微信登录',
    LocalizationKeysAppWuy.wuyQQLogin: 'QQ登录',
    LocalizationKeysAppWuy.wuyAlipayLogin: '支付宝登录',
    
    // Phone Login Page
    LocalizationKeysAppWuy.wuyPhoneLoginTitle: '登录/注册',
    LocalizationKeysAppWuy.wuyEnterPhoneNumber: '请输入手机号',
    LocalizationKeysAppWuy.wuyEnterPassword: '请输入密码',
    LocalizationKeysAppWuy.wuyLoginButton: '登录',
    LocalizationKeysAppWuy.wuyRegisterButton: '注册',

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

    // Splash screen
    LocalizationKeysAppWuy.wuySplashTitle: '安无忧',
    LocalizationKeysAppWuy.wuySplashSubtitle: '为您精心守护',

    // Home screen
    LocalizationKeysAppWuy.wuyHomeFeatures: '功能',
    LocalizationKeysAppWuy.wuyHomeProfile: '个人资料',
    LocalizationKeysAppWuy.wuyHomeSettings: '设置',
    LocalizationKeysAppWuy.wuyHomeDashboard: '仪表板',
    LocalizationKeysAppWuy.wuyHomeViewProfile: '查看和编辑您的个人资料',
    LocalizationKeysAppWuy.wuyHomeConfigureSettings: '配置应用设置',
    LocalizationKeysAppWuy.wuyHomeViewDashboard: '查看您的仪表板',

    // Map screen
    LocalizationKeysAppWuy.wuyMapCurrentLocation: '当前位置',
    LocalizationKeysAppWuy.wuyMapFriendLocation: '好友位置',
    LocalizationKeysAppWuy.wuyMapViewDetails: '查看详情',
    LocalizationKeysAppWuy.wuyMapFriends: '好友',
    LocalizationKeysAppWuy.wuyMapMine: '我的',

    // Profile screen
    LocalizationKeysAppWuy.wuyProfileUsername: '用户名',
    LocalizationKeysAppWuy.wuyProfileEmail: '邮箱',
    LocalizationKeysAppWuy.wuyProfilePhone: '手机号',
    LocalizationKeysAppWuy.wuyProfileEditProfile: '编辑个人资料',
    LocalizationKeysAppWuy.wuyProfileChangePassword: '修改密码',
    LocalizationKeysAppWuy.wuyProfileNotificationSettings: '通知设置',
    LocalizationKeysAppWuy.wuyProfilePrivacySettings: '隐私设置',
    LocalizationKeysAppWuy.wuyProfileHelpSupport: '帮助与支持',
    LocalizationKeysAppWuy.wuyProfileTermsOfService: '服务条款',
    LocalizationKeysAppWuy.wuyProfilePrivacyPolicy: '隐私政策',
    LocalizationKeysAppWuy.wuyProfileLogout: '退出登录',
    LocalizationKeysAppWuy.wuyProfileMemberSince: '注册时间',

    // Login screen
    LocalizationKeysAppWuy.wuyLoginTitle: '登录',
    LocalizationKeysAppWuy.wuyLoginSubtitle: '欢迎回来',
    LocalizationKeysAppWuy.wuyLoginEmail: '邮箱',
    LocalizationKeysAppWuy.wuyLoginEnterEmail: '请输入您的邮箱',
    LocalizationKeysAppWuy.wuyLoginPassword: '密码',
    LocalizationKeysAppWuy.wuyLoginEnterPassword: '请输入您的密码',
    LocalizationKeysAppWuy.wuyLoginRememberMe: '记住我',
    LocalizationKeysAppWuy.wuyLoginForgotPassword: '忘记密码？',
    LocalizationKeysAppWuy.wuyLoginSignIn: '登录',
    LocalizationKeysAppWuy.wuyLoginDontHaveAccount: '没有账户？',
    LocalizationKeysAppWuy.wuyLoginSignUp: '注册',
    LocalizationKeysAppWuy.wuyLoginOr: '或',
    LocalizationKeysAppWuy.wuyLoginWithGoogle: '使用Google登录',
    LocalizationKeysAppWuy.wuyLoginWithFacebook: '使用Facebook登录',

    // Register screen
    LocalizationKeysAppWuy.wuyRegisterTitle: '注册',
    LocalizationKeysAppWuy.wuyRegisterSubtitle: '创建新账户',
    LocalizationKeysAppWuy.wuyRegisterFullName: '姓名',
    LocalizationKeysAppWuy.wuyRegisterEnterFullName: '请输入您的姓名',
    LocalizationKeysAppWuy.wuyRegisterEmail: '邮箱',
    LocalizationKeysAppWuy.wuyRegisterEnterEmail: '请输入您的邮箱',
    LocalizationKeysAppWuy.wuyRegisterPassword: '密码',
    LocalizationKeysAppWuy.wuyRegisterEnterPassword: '请输入您的密码',
    LocalizationKeysAppWuy.wuyRegisterConfirmPassword: '确认密码',
    LocalizationKeysAppWuy.wuyRegisterEnterConfirmPassword: '请再次输入您的密码',
    LocalizationKeysAppWuy.wuyRegisterAgreeTerms: '我同意服务条款和隐私政策',
    LocalizationKeysAppWuy.wuyRegisterCreateAccount: '创建账户',
    LocalizationKeysAppWuy.wuyRegisterAlreadyHaveAccount: '已有账户？',
    LocalizationKeysAppWuy.wuyRegisterSignIn: '登录',

    // Chat screen
    LocalizationKeysAppWuy.wuyChatOnline: '在线',
    LocalizationKeysAppWuy.wuyChatLastSeen: '最后在线',
    LocalizationKeysAppWuy.wuyChatTyping: '正在输入...',
    LocalizationKeysAppWuy.wuyChatImage: '图片',
    LocalizationKeysAppWuy.wuyChatFile: '文件',
    LocalizationKeysAppWuy.wuyChatVoice: '语音',
    LocalizationKeysAppWuy.wuyChatVideo: '视频',

    // Friend info screen
    LocalizationKeysAppWuy.wuyFriendInfoTitle: '好友信息',
    LocalizationKeysAppWuy.wuyFriendInfoPersonalInfo: '个人信息',
    LocalizationKeysAppWuy.wuyFriendInfoContactInfo: '联系信息',
    LocalizationKeysAppWuy.wuyFriendInfoActivity: '活动',
    LocalizationKeysAppWuy.wuyFriendInfoHistoryTracks: '历史轨迹',
    LocalizationKeysAppWuy.wuyFriendInfoNetworkRecords: '网络记录',
    LocalizationKeysAppWuy.wuyFriendInfoSendMessage: '发送消息',
    LocalizationKeysAppWuy.wuyFriendInfoCall: '通话',
    LocalizationKeysAppWuy.wuyFriendInfoVideoCall: '视频通话',

    // Add friend screen
    LocalizationKeysAppWuy.wuyAddFriendTitle: '添加好友',
    LocalizationKeysAppWuy.wuyAddFriendSearch: '搜索',
    LocalizationKeysAppWuy.wuyAddFriendSearchHint: '输入好友的手机号或用户名',
    LocalizationKeysAppWuy.wuyAddFriendResults: '搜索结果',
    LocalizationKeysAppWuy.wuyAddFriendNoResults: '未找到相关好友',
    LocalizationKeysAppWuy.wuyAddFriendAdd: '添加',
    LocalizationKeysAppWuy.wuyAddFriendAdded: '已添加',
    LocalizationKeysAppWuy.wuyAddFriendPending: '等待中',

    // Settings screen
    LocalizationKeysAppWuy.wuySettingsTitle: '设置',
    LocalizationKeysAppWuy.wuySettingsGeneral: '通用',
    LocalizationKeysAppWuy.wuySettingsNotifications: '通知',
    LocalizationKeysAppWuy.wuySettingsPrivacy: '隐私',
    LocalizationKeysAppWuy.wuySettingsSecurity: '安全',
    LocalizationKeysAppWuy.wuySettingsAbout: '关于',
    LocalizationKeysAppWuy.wuySettingsLanguage: '语言',
    LocalizationKeysAppWuy.wuySettingsTheme: '主题',
    LocalizationKeysAppWuy.wuySettingsDarkMode: '深色模式',
    LocalizationKeysAppWuy.wuySettingsLightMode: '浅色模式',
    LocalizationKeysAppWuy.wuySettingsSystemMode: '跟随系统',

    // Dashboard screen
    LocalizationKeysAppWuy.wuyDashboardTitle: '仪表板',
    LocalizationKeysAppWuy.wuyDashboardOverview: '概览',
    LocalizationKeysAppWuy.wuyDashboardStats: '统计',
    LocalizationKeysAppWuy.wuyDashboardRecentActivity: '最近活动',
    LocalizationKeysAppWuy.wuyDashboardQuickActions: '快速操作',

    // Messages
    LocalizationKeysAppWuy.wuyMessagePersonalInfoUpdated: '个人信息更新成功！',
    LocalizationKeysAppWuy.wuyMessageFriendAdded: '好友添加成功！',
    LocalizationKeysAppWuy.wuyMessageEnterPhoneFirst: '请先输入手机号',
    LocalizationKeysAppWuy.wuyMessageVerificationCodeSent: '验证码已发送到 {phone}',
    LocalizationKeysAppWuy.wuyMessageRegistrationSuccessful: '注册成功！',
    LocalizationKeysAppWuy.wuyMessageFeatureComingSoon: '功能信息即将推出！',
    LocalizationKeysAppWuy.wuyMessageVersionComingSoon: '版本信息即将推出！',
    LocalizationKeysAppWuy.wuyMessageLoginFailed: '登录失败: {error}',
    LocalizationKeysAppWuy.wuyMessageLoginSuccessOffline: '登录成功 (离线模式)',

    // About screen specific
    LocalizationKeysAppWuy.wuyAboutAppName: '安无忧',
    LocalizationKeysAppWuy.wuyAboutAppNameEn: 'An Wu You',
    LocalizationKeysAppWuy.wuyAboutVersion: '版本',
    LocalizationKeysAppWuy.wuyAboutBuild: '构建',
    LocalizationKeysAppWuy.wuyAboutDeveloper: '开发者',
    LocalizationKeysAppWuy.wuyAboutPlatform: '平台',
    LocalizationKeysAppWuy.wuyAboutLicense: '许可证',
    LocalizationKeysAppWuy.wuyAboutVersionValue: '1.0.0',
    LocalizationKeysAppWuy.wuyAboutBuildValue: '2025.01.08',
    LocalizationKeysAppWuy.wuyAboutDeveloperValue: 'Wuy Team',
    LocalizationKeysAppWuy.wuyAboutPlatformValue: 'Flutter',
    LocalizationKeysAppWuy.wuyAboutLicenseValue: 'MIT',

    // Validation messages
    LocalizationKeysAppWuy.wuyValidationPhoneInvalid: '请输入有效的手机号',
    LocalizationKeysAppWuy.wuyValidationPhoneRequired: '手机号不能为空',
    LocalizationKeysAppWuy.wuyValidationPhoneFormat: '请输入正确的手机号格式',

    // Search screen specific
    LocalizationKeysAppWuy.wuySearchSampleUser1: '小飞侠',
    LocalizationKeysAppWuy.wuySearchSampleUser1Bio: '今天天气真好',
    LocalizationKeysAppWuy.wuySearchSampleUser2: '阳光明媚',
    LocalizationKeysAppWuy.wuySearchSampleUser2Bio: '热爱生活，享受每一天',

    // Settings screen specific (additional keys)
    LocalizationKeysAppWuy.wuySettingsDarkModeDescription: '启用深色主题',
    LocalizationKeysAppWuy.wuySettingsPushNotifications: '推送通知',
    LocalizationKeysAppWuy.wuySettingsPushNotificationsDescription: '接收推送通知',
    LocalizationKeysAppWuy.wuySettingsBiometricLogin: '生物识别登录',
    LocalizationKeysAppWuy.wuySettingsBiometricLoginDescription: '使用指纹或面部识别',
    LocalizationKeysAppWuy.wuySettingsChangePassword: '修改密码',
    LocalizationKeysAppWuy.wuySettingsChangePasswordDescription: '更新您的密码',
    LocalizationKeysAppWuy.wuySettingsVersion: '版本',
    LocalizationKeysAppWuy.wuySettingsVersionValue: '1.0.0',
    LocalizationKeysAppWuy.wuySettingsTermsOfService: '服务条款',
    LocalizationKeysAppWuy.wuySettingsTermsOfServiceDescription: '阅读我们的条款',
    LocalizationKeysAppWuy.wuySettingsPrivacyPolicy: '隐私政策',
    LocalizationKeysAppWuy.wuySettingsPrivacyPolicyDescription: '阅读我们的隐私政策',
    LocalizationKeysAppWuy.wuySettingsLanguageEnglish: 'English',
    LocalizationKeysAppWuy.wuySettingsLanguageChinese: '中文',

    // Add friend screen specific
    LocalizationKeysAppWuy.wuyAddFriendEnterNickname: '输入好友昵称',
    LocalizationKeysAppWuy.wuyAddFriendEnterGender: '输入性别 (男/女)',
    LocalizationKeysAppWuy.wuyAddFriendEnterAge: '输入年龄',
    LocalizationKeysAppWuy.wuyAddFriendEnterHeight: '输入身高 (cm)',
    LocalizationKeysAppWuy.wuyAddFriendEnterWeight: '输入体重 (kg)',

    // Register screen specific
    LocalizationKeysAppWuy.wuyRegisterEnterPhone: '请输入手机号',
    LocalizationKeysAppWuy.wuyRegisterEnterVerificationCode: '请输入验证码',

    // Social login messages
    LocalizationKeysAppWuy.wuyMessageWeChatApiConnecting: '微信登录API正在接入中',
    LocalizationKeysAppWuy.wuyMessageQQApiConnecting: 'QQ登录API正在接入中',
    LocalizationKeysAppWuy.wuyMessageDingTalkApiConnecting: '钉钉登录API正在接入中',
    LocalizationKeysAppWuy.wuyMessageRecommendPhoneLogin: '推荐使用手机号登录',

    // Missing translations
    LocalizationKeysAppWuy.wuyVerificationCode: '验证码',
    LocalizationKeysAppWuy.wuyGetCode: '获取验证码',
    LocalizationKeysAppWuy.wuyRegisterLogin: '注册/登录',
    LocalizationKeysAppWuy.wuyLogin: '登录',
    LocalizationKeysAppWuy.wuyValidationVerificationRequired: '请输入验证码',
    LocalizationKeysAppWuy.wuyValidationVerificationFormat: '验证码格式不正确',
    LocalizationKeysAppWuy.wuyAgreementText: '注册即表示同意',
    LocalizationKeysAppWuy.wuyAnd: '和',
    LocalizationKeysAppWuy.wuyPrivacyPolicy: '隐私政策',
    LocalizationKeysAppWuy.wuyMessageSendCodeFailed: '发送验证码失败',
    LocalizationKeysAppWuy.wuyMessageSendCodeError: '发送验证码出错',
    LocalizationKeysAppWuy.wuyMessageOperationFailed: '操作失败',
  };
}

/// Alias for compatibility with locales provider
class ZhAppWuy {
  static Map<String, dynamic> get locales => WuyZhTranslations.translations;
}
