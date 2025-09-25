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
import { convertAsciiBinaryToText, convertTextToAsciiBinary } from './text-to-binary.models';

describe('text-to-binary', () => {
  describe('convertTextToAsciiBinary', () => {
    it('a text string is converted to its ascii binary representation', () => {
      expect(convertTextToAsciiBinary('A')).toBe('01000001');
      expect(convertTextToAsciiBinary('hello')).toBe('01101000 01100101 01101100 01101100 01101111');
      expect(convertTextToAsciiBinary('')).toBe('');
    });
    it('the separator between octets can be changed', () => {
      expect(convertTextToAsciiBinary('hello', { separator: '' })).toBe('0110100001100101011011000110110001101111');
    });
  });

  describe('convertAsciiBinaryToText', () => {
    it('an ascii binary string is converted to its text representation', () => {
      expect(convertAsciiBinaryToText('01101000 01100101 01101100 01101100 01101111')).toBe('hello');
      expect(convertAsciiBinaryToText('01000001')).toBe('A');
      expect(convertTextToAsciiBinary('')).toBe('');
    });

    it('the given binary string is cleaned before conversion', () => {
      expect(convertAsciiBinaryToText('  01000 001garbage')).toBe('A');
    });

    it('throws an error if the given binary string as no complete octet', () => {
      expect(() => convertAsciiBinaryToText('010000011')).toThrow('Invalid binary string');
      expect(() => convertAsciiBinaryToText('1')).toThrow('Invalid binary string');
    });
  });
});
