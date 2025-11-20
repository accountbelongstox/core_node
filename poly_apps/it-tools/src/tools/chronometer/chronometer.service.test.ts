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
import { formatMs } from './chronometer.service';

describe('chronometer', () => {
  describe('formatChronometerTime', () => {
    it('format the elapsed time', () => {
      expect(formatMs(0)).toEqual('00:00.000');
      expect(formatMs(1)).toEqual('00:00.001');
      expect(formatMs(123456)).toEqual('02:03.456');
      expect(formatMs(12345600)).toEqual('03:25:45.600');
    });
  });
});
