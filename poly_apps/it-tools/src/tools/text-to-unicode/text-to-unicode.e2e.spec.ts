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

import { expect, test } from '@playwright/test';

test.describe('Tool - Text to Unicode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/text-to-unicode');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Text to Unicode - IT Tools');
  });

  test('Text to unicode conversion', async ({ page }) => {
    await page.getByTestId('text-to-unicode-input').fill('it-tools');
    const unicode = await page.getByTestId('text-to-unicode-output').inputValue();

    expect(unicode).toEqual('&#105;&#116;&#45;&#116;&#111;&#111;&#108;&#115;');
  });

  test('Unicode to text conversion', async ({ page }) => {
    await page.getByTestId('unicode-to-text-input').fill('&#105;&#116;&#45;&#116;&#111;&#111;&#108;&#115;');
    const text = await page.getByTestId('unicode-to-text-output').inputValue();

    expect(text).toEqual('it-tools');
  });
});
