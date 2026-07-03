import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// 订多多 (DingDuoDuo) — Pinduoduo order management + one-click ERP export.
// Built with WXT. Output goes to <project>/.output/chrome-mv3 (WXT default).
// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Keep WXT default outDir = ".output". start.ps1 builds into dingdoudou/.output/.
  srcDir: '.',
  manifest: {
    name: '订多多',
    short_name: '订多多',
    description: '订多多 - 拼多多多账号订单管理与一键导出ERP。支持订单同步、关键词搜索、批量操作、CSV导出。第三方工具，与拼多多官方无关。',
    version: '5.2.0',
    default_locale: 'zh_CN',
    icons: {
      16: 'icon/16.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    action: {
      default_title: '订多多 | 拼多多订单管理与一键导出ERP',
    },
    permissions: [
      'cookies',
      'storage',
      'activeTab',
      'tabs',
      'windows',
      'unlimitedStorage',
      'downloads',
      'scripting',
      'declarativeNetRequest',
    ],
    host_permissions: [
      'https://mobile.yangkeduo.com/*',
      'https://*.yangkeduo.com/*',
      'https://mclient.alipay.com/*',
      'https://air.1688.com/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
      'http://*:9000/*',
    ],
    web_accessible_resources: [
      {
        resources: ['dashboard.html', 'templates/*', 'icon/*'],
        matches: ['<all_urls>'],
      },
    ],
    incognito: 'split',
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
