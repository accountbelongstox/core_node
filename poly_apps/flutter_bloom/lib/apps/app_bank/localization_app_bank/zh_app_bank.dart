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

import 'localization_keys_app_bank.dart';

/// Chinese localization for Bank App
class ZhAppBank {
  static const Map<String, String> locales = {
    // App Title and Branding
    BankLocalizationKeys.bankAppName: 'Flutter银行',
    BankLocalizationKeys.bankAppTagline: '您可信赖的金融伙伴',
    BankLocalizationKeys.bankWelcomeMessage: '早上好',

    // Authentication
    BankLocalizationKeys.bankLogin: '登录',
    BankLocalizationKeys.bankRegister: '注册',
    BankLocalizationKeys.bankEmail: '邮箱',
    BankLocalizationKeys.bankPassword: '密码',
    BankLocalizationKeys.bankConfirmPassword: '确认密码',
    BankLocalizationKeys.bankFirstName: '名',
    BankLocalizationKeys.bankLastName: '姓',
    BankLocalizationKeys.bankForgotPassword: '忘记密码？',
    BankLocalizationKeys.bankBiometricLogin: '生物识别登录',

    // Dashboard
    BankLocalizationKeys.bankDashboard: '仪表板',
    BankLocalizationKeys.bankTotalBalance: '总余额',
    BankLocalizationKeys.bankChecking: '支票账户',
    BankLocalizationKeys.bankSavings: '储蓄账户',
    BankLocalizationKeys.bankQuickActions: '快捷操作',
    BankLocalizationKeys.bankRecentTransactions: '最近交易',

    // Navigation
    BankLocalizationKeys.bankHome: '首页',
    BankLocalizationKeys.bankAccounts: '账户',
    BankLocalizationKeys.bankTransfer: '转账',
    BankLocalizationKeys.bankPayment: '付款',
    BankLocalizationKeys.bankCards: '银行卡',
    BankLocalizationKeys.bankInvestment: '投资',
    BankLocalizationKeys.bankLoan: '贷款',
    BankLocalizationKeys.bankSecurity: '安全',
    BankLocalizationKeys.bankProfile: '个人资料',
    BankLocalizationKeys.bankHelp: '帮助',
    BankLocalizationKeys.bankHistory: '历史记录',

    // Transaction Types
    BankLocalizationKeys.bankTransactionTypeCredit: '贷记',
    BankLocalizationKeys.bankTransactionTypeDebit: '借记',
    BankLocalizationKeys.bankTransactionTypeTransfer: '转账',
    BankLocalizationKeys.bankTransactionTypePayment: '付款',

    // Common Actions
    BankLocalizationKeys.bankSend: '发送',
    BankLocalizationKeys.bankReceive: '接收',
    BankLocalizationKeys.bankNext: '下一步',
    BankLocalizationKeys.bankBack: '返回',
    BankLocalizationKeys.bankCancel: '取消',
    BankLocalizationKeys.bankConfirm: '确认',
    BankLocalizationKeys.bankSave: '保存',
    BankLocalizationKeys.bankEdit: '编辑',
    BankLocalizationKeys.bankDelete: '删除',
    BankLocalizationKeys.bankDone: '完成',
    BankLocalizationKeys.bankContinue: '继续',
    BankLocalizationKeys.bankSkip: '跳过',
    BankLocalizationKeys.bankGetStarted: '开始使用',

    // Status Messages
    BankLocalizationKeys.bankSuccess: '成功',
    BankLocalizationKeys.bankError: '错误',
    BankLocalizationKeys.bankLoading: '加载中...',
    BankLocalizationKeys.bankNoData: '暂无数据',
    BankLocalizationKeys.bankNetworkError: '网络连接错误',
    BankLocalizationKeys.bankSessionExpired: '会话已过期',

    // Security Features
    BankLocalizationKeys.bankSecureBanking: '安全银行',
    BankLocalizationKeys.bankQuickTransfers: '快速转账',
    BankLocalizationKeys.bankSmartInvestments: '智能投资',
    BankLocalizationKeys.bankDigitalCards: '数字银行卡',

    // Amounts and Currency
    BankLocalizationKeys.bankAmount: '金额',
    BankLocalizationKeys.bankBalance: '余额',
    BankLocalizationKeys.bankCurrency: '货币',
    BankLocalizationKeys.bankLimit: '限额',
    BankLocalizationKeys.bankFee: '手续费',

    // Time and Dates
    BankLocalizationKeys.bankToday: '今天',
    BankLocalizationKeys.bankYesterday: '昨天',
    BankLocalizationKeys.bankThisWeek: '本周',
    BankLocalizationKeys.bankThisMonth: '本月',
    BankLocalizationKeys.bankLastMonth: '上月',

    // Settings and Preferences
    BankLocalizationKeys.bankSettings: '设置',
    BankLocalizationKeys.bankNotifications: '通知',
    BankLocalizationKeys.bankLanguage: '语言',
    BankLocalizationKeys.bankTheme: '主题',
    BankLocalizationKeys.bankPrivacy: '隐私',
    BankLocalizationKeys.bankTermsOfService: '服务条款',
    BankLocalizationKeys.bankAccountManagement: '账户管理',
    BankLocalizationKeys.bankAccountManagementDesc: '修改个人信息',
    BankLocalizationKeys.bankSecuritySettings: '安全设置',
    BankLocalizationKeys.bankSecuritySettingsDesc: '密码、指纹、面容识别',
    BankLocalizationKeys.bankNotificationSettings: '消息通知',
    BankLocalizationKeys.bankNotificationSettingsDesc: '推送、短信、邮件通知',
    BankLocalizationKeys.bankLanguageSettings: '简体中文',
    BankLocalizationKeys.bankHelpCenter: '帮助中心',
    BankLocalizationKeys.bankHelpCenterDesc: '常见问题与客服',
    BankLocalizationKeys.bankAboutApp: '关于银行应用',
    BankLocalizationKeys.bankAboutAppDesc: '版本 1.0.0 · 开发者测试',
    BankLocalizationKeys.bankPrivacyPolicy: '隐私政策',
    BankLocalizationKeys.bankPrivacyPolicyDesc: '用户协议与隐私条款',
    BankLocalizationKeys.bankUnknownUser: '未知用户',
    BankLocalizationKeys.bankUnknownLocation: '未知地点',
    BankLocalizationKeys.bankLastLogin: '最后登录',

    // Debug Features
    BankLocalizationKeys.bankDebugExclusiveCustomer: '专属客户',
    BankLocalizationKeys.bankDebugMyExclusiveCustomer: '生成注册码',
    BankLocalizationKeys.bankDebugExclusiveServiceDesc: '为其他机器生成注册码',
    BankLocalizationKeys.bankDebugVipService: 'VIP专属服务',
    BankLocalizationKeys.bankDebugVipDescription: '享受高端权益和个性化服务',
    BankLocalizationKeys.bankDebugVipBenefits: 'VIP权益',
    BankLocalizationKeys.bankDebugDedicatedManager: '专属客户经理',
    BankLocalizationKeys.bankDebugDedicatedManagerDesc: '7×24小时专属理财顾问',
    BankLocalizationKeys.bankDebugHigherReturns: '更高投资回报',
    BankLocalizationKeys.bankDebugHigherReturnsDesc: '专享高端理财产品',
    BankLocalizationKeys.bankDebugPriorityProcessing: '优先处理',
    BankLocalizationKeys.bankDebugPriorityProcessingDesc: '交易快速通道',
    BankLocalizationKeys.bankDebugExclusiveOffers: '专属优惠',
    BankLocalizationKeys.bankDebugExclusiveOffersDesc: '特殊利率和促销活动',
    BankLocalizationKeys.bankDebugContactService: '联系客服',
    BankLocalizationKeys.bankDebugVipHotline: 'VIP热线',
    BankLocalizationKeys.bankDebugSettings: '调试设置',
    BankLocalizationKeys.bankDebugWarning: '调试设置仅供开发使用',
    BankLocalizationKeys.bankDebugGeneralSettings: '常规设置',
    BankLocalizationKeys.bankDebugEnableDebugMode: '启用调试模式',
    BankLocalizationKeys.bankDebugEnableDebugModeDesc: '显示调试信息',
    BankLocalizationKeys.bankDebugShowPerformance: '显示性能叠加层',
    BankLocalizationKeys.bankDebugShowPerformanceDesc: '显示帧率和帧时间',
    BankLocalizationKeys.bankDebugNetworkSettings: '网络设置',
    BankLocalizationKeys.bankDebugEnableNetworkLogging: '启用网络日志',
    BankLocalizationKeys.bankDebugEnableNetworkLoggingDesc: '记录所有网络请求',
    BankLocalizationKeys.bankDebugEnableMockData: '启用模拟数据',
    BankLocalizationKeys.bankDebugEnableMockDataDesc: '使用模拟数据而非真实API',
    BankLocalizationKeys.bankDebugSettingsSaved: '调试设置已保存',
    BankLocalizationKeys.bankDebugResetDefaults: '恢复默认值',
    BankLocalizationKeys.bankDebugDeveloperFeedback: '开发者反馈',
    BankLocalizationKeys.bankDebugFeedbackInfo: '您的反馈帮助我们改进应用',
    BankLocalizationKeys.bankDebugFeedbackCategory: '反馈类别',
    BankLocalizationKeys.bankDebugCategoryBug: '错误报告',
    BankLocalizationKeys.bankDebugCategoryFeature: '功能请求',
    BankLocalizationKeys.bankDebugCategoryImprovement: '改进建议',
    BankLocalizationKeys.bankDebugCategoryOther: '其他',
    BankLocalizationKeys.bankDebugYourEmail: '您的邮箱（选填）',
    BankLocalizationKeys.bankDebugEmailPlaceholder: 'your@email.com',
    BankLocalizationKeys.bankDebugYourFeedback: '您的反馈',
    BankLocalizationKeys.bankDebugFeedbackPlaceholder: '请详细描述您的反馈...',
    BankLocalizationKeys.bankDebugSubmitFeedback: '提交反馈',
    BankLocalizationKeys.bankDebugFeedbackRequired: '请输入您的反馈',
    BankLocalizationKeys.bankDebugFeedbackSubmitted: '感谢您的反馈！',
    BankLocalizationKeys.bankDebugDeveloperTools: '开发者工具',
    BankLocalizationKeys.bankDebugAppInfo: '应用信息',
    BankLocalizationKeys.bankDebugAppVersion: '版本',
    BankLocalizationKeys.bankDebugBuildMode: '构建模式',
    BankLocalizationKeys.bankDebugCurrentLanguage: '语言',
    BankLocalizationKeys.bankDebugDevActions: '开发者操作',
    BankLocalizationKeys.bankDebugShowLogs: '查看日志',
    BankLocalizationKeys.bankDebugShowLogsDesc: '查看应用日志',
    BankLocalizationKeys.bankDebugClearCache: '清除缓存',
    BankLocalizationKeys.bankDebugClearCacheDesc: '删除缓存数据',
    BankLocalizationKeys.bankDebugResetApp: '重置应用数据',
    BankLocalizationKeys.bankDebugResetAppDesc: '清除所有应用数据',
    BankLocalizationKeys.bankDebugNetworkInfo: '网络信息',
    BankLocalizationKeys.bankDebugApiEndpoint: 'API端点',
    BankLocalizationKeys.bankDebugApiVersion: 'API版本',
    BankLocalizationKeys.bankDebugTimeout: '超时时间',
    BankLocalizationKeys.bankDebugApplicationLogs: '应用日志',
    BankLocalizationKeys.bankDebugClearCacheConfirm: '确定要清除缓存吗？',
    BankLocalizationKeys.bankDebugCacheCleared: '缓存已清除',
    BankLocalizationKeys.bankDebugResetAppConfirm: '这将删除所有应用数据。此操作无法撤销。',
    BankLocalizationKeys.bankDebugAppReset: '应用数据已重置',
    BankLocalizationKeys.bankDebugReset: '重置',
  };
}