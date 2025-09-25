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

import { type Ref, ref, watchEffect } from 'vue';

export { computedCatch };

function computedCatch<T, D>(getter: () => T, { defaultValue }: { defaultValue: D; defaultErrorMessage?: string }): [Ref<T | D>, Ref<string | undefined>];
function computedCatch<T, D>(getter: () => T, { defaultValue, defaultErrorMessage = 'Unknown error' }: { defaultValue?: D; defaultErrorMessage?: string } = {}) {
  const error = ref<string | undefined>();
  const value = ref<T | D | undefined>();

  watchEffect(() => {
    try {
      error.value = undefined;
      value.value = getter();
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : err?.toString() ?? defaultErrorMessage;
      value.value = defaultValue;
    }
  });

  return [value, error] as const;
}
