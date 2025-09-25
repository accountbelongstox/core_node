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

import { type Colord, colord } from 'colord';
import { withDefaultOnError } from '@/utils/defaults';
import { useValidation } from '@/composable/validation';

export { removeAlphaChannelWhenOpaque, buildColorFormat };

function removeAlphaChannelWhenOpaque(hexColor: string) {
  return hexColor.replace(/^(#(?:[0-9a-f]{3}){1,2})ff$/i, '$1');
}

function buildColorFormat({
  label,
  parse = value => colord(value),
  format,
  placeholder,
  invalidMessage = `Invalid ${label.toLowerCase()} format.`,
  type = 'text',
}: {
  label: string
  parse?: (value: string) => Colord
  format: (value: Colord) => string
  placeholder?: string
  invalidMessage?: string
  type?: 'text' | 'color-picker'
}) {
  const value = ref('');

  return {
    type,
    label,
    parse: (v: string) => withDefaultOnError(() => parse(v), undefined),
    format,
    placeholder,
    value,
    validation: useValidation({
      source: value,
      rules: [
        {
          message: invalidMessage,
          validator: v => withDefaultOnError(() => {
            if (v === '') {
              return true;
            }

            return parse(v).isValid();
          }, false),
        },
      ],
    }),

  };
}
