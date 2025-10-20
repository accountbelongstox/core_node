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
const { datetool } = require('#@ncore/foundation/utilities/index.js')

class Handle  {

    async init(browser, page) {
        this.browser = browser
        this.pageModus = page
        const methods = Object.getOwnPropertyNames(Handle.prototype)
            .filter(name => typeof Handle.prototype[name] === 'function' && name !== 'constructor');
        // console.log('Methods:', methods);
        console.log('Total Handle of methods:', methods.length);
    }

    async getCurrentPage(page = null) {
        page = await this.pageModus.getCurrentPage(page)
        return page
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

    async setInputBySelector(selector, value, clearBeforeInput = true, index = 0, page = null) {
        if (index > 10) {
            return;
        }
        const currentPage = await this.getCurrentPage(page);
        const inputElement = await currentPage.$(selector);
        if (!inputElement) {
            console.log(`No input element found for selector: ${selector}`);
            return;
        }
        await inputElement.click();
        if (clearBeforeInput) {
            const inputValueLength = await inputElement.evaluate(input => input.value.length);
            for (let i = 0; i < inputValueLength; i++) {
                await currentPage.keyboard.press('Backspace');
            }
        }
        console.log(`value : ${value}`)
        let array = value.split('');
        for (let i = 0; i < array.length; i++) {
            let char = array[i];
            console.log(`char : ${char}`)
            await currentPage.keyboard.type(char, { delay: datetool.randomMillisecond(30, 200) });
        }

        // for (const char of value) {
        //     await currentPage.keyboard.type(char, { delay: datetool.randomMillisecond(30, 200) });
        // }
        let currentLength = await inputElement.evaluate(input => input.value.length);
        if (currentLength != value.length) {
            console.log(`Waiting for complete input... Current length: ${currentLength}, Expected length: ${value.length}`);
            await currentPage.waitForTimeout(300);
            await this.setInputBySelector(selector, value, clearBeforeInput, ++index, page);
            await currentPage.waitForTimeout(300);
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

    async setInputByXpath(xpathExpression, value, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const inputElements = await currentPage.$x(xpathExpression);
        if (inputElements.length === 0) {
            console.log(`No input element found for XPath: ${xpathExpression}`);
        }
        await inputElements[0].type(value, { delay: 50 });
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
                        await this.setInputBySelector(selector, valueOrIndex, currentPage);
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

    async clickElementBySelector(selector, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);
        if (!element) {
            console.error(`No element found for selector: ${selector}`);
            return;
        }
        await element.click();
    }

    async clickElementByInnerText(innerText, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const selector = `//*[text()="${innerText}"]`;
        const elementHandle = await currentPage.$x(selector);

        if (!elementHandle || elementHandle.length === 0) {
            console.error(`No element found with innerText: ${innerText}`);
            return;
        }

        await elementHandle[0].click();
    }
    async clickElementByXpath(xpathExpression, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const elementHandle = await currentPage.$x(xpathExpression);

        if (elementHandle.length > 0) {
            await elementHandle[0].click();
        } else {
            console.log(`No element found for XPath: ${xpathExpression}`);
        }
    }

    async clickElementByContent(textContent, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const xpathExpression = `//*[text()="${textContent}"]`;
        const elementHandle = await currentPage.$x(xpathExpression);
        if (elementHandle.length > 0) {
            await elementHandle[0].click();
        } else {
            console.log(`No element found with text content: ${textContent}`);
        }
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


}

Handle.toString = () => '[class Handle]';
module.exports = Handle;

