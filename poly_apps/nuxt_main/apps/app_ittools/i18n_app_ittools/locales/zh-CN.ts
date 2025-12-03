// 简体中文翻译
export default {
  app: {
    name: 'Laravel Web 面板',
    title: 'Laravel 开发调试工具'
  },

  modules: {
    apiTesting: {
      name: 'API 测试',
      description: '测试和调试 API 端点',
      icon: 'rocket'
    },
    devTools: {
      name: '开发工具',
      description: 'IT 工具集合',
      icon: 'tools'
    },
    systemInfo: {
      name: '系统信息',
      description: '服务器和系统监控',
      icon: 'server'
    },
    vocabulary: {
      name: '词汇学习',
      description: '语言学习工具',
      icon: 'book'
    },
    codeBrowser: {
      name: '代码浏览器',
      description: '浏览和搜索代码',
      icon: 'code'
    },
    staticResources: {
      name: '静态资源',
      description: '管理静态文件',
      icon: 'photo-video'
    },
    mcpManager: {
      name: 'MCP 管理器',
      description: '模型上下文协议管理',
      icon: 'camera'
    },
    octaneTasks: {
      name: 'Octane 定时任务',
      description: 'Laravel Octane 任务调度',
      icon: 'clock'
    }
  },

  common: {
    search: '搜索',
    settings: '设置',
    profile: '个人资料',
    logout: '退出登录',
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    create: '创建',
    loading: '加载中...',
    error: '错误',
    success: '成功',
    confirm: '确认',
    back: '返回',
    next: '下一步',
    submit: '提交',
    reset: '重置',
    connected: '已连接',
    disconnected: '未连接',
    checking: '检查中...',
    reconnect: '重新连接',
    connectionStatus: '连接状态',
    backendStatus: '后端状态',
    noData: '暂无数据',
    upload: '上传',
    download: '下载',
    dragDrop: '拖拽文件到此处',
    selectFiles: '选择文件'
  },

  sidebar: {
    collapse: '收起',
    expand: '展开'
  },

  errors: {
    networkError: '网络错误',
    unauthorized: '未授权访问',
    notFound: '资源未找到',
    serverError: '服务器错误',
    validationError: '验证错误',
    unknownError: '未知错误',
    connectionFailed: '连接后端失败',
    uploadFailed: '上传失败'
  },

  // API 测试模块
  apiTesting: {
    title: 'API 测试仪表板',
    requestBuilder: '请求构建器',
    response: '响应',
    history: '历史记录',
    method: '方法',
    url: '地址',
    headers: '请求头',
    body: '请求体',
    params: '参数',
    send: '发送请求',
    clear: '清空',
    addHeader: '添加请求头',
    addParam: '添加参数',
    statusCode: '状态码',
    responseTime: '响应时间',
    size: '大小',
    copyResponse: '复制响应',
    downloadResponse: '下载',
    formatJson: '格式化 JSON',
    rawView: '原始',
    prettyView: '格式化',
    previewView: '预览',
    apiReference: 'API 参考',
    endpoints: '个端点',
    authRequired: '需要认证',
    noAuth: '无需认证',
    apiInfo: 'API 信息'
  },

  // 系统信息模块
  systemInfo: {
    title: '系统信息',
    phpInfo: 'PHP 信息',
    laravelInfo: 'Laravel 信息',
    serverInfo: '服务器信息',
    databaseInfo: '数据库信息',
    version: '版本',
    environment: '环境',
    debug: '调试模式',
    timezone: '时区',
    memory: '内存',
    uptime: '运行时间',
    loadAverage: '负载平均',
    diskSpace: '磁盘空间',
    refresh: '刷新'
  },

  // 开发工具模块
  devTools: {
    title: '开发工具',
    ittools: 'IT 工具集合',
    selectTool: '选择工具',
    favorites: '收藏',
    recent: '最近使用',
    allTools: '所有工具',
    search: '搜索工具...',
    categories: {
      crypto: '加密工具',
      converter: '转换器',
      web: 'Web 工具',
      text: '文本工具',
      math: '数学工具',
      network: '网络工具',
      media: '媒体工具',
      development: '开发工具',
      measurement: '测量工具',
      data: '数据工具'
    }
  },

  // 代码浏览器模块
  codeBrowser: {
    title: '代码浏览器',
    fileTree: '文件树',
    search: '搜索文件...',
    openFile: '打开文件',
    lineNumber: '行',
    download: '下载',
    copy: '复制代码'
  },

  // 词汇模块
  vocabulary: {
    title: '词汇学习',
    wordList: '单词列表',
    addWord: '添加单词',
    practice: '练习',
    progress: '进度',
    mastered: '已掌握',
    learning: '学习中',
    newWord: '新单词'
  },

  // 静态资源模块
  staticResources: {
    title: '静态资源',
    images: '图片',
    videos: '视频',
    documents: '文档',
    upload: '上传',
    preview: '预览',
    download: '下载'
  },

  // MCP 管理器模块
  mcpManager: {
    title: 'MCP 管理器',
    servers: '服务器',
    status: '状态',
    config: '配置',
    tools: '工具',
    connected: '已连接',
    disconnected: '已断开',
    connect: '连接',
    disconnect: '断开'
  },

  // Octane 任务模块
  octaneTasks: {
    title: 'Octane 定时任务',
    taskList: '任务列表',
    addTask: '添加任务',
    editTask: '编辑任务',
    deleteTask: '删除任务',
    executeNow: '立即执行',
    schedule: '调度',
    lastRun: '上次运行',
    nextRun: '下次运行',
    logs: '执行日志',
    active: '激活',
    inactive: '未激活'
  }
}
