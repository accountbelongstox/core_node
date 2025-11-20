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
import { convert } from './list-converter.models';
import type { ConvertOptions } from './list-converter.types';

describe('list-converter', () => {
  describe('convert', () => {
    it('should convert a given list', () => {
      const options: ConvertOptions = {
        separator: ', ',
        trimItems: true,
        removeDuplicates: true,
        itemPrefix: '"',
        itemSuffix: '"',
        listPrefix: '',
        listSuffix: '',
        reverseList: false,
        sortList: null,
        lowerCase: false,
        keepLineBreaks: false,
      };
      const input = `
        1
        2
        
        3
        3
        4
        `;
      expect(convert(input, options)).toEqual('"1", "2", "3", "4"');
    });

    it('should return an empty value for an empty input', () => {
      const options: ConvertOptions = {
        separator: ', ',
        trimItems: true,
        removeDuplicates: true,
        itemPrefix: '',
        itemSuffix: '',
        listPrefix: '',
        listSuffix: '',
        reverseList: false,
        sortList: null,
        lowerCase: false,
        keepLineBreaks: false,
      };
      expect(convert('', options)).toEqual('');
    });

    it('should keep line breaks', () => {
      const options: ConvertOptions = {
        separator: '',
        trimItems: true,
        itemPrefix: '<li>',
        itemSuffix: '</li>',
        listPrefix: '<ul>',
        listSuffix: '</ul>',
        keepLineBreaks: true,
        lowerCase: false,
        removeDuplicates: false,
        reverseList: false,
        sortList: null,
      };
      const input = `
        1
        2
        3
        `;
      const expected = `<ul>
<li>1</li>
<li>2</li>
<li>3</li>
</ul>`;
      expect(convert(input, options)).toEqual(expected);
    });
  });
});
