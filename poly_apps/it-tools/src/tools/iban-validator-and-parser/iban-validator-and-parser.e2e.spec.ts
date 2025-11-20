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

import { type Page, expect, test } from '@playwright/test';

async function extractIbanInfo({ page }: { page: Page }) {
  const itemsLines = await page
    .locator('.c-key-value-list__item').all();

  return await Promise.all(
    itemsLines.map(async item => [
      (await item.locator('.c-key-value-list__key').textContent() ?? '').trim(),
      (await item.locator('.c-key-value-list__value').textContent() ?? '').trim(),
    ]),
  );
}

test.describe('Tool - Iban validator and parser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/iban-validator-and-parser');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('IBAN validator and parser - IT Tools');
  });

  test('iban info are extracted from a valid iban', async ({ page }) => {
    await page.getByTestId('iban-input').fill('DE89370400440532013000');

    const ibanInfo = await extractIbanInfo({ page });

    expect(ibanInfo).toEqual([
      ['Is IBAN valid ?', 'Yes'],
      ['Is IBAN a QR-IBAN ?', 'No'],
      ['Country code', 'DE'],
      ['BBAN', '370400440532013000'],
      ['IBAN friendly format', 'DE89 3704 0044 0532 0130 00'],
    ]);
  });

  test('invalid iban errors are displayed', async ({ page }) => {
    await page.getByTestId('iban-input').fill('FR7630006060011234567890189');

    const ibanInfo = await extractIbanInfo({ page });

    expect(ibanInfo).toEqual([
      ['Is IBAN valid ?', 'No'],
      ['IBAN errors', 'Wrong account bank branch checksum Wrong IBAN checksum'],
      ['Is IBAN a QR-IBAN ?', 'No'],
      ['Country code', 'N/A'],
      ['BBAN', 'N/A'],
      ['IBAN friendly format', 'FR76 3000 6060 0112 3456 7890 189'],
    ]);
  });
});
