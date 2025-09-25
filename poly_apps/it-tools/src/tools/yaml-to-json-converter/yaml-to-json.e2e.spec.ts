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

test.describe('Tool - Yaml to json', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/yaml-to-json-converter');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('YAML to JSON converter - IT Tools');
  });

  test('Yaml is parsed and output clean json', async ({ page }) => {
    await page.getByTestId('input').fill('foo: bar\nlist:\n  - item\n  - key: value');

    const generatedJson = await page.getByTestId('area-content').innerText();

    expect(generatedJson.trim()).toEqual(
      `
{
   "foo": "bar",
   "list": [
      "item",
      {
         "key": "value"
      }
   ]
}
   `.trim(),
    );
  });

  test('Yaml is parsed with merge key and output correct json', async ({ page }) => {
    await page.getByTestId('input').fill(`
      default: &default
        name: ''
        age: 0

      person:
        *default

      persons:
      - <<: *default
        age: 1
      - <<: *default
        name: John
      - { age: 3, <<: *default }
      
      `);

    const generatedJson = await page.getByTestId('area-content').innerText();

    expect(generatedJson.trim()).toEqual(
      `
{
   "default": {
      "name": "",
      "age": 0
   },
   "person": {
      "name": "",
      "age": 0
   },
   "persons": [
      {
         "name": "",
         "age": 1
      },
      {
         "name": "John",
         "age": 0
      },
      {
         "age": 3,
         "name": ""
      }
   ]
}`.trim(),
    );
  });
});
