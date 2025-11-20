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

import _ from 'lodash';
import { describe, expect, it } from 'vitest';
import { booleanToHumanReadable, isNotThrowing } from './boolean';

describe('boolean utils', () => {
  describe('isNotThrowing', () => {
    it('should return if the call throws or false otherwise', () => {
      expect(isNotThrowing(_.noop)).to.eql(true);
      expect(
        isNotThrowing(() => {
          throw new Error('message');
        }),
      ).to.eql(false);
    });
  });

  describe('booleanToHumanReadable', () => {
    it('should return "Yes" if the value is true and "No" otherwise', () => {
      expect(booleanToHumanReadable(true)).to.eql('Yes');
      expect(booleanToHumanReadable(false)).to.eql('No');
    });
  });
});
