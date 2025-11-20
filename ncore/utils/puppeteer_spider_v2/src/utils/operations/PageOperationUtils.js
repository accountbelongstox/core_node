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

'use strict';

const logger = require('#@logger');
const BaseUtils = require('../base/BaseUtils');

class PageOperationUtils extends BaseUtils {
    constructor() {
        super();
    }

    async safeClick(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            await page.click(selector);
            logger.debug(`Successfully clicked element: ${selector}`);
            return true;
        }, options);
    }

    async safeDoubleClick(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            await page.click(selector, { clickCount: 2 });
            logger.debug(`Successfully double-clicked element: ${selector}`);
            return true;
        }, options);
    }

    async safeRightClick(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            await page.click(selector, { button: 'right' });
            logger.debug(`Successfully right-clicked element: ${selector}`);
            return true;
        }, options);
    }

    async safeType(page, selector, text, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            
            if (options.clearFirst !== false) {
                await page.click(selector, { clickCount: 3 });
                await page.keyboard.down('Control');
                await page.keyboard.press('KeyA');
                await page.keyboard.up('Control');
            }
            
            await page.type(selector, text, { delay: options.typeDelay || 50 });
            logger.debug(`Successfully typed text into element: ${selector}`);
            return true;
        }, options);
    }

    async safeClear(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            await page.click(selector, { clickCount: 3 });
            await page.keyboard.down('Control');
            await page.keyboard.press('KeyA');
            await page.keyboard.up('Control');
            await page.keyboard.press('Delete');
            logger.debug(`Successfully cleared element: ${selector}`);
            return true;
        }, options);
    }

    async safeSelect(page, selector, value, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            await page.select(selector, value);
            logger.debug(`Successfully selected value ${value} in element: ${selector}`);
            return true;
        }, options);
    }

    async safeSelectByText(page, selector, text, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            
            const optionValue = await page.evaluate((sel, searchText) => {
                const select = document.querySelector(sel);
                if (!select) return null;
                
                const options = Array.from(select.options);
                const option = options.find(opt => opt.textContent.includes(searchText));
                return option ? option.value : null;
            }, selector, text);
            
            if (optionValue) {
                await page.select(selector, optionValue);
                logger.debug(`Successfully selected text "${text}" in element: ${selector}`);
            } else {
                throw new Error(`Option with text "${text}" not found in select: ${selector}`);
            }
            
            return true;
        }, options);
    }

    async safeHover(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            await page.hover(selector);
            logger.debug(`Successfully hovered over element: ${selector}`);
            return true;
        }, options);
    }

    async safeFocus(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            await page.focus(selector);
            logger.debug(`Successfully focused element: ${selector}`);
            return true;
        }, options);
    }

    async safeBlur(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (element) element.blur();
            }, selector);
            logger.debug(`Successfully blurred element: ${selector}`);
            return true;
        }, options);
    }

    async safeCheck(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            await page.check(selector);
            logger.debug(`Successfully checked element: ${selector}`);
            return true;
        }, options);
    }

    async safeUncheck(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            await page.uncheck(selector);
            logger.debug(`Successfully unchecked element: ${selector}`);
            return true;
        }, options);
    }

    async safePressKey(page, key, options = {}) {
        return this.safeExecute(page, async () => {
            await page.keyboard.press(key);
            logger.debug(`Successfully pressed key: ${key}`);
            return true;
        }, options);
    }

    async safePressKeys(page, keys, options = {}) {
        return this.safeExecute(page, async () => {
            for (const key of keys) {
                await page.keyboard.press(key);
                await this.wait(options.keyDelay || 100);
            }
            logger.debug(`Successfully pressed keys: ${keys.join(', ')}`);
            return true;
        }, options);
    }

    async safeTypeText(page, text, options = {}) {
        return this.safeExecute(page, async () => {
            await page.keyboard.type(text, { delay: options.typeDelay || 50 });
            logger.debug(`Successfully typed text: ${text}`);
            return true;
        }, options);
    }

    async safeDragAndDrop(page, sourceSelector, targetSelector, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(sourceSelector, { timeout: options.timeout || this.defaultTimeout });
            await page.waitForSelector(targetSelector, { timeout: options.timeout || this.defaultTimeout });
            
            await page.dragAndDrop(sourceSelector, targetSelector);
            logger.debug(`Successfully dragged from ${sourceSelector} to ${targetSelector}`);
            return true;
        }, options);
    }

    async safeUploadFile(page, selector, filePath, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            
            const fileInput = await page.$(selector);
            if (!fileInput) {
                throw new Error(`File input not found: ${selector}`);
            }
            
            await fileInput.uploadFile(filePath);
            logger.debug(`Successfully uploaded file ${filePath} to element: ${selector}`);
            return true;
        }, options);
    }

    async safeSubmitForm(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            await page.waitForSelector(selector, { timeout: options.timeout || this.defaultTimeout });
            await page.click(selector);
            logger.debug(`Successfully submitted form: ${selector}`);
            return true;
        }, options);
    }

    async safeClickAndWaitForNavigation(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            const navigationPromise = page.waitForNavigation({ 
                timeout: options.timeout || this.defaultTimeout 
            });
            
            await page.click(selector);
            await navigationPromise;
            
            logger.debug(`Successfully clicked and navigated: ${selector}`);
            return true;
        }, options);
    }

    async safeClickAndWaitForResponse(page, selector, urlPattern, options = {}) {
        return this.safeExecute(page, async () => {
            const responsePromise = page.waitForResponse(response => 
                response.url().includes(urlPattern)
            );
            
            await page.click(selector);
            const response = await responsePromise;
            
            logger.debug(`Successfully clicked and got response: ${selector}`);
            return response;
        }, options);
    }

    async safeClickAndWaitForDownload(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            const downloadPromise = page.waitForEvent('download');
            
            await page.click(selector);
            const download = await downloadPromise;
            
            logger.debug(`Successfully clicked and started download: ${selector}`);
            return download;
        }, options);
    }

    async safeClickAndWaitForPopup(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            const popupPromise = page.waitForEvent('popup');
            
            await page.click(selector);
            const popup = await popupPromise;
            
            logger.debug(`Successfully clicked and opened popup: ${selector}`);
            return popup;
        }, options);
    }

    async safeClickAndWaitForDialog(page, selector, options = {}) {
        return this.safeExecute(page, async () => {
            const dialogPromise = page.waitForEvent('dialog');
            
            await page.click(selector);
            const dialog = await dialogPromise;
            
            logger.debug(`Successfully clicked and opened dialog: ${selector}`);
            return dialog;
        }, options);
    }

    async safeClickAndWaitForElement(page, selector, waitSelector, options = {}) {
        return this.safeExecute(page, async () => {
            const elementPromise = page.waitForSelector(waitSelector, { 
                timeout: options.timeout || this.defaultTimeout 
            });
            
            await page.click(selector);
            const element = await elementPromise;
            
            logger.debug(`Successfully clicked and element appeared: ${selector} -> ${waitSelector}`);
            return element;
        }, options);
    }

    async safeClickAndWaitForElementToDisappear(page, selector, waitSelector, options = {}) {
        return this.safeExecute(page, async () => {
            const elementPromise = page.waitForSelector(waitSelector, { 
                hidden: true,
                timeout: options.timeout || this.defaultTimeout 
            });
            
            await page.click(selector);
            await elementPromise;
            
            logger.debug(`Successfully clicked and element disappeared: ${selector} -> ${waitSelector}`);
            return true;
        }, options);
    }
}

module.exports = PageOperationUtils;
