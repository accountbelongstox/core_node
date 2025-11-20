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
import { createToken } from './token-generator.service';

describe('token-generator', () => {
  describe('createToken', () => {
    it('should generate an empty string when all params are false', () => {
      const token = createToken({
        withLowercase: false,
        withUppercase: false,
        withNumbers: false,
        withSymbols: false,
        length: 10,
      });

      expect(token).toHaveLength(0);
    });

    it('should generate a random string with the specified length', () => {
      const createTokenWithLength = (length: number) =>
        createToken({
          withLowercase: true,
          withUppercase: true,
          withNumbers: true,
          withSymbols: true,
          length,
        });

      expect(createTokenWithLength(5)).toHaveLength(5);
      expect(createTokenWithLength(10)).toHaveLength(10);
      expect(createTokenWithLength(100)).toHaveLength(100);
    });

    it('should generate a random string with just uppercase if only withUppercase is set', () => {
      const token = createToken({
        withLowercase: false,
        withUppercase: true,
        withNumbers: false,
        withSymbols: false,
        length: 256,
      });

      expect(token).toHaveLength(256);
      expect(token).toMatch(/^[A-Z]+$/);
    });

    it('should generate a random string with just lowercase if only withLowercase is set', () => {
      const token = createToken({
        withLowercase: true,
        withUppercase: false,
        withNumbers: false,
        withSymbols: false,
        length: 256,
      });

      expect(token).toHaveLength(256);
      expect(token).toMatch(/^[a-z]+$/);
    });

    it('should generate a random string with just numbers if only withNumbers is set', () => {
      const token = createToken({
        withLowercase: false,
        withUppercase: false,
        withNumbers: true,
        withSymbols: false,
        length: 256,
      });

      expect(token).toHaveLength(256);
      expect(token).toMatch(/^[0-9]+$/);
    });

    it('should generate a random string with just symbols if only withSymbols is set', () => {
      const token = createToken({
        withLowercase: false,
        withUppercase: false,
        withNumbers: false,
        withSymbols: true,
        length: 256,
      });

      expect(token).toHaveLength(256);
      expect(token).toMatch(/^[.,;:!?./\-"'#{([-|\\@)\]=}*+]+$/);
    });

    it('should generate a random string with just letters (case incensitive) with withLowercase and withUppercase', () => {
      const token = createToken({
        withLowercase: true,
        withUppercase: true,
        withNumbers: false,
        withSymbols: false,
        length: 256,
      });

      expect(token).toHaveLength(256);
      expect(token).toMatch(/^[a-zA-Z]+$/);
    });
  });
});
