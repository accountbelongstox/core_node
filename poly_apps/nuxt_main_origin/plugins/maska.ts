export default defineNuxtPlugin(async (nuxtApp) => {
    if (process.client) {
        const { Mask } = await import('maska');
        nuxtApp.vueApp.directive('maska', {
            mounted(el, binding) {
                const options = typeof binding.value === 'string' ? { mask: binding.value } : binding.value;
                el._maska = new Mask(options);
            },
            updated(el, binding) {
                if (el._maska) {
                    const options = typeof binding.value === 'string' ? { mask: binding.value } : binding.value;
                    el._maska.update(options);
                }
            },
            unmounted(el) {
                if (el._maska) {
                    el._maska.destroy();
                }
            }
        });
    }
});
