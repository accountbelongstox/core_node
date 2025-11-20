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

test.describe('Tool - XML formatter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/xml-formatter');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('XML formatter - IT Tools');
  });

  test('XML is converted into a human readable format', async ({ page }) => {
    await page.getByTestId('input').fill('<foo><bar>baz</bar><bar>baz</bar></foo>');

    const formattedXml = await page.getByTestId('area-content').innerText();

    expect(formattedXml.trim()).toEqual(`
<foo>
  <bar>baz</bar>
  <bar>baz</bar>
</foo>`.trim());
  });
});
