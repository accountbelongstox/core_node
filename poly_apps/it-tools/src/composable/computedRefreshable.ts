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

import { computedAsync, watchThrottled } from '@vueuse/core';
import { computed, ref, watch } from 'vue';

export { computedRefreshable, computedRefreshableAsync };

function computedRefreshable<T>(getter: () => T, { throttle }: { throttle?: number } = {}) {
  const dirty = ref(true);
  let value: T;

  const update = () => (dirty.value = true);

  if (throttle) {
    watchThrottled(getter, update, { throttle });
  }
  else {
    watch(getter, update);
  }

  const computedValue = computed(() => {
    if (dirty.value) {
      value = getter();
      dirty.value = false;
    }
    return value;
  });

  return [computedValue, update] as const;
}

function computedRefreshableAsync<T>(getter: () => Promise<T>, defaultValue?: T) {
  const dirty = ref(true);
  let value: T;

  const update = () => (dirty.value = true);

  watch(getter, update);

  const computedValue = computedAsync(async () => {
    if (dirty.value) {
      value = await getter();
      dirty.value = false;
    }
    return value;
  }, defaultValue);

  return [computedValue, update] as const;
}
