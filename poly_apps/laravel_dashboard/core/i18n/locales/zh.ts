import { TranslationDictionary } from './en';

/**
 * Chinese Translations (中文)
 */
export const zh: TranslationDictionary = {
  // 通用UI
  common: {
    loading: '加载中...',
    error: '错误',
    success: '成功',
    warning: '警告',
    info: '信息',
    confirm: '确认',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    create: '创建',
    update: '更新',
    search: '搜索',
    filter: '筛选',
    reset: '重置',
    apply: '应用',
    close: '关闭',
    back: '返回',
    next: '下一步',
    previous: '上一步',
    submit: '提交',
    clear: '清空',
    refresh: '刷新',
    download: '下载',
    upload: '上传',
    copy: '复制',
    paste: '粘贴',
    cut: '剪切',
    select: '选择',
    selectAll: '全选',
    deselect: '取消选择',
    expand: '展开',
    collapse: '收起',
    view: '查看',
    preview: '预览',
    print: '打印',
    export: '导出',
    import: '导入'
  },

  // 导航
  nav: {
    dashboard: '仪表板',
    home: '首页',
    tools: '工具',
    settings: '设置',
    profile: '个人资料',
    logout: '退出',
    login: '登录',
    register: '注册'
  },

  // 工具分类
  categories: {
    aiTools: 'AI 工具',
    vocabulary: '词汇学习',
    serverManager: '服务器管理',
    cryptoSecurity: '加密安全',
    converters: '转换工具',
    webDevelopment: 'Web 开发',
    textProcessing: '文本处理',
    networkTools: '网络工具',
    mediaTools: '媒体工具'
  },

  // AI 工具
  aiTools: {
    translation: '翻译',
    tts: '文字转语音',
    ocr: '图片识别',
    promptManager: '提示词管理',
    imageGeneration: '图片生成',
    speechToText: '语音转文字',
    translationDesc: '使用 AI 在多语言之间翻译文本',
    ttsDesc: '将文本转换为自然语音',
    ocrDesc: '从图片中提取文字'
  },

  // 服务器管理
  serverManager: {
    systemInfo: '系统信息',
    fileManager: '文件管理',
    nginxManager: 'Nginx 管理',
    sslManager: 'SSL 证书管理',
    codeExecutor: '代码执行器',
    systemInfoDesc: '查看系统信息、进程和服务',
    fileManagerDesc: '浏览和管理服务器文件',
    nginxManagerDesc: '管理 Nginx 站点和配置',
    sslManagerDesc: '使用 Let\'s Encrypt 管理 SSL 证书',
    codeExecutorDesc: '执行服务器端脚本和命令'
  },

  // IT 工具
  itTools: {
    hashGenerator: '哈希生成器',
    uuidGenerator: 'UUID 生成器',
    base64Converter: 'Base64 编解码',
    jsonFormatter: 'JSON 格式化',
    colorConverter: '颜色转换',
    qrCodeGenerator: '二维码生成',
    ipCalculator: 'IP 子网计算器',
    regexTester: '正则测试',
    bcryptGenerator: 'Bcrypt 哈希生成',
    textStatistics: '文本统计'
  },

  // 表单
  form: {
    inputText: '输入文本',
    selectLanguage: '选择语言',
    selectVoice: '选择语音',
    uploadFile: '上传文件',
    dragDropFile: '拖放文件到这里',
    required: '此字段为必填项',
    invalidFormat: '格式无效',
    invalidEmail: '邮箱地址无效',
    passwordTooShort: '密码太短',
    passwordMismatch: '密码不匹配',
    minLength: '最小长度: {{min}}',
    maxLength: '最大长度: {{max}}',
    minValue: '最小值: {{min}}',
    maxValue: '最大值: {{max}}'
  },

  // 消息
  messages: {
    saveSuccess: '保存成功',
    saveError: '保存失败',
    deleteSuccess: '删除成功',
    deleteError: '删除失败',
    copySuccess: '已复制到剪贴板',
    copyError: '复制失败',
    uploadSuccess: '上传成功',
    uploadError: '上传失败',
    networkError: '网络错误，请重试',
    unauthorized: '未授权，请登录',
    forbidden: '您没有权限',
    notFound: '资源未找到',
    serverError: '服务器错误，请稍后重试',
    confirmDelete: '确定要删除吗？',
    unsavedChanges: '您有未保存的更改'
  },

  // 历史记录
  history: {
    title: '历史记录',
    empty: '暂无历史记录',
    clear: '清空历史',
    clearConfirm: '清空所有历史记录？',
    viewAll: '查看全部',
    recent: '最近'
  },

  // 收藏
  favorites: {
    title: '收藏',
    empty: '暂无收藏',
    add: '添加到收藏',
    remove: '从收藏移除'
  },

  // 用户
  user: {
    profile: '个人资料',
    settings: '设置',
    preferences: '偏好设置',
    language: '语言',
    theme: '主题',
    notifications: '通知',
    privacy: '隐私',
    security: '安全',
    account: '账户',
    changePassword: '修改密码',
    logout: '退出',
    login: '登录',
    register: '注册',
    forgotPassword: '忘记密码',
    resetPassword: '重置密码'
  },

  // 时间
  time: {
    justNow: '刚刚',
    minutesAgo: '{{count}} 分钟前',
    hoursAgo: '{{count}} 小时前',
    daysAgo: '{{count}} 天前',
    weeksAgo: '{{count}} 周前',
    monthsAgo: '{{count}} 个月前',
    yearsAgo: '{{count}} 年前'
  }
};
