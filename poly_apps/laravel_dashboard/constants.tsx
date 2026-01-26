
import { 
  LayoutDashboard, Film, Code2, Wrench, Server, Settings, Clipboard, Cpu, Image as ImageIcon,
  FileText, Calculator, Palette, Search, Shield, RefreshCcw, Type, Globe, Database, Wifi,
  QrCode, Hash, Binary, Lock, Edit3, Terminal, Upload, Download, Play, AlignLeft, ArrowLeftRight,
  Link, BarChart, Clock, Phone, Key, FileJson, CheckCircle, Check
} from "lucide-react";
import { FileNode, ViewType, TaskItem, ToolCategory, ToolConfig, ToolUISchema } from "./types";
import { API_ENDPOINTS } from "./endpoints";

export { API_ENDPOINTS }; // Re-export for compatibility

export const APP_NAME = "NEXUS // ORBIT";
export const APP_VERSION = "v3.4.0-beta";

export const TRANSLATIONS = {
  en: {
    nav: {
      media: "Media Browser",
      code: "Code Node",
    tools: "Tools",
    api: "API Tester",
    settings: "Settings",
    tools_dashboard: {
      search_placeholder: "Search tools...",
      all_tools: "All Tools",
      favorites: "Favorites",
      history: "History",
      recent_history: "Recent History",
      all_utilities: "All Utilities",
      clear_history: "Clear History",
      clear: "Clear",
      no_history: "No history yet.",
      no_favorites: "No favorites yet.",
      no_tools_found: "No tools found.",
      tools_available: "Tools Available",
      recent: "Recent",
      add_to_favorites: "Add to favorites",
      remove_from_favorites: "Remove from favorites"
    },
      system: "System Info",
      vocabulary: "Vocabulary",
      aiTools: "AI Tools",
      mcp: "MCP Manager",
      octane: "Octane Tasks",
      server: "Server Manager",
      inviteCodes: "Invite Codes",
      bankManager: "Bank Manager"
    },
    header: {
      system_online: "System Online",
      system_offline: "Offline Mode",
      login: "Login",
      logout: "Logout",
      logged_in_as: "Logged in as:",
      guest: "Guest",
      titles: {
        media: "Static Resources - Media Browser",
        code: "Code Browser - Core Node Directory",
        tools: "Developer Utilities",
        api: "API Testing Interface",
        system: "System Information Dashboard",
        vocabulary: "Vocabulary Learning Center",
        ai_tools: "AI Tools Suite",
        mcp: "MCP Manager",
        octane: "Octane Timer Tasks Monitor",
        server: "Server Management Dashboard",
        invite_codes: "Invite Code Management",
        bank_manager: "Bank Data Management",
        settings: "Settings"
      }
    },
    login: {
      title: "Identity Verification",
      subtitle: "Please authenticate to access core systems.",
      username: "Username / ID",
      password: "Password",
      confirm_password: "Confirm Password",
      email: "Email (Optional)",
      nickname: "Nickname (Optional)",
      registration_code: "Registration Code (Optional)",
      submit: "Authenticate",
      cancel: "Cancel",
      processing: "Verifying...",
      register_title: "Create Account",
      register_subtitle: "Register to access core systems.",
      register_submit: "Register",
      register_processing: "Creating account...",
      switch_to_login: "Already have an account? Login",
      switch_to_register: "Don't have an account? Register",
      login_success: "Login successful",
      register_success: "Registration successful"
    },
    system: {
      title: "System Information",
      subtitle: "Real-time system configuration and status",
      tabs: {
        server: "Server",
        php: "PHP",
        laravel: "Laravel",
        database: "Database",
        cache: "Cache",
        queue: "Queue",
        routes: "Routes"
      },
      fields: {
        hostname: "Hostname",
        operating_system: "Operating System",
        server_time: "Server Time",
        timezone: "Timezone",
        uptime: "Uptime",
        cpu_model: "CPU Model",
        cpu_cores: "CPU Cores",
        version: "Version",
        memory_limit: "Memory Limit",
        max_execution_time: "Max Execution Time",
        upload_max_size: "Upload Max Size",
        post_max_size: "Post Max Size",
        display_errors: "Display Errors",
        extensions: "Extensions",
        environment: "Environment",
        debug_mode: "Debug Mode",
        app_url: "App URL",
        app_name: "App Name",
        locale: "Locale",
        cache_status: "Cache Status",
        config_cached: "Config Cached",
        routes_cached: "Routes Cached",
        events_cached: "Events Cached",
        views_cached: "Views Cached",
        service_name: "Service Name",
        enabled: "Enabled",
        active: "Active",
        inactive: "Inactive",
        yes: "Yes",
        no: "No",
        not_available: "Not available"
      },
      refresh: "Refresh",
      auto_refresh: "Auto Refresh",
      last_updated: "Last Updated"
    },
    vocabulary: {
      title: "Vocabulary Learning",
      translate: "Translate",
      source_lang: "Source Language",
      target_lang: "Target Language",
      input_placeholder: "Enter text to translate...",
      auto_detect: "Auto Detect",
      clear: "Clear",
      history: "Translation History"
    },
    mcp: {
      title: "MCP Manager",
      tabs: {
        screenshots: "Screenshots",
        tasks: "Task Dispatch",
        placeholder: "Placeholder",
        voice: "Voice Subtitle",
        ocr: "OCR",
        settings: "Settings"
      },
      screenshots: {
        upload: "Upload",
        refresh: "Refresh",
        latest: "Latest",
        clear_all: "Clear All",
        search_placeholder: "Search screenshots...",
        no_screenshots: "No screenshots found",
        upload_hint: "Click Upload button, drag & drop, or paste (Ctrl+V) images here",
        view: "View",
        download: "Download",
        delete: "Delete",
        copy_url: "Copy URL",
        image_url: "Image URL",
        description: "Description",
        delete_confirm: "Delete this screenshot?",
        clear_all_confirm: "⚠️ DANGER: This will permanently delete ALL screenshots. This action cannot be undone. Are you sure?",
        clear_all_final: "Final confirmation: Delete ALL screenshots?",
        upload_mode: "Upload Mode",
        single_upload: "Single Upload",
        batch_upload: "Batch Upload",
        batch_desc: "Upload each image separately",
        merge_upload: "Merge Upload",
        merge_desc: "Merge multiple images into one",
        drop_here: "Drop images here",
        paste_hint: "or paste with Ctrl+V / Cmd+V",
        toast: {
          copied: "Copied to clipboard!",
          copy_failed: "Copy failed",
          copy_failed_manual: "Copy failed, please copy manually"
        }
      }
    },
    octane: {
      title: "Octane Timer Tasks",
      subtitle: "Real-time task scheduling and execution monitoring",
      timer_status: "Timer Status",
      total_tasks: "Total Tasks",
      running_tasks: "Running Tasks",
      completed_tasks: "Completed Tasks",
      failed_tasks: "Failed Tasks"
    },
    api_tester: {
      title: "API Testing Dashboard",
      search_placeholder: "Search by #ID, path, or description...",
      select_app: "Select App",
      endpoints: "endpoints",
      endpoint: "endpoint",
      shared_headers: "Shared Headers",
      save: "Save",
      reset: "Reset",
      copy_headers: "Copy headers JSON",
      authentication: "Authentication",
      required: "Required",
      optional: "Optional",
      controller: "Controller",
      parameters: "Parameters",
      response_format: "Response Format",
      endpoint_url: "Endpoint URL",
      request_params: "Request Parameters (JSON)",
      load_params: "Load",
      save_params: "Save",
      send_request: "Send Request",
      sending: "Sending...",
      response: "Response",
      no_endpoints: "No endpoints found",
      select_send: "Select and send an API request",
      view_response: "to view the response here"
    },
    media_browser: {
      title: "Media Browser",
      upload: "Upload",
      new_folder: "New Folder",
      refresh: "Refresh",
      fullscreen: "Fullscreen",
      auto_play: "Auto Play",
      next: "Next",
      no_preview: "No preview available",
      loading: "Loading...",
      error: "Error loading media",
      folder_name: "Folder Name",
      create_folder: "Create Folder",
      cancel: "Cancel",
      upload_files: "Upload Files",
      drop_files: "Drop files here or click to upload"
    },
    code_browser: {
      title: "Code Browser",
      search: "Search files...",
      no_files: "No files found",
      loading: "Loading...",
      error: "Error loading files"
    },
    settings: {
      title: "Settings",
      api_config: "API Configuration",
      base_url: "Base URL",
      api_key: "API Key",
      save: "Save",
      reset: "Reset to Default",
      reset_to_origin: "Reset to Origin",
      test_connection: "Test Connection",
      saved: "Settings saved successfully",
      reset_success: "Settings reset to default",
      reset_to_origin_success: "Settings reset to browser origin",
      test_success: "Connection successful",
      test_error: "Connection failed",
      current_origin: "Current origin",
      browser_origin: "Browser Origin",
      auth_required: "Settings page requires authentication. Please login to continue."
    },
    invite_codes: {
      auth_required: "Invite Code Manager requires admin access. Please login with admin account."
    },
    server_manager: {
      auth_required: "Server Manager requires authentication. Please login to continue."
    },
    server: {
      title: "Server Manager",
      subtitle: "Nginx sites, SSL certificates, and system management",
      tabs: {
        nginx: "Nginx Sites",
        ssl: "SSL Certificates",
        system: "System Status",
        files: "File Manager",
        executor: "Code Executor",
        unified: "Unified Manager"
      },
      nginx: {
        sites: "Nginx Sites",
        create_site: "Create Site",
        site_name: "Site Name",
        domain: "Domain",
        site_type: "Site Type",
        www_dir: "Web Directory",
        php_mode: "PHP Mode",
        swoole_port: "Swoole Port",
        ssl_enabled: "SSL Enabled",
        enabled: "Enabled",
        disabled: "Disabled",
        enable: "Enable",
        disable: "Disable",
        delete: "Delete Site",
        view_config: "View Config",
        test_config: "Test Config",
        reload: "Reload Nginx",
        refresh: "Refresh",
        create: "Create Site",
        update: "Update Site",
        test: "Test Configuration"
      },
      ssl: {
        certificates: "SSL Certificates",
        generate: "Generate Certificate",
        renew: "Renew All",
        renew_all: "Renew All Certificates",
        domain: "Domain",
        expiry_date: "Expiry Date",
        days_until_expiry: "Days Until Expiry",
        status: "Status",
        ok: "OK",
        warning: "Warning",
        critical: "Critical",
        certbot_detect: "Detect Certbot",
        certbot_install: "Install Certbot"
      },
      system: {
        title: "System Status",
        cpu: "CPU",
        memory: "Memory",
        disk: "Disk",
        services: "Services",
        refresh: "Refresh",
        processes: "Processes",
        storage: "Storage",
        permissions: "Permissions"
      },
      files: {
        title: "File Manager",
        browse: "Browse",
        download: "Download",
        preview: "Preview",
        info: "File Info",
        path: "Path",
        size: "Size",
        modified: "Modified",
        permissions: "Permissions"
      },
      executor: {
        title: "Code Executor",
        scripts: "Predefined Scripts",
        execute: "Execute",
        logs: "Execution Logs",
        status: "Status",
        category: "Category",
        timeout: "Timeout",
        output: "Output"
      },
      unified: {
        title: "Unified Manager",
        apps: "Applications",
        deploy: "Deploy",
        start: "Start",
        stop: "Stop",
        restart: "Restart",
        status: "Status",
        logs: "Logs",
        service_name: "Service Name",
        port: "Port"
      },
      messages: {
        confirm_reset: "Are you sure you want to reset to default settings?",
        confirm_renew_certs: "Are you sure you want to renew all certificates?",
        confirm_install_certbot: "Are you sure you want to install Certbot?",
        confirm_delete_site: "Are you sure you want to delete site: {site}?",
        cert_generation_started: "Certificate generation started",
        cert_renewal_started: "Certificate renewal started",
        certbot_installation_started: "Certbot installation started",
        nginx_reloaded: "Nginx reloaded successfully",
        site_deleted: "Site deleted successfully",
        nginx_config_valid: "Nginx configuration is valid!",
        nginx_config_errors: "Configuration errors:",
        operation_failed: "Operation failed",
        action_completed: "Action {action} completed",
        failed_to_load: "Failed to load",
        failed_to_generate_cert: "Failed to generate certificate",
        failed_to_renew_certs: "Failed to renew certificates",
        failed_to_install_certbot: "Failed to install Certbot"
      }
    }
  },
  zh: {
    nav: {
      media: "媒体资源库",
      code: "代码节点",
      tools: "工具箱",
      api: "API 测试",
      settings: "系统设置",
      system: "系统信息",
      vocabulary: "词汇学习",
      mcp: "MCP 管理器",
      octane: "Octane 任务",
      server: "服务器管理",
      inviteCodes: "邀请码管理",
      bankManager: "银行管理"
    },
    header: {
      system_online: "系统在线",
      system_offline: "离线模式",
      login: "登录",
      logout: "登出",
      logged_in_as: "当前用户:",
      guest: "访客",
      titles: {
        media: "静态资源 - 媒体浏览器",
        code: "代码浏览器 - 核心节点目录",
        tools: "开发者实用工具",
        api: "API 测试接口",
        system: "系统信息仪表板",
        vocabulary: "词汇学习中心",
        ai_tools: "AI 工具套件",
        mcp: "MCP 管理器",
        octane: "Octane 定时任务监控",
        server: "服务器管理仪表板",
        invite_codes: "邀请码管理",
        bank_manager: "银行数据管理",
        settings: "系统设置"
      }
    },
    login: {
      title: "身份验证",
      subtitle: "请验证身份以访问核心系统。",
      username: "用户名 / ID",
      password: "密码",
      confirm_password: "确认密码",
      email: "邮箱（可选）",
      nickname: "昵称（可选）",
      registration_code: "注册码（可选）",
      submit: "验证登录",
      cancel: "取消",
      processing: "验证中...",
      register_title: "创建账户",
      register_subtitle: "注册以访问核心系统。",
      register_submit: "注册",
      register_processing: "创建账户中...",
      switch_to_login: "已有账户？登录",
      switch_to_register: "没有账户？注册",
      login_success: "登录成功",
      register_success: "注册成功"
    },
    system: {
      title: "系统信息",
      subtitle: "实时系统配置和状态",
      tabs: {
        server: "服务器",
        php: "PHP",
        laravel: "Laravel",
        database: "数据库",
        cache: "缓存",
        queue: "队列",
        routes: "路由"
      },
      fields: {
        hostname: "主机名",
        operating_system: "操作系统",
        server_time: "服务器时间",
        timezone: "时区",
        uptime: "运行时间",
        cpu_model: "CPU 型号",
        cpu_cores: "CPU 核心数",
        version: "版本",
        memory_limit: "内存限制",
        max_execution_time: "最大执行时间",
        upload_max_size: "最大上传大小",
        post_max_size: "POST 最大大小",
        display_errors: "显示错误",
        extensions: "扩展",
        environment: "环境",
        debug_mode: "调试模式",
        app_url: "应用 URL",
        app_name: "应用名称",
        locale: "语言区域",
        cache_status: "缓存状态",
        config_cached: "配置已缓存",
        routes_cached: "路由已缓存",
        events_cached: "事件已缓存",
        views_cached: "视图已缓存",
        service_name: "服务名称",
        enabled: "已启用",
        active: "活动",
        inactive: "未活动",
        yes: "是",
        no: "否",
        not_available: "不可用"
      },
      refresh: "刷新",
      auto_refresh: "自动刷新",
      last_updated: "最后更新"
    },
    vocabulary: {
      title: "词汇学习",
      translate: "翻译",
      source_lang: "源语言",
      target_lang: "目标语言",
      input_placeholder: "输入要翻译的文本...",
      auto_detect: "自动检测",
      clear: "清除",
      history: "翻译历史"
    },
    mcp: {
      title: "MCP 管理器",
      tabs: {
        screenshots: "截图",
        tasks: "任务分发",
        placeholder: "占位图",
        voice: "语音字幕",
        ocr: "OCR识别",
        settings: "设置"
      },
      screenshots: {
        upload: "上传",
        refresh: "刷新",
        latest: "最新",
        clear_all: "清空全部",
        search_placeholder: "搜索截图...",
        no_screenshots: "未找到截图",
        upload_hint: "点击上传按钮、拖放或粘贴（Ctrl+V）图片到这里",
        view: "查看",
        download: "下载",
        delete: "删除",
        copy_url: "复制链接",
        image_url: "图片链接",
        description: "描述",
        delete_confirm: "确定删除此截图？",
        clear_all_confirm: "⚠️ 危险操作：这将永久删除所有截图，此操作无法撤销。确定继续？",
        clear_all_final: "最终确认：删除所有截图？",
        upload_mode: "上传模式",
        single_upload: "单图上传",
        batch_upload: "批量上传",
        batch_desc: "每张图片分别保存",
        merge_upload: "合并上传",
        merge_desc: "多张图片合成一张",
        drop_here: "拖放图片到这里",
        paste_hint: "或使用 Ctrl+V / Cmd+V 粘贴",
        toast: {
          copied: "已复制到剪贴板！",
          copy_failed: "复制失败",
          copy_failed_manual: "复制失败，请手动复制"
        }
      }
    },
    octane: {
      title: "Octane 定时任务",
      subtitle: "实时任务调度和执行监控",
      timer_status: "定时器状态",
      total_tasks: "总任务数",
      running_tasks: "运行中任务",
      completed_tasks: "已完成任务",
      failed_tasks: "失败任务"
    },
    api_tester: {
      title: "API 测试仪表板",
      search_placeholder: "按 #ID、路径或描述搜索...",
      select_app: "选择应用",
      endpoints: "个端点",
      endpoint: "端点",
      shared_headers: "共享请求头",
      save: "保存",
      reset: "重置",
      copy_headers: "复制请求头 JSON",
      authentication: "身份验证",
      required: "必需",
      optional: "可选",
      controller: "控制器",
      parameters: "参数",
      response_format: "响应格式",
      endpoint_url: "端点 URL",
      request_params: "请求参数 (JSON)",
      load_params: "加载",
      save_params: "保存",
      send_request: "发送请求",
      sending: "发送中...",
      response: "响应",
      no_endpoints: "未找到端点",
      select_send: "选择并发送 API 请求",
      view_response: "以在此处查看响应"
    },
    media_browser: {
      title: "媒体浏览器",
      upload: "上传",
      new_folder: "新建文件夹",
      refresh: "刷新",
      fullscreen: "全屏",
      auto_play: "自动播放",
      next: "下一个",
      no_preview: "无可用预览",
      loading: "加载中...",
      error: "加载媒体错误",
      folder_name: "文件夹名称",
      create_folder: "创建文件夹",
      cancel: "取消",
      upload_files: "上传文件",
      drop_files: "拖放文件到这里或点击上传"
    },
    code_browser: {
      title: "代码浏览器",
      search: "搜索文件...",
      no_files: "未找到文件",
      loading: "加载中...",
      error: "加载文件错误"
    },
    settings: {
      title: "系统设置",
      api_config: "API 配置",
      base_url: "基础 URL",
      api_key: "API 密钥",
      save: "保存",
      reset: "重置为默认",
      reset_to_origin: "恢复到同源",
      test_connection: "测试连接",
      saved: "设置保存成功",
      reset_success: "已重置为默认设置",
      reset_to_origin_success: "已恢复为浏览器同源地址",
      test_success: "连接成功",
      test_error: "连接失败",
      current_origin: "当前源",
      browser_origin: "浏览器源",
      auth_required: "设置页面需要身份验证。请登录后继续。"
    },
    invite_codes: {
      auth_required: "邀请码管理需要管理员权限。请使用管理员账户登录。"
    },
    server_manager: {
      auth_required: "服务器管理需要身份验证。请登录后继续。"
    },
    server: {
      title: "服务器管理",
      subtitle: "Nginx 站点、SSL 证书和系统管理",
      tabs: {
        nginx: "Nginx 站点",
        ssl: "SSL 证书",
        system: "系统状态",
        files: "文件管理",
        executor: "代码执行",
        unified: "统一管理器"
      },
      nginx: {
        sites: "Nginx 站点",
        create_site: "创建站点",
        site_name: "站点名称",
        domain: "域名",
        site_type: "站点类型",
        www_dir: "网站目录",
        php_mode: "PHP 模式",
        swoole_port: "Swoole 端口",
        ssl_enabled: "启用 SSL",
        enabled: "已启用",
        disabled: "已禁用",
        enable: "启用",
        disable: "禁用",
        delete: "删除站点",
        view_config: "查看配置",
        test_config: "测试配置",
        reload: "重载 Nginx",
        refresh: "刷新",
        create: "创建站点",
        update: "更新站点",
        test: "测试配置"
      },
      ssl: {
        certificates: "SSL 证书",
        generate: "生成证书",
        renew: "续期全部",
        domain: "域名",
        expiry_date: "到期日期",
        days_until_expiry: "剩余天数",
        status: "状态",
        ok: "正常",
        warning: "警告",
        critical: "紧急",
        renew_all: "续期全部证书",
        certbot_detect: "检测 Certbot",
        certbot_install: "安装 Certbot"
      },
      system: {
        title: "系统状态",
        cpu: "CPU",
        memory: "内存",
        disk: "磁盘",
        services: "服务",
        refresh: "刷新",
        processes: "进程",
        storage: "存储",
        permissions: "权限"
      },
      files: {
        title: "文件管理",
        browse: "浏览",
        download: "下载",
        preview: "预览",
        info: "文件信息",
        path: "路径",
        size: "大小",
        modified: "修改时间",
        permissions: "权限"
      },
      executor: {
        title: "代码执行",
        scripts: "预定义脚本",
        execute: "执行",
        logs: "执行日志",
        status: "状态",
        category: "分类",
        timeout: "超时",
        output: "输出"
      },
      unified: {
        title: "统一管理器",
        apps: "应用列表",
        deploy: "部署",
        start: "启动",
        stop: "停止",
        restart: "重启",
        status: "状态",
        logs: "日志",
        service_name: "服务名称",
        port: "端口"
      },
      messages: {
        confirm_reset: "确定要重置为默认设置吗？",
        confirm_renew_certs: "确定要续期所有证书吗？",
        confirm_install_certbot: "确定要安装 Certbot 吗？",
        confirm_delete_site: "确定要删除站点: {site} 吗？",
        cert_generation_started: "证书生成已开始",
        cert_renewal_started: "证书续期已开始",
        certbot_installation_started: "Certbot 安装已开始",
        nginx_reloaded: "Nginx 重载成功",
        site_deleted: "站点删除成功",
        nginx_config_valid: "Nginx 配置有效！",
        nginx_config_errors: "配置错误：",
        operation_failed: "操作失败",
        action_completed: "操作 {action} 已完成",
        failed_to_generate_cert: "证书生成失败",
        failed_to_renew_certs: "证书续期失败",
        failed_to_install_certbot: "Certbot 安装失败"
      }
    }
  }
};

