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

test.describe('Tool - OTP code generator', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Date.now = () => 1609477200000; // Jan 1, 2021
    });
    await page.goto('/otp-generator');
  });

  test('Has title', async ({ page }) => {
    await expect(page).toHaveTitle('OTP code generator - IT Tools');
  });

  test('Secret hexa value is computed from provided secret', async ({ page }) => {
    await page.getByPlaceholder('Paste your TOTP secret...').fill('ITTOOLS');

    const secretInHex = await page.getByPlaceholder('Secret in hex will be displayed here').inputValue();

    expect(secretInHex).toEqual('44e6e72e02');
  });

  test('OTP a generated from the provided secret', async ({ page }) => {
    await page.getByPlaceholder('Paste your TOTP secret...').fill('ITTOOLS');

    const previousOtp = await page.getByTestId('previous-otp').innerText();
    const currentOtp = await page.getByTestId('current-otp').innerText();
    const nextOtp = await page.getByTestId('next-otp').innerText();

    expect(previousOtp.trim()).toEqual('028034');
    expect(currentOtp.trim()).toEqual('162195');
    expect(nextOtp.trim()).toEqual('452815');
  });

  test('You can generate a new random secret', async ({ page }) => {
    const initialSecret = await page.getByPlaceholder('Paste your TOTP secret...').inputValue();
    await page
      .locator('div')
      .filter({ hasText: /^Secret$/ })
      .getByRole('button')
      .click();

    const newSecret = await page.getByPlaceholder('Paste your TOTP secret...').inputValue();

    expect(newSecret).not.toEqual(initialSecret);
  });
});
