// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

// ============================================================================
// NUXT CONFIGURATION - MULTI-APP ARCHITECTURE
// ============================================================================
//
// **ARCHITECTURE OVERVIEW**:
// This project uses a multi-app architecture where:
// 1. Each app is isolated in apps/app_{namespace}/ directory
// 2. Entry files (pages/index.{app}.vue) are switched at build time by scripts/switch-app-entry.js
// 3. Only the current app's code is included in the build
//
// **BUILD PROCESS**:
// start.ps1 → switch-app-entry.js (physical file copy) → yarn dev/build → nuxt
//
// **CRITICAL DEPENDENCY RULE**:
// ✓ Apps CAN import from common libraries (apps → common)
// ✗ Common libraries MUST NOT import from specific apps (common ↛ apps)
//
// **ENTRY POINT SWITCHING**:
// - Environment variable APP_ENTRY determines the active app (example, ittools, codemart, etc.)
// - scripts/switch-app-entry.js copies pages/index.{APP_ENTRY}.vue → pages/index.vue
// - Nuxt only sees the active app's entry point
// ============================================================================

// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
    compatibilityDate: '2025-01-17',

    // ========================================================================
    // Runtime Configuration
    // ========================================================================
    // APP_ENTRY environment variable identifies the current active app
    // Set by: start.ps1 → cross-env APP_ENTRY={app} → nuxt dev/build
    // ========================================================================
    runtimeConfig: {
        // Private keys (only available on server-side)
        appEntry: process.env.APP_ENTRY || 'example',

        // Public keys (exposed to client-side)
        public: {
            appEntry: process.env.APP_ENTRY || 'example',
            // PyMatrix API configuration
            pyMatrixAPI: process.env.NUXT_PUBLIC_PYMATRIX_API || '',
            pyMatrixWSBase: process.env.NUXT_PUBLIC_PYMATRIX_WS_BASE || ''
        }
    },
    app: {
        head: {
            title: 'Sales Admin | VRISTO - Multipurpose Tailwind Dashboard Template',
            titleTemplate: '%s | VRISTO - Multipurpose Tailwind Dashboard Template',
            htmlAttrs: {
                lang: 'en',
            },
            meta: [
                { charset: 'utf-8' },
                {
                    name: 'viewport',
                    content: 'width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no',
                },
                { hid: 'description', name: 'description', content: '' },
                { name: 'format-detection', content: 'telephone=no' },
            ],
            link: [
                { rel: 'icon', type: 'image/x-icon', href: '/favicon.png' },
                {
                    rel: 'stylesheet',
                    href: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap',
                },
                {
                    rel: 'stylesheet',
                    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
                },
                {
                    rel: 'stylesheet',
                    href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
                },
            ],
        },
    },

    css: [
        '~/assets/css/app.css',
        '~/assets/css/apps/app_pymatrix_theme.css'
    ],
    modules: ['@pinia/nuxt', '@nuxtjs/i18n'],

    // ========================================================================
    // Path Aliases - INTENTIONALLY MINIMAL
    // ========================================================================
    // **IMPORTANT**: Only universal aliases are defined here.
    // App-specific aliases (@/app_xxx) are REMOVED to prevent:
    // 1. Cross-app dependencies
    // 2. Accidental imports from common libraries to specific apps
    // 3. Global namespace pollution
    //
    // **USAGE**:
    // ✓ Correct: import { useItToolsStore } from '@/apps/app_ittools/stores_app_ittools/ittools-store'
    // ✗ Wrong:   import { useItToolsStore } from '@/app_ittools/stores_app_ittools/ittools-store'
    //
    // **RATIONALE**:
    // By forcing full paths, we ensure:
    // - Tree-shaking can properly eliminate unused apps
    // - No accidental cross-app imports
    // - Clear dependency boundaries
    // ========================================================================
    alias: {
        '@/apps': './apps',      // Universal access to all apps (read-only by common/)
        '@/common': './common',  // Shared utilities, components, composables
        // NOTE: App-specific aliases intentionally removed for isolation
    },

    i18n: {
        defaultLocale: 'en',
        locales: [
            { code: 'da', language: 'da-DK', file: 'da.json' },
            { code: 'de', language: 'de-DE', file: 'de.json' },
            { code: 'el', language: 'el-GR', file: 'el.json' },
            { code: 'en', language: 'en-US', file: 'en.json' },
            { code: 'es', language: 'es-ES', file: 'es.json' },
            { code: 'fr', language: 'fr-FR', file: 'fr.json' },
            { code: 'hu', language: 'hu-HU', file: 'hu.json' },
            { code: 'it', language: 'it-IT', file: 'it.json' },
            { code: 'ja', language: 'ja-JP', file: 'ja.json' },
            { code: 'pl', language: 'pl-PL', file: 'pl.json' },
            { code: 'pt', language: 'pt-PT', file: 'pt.json' },
            { code: 'ru', language: 'ru-RU', file: 'ru.json' },
            { code: 'sv', language: 'sv-SE', file: 'sv.json' },
            { code: 'tr', language: 'tr-TR', file: 'tr.json' },
            { code: 'zh', language: 'zh-CN', file: 'zh.json' },
        ],
        strategy: 'no_prefix',
        langDir: 'locales'
    },
    plugins: [
        { src: '~/plugins/vue3-popper', mode: 'client' },
        { src: '~/plugins/perfect-scrollbar' },
        { src: '~/plugins/tippy', mode: 'client' },
        { src: '~/plugins/vue3-json-excel', mode: 'client' },
        { src: '~/plugins/maska', mode: 'client' },
        { src: '~/plugins/vue-easymde', mode: 'client' },
        { src: '~/plugins/vue3-apexcharts', mode: 'client' },
        { src: '~/plugins/datasource.client.ts', mode: 'client' },
    ],
    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: {
            include: ['quill'],
            exclude: ['vue3-easymde', 'vue-json-excel3', 'easymde', 'vue3-quill']
        },
        server: {
            watch: {
                ignored: ['**/pages/index.vue']
            }
        },
        ssr: {
            noExternal: ['vue3-quill']
        },
        build: {
            sourcemap: process.env.NODE_ENV === 'production' ? false : 'hidden'
        },
        define: {
            'process.env.NODE_ENV': '"development"'
        }
    },
    router: {
        options: { linkExactActiveClass: 'active' },
    },
    nitro: {
        preset: 'node-server',
        devProxy: {
            '/api/ittools': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                prependPath: true
            }
        }
    },
    experimental: {
        payloadExtraction: false
    },
});
