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

import { type MaybeRef, get } from '@vueuse/core';
import _ from 'lodash';
import { type Ref, reactive, watch } from 'vue';

type ValidatorReturnType = unknown;
type GetErrorMessageReturnType = string;

export interface UseValidationRule<T> {
  validator: (value: T) => ValidatorReturnType
  getErrorMessage?: (value: T) => GetErrorMessageReturnType
  message: string
}

export function isFalsyOrHasThrown(cb: () => ValidatorReturnType): boolean {
  try {
    const returnValue = cb();

    if (_.isNil(returnValue)) {
      return true;
    }

    return returnValue === false;
  }
  catch (_) {
    return true;
  }
}

export function getErrorMessageOrThrown(cb: () => GetErrorMessageReturnType): string {
  try {
    return cb() || '';
  }
  catch (e: any) {
    return e.toString();
  }
}

export interface ValidationAttrs {
  feedback: string
  validationStatus: string | undefined
}

export function useValidation<T>({
  source,
  rules,
  watch: watchRefs = [],
}: {
  source: Ref<T>
  rules: MaybeRef<UseValidationRule<T>[]>
  watch?: Ref<unknown>[]
}) {
  const state = reactive<{
    message: string
    status: undefined | 'error'
    isValid: boolean
    attrs: ValidationAttrs
  }>({
    message: '',
    status: undefined,
    isValid: false,
    attrs: {
      validationStatus: undefined,
      feedback: '',
    },
  });

  watch(
    [source, ...watchRefs],
    () => {
      state.message = '';
      state.status = undefined;

      for (const rule of get(rules)) {
        if (isFalsyOrHasThrown(() => rule.validator(source.value))) {
          if (rule.getErrorMessage) {
            const getErrorMessage = rule.getErrorMessage;
            state.message = rule.message.replace('{0}', getErrorMessageOrThrown(() => getErrorMessage(source.value)));
          }
          else {
            state.message = rule.message;
          }
          state.status = 'error';
        }
      }

      state.isValid = state.status !== 'error';
      state.attrs.feedback = state.message;
      state.attrs.validationStatus = state.status;
    },
    { immediate: true },
  );

  return state;
}
