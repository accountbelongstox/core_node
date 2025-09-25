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

const ULID_REGEX = /[0-9A-Z]{26}/;

test.describe('Tool - ULID generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ulid-generator');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('ULID generator - IT Tools');
  });

  test('the refresh button generates a new ulid', async ({ page }) => {
    const ulid = await page.getByTestId('ulids').textContent();
    expect(ulid?.trim()).toMatch(ULID_REGEX);

    await page.getByTestId('refresh').click();
    const newUlid = await page.getByTestId('ulids').textContent();
    expect(ulid?.trim()).not.toBe(newUlid?.trim());
    expect(newUlid?.trim()).toMatch(ULID_REGEX);
  });
});
