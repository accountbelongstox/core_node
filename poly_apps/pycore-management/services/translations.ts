import { Language } from '../types';

type TranslationKeys = {
  [key: string]: string;
};

const en: TranslationKeys = {
  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.system': 'System',
  'nav.system.status': 'Status',
  'nav.system.config': 'Configuration',
  'nav.local': 'Local Processing',
  'nav.local.cap': 'Capabilities',
  'nav.local.conf': 'Configuration',
  'nav.uploads': 'Uploads',
  'nav.remote': 'Remote Servers',
  'nav.logs': 'Logs',
  'nav.tools': 'Tools',
  'nav.statistics': 'Statistics',
  'nav.settings': 'Settings',

  // Common
  'common.loading': 'Loading...',
  'common.refresh': 'Refresh',
  'common.save': 'Save Changes',
  'common.cancel': 'Cancel',
  'common.success': 'Success',
  'common.error': 'Error',
  'common.add': 'Add New',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.test': 'Test',
  'common.clear': 'Clear',
  
  // Dashboard
  'dash.title': 'System Dashboard',
  'dash.subtitle': 'Real-time overview of node performance',
  'dash.cpu': 'CPU Usage',
  'dash.memory': 'Memory',
  'dash.processed': 'Processed Tasks',
  'dash.disk': 'Disk Usage',
  'dash.actions': 'Quick Actions',
  
  // System
  'sys.status.title': 'System Status',
  'sys.core': 'Core System',
  'sys.microservices': 'Microservices',
  'sys.controls': 'System Controls',
  'sys.stop': 'Stop System',
  'sys.restart': 'Restart Core',
  'sys.reload': 'Reload Config',
  'sys.config.title': 'System Configuration',
  'sys.debug_mode': 'Debug Mode',
  'sys.log_level': 'Log Level',
  'sys.max_conn': 'Max Connections',
  'sys.auto_start': 'Auto Start on Boot',

  // Local
  'local.title': 'Local Processing Nodes',
  'local.hardware': 'Hardware',
  'local.config.title': 'Processing Configuration',
  'local.screenshot': 'Screenshot Settings',
  'local.ocr': 'OCR Settings',
  'local.audio': 'Audio Settings',
  
  // Uploads
  'upload.tasks': 'Active Tasks',
  'upload.history': 'History',
  'upload.servers': 'Server Config',
  
  // Remote
  'remote.title': 'Remote Server Management',
  'remote.list': 'Server List',
  'remote.add_server': 'Add Server',
  'remote.status': 'Connection Status',
  
  // Logs
  'logs.title': 'System Logs',
  'logs.filter': 'Filter Logs',
  'logs.level': 'Level',
  'logs.category': 'Category',
  
  // Tools
  'tools.title': 'Toolbox',
  'tools.screenshot': 'Screenshot',
  'tools.ocr': 'OCR Tool',
  'tools.audio': 'Audio Transcribe',
  'tools.video': 'Video Processing',
  'tools.file': 'File Analysis',
  'tools.test': 'System Test',
  
  // Statistics
  'stats.title': 'Analytics & Statistics',
  'stats.performance': 'Performance',
  'stats.trends': 'Usage Trends',
  'stats.resources': 'Resources',
  'stats.cpu_mem': 'CPU & Memory History',
  'stats.network': 'Network IO',
  'stats.disk': 'Storage Breakdown',

  // Settings
  'settings.title': 'Application Settings',
  'settings.general': 'General',
  'settings.appearance': 'Appearance',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
  'settings.theme.auto': 'Auto (System)',
};

const zh: TranslationKeys = {
  // Navigation
  'nav.dashboard': '仪表盘',
  'nav.system': '系统管理',
  'nav.system.status': '系统状态',
  'nav.system.config': '系统配置',
  'nav.local': '本地处理',
  'nav.local.cap': '处理能力',
  'nav.local.conf': '处理配置',
  'nav.uploads': '上传管理',
  'nav.remote': '远程服务器',
  'nav.logs': '日志中心',
  'nav.tools': '工具箱',
  'nav.statistics': '统计分析',
  'nav.settings': '设置',

  // Common
  'common.loading': '加载中...',
  'common.refresh': '刷新',
  'common.save': '保存更改',
  'common.cancel': '取消',
  'common.success': '成功',
  'common.error': '错误',
  'common.add': '添加',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.test': '测试',
  'common.clear': '清除',

  // Dashboard
  'dash.title': '系统仪表盘',
  'dash.subtitle': '节点性能实时概览',
  'dash.cpu': 'CPU 使用率',
  'dash.memory': '内存使用',
  'dash.processed': '今日处理',
  'dash.disk': '磁盘使用',
  'dash.actions': '快捷操作',

  // System
  'sys.status.title': '系统状态',
  'sys.core': '核心系统',
  'sys.microservices': '微服务状态',
  'sys.controls': '系统控制',
  'sys.stop': '停止系统',
  'sys.restart': '重启核心',
  'sys.reload': '重载配置',
  'sys.config.title': '系统配置',
  'sys.debug_mode': '调试模式',
  'sys.log_level': '日志级别',
  'sys.max_conn': '最大连接数',
  'sys.auto_start': '开机自启',

  // Local
  'local.title': '本地处理节点',
  'local.hardware': '硬件信息',
  'local.config.title': '处理配置',
  'local.screenshot': '截图设置',
  'local.ocr': 'OCR 设置',
  'local.audio': '音频设置',

  // Uploads
  'upload.tasks': '进行中任务',
  'upload.history': '上传历史',
  'upload.servers': '服务器配置',

  // Remote
  'remote.title': '远程服务器管理',
  'remote.list': '服务器列表',
  'remote.add_server': '添加服务器',
  'remote.status': '连接状态',

  // Logs
  'logs.title': '系统日志',
  'logs.filter': '日志筛选',
  'logs.level': '级别',
  'logs.category': '分类',

  // Tools
  'tools.title': '系统工具箱',
  'tools.screenshot': '截图工具',
  'tools.ocr': 'OCR识别',
  'tools.audio': '音频转写',
  'tools.video': '视频处理',
  'tools.file': '文件分析',
  'tools.test': '系统测试',

  // Statistics
  'stats.title': '统计分析',
  'stats.performance': '性能统计',
  'stats.trends': '使用趋势',
  'stats.resources': '资源监控',
  'stats.cpu_mem': 'CPU与内存历史',
  'stats.network': '网络流量',
  'stats.disk': '存储分布',

  // Settings
  'settings.title': '应用设置',
  'settings.general': '通用',
  'settings.appearance': '外观',
  'settings.language': '语言',
  'settings.theme': '主题',
  'settings.theme.light': '浅色',
  'settings.theme.dark': '深色',
  'settings.theme.auto': '跟随系统',
};

export const translations = { en, zh };

export const getTranslation = (lang: Language, key: string): string => {
  return translations[lang][key] || key;
};