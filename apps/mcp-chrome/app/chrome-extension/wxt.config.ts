import { defineConfig } from 'wxt';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

// Load configuration from config.cjs
const configPath = resolve(__dirname, 'config.cjs');
const config = require(configPath);
const CHROME_EXTENSION_KEY = config.CHROME_EXTENSION_KEY;
const REPOSITORY_ROOT = resolve(__dirname, '../../../..');

// Detect the target browser from the wxt CLI args (this file is plain TS run by
// the wxt CLI, so process.argv is the only reliable pre-config signal). Used to
// pick the output dir template: external scripts depend on .output/build_extension
// staying the Chrome output, so Firefox builds go to .output/build_extension_firefox.
const CLI_ARGS = process.argv;
const IS_FIREFOX_TARGET = CLI_ARGS.some(
  (arg, i) =>
    ((arg === '-b' || arg === '--browser') && CLI_ARGS[i + 1] === 'firefox') ||
    arg === '-b=firefox' ||
    arg === '--browser=firefox',
);

// Chrome permission list (unchanged historical set).
const CHROME_PERMISSIONS = [
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
  'unlimitedStorage',
  'alarms',
  'tabGroups',
];

// Firefox permission list: Chrome list minus APIs Firefox does not implement
// (debugger, offscreen, tabCapture, tabGroups) plus the blocking webRequest and
// StreamFilter (filterResponseData) permissions that replace CDP network capture.
const FIREFOX_PERMISSIONS = [
  'nativeMessaging',
  'tabs',
  'activeTab',
  'scripting',
  'downloads',
  'webRequest',
  'webRequestBlocking',
  'webRequestFilterResponse',
  'history',
  'bookmarks',
  'storage',
  'alarms',
];

// Build in current directory: .output/chrome-mv3 (WXT default, no custom outDir)

// See https://wxt.dev/api/config.html
export default defineConfig({
  // Output the built extension to <mcp-chrome>/.output/build_extension (Chrome)
  // or <mcp-chrome>/.output/build_extension_firefox (Firefox). outDir is the
  // base dir; the static outDirTemplate replaces the default
  // "{{browser}}-mv{{manifestVersion}}" (chrome-mv3) so there is no extra suffix.
  outDir: resolve(__dirname, '../../.output'),
  outDirTemplate: IS_FIREFOX_TARGET ? 'build_extension_firefox' : 'build_extension',
  modules: ['@wxt-dev/module-vue'],
  webExt: {
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
  manifest: ({ browser }) => {
    // Shared manifest keys, identical on Chrome and Firefox.
    const shared = {
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
      host_permissions: ['<all_urls>'],
      content_security_policy: {
        extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
      },
    };

    if (browser === 'firefox') {
      // Firefox: no Chrome key, gecko id required for native messaging
      // (allowed_extensions in the host manifest must match this id).
      // COOP/COEP omitted: those manifest keys are Chrome-only; wasm runs
      // single-threaded on Firefox. No offscreen documents on Firefox, so
      // audio-recorder.html is not web-accessible there.
      return {
        ...shared,
        browser_specific_settings: {
          gecko: {
            id: 'mcp-chrome@core-node',
            strict_min_version: '128.0',
          },
        },
        permissions: FIREFOX_PERMISSIONS,
        web_accessible_resources: [
          {
            resources: [
              '/models/*', // Allow access to public/models/ files
              '/workers/*', // Allow access to workers
              '/wasm/*', // bzip2 WASM for Duoreader .pz decode
            ],
            matches: ['<all_urls>'],
          },
        ],
      };
    }

    // Chrome: unchanged historical manifest.
    return {
      // Use environment variable for the key, fallback to undefined if not set
      key: CHROME_EXTENSION_KEY,
      ...shared,
      permissions: CHROME_PERMISSIONS,
      web_accessible_resources: [
        {
        resources: [
          '/models/*', // Allow access to public/models/ files
          '/workers/*', // Allow access to workers
          '/wasm/*', // bzip2 WASM for Duoreader .pz decode
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
    };
  },
  vite: (env) => ({
    // The TASK tab imports config/queue_center_contract.json directly from the
    // repository root. This keeps mcp-chrome, Laravel, Pycore, Pycore UI, and
    // Laravel-manager on one task model. WXT build already resolves outside the
    // extension package; this allowlist gives the Vite dev server the same
    // boundary, so scripts/start.ps1 and scripts/start.sh must not copy a second
    // contract file that could drift.
    server: {
      fs: {
        allow: [REPOSITORY_ROOT],
      },
    },
    plugins: [
      tailwindcss(),
      viteStaticCopy({
        targets: [
          {
            src: 'inject-scripts/*.js',
            dest: 'inject-scripts',
          },
          {
            src: 'public/wasm/*',
            dest: 'wasm',
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
        // onnxruntime-web's minified WASM loader glue uses direct eval(). It's a
        // vendor file we can't change and the eval is internal/required, so we
        // silence just the [EVAL] diagnostic (our own code never uses direct
        // eval, so suppressing this code is safe).
        onwarn(warning: any, defaultHandler: (w: any) => void) {
          if (warning && warning.code === 'EVAL') return;
          defaultHandler(warning);
        },
        output: {
          // Preserve all exports from shared package
          preserveModules: false,
        },
      },
    },
  }),
});
