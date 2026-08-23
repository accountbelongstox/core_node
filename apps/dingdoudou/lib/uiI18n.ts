import { isAppError, type AppErrorCode } from './appError';
import { errorText } from './value';

export type UiLanguage = 'zh' | 'en';

const ERROR_MESSAGES = {
  zh: {
    'account.bindLimit': '账号绑定数量已达到授权上限',
    'account.credentialMissing': '该账号缺少登录凭证，请从已登录的拼多多页面重新绑定',
    'account.invalidCredential': '拼多多账号凭证无效',
    'account.notBound': '该拼多多账号尚未绑定',
    'account.removedDuringSync': '同步完成前账号已被移除',
    'account.required': '请先绑定并选择一个拼多多账号',
    'backend.credentialsRequired': '请填写后台地址与账号',
    'backend.requestFailed': '后台请求失败',
    'backend.timeout': '后台连接超时',
    'backend.urlCredentials': '后台地址不能包含用户名或密码',
    'backend.urlInvalid': '后台地址格式无效',
    'backend.urlProtocol': '后台地址仅支持 HTTP 或 HTTPS',
    'license.featureUnavailable': '当前授权不包含此功能',
    'license.inactive': '授权无效或已过期',
    'license.memberInactive': '会员授权已过期或不可用',
    'license.superCodeInvalid': '超级码无效',
    'message.unknown': '扩展收到未知请求',
    'order.selectionRequired': '请选择需要退款的订单',
    'pdd.loginRequired': '未检测到已登录的拼多多账号，请先在拼多多页面登录',
    'pdd.requestFailed': '拼多多订单请求失败',
    'pdd.sessionCookieFailed': '无法安全切换拼多多账号会话',
  },
  en: {
    'account.bindLimit': 'The account binding limit has been reached',
    'account.credentialMissing': 'This account has no login credentials; bind it again from a signed-in PDD page',
    'account.invalidCredential': 'The PDD account credentials are invalid',
    'account.notBound': 'This PDD account is not bound',
    'account.removedDuringSync': 'The account was removed before synchronization completed',
    'account.required': 'Bind and select a PDD account first',
    'backend.credentialsRequired': 'Enter the backend URL and account',
    'backend.requestFailed': 'The backend request failed',
    'backend.timeout': 'The backend connection timed out',
    'backend.urlCredentials': 'The backend URL must not contain a username or password',
    'backend.urlInvalid': 'The backend URL is invalid',
    'backend.urlProtocol': 'The backend URL must use HTTP or HTTPS',
    'license.featureUnavailable': 'The current license does not include this feature',
    'license.inactive': 'The license is invalid or expired',
    'license.memberInactive': 'The member license is expired or unavailable',
    'license.superCodeInvalid': 'The super code is invalid',
    'message.unknown': 'The extension received an unknown request',
    'order.selectionRequired': 'Select orders to refund',
    'pdd.loginRequired': 'No signed-in PDD account was detected; sign in to PDD first',
    'pdd.requestFailed': 'The PDD order request failed',
    'pdd.sessionCookieFailed': 'Unable to switch the PDD account session safely',
  },
} as const satisfies Record<UiLanguage, Record<AppErrorCode, string>>;

export function localizedErrorText(
  lang: UiLanguage,
  error: unknown,
  fallback: string,
): string {
  if (isAppError(error)) return ERROR_MESSAGES[lang][error.code];
  return errorText(error, fallback);
}

export function nextLanguage(lang: UiLanguage): UiLanguage {
  return lang === 'zh' ? 'en' : 'zh';
}

export function localeFor(lang: UiLanguage): string {
  return lang === 'zh' ? 'zh-CN' : 'en-US';
}

