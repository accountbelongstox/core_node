// i18n Service - Multi-language support
export type Language = 'zh' | 'en';

export interface Translations {
  [key: string]: string | Translations;
}

const translations: Record<Language, Translations> = {
  zh: {
    common: {
      ok: '确定',
      cancel: '取消',
      close: '关闭',
      save: '保存',
      delete: '删除',
      edit: '编辑',
      search: '搜索',
      loading: '加载中...',
      error: '错误',
      success: '成功',
      warning: '警告',
      info: '信息',
    },
    menu: {
      sidebar: {
        title: '设备舰队',
        allDevices: '所有设备',
        groups: '设备组',
      },
      topbar: {
        scripts: '脚本功能',
        settings: '设置',
        management: '管理控制台',
        stats: '数据统计',
        user: '用户',
      },
      rightbar: {
        deviceControl: '设备控制',
        logs: '日志',
        properties: '属性',
      },
    },
    device: {
      status: {
        online: '在线',
        offline: '离线',
        busy: '忙碌',
      },
      actions: {
        connect: '连接',
        disconnect: '断开',
        screenshot: '截图',
        recording: '录制',
        install: '安装',
        uninstall: '卸载',
        home: '主页',
        back: '返回',
        power: '电源',
        script: '脚本',
      },
    },
    api: {
      error: {
        connectionFailed: '连接失败',
        requestFailed: '请求失败',
        unauthorized: '未授权',
        notFound: '未找到',
        serverError: '服务器错误',
      },
    },
    websocket: {
      connecting: '连接中...',
      connected: '已连接',
      disconnected: '已断开',
      reconnecting: '重连中...',
      error: '连接错误',
    },
    management: {
      title: '管理控制台',
      sections: {
        connection: '连接与部署',
        video: '视频与渲染',
        input: '输入与控制',
        group: '多设备编组',
        recording: '采集与录制',
        file: '文件与剪贴板',
        preferences: '配置与偏好',
        interface: '界面与平台',
      },
      save: '保存配置',
      reset: '重置',
    },
  },
  en: {
    common: {
      ok: 'OK',
      cancel: 'Cancel',
      close: 'Close',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      search: 'Search',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      info: 'Info',
    },
    menu: {
      sidebar: {
        title: 'Fleet Command',
        allDevices: 'All Devices',
        groups: 'Device Groups',
      },
      topbar: {
        scripts: 'Scripts',
        settings: 'Settings',
        management: 'Management',
        stats: 'Statistics',
        user: 'User',
      },
      rightbar: {
        deviceControl: 'Device Control',
        logs: 'Logs',
        properties: 'Properties',
      },
    },
    device: {
      status: {
        online: 'Online',
        offline: 'Offline',
        busy: 'Busy',
      },
      actions: {
        connect: 'Connect',
        disconnect: 'Disconnect',
        screenshot: 'Screenshot',
        recording: 'Recording',
        install: 'Install',
        uninstall: 'Uninstall',
        home: 'Home',
        back: 'Back',
        power: 'Power',
        script: 'Script',
      },
    },
    api: {
      error: {
        connectionFailed: 'Connection Failed',
        requestFailed: 'Request Failed',
        unauthorized: 'Unauthorized',
        notFound: 'Not Found',
        serverError: 'Server Error',
      },
    },
    websocket: {
      connecting: 'Connecting...',
      connected: 'Connected',
      disconnected: 'Disconnected',
      reconnecting: 'Reconnecting...',
      error: 'Connection Error',
    },
    management: {
      title: 'Management Console',
      sections: {
        connection: 'Connection & Deployment',
        video: 'Video & Rendering',
        input: 'Input & Control',
        group: 'Multi-Device Grouping',
        recording: 'Capture & Recording',
        file: 'File & Clipboard',
        preferences: 'Config & Preferences',
        interface: 'Interface & Platform',
      },
      save: 'Save Config',
      reset: 'Reset',
    },
  },
};

class I18nService {
  private currentLanguage: Language = 'zh';

  setLanguage(lang: Language) {
    this.currentLanguage = lang;
    localStorage.setItem('matrix_language', lang);
  }

  getLanguage(): Language {
    const saved = localStorage.getItem('matrix_language') as Language;
    if (saved && (saved === 'zh' || saved === 'en')) {
      this.currentLanguage = saved;
    }
    return this.currentLanguage;
  }

  t(key: string): string {
    const keys = key.split('.');
    let value: any = translations[this.currentLanguage];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    return typeof value === 'string' ? value : key;
  }
}

export const i18n = new I18nService();

// Import React for hook
import React from 'react';

// React hook for translations
export function useTranslation() {
  const [lang, setLang] = React.useState<Language>(i18n.getLanguage());

  React.useEffect(() => {
    i18n.setLanguage(lang);
  }, [lang]);

  return {
    t: (key: string) => i18n.t(key),
    language: lang,
    setLanguage: (l: Language) => {
      setLang(l);
      i18n.setLanguage(l);
    },
  };
}

