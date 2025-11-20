export default defineNuxtPlugin((nuxtApp) => {
    if (process.client) {
        Promise.all([
            // @ts-ignore
            import('vue3-easymde'),
            import('easymde/dist/easymde.min.css')
        ]).then(([moduleVue]) => {
            const VueEasymde = (moduleVue as any).default;
            if (VueEasymde && typeof VueEasymde.install === 'function') {
    nuxtApp.vueApp.use(VueEasymde);
            }
        }).catch(() => {
            // Silently handle module loading errors
        });
    }
});