const DASHBOARD_MESSAGES = {
  zh: {
    licenseVerification: '授权验证',
    superCode: '超级码',
    memberBackend: '会员后台',
    offlineActivate: '离线激活',
    account: '账号',
    email: '邮箱（可选）',
    password: '密码',
    confirmPassword: '确认密码',
    login: '登录',
    register: '注册',
    passwordMismatch: '两次输入的密码不一致',
    logout: '退出授权',
    bindCurrentAccount: '绑定当前拼多多账号',
    passwordManaged: '密码由授权后台管理',
    realBalanceReadonly: '真实余额不可在本地修改',
    useBindButton: '请使用上方绑定按钮',
    orderFilters: '订单筛选',
    reset: '重置',
    daySuffix: '天',
    currentAccount: '当前账号',
    allAccounts: '合并全部账号',
    recipientUnit: '位收件人',
    sync: '同步',
    reconcile: '订单核算',
    selectResults: '全选当前结果',
    refund: '提交退款',
    bindFirst: '请先绑定拼多多账号',
    selectFirst: '请先选择订单',
    pddPageRequired: '该操作必须在对应的拼多多页面完成，控制台不会伪造成功状态',
    clipboardFailed: '复制失败，请检查剪贴板权限',
    noExportOrders: '没有可导出的订单',
    reorderOnPdd: '请在拼多多商品页重新下单',
    missingOwner: '缺少所属账号',
    backendPermissionDenied: '未授予后台地址访问权限',
    genericError: '操作失败',
  },
  en: {
    licenseVerification: 'License verification',
    superCode: 'Super code',
    memberBackend: 'Backend',
    offlineActivate: 'Activate',
    account: 'Account',
    email: 'Email (optional)',
    password: 'Password',
    confirmPassword: 'Confirm password',
    login: 'Login',
    register: 'Register',
    passwordMismatch: 'The passwords do not match',
    logout: 'Logout',
    bindCurrentAccount: 'Bind current PDD account',
    passwordManaged: 'Password is managed by the license backend',
    realBalanceReadonly: 'Real balance cannot be edited locally',
    useBindButton: 'Use the bind button above',
    orderFilters: 'Order filters',
    reset: 'Reset',
    daySuffix: 'd',
    currentAccount: 'Current account',
    allAccounts: 'All accounts',
    recipientUnit: 'recipients',
    sync: 'Sync',
    reconcile: 'Reconcile',
    selectResults: 'Select results',
    refund: 'Refund',
    bindFirst: 'Bind a PDD account first',
    selectFirst: 'Select orders first',
    pddPageRequired: 'Complete this action on the corresponding PDD page',
    clipboardFailed: 'Clipboard access failed',
    noExportOrders: 'No orders to export',
    reorderOnPdd: 'Reorder from the PDD product page',
    missingOwner: 'has no owning account',
    backendPermissionDenied: 'Backend access permission was not granted',
    genericError: 'Operation failed',
  },
} as const;

export function dashboardText(lang: UiLanguage) {
  const messages = DASHBOARD_MESSAGES[lang];
  return {
    ...messages,
    accountBound: (name: string) => lang === 'zh' ? `已绑定 ${name}` : `Bound ${name}`,
    synced: (count: number) => lang === 'zh' ? `同步完成，共 ${count} 笔` : `Synced ${count} orders`,
    refunded: (count: number) => lang === 'zh' ? `已提交 ${count} 笔退款` : `${count} refunds submitted`,
    copied: (label: string) => lang === 'zh' ? `已复制：${label}` : `Copied: ${label}`,
    missingOrderOwner: (id: string) => lang === 'zh'
      ? `订单 ${id} ${messages.missingOwner}`
      : `Order ${id} ${messages.missingOwner}`,
  };
}

