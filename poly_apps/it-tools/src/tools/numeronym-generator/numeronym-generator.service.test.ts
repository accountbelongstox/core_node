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
import { generateNumeronym } from './numeronym-generator.service';

describe('numeronym-generator service', () => {
  describe('generateNumeronym', () => {
    it('a numeronym of a word is the first letter, the number of letters between the first and the last letter, and the last letter', () => {
      expect(generateNumeronym('internationalization')).toBe('i18n');
      expect(generateNumeronym('accessibility')).toBe('a11y');
      expect(generateNumeronym('localization')).toBe('l10n');
    });
    it('a numeronym of a word with 3 letters is the word itself', () => {
      expect(generateNumeronym('abc')).toBe('abc');
    });
  });
});
