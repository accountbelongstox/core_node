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
import { calculateCidr } from './ipv4-range-expander.service';

describe('ipv4RangeExpander', () => {
  describe('when there are two valid ipv4 addresses given', () => {
    it('should calculate valid cidr for given addresses', () => {
      const result = calculateCidr({ startIp: '192.168.1.1', endIp: '192.168.7.255' });

      expect(result).toBeDefined();
      expect(result?.oldSize).toEqual(1791);
      expect(result?.newSize).toEqual(2048);
      expect(result?.newStart).toEqual('192.168.0.0');
      expect(result?.newEnd).toEqual('192.168.7.255');
      expect(result?.newCidr).toEqual('192.168.0.0/21');
    });

    it('should calculate valid cidr for given addresses, where first octet is lower than 128', () => {
      const result = calculateCidr({ startIp: '10.0.0.1', endIp: '10.0.0.17' });

      expect(result).toBeDefined();
      expect(result?.oldSize).toEqual(17);
      expect(result?.newSize).toEqual(32);
      expect(result?.newStart).toEqual('10.0.0.0');
      expect(result?.newEnd).toEqual('10.0.0.31');
      expect(result?.newCidr).toEqual('10.0.0.0/27');
    });

    it('should return empty result for invalid input', () => {
      expect(calculateCidr({ startIp: '192.168.7.1', endIp: '192.168.6.255' })).not.toBeDefined();
    });
  });
});
