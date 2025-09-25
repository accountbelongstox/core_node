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

test.describe('Tool - Password strength analyser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/password-strength-analyser');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Password strength analyser - IT Tools');
  });

  test('Computes the brute force attack time of a password', async ({ page }) => {
    await page.getByTestId('password-input').fill('ABCabc123!@#');

    const crackDuration = await page.getByTestId('crack-duration').textContent();

    expect(crackDuration).toEqual('15,091 millennia, 3 centuries');
  });
});
