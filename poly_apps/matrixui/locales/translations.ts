

export const translations = {
  'zh-CN': {
    app: {
      title: '星灿传媒 云矩阵',
      subtitle: '星灿传媒科技 // V3.0',
      status: {
        online: '在线',
        offline: '离线',
        connecting: '连接中...',
        sync_active: '同步已激活',
        sync_off: '同步关闭'
      },
      language_label: '语言',
      admin: '管理员',
      level_access: '访问级别',
      protocol_unified: '统一 WebSocket (默认)',
      protocol_raw: '原始 TCP',
      codec_h264: 'H.264 (AVC)',
      codec_h265: 'H.265 (HEVC)',
      codec_av1: 'AV1',
      cancel: '取消'
    },
    nav: {
      fleet_command: '机队指挥',
      matrix_view: '矩阵视图',
      groups: '设备群组',
      support: '技术支持',
      system_health: '系统健康',
      file_manager: '文件管理',
      recording: '媒体中心',
      scripts: '脚本引擎'
    },
    dashboard: {
      all: '全部',
      online: '在线',
      offline: '离线',
      enroll_device: '注册设备',
      refresh: '刷新列表',
      establishing_link: '建立链路中',
      disconnected: '已断开连接',
      selected: '已选中',
      batch_actions: '批量操作'
    },
    control: {
      inspector: '检查器',
      identity: '设备标识',
      telemetry: '遥测数据',
      quick_actions: '快捷操作',
      console: '系统日志',
      actions: {
        snap: '截图',
        rec: '录屏',
        paste: '粘贴',
        lock: '锁屏',
        clean: '清理',
        kill: '终止',
        home: '主页',
        back: '返回',
        recent: '任务'
      }
    },
    settings: {
      title: '系统配置',
      global_search: '全局搜索',
      view_pref: '视图偏好',
      protocol: '连接协议',
      advanced: '高级选项',
      stream_config: '推流配置',
      bitrate: '码率 (bps)',
      fps: '帧率 (FPS)',
      resolution: '分辨率',
      codec: '编码器'
    },
    scripts: {
      library: '脚本库',
      flow: '执行流程',
      execute: '立即执行',
      selected_target: '目标设备数',
      est_time: '预计耗时',
      steps: '步骤',
      filter_all: '全部',
      running: '执行中...',
      devices: '设备',
      actions: '操作',
      select_script: '选择脚本查看流程'
    },
    files: {
      title: '文件资源管理器',
      storage: '内部存储',
      packages: '应用管理',
      upload: '上传文件',
      install_apk: '安装 APK',
      uninstall: '卸载',
      empty: '暂无文件',
      name: '名称',
      size: '大小',
      type: '类型',
      delete: '删除',
      items_selected: '项已选中',
      gb_free: 'GB 可用',
      apps_installed: '应用已安装',
      all_devices: '所有设备',
      installed_packages: '已安装包',
      folder: '文件夹',
      system: '系统',
      file_size_mb: 'MB'
    },
    gallery: {
      title: '媒体中心',
      screenshots: '截图',
      recordings: '录屏',
      filter_all: '全部',
      duration: '时长',
      device: '来源设备',
      download: '下载',
      delete: '删除'
    },
    device_config: {
      title: '设备配置',
      override_global: '覆盖全局设置',
      orientation: '锁定方向',
      auto: '自动',
      portrait: '竖屏',
      landscape: '横屏',
      save: '保存配置',
      reset: '重置',
      cancel: '取消',
      resolution_360: '360p',
      resolution_720: '720p',
      resolution_1080: '1080p',
      fps_30: '30 FPS',
      fps_60: '60 FPS',
      fps_90: '90 FPS',
      fps_120: '120 FPS',
      codec_h264: 'H.264',
      codec_h265: 'H.265',
      codec_av1: 'AV1'
    },
    toolbar: {
      selected: '已选中',
      sync_on: '同步开启',
      sync_off: '同步关闭',
      broadcast_placeholder: '广播文本...',
      sys_log: '系统日志',
      power_toggle: '电源开关',
      apps: {
        tiktok: 'TikTok',
        insta: 'Instagram',
        momo: 'Momo',
        wechat: '微信',
        youtube: 'YouTube',
        facebook: 'Facebook',
        whatsapp: 'WhatsApp'
      },
      tools: {
        home: '主页',
        back: '返回',
        recent: '最近',
        snap: '截图',
        rec: '录屏',
        bright: '亮度',
        rotate: '旋转',
        paste: '粘贴'
      }
    },
    terminal: {
      ai_core: 'AI 核心',
      placeholder: '输入自然语言命令 (例如: "关闭所有电池电量低的设备")'
    },
    device_control: {
      live_fps: 'LIVE 60FPS',
      touch_control: '触摸控制',
      inspector: '检查器',
      select_device: '选择设备',
      select_node: '选择节点进行检查',
      identity: '设备标识',
      model: '型号',
      serial: '序列号',
      battery: '电池',
      temp: '温度',
      telemetry: '遥测数据',
      cpu_load: 'CPU 负载',
      quick_actions: '快捷操作',
      system_log: '系统日志'
    },
    group_control: {
      target_devices: '目标设备',
      sync_active: '同步已激活',
      sync_off: '同步关闭',
      navigation: '导航',
      back: '返回',
      home: '主页',
      recent: '最近',
      power: '电源',
      unlock: '解锁',
      snap: '截图',
      gestures: '手势',
      swipe_up: '向上滑动',
      swipe_down: '向下滑动',
      broadcast_input: '广播输入',
      broadcast_placeholder: '输入消息到所有设备...',
      quick_launch: '快速启动'
    },
    script_flow: {
      start: '开始',
      complete: '完成'
    },
    system_stats: {
      network_status: '网络状态',
      online: '在线',
      system_load: '系统负载 (平均)',
      critical_alerts: '严重警报',
      units: '单元'
    },
    unit_grid: {
      load: '负载',
      power: '电源'
    }
  },
  'en-US': {
    app: {
      title: 'Xingcan Media Cloud Matrix',
      subtitle: 'StarBurst Tech // V3.0',
      status: {
        online: 'ONLINE',
        offline: 'OFFLINE',
        connecting: 'CONNECTING...',
        sync_active: 'SYNC ACTIVE',
        sync_off: 'SYNC OFF'
      },
      language_label: 'LANGUAGE',
      admin: 'Admin',
      level_access: 'Level 9 Access',
      protocol_unified: 'Unified WebSocket (Default)',
      protocol_raw: 'Raw TCP',
      codec_h264: 'H.264 (AVC)',
      codec_h265: 'H.265 (HEVC)',
      codec_av1: 'AV1',
      cancel: 'Cancel'
    },
    nav: {
      fleet_command: 'FLEET COMMAND',
      matrix_view: 'Matrix View',
      groups: 'GROUPS',
      support: 'Support',
      system_health: 'System Health',
      file_manager: 'File Manager',
      recording: 'Media Center',
      scripts: 'Script Engine'
    },
    dashboard: {
      all: 'ALL',
      online: 'ONLINE',
      offline: 'OFFLINE',
      enroll_device: 'ENROLL DEVICE',
      refresh: 'REFRESH',
      establishing_link: 'ESTABLISHING LINK',
      disconnected: 'DISCONNECTED',
      selected: 'SELECTED',
      batch_actions: 'BATCH ACTIONS'
    },
    control: {
      inspector: 'INSPECTOR',
      identity: 'IDENTITY',
      telemetry: 'TELEMETRY',
      quick_actions: 'QUICK ACTIONS',
      console: 'SYSTEM LOG',
      actions: {
        snap: 'Snap',
        rec: 'Rec',
        paste: 'Paste',
        lock: 'Lock',
        clean: 'Clean',
        kill: 'Kill',
        home: 'Home',
        back: 'Back',
        recent: 'Recent'
      }
    },
    settings: {
      title: 'SYSTEM CONFIG',
      global_search: 'GLOBAL SEARCH',
      view_pref: 'VIEW PREFERENCE',
      protocol: 'CONNECTION PROTOCOL',
      advanced: 'ADVANCED OPTIONS',
      stream_config: 'STREAM CONFIG',
      bitrate: 'Bitrate (bps)',
      fps: 'FPS',
      resolution: 'Resolution',
      codec: 'Codec'
    },
    scripts: {
      library: 'Script Library',
      flow: 'Execution Flow',
      execute: 'Execute Now',
      selected_target: 'Targets',
      est_time: 'Est. Time',
      steps: 'Steps',
      filter_all: 'All',
      running: 'Running...',
      devices: 'Devices',
      actions: 'Actions',
      select_script: 'Select a script to view flow'
    },
    files: {
      title: 'File Explorer',
      storage: 'Internal Storage',
      packages: 'App Packages',
      upload: 'Upload File',
      install_apk: 'Install APK',
      uninstall: 'Uninstall',
      empty: 'No files found',
      name: 'Name',
      size: 'Size',
      type: 'Type',
      delete: 'Delete',
      items_selected: 'items selected',
      gb_free: 'GB Free',
      apps_installed: 'Apps Installed',
      all_devices: 'ALL DEVICES',
      installed_packages: 'Installed Packages',
      folder: 'Folder',
      system: 'System',
      file_size_mb: 'MB'
    },
    gallery: {
      title: 'Media Center',
      screenshots: 'Screenshots',
      recordings: 'Recordings',
      filter_all: 'All',
      duration: 'Duration',
      device: 'Source Device',
      download: 'Download',
      delete: 'Delete'
    },
    device_config: {
      title: 'Device Config',
      override_global: 'Override Global',
      orientation: 'Lock Orientation',
      auto: 'Auto',
      portrait: 'Portrait',
      landscape: 'Landscape',
      save: 'Save Config',
      reset: 'Reset',
      cancel: 'Cancel',
      resolution_360: '360p',
      resolution_720: '720p',
      resolution_1080: '1080p',
      fps_30: '30 FPS',
      fps_60: '60 FPS',
      fps_90: '90 FPS',
      fps_120: '120 FPS',
      codec_h264: 'H.264',
      codec_h265: 'H.265',
      codec_av1: 'AV1'
    },
    toolbar: {
      selected: 'SELECTED',
      sync_on: 'SYNC ON',
      sync_off: 'SYNC OFF',
      broadcast_placeholder: 'Broadcast text...',
      sys_log: 'SYS.LOG',
      power_toggle: 'Power Toggle',
      apps: {
        tiktok: 'TikTok',
        insta: 'Insta',
        momo: 'Momo',
        wechat: 'WeChat',
        youtube: 'YouTube',
        facebook: 'Facebook',
        whatsapp: 'WhatsApp'
      },
      tools: {
        home: 'Home',
        back: 'Back',
        recent: 'Recent',
        snap: 'Snap',
        rec: 'Rec',
        bright: 'Bright',
        rotate: 'Rotate',
        paste: 'Paste'
      }
    },
    terminal: {
      ai_core: 'AI CORE',
      placeholder: 'Enter natural language command (e.g., \'Shutdown all units with critical battery\')'
    },
    device_control: {
      live_fps: 'LIVE 60FPS',
      touch_control: 'Touch Control',
      inspector: 'INSPECTOR',
      select_device: 'Select Device',
      select_node: 'SELECT NODE TO INSPECT',
      identity: 'IDENTITY',
      model: 'MODEL',
      serial: 'SERIAL',
      battery: 'BATTERY',
      temp: 'TEMP',
      telemetry: 'TELEMETRY',
      cpu_load: 'CPU LOAD',
      quick_actions: 'QUICK ACTIONS',
      system_log: 'SYSTEM LOG'
    },
    group_control: {
      target_devices: 'Target Devices',
      sync_active: 'SYNC ACTIVE',
      sync_off: 'SYNC OFF',
      navigation: 'NAVIGATION',
      back: 'Back',
      home: 'Home',
      recent: 'Recent',
      power: 'Power',
      unlock: 'Unlock',
      snap: 'Snap',
      gestures: 'GESTURES',
      swipe_up: 'SWIPE UP',
      swipe_down: 'SWIPE DOWN',
      broadcast_input: 'BROADCAST INPUT',
      broadcast_placeholder: 'Type message to all devices...',
      quick_launch: 'QUICK LAUNCH'
    },
    script_flow: {
      start: 'Start',
      complete: 'Complete'
    },
    system_stats: {
      network_status: 'Network Status',
      online: 'ONLINE',
      system_load: 'System Load (Avg)',
      critical_alerts: 'Critical Alerts',
      units: 'UNITS'
    },
    unit_grid: {
      load: 'Load',
      power: 'Power'
    }
  }
};

export type Language = 'zh-CN' | 'en-US';
export type TranslationKey = string;