export const MOCK_FILE_TREE: FileNode[] = [
  // ... (Existing Mock File Tree - kept same)
  {
    id: 'root',
    name: 'wwwroot',
    type: 'folder',
    isOpen: true,
    children: [
      {
        id: 'laravel_db',
        name: 'laravel_db',
        type: 'folder',
        isOpen: true,
        children: [
          { id: 'static', name: 'static', type: 'folder', isOpen: true, children: [
            { id: 'img1', name: 'cyber_bg.jpg', type: 'file', fileType: 'image', size: '2.4 MB', date: '2025-01-10' },
            { id: 'aud1', name: 'alert_notification.mp3', type: 'file', fileType: 'audio', size: '150 KB', date: '2025-01-12' },
            { id: 'vid1', name: 'intro_sequence.mp4', type: 'file', fileType: 'video', size: '45 MB', date: '2025-01-15' },
            { id: 'doc1', name: 'readme.txt', type: 'file', fileType: 'text', size: '2 KB', date: '2025-01-05' },
            { id: 'code1', name: 'config.json', type: 'file', fileType: 'code', size: '5 KB', date: '2025-01-08' }
          ] }
        ]
      }
    ]
  }
];

export const MOCK_CODE_TREE: FileNode[] = [
    {
    id: 'core',
    name: 'core_node',
    type: 'folder',
    isOpen: true,
    children: []
    }
];

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'crypto',
    name: 'Crypto & Security',
    icon: Shield,
    tools: [
      { id: 'cry1', name: 'UUID Generator', status: 'available' },
      { id: 'cry_ulid', name: 'ULID Generator', status: 'available' },
      { id: 'cry_token', name: 'Token Generator', status: 'available' },
      { id: 'ut4', name: 'Password Generator', status: 'available' },
      { id: 'ut5', name: 'Password Strength', status: 'available' },
      { id: 'cry_hash', name: 'Hash Generator', status: 'available' },
      { id: 'cry_bcrypt', name: 'Bcrypt Hash/Verify', status: 'available' },
      { id: 'cry_enc', name: 'AES Encrypt', status: 'available' },
      { id: 'cry_dec', name: 'AES Decrypt', status: 'available' },
      { id: 'cry_hmac', name: 'HMAC Generator', status: 'available' },
      { id: 'cry_rsa', name: 'RSA Key Generator', status: 'available' },
      { id: 'cry_otp_gen', name: 'OTP Generator', status: 'available' },
      { id: 'cry_otp_ver', name: 'OTP Verify', status: 'available' },
      { id: 'cry_bip39', name: 'BIP39 Passphrase', status: 'available' },
      { id: 'cry_basic_auth', name: 'Basic Auth Header', status: 'available' },
    ]
  },
  {
    id: 'converters',
    name: 'Converters',
    icon: RefreshCcw,
    tools: [
      { id: 'cv1', name: 'Base64 Converter', status: 'available' },
      { id: 'cv2', name: 'URL Encoder', status: 'available' },
      { id: 'cv4', name: 'Case Converter', status: 'available' },
      { id: 'cv11', name: 'JSON ⇄ YAML', status: 'available' },
      { id: 'cv6', name: 'Timestamp Converter', status: 'available' },
      { id: 'conv_temp', name: 'Temperature Converter', status: 'available' },
      { id: 'conv_roman', name: 'Roman Numerals', status: 'available' },
      { id: 'col1', name: 'HEX to RGB', status: 'available' },
    ]
  },
  {
    id: 'web',
    name: 'Web Tools',
    icon: Globe,
    tools: [
      { id: 'web_jwt', name: 'JWT Parser', status: 'available' },
      { id: 'web_md', name: 'Markdown to HTML', status: 'available' },
      { id: 'gen1', name: 'QR Code Generator', status: 'available' },
      { id: 'web_wifi', name: 'WiFi QR Code', status: 'available' },
      { id: 'web_url_parse', name: 'URL Parser', status: 'todo' }, // Placeholder
    ]
  },
  {
    id: 'formatters',
    name: 'Formatters',
    icon: FileJson,
    tools: [
      { id: 'fmt1', name: 'JSON Formatter', status: 'available' },
      { id: 'web_json_min', name: 'JSON Minify', status: 'available' },
      { id: 'fmt4', name: 'SQL Formatter', status: 'available' },
      { id: 'web_xml', name: 'XML Formatter', status: 'available' },
      { id: 'web_yaml', name: 'YAML Formatter', status: 'available' },
    ]
  },
  {
    id: 'image',
    name: 'Image Tools',
    icon: ImageIcon,
    tools: [
      { id: 'img2', name: 'Image Compressor', status: 'available' },
      { id: 'adv_img_crop', name: 'Image Cropper', status: 'available' },
    ]
  },
  {
    id: 'pdf',
    name: 'PDF Tools',
    icon: FileText,
    tools: [
      { id: 'adv_pdf_split', name: 'PDF Splitter', status: 'available' },
    ]
  },
  {
    id: 'calc',
    name: 'Calculators',
    icon: Calculator,
    tools: [
      { id: 'calc1', name: 'Age Calculator', status: 'available' },
    ]
  },
  {
    id: 'text_adv',
    name: 'Text Advanced',
    icon: Edit3,
    tools: [
      { id: 'ta4', name: 'Word Counter', status: 'available' },
    ]
  }
];

