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

import { describe, expect, test } from 'vitest';
import { darken, lighten, setOpacity } from './color.models';

describe('color models', () => {
  describe('lighten', () => {
    test('lightens a color', () => {
      expect(lighten('#000000', 10)).toBe('#0a0a0a');
      expect(lighten('#000000', 20)).toBe('#141414');
      expect(lighten('#ffffff', 30)).toBe('#ffffff');
    });

    test('lightens a color with alpha', () => {
      expect(lighten('#00000080', 10)).toBe('#0a0a0a80');
      expect(lighten('#00000080', 20)).toBe('#14141480');
      expect(lighten('#ffffff80', 30)).toBe('#ffffff80');
    });
  });

  describe('darken', () => {
    test('darkens a color', () => {
      expect(darken('#ffffff', 10)).toBe('#f5f5f5');
      expect(darken('#ffffff', 20)).toBe('#ebebeb');
      expect(darken('#000000', 30)).toBe('#000000');
    });

    test('darkens a color with alpha', () => {
      expect(darken('#ffffff80', 10)).toBe('#f5f5f580');
    });
  });

  describe('setOpacity', () => {
    test('sets the opacity of a color', () => {
      expect(setOpacity('#000000', 0.5)).toBe('#00000080');
    });

    test('sets the opacity of a color with alpha', () => {
      expect(setOpacity('#00000000', 0.5)).toBe('#00000080');
    });
  });
});
