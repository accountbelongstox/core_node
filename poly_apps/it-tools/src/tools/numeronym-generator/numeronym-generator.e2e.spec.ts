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

test.describe('Tool - Numeronym generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/numeronym-generator');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Numeronym generator - IT Tools');
  });

  test('a numeronym is generated when a word is entered', async ({ page }) => {
    await page.getByTestId('word-input').fill('internationalization');
    const numeronym = await page.getByTestId('numeronym').inputValue();

    expect(numeronym).toEqual('i18n');
  });

  test('when a word has 3 letters or less, the numeronym is the word itself', async ({ page }) => {
    await page.getByTestId('word-input').fill('abc');
    const numeronym = await page.getByTestId('numeronym').inputValue();

    expect(numeronym).toEqual('abc');
  });
});