const POPUP_MESSAGES = {
  zh: {
    appName: '订多多', locked: '未授权', super: '超级码', member: '会员', loading: '加载中…',
    superLicense: '超级码授权', memberLicense: '会员授权', tier: '版本', offline: '离线',
    logout: '退出授权', activate: '激活', offlineHint: '超级码完全离线校验，不连接后台。',
    backendLogin: '连接后台登录或注册', backendUrl: '后台地址', username: '用户名', email: '邮箱（可选）', password: '密码',
    confirmPassword: '确认密码', login: '登录', register: '注册', passwordMismatch: '两次输入的密码不一致',
    accounts: '拼多多账号', accountUnit: '个', noAccounts: '暂无绑定账号', expired: '登录已过期', normal: '正常',
    remove: '移除账号', capture: '捕获当前拼多多账号', sync: '同步当前账号订单', dashboard: '打开订单管理终端',
    enterSuperCode: '请输入超级码', activated: '授权成功', invalidSuperCode: '超级码无效',
    enterBackendCredentials: '请填写后台地址、用户名与密码', loginSucceeded: '会员登录成功', loginFailed: '登录失败',
    registrationSucceeded: '会员注册成功', registrationFailed: '注册失败',
    backendPermissionDenied: '未授予后台地址访问权限',
    genericError: '操作失败',
    loggedOut: '已退出授权', captureFromPdd: '请先在已登录的拼多多页面打开此插件', removed: '已移除账号',
    selectAccountFirst: '请先捕获并选择一个拼多多账号', syncFailed: '同步失败',
  },
  en: {
    appName: 'DingDuoDuo', locked: 'Locked', super: 'Super code', member: 'Member', loading: 'Loading…',
    superLicense: 'Super-code license', memberLicense: 'Member license', tier: 'Tier', offline: 'Offline',
    logout: 'Log out', activate: 'Activate', offlineHint: 'Super codes are verified fully offline without contacting the backend.',
    backendLogin: 'Backend login or registration', backendUrl: 'Backend URL', username: 'Username', email: 'Email (optional)', password: 'Password',
    confirmPassword: 'Confirm password', login: 'Log in', register: 'Register', passwordMismatch: 'The passwords do not match',
    accounts: 'PDD accounts', accountUnit: '', noAccounts: 'No bound accounts', expired: 'Login expired', normal: 'Active',
    remove: 'Remove account', capture: 'Capture current PDD account', sync: 'Sync current account', dashboard: 'Open order dashboard',
    enterSuperCode: 'Enter a super code', activated: 'License activated', invalidSuperCode: 'Invalid super code',
    enterBackendCredentials: 'Enter the backend URL, username, and password', loginSucceeded: 'Member login succeeded', loginFailed: 'Login failed',
    registrationSucceeded: 'Member registration succeeded', registrationFailed: 'Registration failed',
    backendPermissionDenied: 'Backend access permission was not granted',
    genericError: 'Operation failed',
    loggedOut: 'Logged out', captureFromPdd: 'Open the extension from a signed-in PDD page', removed: 'Account removed',
    selectAccountFirst: 'Capture and select a PDD account first', syncFailed: 'Sync failed',
  },
} as const;

export function popupText(lang: UiLanguage) {
  const messages = POPUP_MESSAGES[lang];
  return {
    ...messages,
    bound: (name: string) => lang === 'zh' ? `已绑定 ${name}` : `Bound ${name}`,
    synced: (count: number) => lang === 'zh' ? `已同步 ${count} 条订单` : `Synced ${count} orders`,
  };
}

const ORDER_CARD_MESSAGES = {
  zh: {
    spec: '规格', quantity: '数量', price: '单价', shipped: '发货',
    inTransit: '快递正在派件', noTracking: '暂无物流单号 / 等待商家打单发货',
    product: '拼单商品', account: '绑定账号', supportUnavailable: '请通过拼多多订单页联系商家客服',
  },
  en: {
    spec: 'Spec', quantity: 'Qty', price: 'Price', shipped: 'Shipped',
    inTransit: 'In Transit', noTracking: 'Awaiting Tracking Number / Pending Merchant Dispatch',
    product: 'Product', account: 'ERP ID', supportUnavailable: 'Contact merchant support from the PDD order page',
  },
} as const;

export function orderCardText(lang: UiLanguage) {
  return ORDER_CARD_MESSAGES[lang];
}

