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
import { obfuscateString } from './string-obfuscator.model';

describe('string-obfuscator model', () => {
  describe('obfuscateString', () => {
    it('the characters in the middle of the string are replaced by the replacement character', () => {
      expect(obfuscateString('1234567890')).toBe('1234******');
      expect(obfuscateString('1234567890', { replacementChar: 'x' })).toBe('1234xxxxxx');
      expect(obfuscateString('1234567890', { keepFirst: 5 })).toBe('12345*****');
      expect(obfuscateString('1234567890', { keepFirst: 0, keepLast: 5 })).toBe('*****67890');
      expect(obfuscateString('1234567890', { keepFirst: 5, keepLast: 5 })).toBe('1234567890');
      expect(obfuscateString('1234567890', { keepFirst: 2, keepLast: 2, replacementChar: 'x' })).toBe('12xxxxxx90');
    });

    it('by default, the spaces are kept, they can be removed with the keepSpace option', () => {
      expect(obfuscateString('12345 67890')).toBe('1234* *****');
      expect(obfuscateString('12345 67890', { keepSpace: false })).toBe('1234*******');
    });
  });
});