export const MOCK_TASKS: TaskItem[] = [
    { 
      id: 'task1', 
      title: 'Init System', 
      size: '1KB', 
      date: '2025-01-01', 
      status: 'done', 
      promptText: 'Initialize system core parameters and establish neural handshake protocol. Ensure all subsystems are green.', 
      audioSegments: [
        { id: 'seg1', text: "Initializing system core...", duration: 2.5 },
        { id: 'seg2', text: "Establishing neural handshake...", duration: 3.2 },
        { id: 'seg3', text: "Handshake complete. Subsystems green.", duration: 2.8 },
        { id: 'seg4', text: "System online.", duration: 1.5 }
      ] 
    }
];

export const DEFAULT_API_CONFIGS: Record<string, ToolConfig> = {
  'calc1': { toolId: 'calc1', apiUrl: '', mode: 'local' }, 
  'col1': { toolId: 'col1', apiUrl: '', mode: 'local' }, 
  'ut4': { toolId: 'ut4', apiUrl: '', mode: 'local' }, 
  'ta4': { toolId: 'ta4', apiUrl: '', mode: 'local' }, 
};

// --- TOOL UI SCHEMAS ---
export const TOOL_UI_SCHEMAS: Record<string, ToolUISchema> = {
  // --- Crypto ---
  'cry1': {
    id: 'cry1', title: 'UUID Generator', description: 'Generate UUID v4 identifiers.',
    inputs: [{ id: 'count', label: 'Count', type: 'number', defaultValue: 1 }, { id: 'uppercase', label: 'Uppercase', type: 'checkbox' }],
    actions: [{ id: 'gen', label: 'Generate', icon: Shield, apiPath: '/api/ittools/v1/crypto/uuid/generate' }],
    outputs: [{ id: 'uuids', label: 'UUIDs', type: 'json' }]
  },
  'cry_ulid': {
    id: 'cry_ulid', title: 'ULID Generator', description: 'Generate Universally Unique Lexicographically Sortable Identifiers.',
    inputs: [{ id: 'count', label: 'Count', type: 'number', defaultValue: 1 }],
    actions: [{ id: 'gen', label: 'Generate', icon: Shield, apiPath: '/api/ittools/v1/crypto/ulid/generate' }],
    outputs: [{ id: 'ulids', label: 'ULIDs', type: 'json' }]
  },
  'cry_token': {
    id: 'cry_token', title: 'Token Generator', description: 'Generate random security tokens.',
    inputs: [
        { id: 'length', label: 'Length', type: 'number', defaultValue: 32 },
        { id: 'charset', label: 'Charset', type: 'select', options: [{label:'Alphanumeric', value:'alphanumeric'}, {label:'Hex', value:'hex'}, {label:'Numeric', value:'numeric'}] }
    ],
    actions: [{ id: 'gen', label: 'Generate', icon: Key, apiPath: '/api/ittools/v1/crypto/token/generate' }],
    outputs: [{ id: 'tokens', label: 'Tokens', type: 'json' }]
  },
  'cry_hash': {
    id: 'cry_hash', title: 'Hash Generator', description: 'Calculate MD5, SHA1, SHA256, SHA512 hashes.',
    inputs: [
        { id: 'text', label: 'Text', type: 'textarea' },
        { id: 'algorithm', label: 'Algorithm', type: 'select', options: [{label:'SHA256', value:'sha256'}, {label:'MD5', value:'md5'}, {label:'SHA1', value:'sha1'}, {label:'SHA512', value:'sha512'}] }
    ],
    actions: [{ id: 'hash', label: 'Calculate Hash', icon: Hash, apiPath: '/api/ittools/v1/crypto/hash' }],
    outputs: [{ id: 'hash', label: 'Hash Value', type: 'text' }]
  },
  'cry_bcrypt': {
    id: 'cry_bcrypt', title: 'Bcrypt Hash & Verify', description: 'Generate or verify Bcrypt password hashes.',
    inputs: [
        { id: 'password', label: 'Password', type: 'text' },
        { id: 'rounds', label: 'Rounds (Hash only)', type: 'number', defaultValue: 10 },
        { id: 'hash', label: 'Existing Hash (Verify only)', type: 'text', placeholder: '$2y$10$...' }
    ],
    actions: [
        { id: 'hash', label: 'Generate Hash', icon: Lock, apiPath: '/api/ittools/v1/crypto/bcrypt/hash' },
        { id: 'verify', label: 'Verify Hash', icon: CheckCircle, apiPath: '/api/ittools/v1/crypto/bcrypt/verify' }
    ],
    outputs: [{ id: 'hash', label: 'Generated Hash', type: 'text' }, { id: 'valid', label: 'Verification Result', type: 'json' }]
  },
  'ut5': {
    id: 'ut5', title: 'Password Strength', description: 'Analyze password entropy.',
    inputs: [{ id: 'password', label: 'Password', type: 'text' }],
    actions: [{ id: 'check', label: 'Analyze', icon: Shield, apiPath: '/api/ittools/v1/crypto/password/analyze' }],
    outputs: [{ id: 'score', label: 'Analysis', type: 'json' }]
  },
  'cry_enc': {
      id: 'cry_enc', title: 'AES Encryption', description: 'Encrypt text using AES.',
      inputs: [{ id: 'text', label: 'Text', type: 'textarea' }, { id: 'key', label: 'Key', type: 'text' }],
      actions: [{ id: 'encrypt', label: 'Encrypt', icon: Lock, apiPath: '/api/ittools/v1/crypto/encrypt' }],
      outputs: [{ id: 'encrypted', label: 'Encrypted Text', type: 'text' }]
  },
  'cry_dec': {
      id: 'cry_dec', title: 'AES Decryption', description: 'Decrypt AES text.',
      inputs: [{ id: 'encrypted', label: 'Encrypted Data', type: 'textarea' }, { id: 'key', label: 'Key', type: 'text' }],
      actions: [{ id: 'decrypt', label: 'Decrypt', icon: Lock, apiPath: '/api/ittools/v1/crypto/decrypt' }],
      outputs: [{ id: 'decrypted', label: 'Decrypted Text', type: 'text' }]
  },
  'cry_hmac': {
      id: 'cry_hmac', title: 'HMAC Generator', description: 'Create Hash-based Message Authentication Codes.',
      inputs: [
          { id: 'text', label: 'Text', type: 'textarea' },
          { id: 'secret', label: 'Secret Key', type: 'text' },
          { id: 'algorithm', label: 'Algorithm', type: 'select', options: [{label:'SHA256', value:'sha256'}, {label:'SHA512', value:'sha512'}] }
      ],
      actions: [{ id: 'gen', label: 'Generate', icon: Hash, apiPath: '/api/ittools/v1/crypto/hmac' }],
      outputs: [{ id: 'hmac', label: 'HMAC', type: 'text' }]
  },
  'cry_rsa': {
      id: 'cry_rsa', title: 'RSA Key Generator', description: 'Generate RSA Key Pairs.',
      inputs: [{ id: 'key_size', label: 'Key Size', type: 'select', options: [{label:'2048 bit', value:'2048'}, {label:'4096 bit', value:'4096'}] }],
      actions: [{ id: 'gen', label: 'Generate Keys', icon: Shield, apiPath: '/api/ittools/v1/crypto/rsa/generate' }],
      outputs: [{ id: 'publicKey', label: 'Public Key', type: 'text' }, { id: 'privateKey', label: 'Private Key', type: 'text' }]
  },
  'cry_otp_gen': {
      id: 'cry_otp_gen', title: 'OTP Generator', description: 'Generate TOTP Secret and Code.',
      inputs: [],
      actions: [{ id: 'gen', label: 'Generate Secret', icon: Clock, apiPath: '/api/ittools/v1/crypto/otp/generate' }],
      outputs: [{ id: 'otp', label: 'Current OTP', type: 'text' }, { id: 'secret', label: 'Secret', type: 'text' }]
  },
  'cry_otp_ver': {
      id: 'cry_otp_ver', title: 'OTP Verifier', description: 'Verify TOTP Codes.',
      inputs: [{ id: 'otp', label: 'OTP Code', type: 'text' }, { id: 'secret', label: 'Secret Key', type: 'text' }],
      actions: [{ id: 'ver', label: 'Verify', icon: Check, apiPath: '/api/ittools/v1/crypto/otp/verify' }],
      outputs: [{ id: 'valid', label: 'Is Valid?', type: 'json' }]
  },
  'cry_bip39': {
      id: 'cry_bip39', title: 'BIP39 Generator', description: 'Generate Mnemonic Phrases.',
      inputs: [{ id: 'strength', label: 'Strength', type: 'select', options: [{label:'128 bit', value:'128'}, {label:'256 bit', value:'256'}] }],
      actions: [{ id: 'gen', label: 'Generate', icon: Key, apiPath: '/api/ittools/v1/crypto/bip39/generate' }],
      outputs: [{ id: 'mnemonics', label: 'Mnemonic', type: 'json' }]
  },
  'cry_basic_auth': {
      id: 'cry_basic_auth', title: 'Basic Auth Generator', description: 'Create HTTP Basic Auth Headers.',
      inputs: [{ id: 'username', label: 'Username', type: 'text' }, { id: 'password', label: 'Password', type: 'text' }],
      actions: [{ id: 'gen', label: 'Generate', icon: Lock, apiPath: '/api/ittools/v1/crypto/basic-auth' }],
      outputs: [{ id: 'header', label: 'Header Key', type: 'text' }, { id: 'value', label: 'Header Value', type: 'text' }]
  },

  // --- Converters ---
  'cv1': {
    id: 'cv1', title: 'Base64 Tool', description: 'Encode/Decode Base64.',
    inputs: [{ id: 'text', label: 'Input', type: 'textarea' }, { id: 'encoded', label: 'Encoded Input', type: 'textarea' }],
    actions: [
        { id: 'enc', label: 'Encode', icon: Play, apiPath: '/api/ittools/v1/converter/base64/encode' },
        { id: 'dec', label: 'Decode', icon: Play, apiPath: '/api/ittools/v1/converter/base64/decode' }
    ],
    outputs: [{ id: 'encoded', label: 'Encoded', type: 'text' }, { id: 'decoded', label: 'Decoded', type: 'text' }]
  },
  'cv2': {
      id: 'cv2', title: 'URL Tool', description: 'Encode/Decode URLs.',
      inputs: [{ id: 'url', label: 'URL', type: 'textarea' }, { id: 'encoded', label: 'Encoded URL', type: 'textarea' }],
      actions: [
          { id: 'enc', label: 'Encode', icon: Link, apiPath: '/api/ittools/v1/converter/url/encode' },
          { id: 'dec', label: 'Decode', icon: Link, apiPath: '/api/ittools/v1/converter/url/decode' }
      ],
      outputs: [{ id: 'encoded', label: 'Encoded', type: 'text' }, { id: 'decoded', label: 'Decoded', type: 'text' }]
  },
  'cv4': {
    id: 'cv4', title: 'Case Converter', description: 'Convert text casing.',
    inputs: [{ id: 'text', label: 'Text Input', type: 'textarea' }],
    actions: [{ id: 'convert', label: 'Convert', icon: Type, apiPath: '/api/ittools/v1/converter/case' }],
    outputs: [{ id: 'snake_case', label: 'Snake Case', type: 'text' }, { id: 'camelCase', label: 'Camel Case', type: 'text' }]
  },
  'cv11': {
      id: 'cv11', title: 'JSON <> YAML', description: 'Convert between JSON and YAML.',
      inputs: [{ id: 'json', label: 'JSON Input', type: 'textarea' }, { id: 'yaml', label: 'YAML Input', type: 'textarea' }],
      actions: [
          { id: 'to_yaml', label: 'To YAML', icon: RefreshCcw, apiPath: '/api/ittools/v1/converter/json-to-yaml' },
          { id: 'to_json', label: 'To JSON', icon: RefreshCcw, apiPath: '/api/ittools/v1/converter/yaml-to-json' }
      ],
      outputs: [{ id: 'yaml', label: 'YAML Result', type: 'text' }, { id: 'json', label: 'JSON Result', type: 'text' }]
  },
  'conv_temp': {
      id: 'conv_temp', title: 'Temperature Converter', description: 'Convert C/F/K.',
      inputs: [
          { id: 'value', label: 'Value', type: 'number' },
          { id: 'from', label: 'From Unit', type: 'select', options: [{label:'Celsius', value:'celsius'}, {label:'Fahrenheit', value:'fahrenheit'}, {label:'Kelvin', value:'kelvin'}] }
      ],
      actions: [{ id: 'conv', label: 'Convert', icon: RefreshCcw, apiPath: '/api/ittools/v1/converter/temperature' }],
      outputs: [{ id: 'celsius', label: 'Celsius', type: 'text' }, { id: 'fahrenheit', label: 'Fahrenheit', type: 'text' }, { id: 'kelvin', label: 'Kelvin', type: 'text' }]
  },
  'conv_roman': {
      id: 'conv_roman', title: 'Roman Numerals', description: 'Convert Roman to Arabic.',
      inputs: [{ id: 'roman', label: 'Roman Numeral', type: 'text' }],
      actions: [{ id: 'conv', label: 'Convert', icon: Hash, apiPath: '/api/ittools/v1/converter/roman/to-arabic' }],
      outputs: [{ id: 'arabic', label: 'Arabic Number', type: 'text' }]
  },
  'cv6': {
    id: 'cv6', title: 'Timestamp Converter', description: 'Convert DateTime formats.',
    inputs: [
      { id: 'input', label: 'Date String', type: 'text' },
      { id: 'inputFormat', label: 'Format', type: 'select', options: [{label: 'ISO 8601', value: 'iso8601'}, {label: 'Unix Timestamp', value: 'unix'}] }
    ],
    actions: [{ id: 'conv', label: 'Convert', icon: Clock, apiPath: '/api/ittools/v1/converter/datetime' }],
    outputs: [{ id: 'iso8601', label: 'ISO', type: 'text' }, { id: 'unix', label: 'Unix', type: 'text' }]
  },

  // --- Web Tools & Formatters ---
  'fmt1': {
    id: 'fmt1', title: 'JSON Formatter', description: 'Prettify JSON.',
    inputs: [{ id: 'json', label: 'Raw JSON', type: 'textarea' }, { id: 'indent', label: 'Indent', type: 'number', defaultValue: 2 }],
    actions: [{ id: 'fmt', label: 'Beautify', icon: AlignLeft, apiPath: '/api/ittools/v1/web/json/prettify' }],
    outputs: [{ id: 'prettified', label: 'Formatted JSON', type: 'text' }]
  },
  'web_json_min': {
    id: 'web_json_min', title: 'JSON Minifier', description: 'Minify JSON.',
    inputs: [{ id: 'json', label: 'JSON', type: 'textarea' }],
    actions: [{ id: 'min', label: 'Minify', icon: AlignLeft, apiPath: '/api/ittools/v1/web/json/minify' }],
    outputs: [{ id: 'minified', label: 'Minified JSON', type: 'text' }]
  },
  'web_xml': {
      id: 'web_xml', title: 'XML Formatter', description: 'Format XML string.',
      inputs: [{ id: 'xml', label: 'XML', type: 'textarea' }],
      actions: [{ id: 'fmt', label: 'Format', icon: AlignLeft, apiPath: '/api/ittools/v1/web/xml/format' }],
      outputs: [{ id: 'formatted', label: 'Result', type: 'text' }]
  },
  'web_yaml': {
      id: 'web_yaml', title: 'YAML Formatter', description: 'Format YAML string.',
      inputs: [{ id: 'yaml', label: 'YAML', type: 'textarea' }],
      actions: [{ id: 'fmt', label: 'Format', icon: AlignLeft, apiPath: '/api/ittools/v1/web/yaml/format' }],
      outputs: [{ id: 'formatted', label: 'Result', type: 'text' }]
  },
  'fmt4': {
      id: 'fmt4', title: 'SQL Formatter', description: 'Format SQL queries.',
      inputs: [{ id: 'sql', label: 'SQL', type: 'textarea' }],
      actions: [{ id: 'fmt', label: 'Format', icon: AlignLeft, apiPath: '/api/ittools/v1/web/sql/format' }],
      outputs: [{ id: 'formatted', label: 'Formatted SQL', type: 'text' }]
  },
  'web_md': {
      id: 'web_md', title: 'Markdown to HTML', description: 'Render Markdown.',
      inputs: [{ id: 'markdown', label: 'Markdown', type: 'textarea' }],
      actions: [{ id: 'conv', label: 'Convert', icon: FileText, apiPath: '/api/ittools/v1/web/markdown/to-html' }],
      outputs: [{ id: 'html', label: 'HTML Preview', type: 'html' }]
  },
  'web_jwt': {
      id: 'web_jwt', title: 'JWT Parser', description: 'Decode JSON Web Tokens.',
      inputs: [{ id: 'token', label: 'JWT Token', type: 'textarea' }],
      actions: [{ id: 'parse', label: 'Parse', icon: Lock, apiPath: '/api/ittools/v1/web/jwt/parse' }],
      outputs: [{ id: 'header', label: 'Header', type: 'json' }, { id: 'payload', label: 'Payload', type: 'json' }]
  },
  'gen1': {
    id: 'gen1', title: 'QR Code Generator', description: 'Generate QR codes.',
    inputs: [{ id: 'text', label: 'Content', type: 'text' }, { id: 'size', label: 'Size (px)', type: 'number', defaultValue: 300 }],
    actions: [{ id: 'gen', label: 'Generate', icon: QrCode, apiPath: '/api/ittools/v1/web/qr-code/generate' }],
    outputs: [{ id: 'qrCodeUrl', label: 'QR Code', type: 'image-preview' }]
  },
  'web_wifi': {
      id: 'web_wifi', title: 'WiFi QR Code', description: 'Generate WiFi Access QR.',
      inputs: [
          { id: 'ssid', label: 'SSID', type: 'text' },
          { id: 'password', label: 'Password', type: 'text' },
          { id: 'encryption', label: 'Encryption', type: 'select', options: [{label:'WPA/WPA2', value:'WPA'}, {label:'WEP', value:'WEP'}, {label:'None', value:'nopass'}] }
      ],
      actions: [{ id: 'gen', label: 'Generate', icon: Wifi, apiPath: '/api/ittools/v1/web/wifi-qr-code/generate' }],
      outputs: [{ id: 'qrCodeUrl', label: 'WiFi QR', type: 'image-preview' }]
  },

  // --- Advanced ---
  'img2': {
    id: 'img2', title: 'Image Compressor', description: 'Reduce image size.',
    inputs: [{ id: 'image', label: 'Images', type: 'file', accept: 'image/*' }, { id: 'quality', label: 'Quality (%)', type: 'number', defaultValue: 80 }],
    actions: [{ id: 'compress', label: 'Compress', icon: Upload, apiPath: '/api/ittools/v1/advanced/image/compress' }],
    outputs: [{ id: 'image_data', label: 'Optimized Image', type: 'image-preview' }]
  },
  'adv_img_crop': {
    id: 'adv_img_crop', title: 'Image Cropper', description: 'Crop images.',
    inputs: [
        { id: 'image', label: 'Image', type: 'file', accept: 'image/*' },
        { id: 'width', label: 'Width (px)', type: 'number', defaultValue: 300 },
        { id: 'height', label: 'Height (px)', type: 'number', defaultValue: 300 }
    ],
    actions: [{ id: 'crop', label: 'Crop', icon: Upload, apiPath: '/api/ittools/v1/advanced/image/crop' }],
    outputs: [{ id: 'image_data', label: 'Result', type: 'image-preview' }]
  },
  'adv_pdf_split': {
      id: 'adv_pdf_split', title: 'PDF Splitter', description: 'Split PDF pages.',
      inputs: [{ id: 'pdf', label: 'PDF File', type: 'file', accept: 'application/pdf' }, { id: 'ranges', label: 'Ranges (1-2,5)', type: 'text' }],
      actions: [{ id: 'split', label: 'Split', icon: Upload, apiPath: '/api/ittools/v1/advanced/pdf/split' }],
      outputs: [{ id: 'files', label: 'Files', type: 'json' }]
  }
};
