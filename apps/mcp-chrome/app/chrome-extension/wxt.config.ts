import { defineConfig } from 'wxt';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

// Load configuration from config.cjs
const configPath = resolve(__dirname, 'config.cjs');
const config = require(configPath);
const CHROME_EXTENSION_KEY = config.CHROME_EXTENSION_KEY;

// Build in current directory: .output/chrome-mv3 (WXT default, no custom outDir)

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  // Disable automatic .env loading since we use config.js
  env: {},
  runner: {
    // 方案1: 禁用自动启动（推荐）
    disabled: true,

    // 方案2: 如果要启用自动启动并使用现有配置，取消注释下面的配置
    // chromiumArgs: [
    //   '--user-data-dir=' + homedir() + (process.platform === 'darwin'
    //     ? '/Library/Application Support/Google/Chrome'
    //     : process.platform === 'win32'
    //     ? '/AppData/Local/Google/Chrome/User Data'
    //     : '/.config/google-chrome'),
    //   '--remote-debugging-port=9222',
    // ],
  },
  manifest: {
    // Use environment variable for the key, fallback to undefined if not set
    key: CHROME_EXTENSION_KEY,
    default_locale: 'en',
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDescription__',
    // https://developer.chrome.com/docs/extensions/reference/manifest/icons
    // https://developer.chrome.com/docs/extensions/reference/api/action#manifest
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
    action: {
      // Localized via _locales/<code>/messages.json — never hardcode here.
      // (Without this, newer WXT injects a placeholder "Default Popup Title".)
      default_title: '__MSG_extensionName__',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
      },
    },
    permissions: [
      'nativeMessaging',
      'tabs',
      'activeTab',
      'scripting',
      'downloads',
      'webRequest',
      'debugger',
      'history',
      'bookmarks',
      'offscreen',
      'tabCapture',
      'storage',
      'alarms',
      'tabGroups',
    ],
    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: [
          '/models/*', // Allow access to public/models/ files
          '/workers/*', // Allow access to workers
          '/offscreen/audio-recorder.html', // Audio recording offscreen document
        ],
        matches: ['<all_urls>'],
      },
    ],
    cross_origin_embedder_policy: {
      value: 'require-corp',
    },
    cross_origin_opener_policy: {
      value: 'same-origin',
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
  },
  vite: (env) => ({
    plugins: [
      tailwindcss(),
      viteStaticCopy({
        targets: [
          {
            src: 'inject-scripts/*.js',
            dest: 'inject-scripts',
          },
          {
            src: ['workers/*'],
            dest: 'workers',
          },
          {
            src: '_locales/**/*',
            dest: '_locales',
          },
        ],
      }) as any,
    ],
    resolve: {
      // Explicitly register the WXT @ / ~ aliases for Vite/rolldown. Earlier
      // WXT versions injected these automatically, but after upgrading to
      // Vite 8 + rolldown the bundler no longer sees them, so imports like
      // `@/composables/...` were treated as literal paths and failed to
      // resolve ([UNLOADABLE_DEPENDENCY] os error 3). Map all four WXT alias
      // forms to the chrome-extension srcDir (this directory).
      alias: {
        '@': resolve(__dirname, '.'),
        '~': resolve(__dirname, '.'),
        '@@': resolve(__dirname, '.'),
        '~~': resolve(__dirname, '.'),
      },
      // Ensure chrome-mcp-shared is resolved correctly
      preserveSymlinks: false,
    },
    optimizeDeps: {
      // Include chrome-mcp-shared in optimization to ensure all exports are available
      include: ['chrome-mcp-shared'],
    },
    build: {
      // MV3 extensions only ever run in modern Chrome (Chrome 88+), so there is no
      // reason to down-level to ES2015. Crucially, deps like @xenova/transformers and
      // hnswlib-wasm-static use BigInt literals (1n/0n), which CANNOT be transpiled to
      // ES2015 — targeting es2015 makes rolldown ship them as-is and spam
      // [TOLERATED_TRANSFORM] warnings on every build. es2020 natively supports BigInt
      // (and optional chaining / nullish coalescing), which clears those warnings.
      target: 'es2020',
      // 非生产环境下生成sourcemap
      sourcemap: env.mode !== 'production',
      // 禁用gzip 压缩大小报告，因为压缩大型文件可能会很慢
      reportCompressedSize: false,
      // chunk大小超过1500kb是触发警告
      chunkSizeWarningLimit: 1500,
      minify: false,
      // Ensure all exports from chrome-mcp-shared are included
      commonjsOptions: {
        include: [/chrome-mcp-shared/, /node_modules/],
      },
      rollupOptions: {
        output: {
          // Preserve all exports from shared package
          preserveModules: false,
        },
      },
    },
  }),
});
