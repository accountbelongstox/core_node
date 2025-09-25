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
  };
}