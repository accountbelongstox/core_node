export default defineNuxtPlugin((nuxtApp) => {
    if (process.client) {
        // @ts-ignore
        import('vue-json-excel3').then((module) => {
            const JsonExcel = module.default;
            if (JsonExcel) {
                nuxtApp.vueApp.component('downloadExcel', JsonExcel);
                nuxtApp.vueApp.component('vue3JsonExcel', JsonExcel); // Keep backward compatibility
            }
        }).catch(() => {
            // Silently handle module loading errors
        });
    }
});
