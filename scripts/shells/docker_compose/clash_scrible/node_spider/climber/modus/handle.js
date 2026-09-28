'use strict';
const { HandleInterface } = require('../../interface/modus/handle_interface.js');
const Util = require('../../node_provider/utils.js')
const { getMethodNames, getObjectMethodNames } = require('../../utils/classUtils.js');

class Handle extends HandleInterface {
    constructor(browser, page) {
        super();
        this.browser = browser;
        this.pageModus = page;
        this.methods = getMethodNames(Handle.prototype, true, 'Handle');
        this.typeQueue = [];
        this.currentTypeOperation = null;
    }

    async getCurrentPage(page = null) {
        page = await this.pageModus.getCurrentPage(page);
        return page;
    }

    async executeJsCode(jsCode, page = null) {
        const currentPage = await this.getCurrentPage(page);
        return await currentPage.evaluate(jsCode);
    }

    async returnByJavascript(jsCode, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const wrappedJsCode = `(function() { ${jsCode} })()`;
        return await currentPage.evaluate(wrappedJsCode);
    }

    async triggerBySelector(selector, action = 'click', page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);
        if (element) {
            switch (action) {
                case 'click':
                    await element.click();
                    break;
                // ... handle other actions as needed
            }
        }
    }

    async dragAndDropElement(selector, targetX, targetY, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);
        if (element) {
            const boundingBox = await element.boundingBox();
            await currentPage.mouse.move(boundingBox.x + boundingBox.width / 2, boundingBox.y + boundingBox.height / 2);
            await currentPage.mouse.down();
            await currentPage.mouse.move(targetX, targetY);
            await currentPage.mouse.up();
        }
    }

    async loadJsFileLocal(filePath, page = null) {
        const currentPage = await this.getCurrentPage(page);
        await currentPage.addScriptTag({ path: filePath });
    }

    async loadJsFileRemote(url, page = null) {
        const currentPage = await this.getCurrentPage(page);
        await currentPage.addScriptTag({ url: url });
    }
    async setInputValue() {
        console.error('Warning: setInputValue is deprecated. Please use type() instead.');
    }

    async type(selectorOrXpath, value, options = {}) {
        value = Util.strtool.toString(value)
        const {
            clearBeforeInput = true,
            wait = false,
            timeout = 20000,
            waitTimeout = 5000
        } = options;

        const typeOperation = {
            selectorOrXpath,
            value,
            status: 'pending',
            pause: () => { this.currentTypeOperation.status = 'paused'; },
            resume: () => { this.currentTypeOperation.status = 'running'; },
            stop: () => { this.currentTypeOperation.status = 'stopped'; }
        };

        const conflictingOperation = this.typeQueue.find(op => op.selectorOrXpath === selectorOrXpath && op.status === 'running');
        if (conflictingOperation) {
            console.log(`Stopping conflicting type operation for ${selectorOrXpath}`);
            conflictingOperation.stop();
            this.typeQueue = this.typeQueue.filter(op => op !== conflictingOperation);
        }

        this.typeQueue.push(typeOperation);
        this.currentTypeOperation = typeOperation;

        const currentPage = await this.getCurrentPage();
        const startTime = Date.now();

        return new Promise(async (resolve, reject) => {
            const attemptType = async () => {
                if (Date.now() - startTime > timeout) {
                    typeOperation.status = 'timeout';
                    reject(new Error(`Timeout: Failed to type "${value}" into ${selectorOrXpath}`));
                    return;
                }

                if (typeOperation.status === 'stopped') {
                    resolve(false);
                    return;
                }

                if (typeOperation.status === 'paused') {
                    setTimeout(attemptType, 100);
                    return;
                }

                try {
                    let element;
                    if (wait) {
                        element = await this.waitForElement(selectorOrXpath, waitTimeout);
                    } else {
                        element = await this.getElement(selectorOrXpath);
                    }

                    if (!element) {
                        setTimeout(attemptType, 100);
                        return;
                    }

                    await element.click();

                    if (clearBeforeInput) {
                        await element.evaluate(el => el.value = '');
                    }

                    await element.type(value, { delay: Util.date.randomMillisecond(30, 200) });

                    const inputValue = await element.evaluate(el => el.value);
                    if (inputValue === value) {
                        typeOperation.status = 'completed';
                        resolve(true);
                    } else {
                        setTimeout(attemptType, 100);
                    }
                } catch (error) {
                    console.error(`Error during type operation: ${error.message}`);
                    console.warn(`selectorOrXpath`,selectorOrXpath,`value`,value);
                    setTimeout(attemptType, 100);
                }
            };

            attemptType();
        }).finally(() => {
            this.typeQueue = this.typeQueue.filter(op => op !== typeOperation);
            if (this.currentTypeOperation === typeOperation) {
                this.currentTypeOperation = null;
            }
        });
    }

    async waitForElement(selectorOrXpath, timeout) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const element = await this.getElement(selectorOrXpath);
            if (element) return element;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return null;
    }

    async getElement(selectorOrXpath) {
        const currentPage = await this.getCurrentPage();
        if (selectorOrXpath.startsWith('//') || selectorOrXpath.startsWith('(//')) {
            const elements = await currentPage.$x(selectorOrXpath);
            return elements[0];
        } else {
            return await currentPage.$(selectorOrXpath);
        }
    }

    async clearInputBySelector(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const inputElement = await currentPage.$(selector);
        if (!inputElement) {
            console.log(`No input element found for selector: ${selector}`);
            return;
        }
        await inputElement.focus();
        const inputValue = await currentPage.evaluate(el => el.value, inputElement);
        const inputValueLength = inputValue.length;
        for (let i = 0; i < inputValueLength; i++) {
            await currentPage.keyboard.press('Backspace');
        }
    }

    async setSelectValueBySelector(selector, valueOrIndex, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);
        if (element) {
            if (typeof valueOrIndex === 'number') {
                await currentPage.select(selector, valueOrIndex.toString());
            } else {
                await currentPage.select(selector, valueOrIndex);
            }
        }
    }

    async setCheckboxValueBySelector(selector, valueOrIndex, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);
        if (element) {
            const isChecked = await currentPage.evaluate(el => el.checked, element);
            if ((isChecked && !valueOrIndex) || (!isChecked && valueOrIndex)) {
                await element.click();
            }
        }
    }

    async setRadioValueBySelector(selector, valueOrIndex, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);
        if (element) {
            const isOn = await currentPage.evaluate(el => el.checked, element);
            if (!isOn) {
                await element.click();
            }
        }
    }

    async setElementValueBySelector(selector, valueOrIndex, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const elementType = await currentPage.evaluate(selector => {
            const element = document.querySelector(selector);
            return element.tagName.toLowerCase();
        }, selector);

        switch (elementType) {
            case 'select':
                await this.setSelectValueBySelector(selector, valueOrIndex, currentPage);
                break;
            case 'input':
                const type = await currentPage.evaluate(selector => {
                    const element = document.querySelector(selector);
                    return element.type.toLowerCase();
                }, selector);
                switch (type) {
                    case 'checkbox':
                        await this.setCheckboxValueBySelector(selector, valueOrIndex, currentPage);
                        break;
                    case 'radio':
                        await this.setRadioValueBySelector(selector, valueOrIndex, currentPage);
                        break;
                    default:
                        await this.type(selector, valueOrIndex, currentPage);
                }
                break;
            // ... handle other element types as needed
        }
    }

    async getSelectValueBySelector(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        return await currentPage.evaluate(selector => {
            const element = document.querySelector(selector);
            return element.options[element.selectedIndex].value;
        }, selector);
    }

    async getCheckboxValueBySelector(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        return await currentPage.evaluate(selector => {
            const element = document.querySelector(selector);
            return element.checked;
        }, selector);
    }

    async getRadioValueBySelector(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        return await currentPage.evaluate(selector => {
            const element = document.querySelector(selector);
            return element.checked;
        }, selector);
    }

    async getElementValueBySelector(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        return await currentPage.evaluate(selector => {
            const element = document.querySelector(selector);
            if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
                return element.value;
            } else if (element.tagName.toLowerCase() === 'select') {
                return element.options[element.selectedIndex].value;
            }
            // ... handle other element types as needed
        }, selector);
    }

    async getCoordinatesBySelector(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);
        if (element) {
            const boundingBox = await element.boundingBox();
            if (boundingBox) {
                return {
                    x: boundingBox.x,
                    y: boundingBox.y
                };
            }
        }
        return null;
    }

    async executeJsIfElementExists(selector, jsCode, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);
        if (element) {
            return await currentPage.evaluate(jsCode);
        }
        return null;
    }

    async setFocusBySelector(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);
        if (element) {
            await element.focus();
        }
    }

    async click(target, page = null) {
        const currentPage = await this.getCurrentPage(page);
        let element = null;
        try {
            if (typeof target === 'string') {
                if (target.startsWith('//')) {
                    const elements = await currentPage.$x(target);
                    if (elements.length > 0) {
                        element = elements[0];
                    }
                } else {
                    element = await currentPage.$(target);
                }
            }

            if (element) {
                await element.click();
                console.log(`Clicked element: ${target}`);
                return true;
            } else {
                console.error(`No element found for: ${target}`);
                return false;
            }
        } catch (error) {
            console.error(`Error clicking element: ${target}`, error);
            return false;
        }
    }

    async clickWait(clickSelector, timeout = 10000, waitSelector, page = null) {
        if (!waitSelector) waitSelector = clickSelector;
        const currentPage = await this.getCurrentPage(page);
        const startTime = Date.now();

        return new Promise((resolve) => {
            const attemptClick = async () => {
                if (Date.now() - startTime >= timeout) {
                    console.log(`Timeout: Element not found or clickable within ${timeout}ms: ${waitSelector}`);
                    resolve(false);
                    return;
                }

                try {
                    let clicked = await this.click(clickSelector, currentPage);
                    let element = null;
                    if (waitSelector.startsWith('//')) {
                        const elements = await currentPage.$x(waitSelector);
                        if (elements.length > 0) {
                            element = elements[0];
                        }
                    } else {
                        element = await currentPage.$(waitSelector);
                    }

                    if (clicked && element) {
                        console.log(`Element found: ${waitSelector}`);
                        resolve(true);
                        return;
                    }
                } catch (error) {
                    console.error(`Error during click or element search: ${error.message}`);
                }
                setTimeout(attemptClick, 500);
            };

            attemptClick();
        });
    }

    async clickByInnerText(innerText, page = null) {
        const xpathExpression = `//*[text()="${innerText}"]`;
        return await this.click(xpathExpression, page);
    }

    async clickByContent(textContent, page = null) {
        const xpathExpression = `//*[contains(text(),"${textContent}")]`;
        return await this.click(xpathExpression, page);
    }

    async removeElementBySelector(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        await currentPage.evaluate(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.remove();
            }
        }, selector);
    }

    async setInnerHtmlBySelector(selector, html, page = null) {
        const currentPage = await this.getCurrentPage(page);
        await currentPage.evaluate((selector, html) => {
            const element = document.querySelector(selector);
            if (element) {
                element.innerHTML = html;
            }
        }, selector, html);
    }

    async insertHtmlBeforeElementBySelector(selector, html, page = null) {
        const currentPage = await this.getCurrentPage(page);
        await currentPage.evaluate((selector, html) => {
            const element = document.querySelector(selector);
            if (element) {
                element.insertAdjacentHTML('beforebegin', html);
            }
        }, selector, html);
    }

    async insertHtmlAfterElementBySelector(selector, html, page = null) {
        const currentPage = await this.getCurrentPage(page);
        await currentPage.evaluate((selector, html) => {
            const element = document.querySelector(selector);
            if (element) {
                element.insertAdjacentHTML('afterend', html);
            }
        }, selector, html);
    }

    async insertHtmlInsideElementBySelector(selector, html, page = null) {
        const currentPage = await this.getCurrentPage(page);
        await currentPage.evaluate((selector, html) => {
            const element = document.querySelector(selector);
            if (element) {
                element.innerHTML = html;
            }
        }, selector, html);
    }

    async insertHtmlInsideEndOfElementBySelector(selector, html, page = null) {
        const currentPage = await this.getCurrentPage(page);
        await currentPage.evaluate((selector, html) => {
            const element = document.querySelector(selector);
            if (element) {
                element.insertAdjacentHTML('beforeend', html);
            }
        }, selector, html);
    }

    async createAndInsertHtmlElement(htmlString, targetSelector = 'BODY', position = 'beforeend', jsToExecute = null, page = null) {
        const currentPage = await this.getCurrentPage(page);
        await currentPage.evaluate((htmlString, targetSelector, position) => {
            const targetElement = document.querySelector(targetSelector);
            if (targetElement) {
                targetElement.insertAdjacentHTML(position, htmlString);
            }
        }, htmlString, targetSelector, position);

        if (jsToExecute) {
            await currentPage.evaluate(jsToExecute);
        }
    }
    async getScrollHeightBySelector(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        return await currentPage.evaluate(selector => {
            const element = document.querySelector(selector);
            return element ? element.scrollHeight : null;
        }, selector);
    }

    async scrollToPositionBySelector(selector, position = 'top', page = null) {
        const currentPage = await this.getCurrentPage(page);
        await currentPage.evaluate((selector, position) => {
            const element = document.querySelector(selector);
            if (element) {
                switch (position) {
                    case 'top':
                        element.scrollTop = 0;
                        break;
                    case 'bottom':
                        element.scrollTop = element.scrollHeight;
                        break;
                    default:
                        element.scrollTop = position;
                        break;
                }
            }
        }, selector, position);
    }

    async scrollToBottomBySelector(selector, page = null) {
        await this.scrollToPositionBySelector(selector, 'bottom', page);
    }

    async horizontalSwipeBySelector(selector, length, direction = 'right', page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);

        if (element) {
            const boundingBox = await element.boundingBox();

            let startX = boundingBox.x + boundingBox.width / 2;
            let endX = direction === 'right' ? startX + length : startX - length;

            await currentPage.mouse.move(startX, boundingBox.y + boundingBox.height / 2);
            await currentPage.mouse.down();
            await currentPage.mouse.move(endX, boundingBox.y + boundingBox.height / 2);
            await currentPage.mouse.up();
        }
    }

    async verticalSwipeBySelector(selector, length, direction = 'down', page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);

        if (element) {
            const boundingBox = await element.boundingBox();

            let startY = boundingBox.y + boundingBox.height / 2;
            let endY = direction === 'down' ? startY + length : startY - length;

            await currentPage.mouse.move(boundingBox.x + boundingBox.width / 2, startY);
            await currentPage.mouse.down();
            await currentPage.mouse.move(boundingBox.x + boundingBox.width / 2, endY);
            await currentPage.mouse.up();
        }
    }

    async clickParentOrChild(selector, parentLevels = 0, childSelector = null, timeout = 10000, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const startTime = Date.now();

        return new Promise((resolve) => {
            const attemptClick = async () => {
                if (Date.now() - startTime >= timeout) {
                    console.log(`Timeout: Element not found or clickable within ${timeout}ms: ${selector}`);
                    resolve(false);
                    return;
                }

                try {
                    const element = await currentPage.$(selector);
                    if (!element) {
                        setTimeout(attemptClick, 500);
                        return;
                    }

                    let targetElement = element;
                    for (let i = 0; i < parentLevels; i++) {
                        const parent = await targetElement.evaluateHandle(el => el.parentElement);
                        if (!parent) {
                            console.error(`Cannot find parent at level ${i + 1}`);
                            setTimeout(attemptClick, 500);
                            return;
                        }
                        targetElement = parent;
                    }
                    console.log(`targetElement`,targetElement)
                    if (childSelector) {
                        const childElement = await targetElement.$(childSelector);
                        if (childElement) {
                            targetElement = childElement;
                        } else {
                            console.error(`No child element found for selector: ${childSelector}`);
                            setTimeout(attemptClick, 500);
                            return;
                        }
                    }

                    await targetElement.click();
                    console.log(`Clicked element: ${childSelector || selector} (Parent level: ${parentLevels})`);
                    resolve(true);
                } catch (error) {
                    console.error(`Error in clickParentOrChild: ${error.message}`);
                    setTimeout(attemptClick, 500);
                }
            };

            attemptClick();
        });
    }

}

Handle.toString = () => '[class Handle]';
module.exports = Handle;