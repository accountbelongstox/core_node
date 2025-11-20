export default defineNuxtPlugin((nuxtApp) => {
    if (process.client) {
        import('vue3-perfect-scrollbar').then((module) => {
            const { PerfectScrollbarPlugin } = module;
            if (PerfectScrollbarPlugin) {
                nuxtApp.vueApp.use(PerfectScrollbarPlugin);
            }
        }).catch(() => {
            // Silently handle module loading errors
        });
    }
});