const RECONCILIATION_MESSAGES = {
  zh: {
    batch: '批次', title: '订单核算 · 快递单号双向核对', print: '一键打印报表', add: '批量添加快递单号',
    batchName: '批次名称（可选）', trackingPlaceholder: '粘贴快递单号，支持换行 / 空格 / 逗号 / 分号分隔',
    save: '保存批次', cached: '已缓存批次', emptyBatches: '暂无批次，请在上方添加。', numberUnit: '个单号',
    batchNumbers: '批次单号', orderNumbers: '订单单号', matched: '命中', missing: '缺失', extra: '多余', perBatch: '各批次命中情况',
    batchMissing: '批次缺失', orderExtra: '订单多余', tracking: '快递单号', batches: '所属批次', order: '订单号',
    account: '账号', status: '状态', noData: '无数据', compareHint: '核对对象为系统中已同步的全部订单快递单号。',
    loadFailed: '加载核算数据失败', saveFailed: '保存批次失败', removeFailed: '删除批次失败',
  },
  en: {
    batch: 'Batch', title: 'Order Reconciliation · Tracking Audit', print: 'Print Report', add: 'Batch add tracking numbers',
    batchName: 'Batch name (optional)', trackingPlaceholder: 'Paste tracking numbers (newline / space / comma / ; separated)',
    save: 'Save batch', cached: 'Cached batches', emptyBatches: 'No batches yet.', numberUnit: 'nums',
    batchNumbers: 'Batch', orderNumbers: 'Orders', matched: 'Matched', missing: 'Missing', extra: 'Extra', perBatch: 'Per-batch',
    batchMissing: 'Missing', orderExtra: 'Unaccounted', tracking: 'Tracking', batches: 'Batches', order: 'Order',
    account: 'Account', status: 'Status', noData: 'No data', compareHint: 'Compared against tracking numbers of all synced orders.',
    loadFailed: 'Unable to load reconciliation data', saveFailed: 'Unable to save batch', removeFailed: 'Unable to remove batch',
  },
} as const;

export function reconciliationText(lang: UiLanguage) {
  const messages = RECONCILIATION_MESSAGES[lang];
  return {
    ...messages,
    parsed: (count: number) => lang === 'zh' ? `已解析 ${count} 个去重单号` : `${count} unique numbers`,
    missingCount: (count: number) => lang === 'zh' ? `缺 ${count}` : `${count} missing`,
  };
}

const ORDER_FORM_MESSAGES = {
  zh: {
    defaultProduct: '史丹利中心冲样冲定位冲子冲销圆锥冲尖头冲子钉冲金属敲击定位',
    defaultSpec: '圆锥冲2*138mm', defaultStore: 'STANLEY史丹利因珀特专卖店', customRecipient: '手动输入收件信息',
  },
  en: {
    defaultProduct: 'STANLEY Heavy Duty Center Punch Scribe Brass Automatic Alignment Pin',
    defaultSpec: 'Tapered 2*138mm', defaultStore: 'STANLEY Official Store', customRecipient: 'Custom Add Address',
  },
} as const;

export function orderFormText(lang: UiLanguage) {
  return ORDER_FORM_MESSAGES[lang];
}

const CSV_HEADERS = {
  zh: ['拼多多账号', '订单号', '商品ID', '商品名称', '规格', '规格ID', '数量', '单价', '应付实付', '订单状态', '店铺名称', '收件人姓名', '收件人电话', '收货详细地址', '物流公司', '快递单号', '下单时间'],
  en: ['Channel', 'Order ID', 'Item ID', 'Item Title', 'Variant', 'Variant ID', 'Qty', 'Price', 'Amount', 'Status', 'Shop Name', 'Recipient Name', 'Phone', 'Address', 'Courier', 'Tracking No', 'Order Date'],
} as const;

export function csvHeaders(lang: UiLanguage): readonly string[] {
  return CSV_HEADERS[lang];
}

const REPORT_MESSAGES = {
  zh: {
    title: '订多多 · 订单快递核算报表', generated: '生成时间', overview: '核算概览', batchNumbers: '批次单号总数',
    orderNumbers: '订单单号总数', matched: '匹配命中', missing: '批次缺失(未在订单中)', extra: '订单多余(未在批次中)',
    batchSummary: '各批次命中情况', batch: '批次', total: '单号数', tracking: '快递单号', order: '订单号',
    account: '账号', product: '商品', recipient: '收件人', status: '状态', inBatches: '所属批次', htmlLanguage: 'zh-CN',
  },
  en: {
    title: 'DingDuoDuo · Order Reconciliation Report', generated: 'Generated', overview: 'Overview', batchNumbers: 'Batch numbers',
    orderNumbers: 'Order numbers', matched: 'Matched', missing: 'Missing (not in orders)', extra: 'Unaccounted (not in batches)',
    batchSummary: 'Per-batch summary', batch: 'Batch', total: 'Count', tracking: 'Tracking No', order: 'Order',
    account: 'Account', product: 'Product', recipient: 'Recipient', status: 'Status', inBatches: 'In batches', htmlLanguage: 'en',
  },
} as const;

export function reconciliationReportText(lang: UiLanguage) {
  return REPORT_MESSAGES[lang];
}
