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
