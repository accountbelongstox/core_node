// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
    compatibilityDate: '2025-01-17',
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
            ],
        },
    },

    css: ['~/assets/css/app.css'],
    modules: ['@pinia/nuxt', '@nuxtjs/i18n'],

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
    ],
    vite: {
        plugins: [tailwindcss()],
        optimizeDeps: { 
            include: ['quill'],
            exclude: ['vue3-easymde', 'vue-json-excel3', 'easymde', 'vue3-quill']
        },
        ssr: {
            noExternal: ['vue3-quill']
        },
        define: {
            'process.env.NODE_ENV': '"development"'
        }
    },
    router: {
        options: { linkExactActiveClass: 'active' },
    },
    nitro: {
        preset: 'node-server'
    },
    experimental: {
        payloadExtraction: false
    },
});
