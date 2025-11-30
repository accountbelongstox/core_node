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

import { describe, expect, it } from 'vitest';
import { diff } from './json-diff.models';

describe('json-diff models', () => {
  describe('diff', () => {
    it('list object differences', () => {
      const obj = { a: 1, b: 2 };
      const newObj = { a: 1, b: 2, c: 3 };
      const result = diff(obj, newObj);

      expect(result).toEqual({
        key: '',
        type: 'object',
        children: [
          {
            key: 'a',
            type: 'value',
            value: 1,
            oldValue: 1,
            status: 'unchanged',
          },
          {
            key: 'b',
            type: 'value',
            value: 2,
            oldValue: 2,
            status: 'unchanged',
          },
          {
            key: 'c',
            type: 'value',
            value: 3,
            oldValue: undefined,
            status: 'added',
          },
        ],
        oldValue: { a: 1, b: 2 },
        value: { a: 1, b: 2, c: 3 },
        status: 'children-updated',
      });
    });

    it('list array differences', () => {
      const obj = [1, 2];
      const newObj = [1, 2, 3];
      const result = diff(obj, newObj);

      expect(result).toEqual({
        key: '',
        type: 'array',
        children: [
          {
            key: 0,
            type: 'value',
            value: 1,
            oldValue: 1,
            status: 'unchanged',
          },
          {
            key: 1,
            type: 'value',
            value: 2,
            oldValue: 2,
            status: 'unchanged',
          },
          {
            key: 2,
            type: 'value',
            value: 3,
            oldValue: undefined,
            status: 'added',
          },
        ],
        oldValue: [1, 2],
        value: [1, 2, 3],
        status: 'children-updated',
      });
    });
  });
});
