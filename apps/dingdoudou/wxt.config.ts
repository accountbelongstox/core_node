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
    name: '__MSG_extensionName__',
    short_name: '__MSG_extensionShortName__',
    description: '__MSG_extensionDescription__',
    version: '5.2.0',
    default_locale: 'zh_CN',
    icons: {
      16: 'icon/16.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    action: {
      default_title: '__MSG_actionTitle__',
    },
    permissions: [
      'cookies',
      'storage',
      'unlimitedStorage',
    ],
    host_permissions: [
      'https://*.yangkeduo.com/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    incognito: 'split',
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
