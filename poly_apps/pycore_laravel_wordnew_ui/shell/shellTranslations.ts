import i18n from '../core/i18n/UiI18n';

const SHELL_TRANSLATIONS = {
  en: {
    common: {
      loading: 'Loading...',
      unknown_app_flavor: 'Unknown app flavor: {{id}}',
      control_center: 'Control Center',
      control_center_subtitle: 'One front-end for every local application. Choose an app to continue.',
      enter: 'Enter',
      health_online: 'online',
      health_offline: 'offline',
      health_checking: 'checking...',
      health_unknown: 'unknown',
      app_laravel_description: 'Manage the Laravel backend, data, services, and operational tools.',
      app_pycore_description: 'Manage Pycore queues, media extraction, code sync, and AI status.',
      app_wordnew_description: 'Study, read, review vocabulary, and use the learning assistant.',
      app_vortex_description: 'Explore the local real-time simulated trading workspace.',
      app_codemart_description: 'Plan, fund, deliver, and review managed software projects.',
    },
  },
  zh: {
    common: {
      loading: '加载中...',
      unknown_app_flavor: '未知应用类型：{{id}}',
      control_center: '控制中心',
      control_center_subtitle: '统一前端承载所有本地应用，请选择一个应用继续。',
      enter: '进入',
      health_online: '在线',
      health_offline: '离线',
      health_checking: '检查中...',
      health_unknown: '未知',
      app_laravel_description: '管理 Laravel 后端、数据、服务和运维工具。',
      app_pycore_description: '管理 Pycore 队列、媒体提取、代码同步和 AI 状态。',
      app_wordnew_description: '学习、阅读、复习词汇并使用学习助手。',
      app_vortex_description: '使用本地实时模拟交易工作区。',
      app_codemart_description: '规划、托管、交付和评审软件项目。',
    },
  },
} as const;

Object.entries(SHELL_TRANSLATIONS).forEach(([language, resources]) => {
  i18n.addResourceBundle(language, 'translation', resources, true, true);
});
