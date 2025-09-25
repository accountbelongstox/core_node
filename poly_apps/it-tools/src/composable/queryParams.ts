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

import { useRouteQuery } from '@vueuse/router';
import { computed } from 'vue';
import { useStorage } from '@vueuse/core';

export { useQueryParam, useQueryParamOrStorage };

const transformers = {
  number: {
    fromQuery: (value: string) => Number(value),
    toQuery: (value: number) => String(value),
  },
  string: {
    fromQuery: (value: string) => value,
    toQuery: (value: string) => value,
  },
  boolean: {
    fromQuery: (value: string) => value.toLowerCase() === 'true',
    toQuery: (value: boolean) => (value ? 'true' : 'false'),
  },
  object: {
    fromQuery: (value: string) => {
      return JSON.parse(value);
    },
    toQuery: (value: object) => JSON.stringify(value),
  },
};

function useQueryParam<T>({ name, defaultValue }: { name: string; defaultValue: T }) {
  const type = typeof defaultValue;
  const transformer = transformers[type as keyof typeof transformers] ?? transformers.string;

  const proxy = useRouteQuery(name, transformer.toQuery(defaultValue as never));

  return computed<T>({
    get() {
      return transformer.fromQuery(proxy.value) as unknown as T;
    },
    set(value) {
      proxy.value = transformer.toQuery(value as never);
    },
  });
}

function useQueryParamOrStorage<T>({ name, storageName, defaultValue }: { name: string; storageName: string; defaultValue: T }) {
  const type = typeof defaultValue;
  const transformer = transformers[type as keyof typeof transformers] ?? transformers.string;

  const storageRef = useStorage(storageName, defaultValue);
  const proxyDefaultValue = transformer.toQuery(defaultValue as never);
  const proxy = useRouteQuery(name, proxyDefaultValue);

  const r = ref(defaultValue);

  watch(r,
    (value) => {
      proxy.value = transformer.toQuery(value as never);
      storageRef.value = value as never;
    },
    { deep: true });

  r.value = (proxy.value && proxy.value !== proxyDefaultValue
    ? transformer.fromQuery(proxy.value) as unknown as T
    : storageRef.value as T) as never;

  return r;
}
