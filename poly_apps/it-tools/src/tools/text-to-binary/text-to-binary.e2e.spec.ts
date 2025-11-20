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

test.describe('Tool - Text to ASCII binary', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/text-to-binary');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Text to ASCII binary - IT Tools');
  });

  test('Text to binary conversion', async ({ page }) => {
    await page.getByTestId('text-to-binary-input').fill('it-tools');
    const binary = await page.getByTestId('text-to-binary-output').inputValue();

    expect(binary).toEqual('01101001 01110100 00101101 01110100 01101111 01101111 01101100 01110011');
  });

  test('Binary to text conversion', async ({ page }) => {
    await page.getByTestId('binary-to-text-input').fill('01101001 01110100 00101101 01110100 01101111 01101111 01101100 01110011');
    const text = await page.getByTestId('binary-to-text-output').inputValue();

    expect(text).toEqual('it-tools');
  });
});
