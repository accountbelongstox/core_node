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

test.describe('Tool - IPv4 range expander', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ipv4-range-expander');
  });

  test('Has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('IPv4 range expander - IT Tools');
  });

  test('Calculates correct for valid input', async ({ page }) => {
    await page.getByPlaceholder('Start IPv4 address...').fill('192.168.1.1');
    await page.getByPlaceholder('End IPv4 address...').fill('192.168.7.255');

    expect(await page.getByTestId('start-address.old').textContent()).toEqual('192.168.1.1');
    expect(await page.getByTestId('start-address.new').textContent()).toEqual('192.168.0.0');
    expect(await page.getByTestId('end-address.old').textContent()).toEqual('192.168.7.255');
    expect(await page.getByTestId('end-address.new').textContent()).toEqual('192.168.7.255');
    expect(await page.getByTestId('addresses-in-range.old').textContent()).toEqual('1,791');
    expect(await page.getByTestId('addresses-in-range.new').textContent()).toEqual('2,048');
    expect(await page.getByTestId('cidr.old').textContent()).toEqual('');
    expect(await page.getByTestId('cidr.new').textContent()).toEqual('192.168.0.0/21');
  });

  test('Calculates correct for valid input, where first octet is lower than 128', async ({ page }) => {
    await page.getByPlaceholder('Start IPv4 address...').fill('10.0.0.1');
    await page.getByPlaceholder('End IPv4 address...').fill('10.0.0.17');

    expect(await page.getByTestId('start-address.old').textContent()).toEqual('10.0.0.1');
    expect(await page.getByTestId('start-address.new').textContent()).toEqual('10.0.0.0');
    expect(await page.getByTestId('end-address.old').textContent()).toEqual('10.0.0.17');
    expect(await page.getByTestId('end-address.new').textContent()).toEqual('10.0.0.31');
    expect(await page.getByTestId('addresses-in-range.old').textContent()).toEqual('17');
    expect(await page.getByTestId('addresses-in-range.new').textContent()).toEqual('32');
    expect(await page.getByTestId('cidr.old').textContent()).toEqual('');
    expect(await page.getByTestId('cidr.new').textContent()).toEqual('10.0.0.0/27');
  });

  test('Hides result for invalid input', async ({ page }) => {
    await page.getByPlaceholder('Start IPv4 address...').fill('192.168.1.1');
    await page.getByPlaceholder('End IPv4 address...').fill('192.168.0.255');

    await expect(page.getByTestId('result')).not.toBeVisible();
  });
});
