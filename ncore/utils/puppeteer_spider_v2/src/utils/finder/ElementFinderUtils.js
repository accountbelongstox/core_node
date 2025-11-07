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

class ElementFinderUtils extends BaseUtils {
    constructor() {
        super();
    }

    async waitForElement(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const visible = options.visible !== false;
        
        try {
            const element = await page.waitForSelector(selector, { 
                timeout, 
                visible 
            });
            logger.debug(`Element found: ${selector}`);
            return element;
        } catch (error) {
            logger.error(`Element not found: ${selector}`, error);
            throw error;
        }
    }

    async waitForElements(page, selectors, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const visible = options.visible !== false;
        const results = {};
        
        try {
            const promises = selectors.map(async (selector) => {
                try {
                    const element = await page.waitForSelector(selector, { 
                        timeout, 
                        visible 
                    });
                    return { selector, element, found: true };
                } catch (error) {
                    return { selector, element: null, found: false, error };
                }
            });
            
            const results = await Promise.all(promises);
            results.forEach(result => {
                results[result.selector] = result;
            });
            
            logger.debug(`Elements search completed for ${selectors.length} selectors`);
            return results;
        } catch (error) {
            logger.error('Failed to wait for elements:', error);
            throw error;
        }
    }

    async waitForAnyElement(page, selectors, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const visible = options.visible !== false;
        
        try {
            const promises = selectors.map(selector => 
                page.waitForSelector(selector, { timeout, visible })
                    .then(element => ({ selector, element }))
                    .catch(() => null)
            );
            
            const results = await Promise.allSettled(promises);
            const found = results.find(result => 
                result.status === 'fulfilled' && result.value !== null
            );
            
            if (found) {
                logger.debug(`Element found: ${found.value.selector}`);
                return found.value;
            }
            
            throw new Error(`None of the elements found: ${selectors.join(', ')}`);
        } catch (error) {
            logger.error('Failed to wait for any element:', error);
            throw error;
        }
    }

    async waitForElementToBeVisible(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForSelector(selector, { 
                timeout, 
                visible: true 
            });
            logger.debug(`Element is visible: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element not visible: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToBeHidden(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForSelector(selector, { 
                timeout, 
                hidden: true 
            });
            logger.debug(`Element is hidden: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element not hidden: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToDisappear(page, selector, options = {}) {
        return this.waitForElementToBeHidden(page, selector, options);
    }

    async waitForElementToAppear(page, selector, options = {}) {
        return this.waitForElementToBeVisible(page, selector, options);
    }

    async waitForElementCount(page, selector, count, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel, expectedCount) => {
                    const elements = document.querySelectorAll(sel);
                    return elements.length === expectedCount;
                },
                { timeout },
                selector, count
            );
            logger.debug(`Element count ${count} found for: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element count ${count} not found for: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToHaveText(page, selector, text, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel, expectedText) => {
                    const element = document.querySelector(sel);
                    return element && element.textContent.includes(expectedText);
                },
                { timeout },
                selector, text
            );
            logger.debug(`Element has text "${text}": ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element does not have text "${text}": ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToHaveAttribute(page, selector, attribute, value, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel, attr, expectedValue) => {
                    const element = document.querySelector(sel);
                    return element && element.getAttribute(attr) === expectedValue;
                },
                { timeout },
                selector, attribute, value
            );
            logger.debug(`Element has attribute ${attribute}="${value}": ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element does not have attribute ${attribute}="${value}": ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToHaveClass(page, selector, className, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel, expectedClass) => {
                    const element = document.querySelector(sel);
                    return element && element.classList.contains(expectedClass);
                },
                { timeout },
                selector, className
            );
            logger.debug(`Element has class "${className}": ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element does not have class "${className}": ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToNotHaveClass(page, selector, className, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel, expectedClass) => {
                    const element = document.querySelector(sel);
                    return element && !element.classList.contains(expectedClass);
                },
                { timeout },
                selector, className
            );
            logger.debug(`Element does not have class "${className}": ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element still has class "${className}": ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToBeEnabled(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel) => {
                    const element = document.querySelector(sel);
                    return element && !element.disabled;
                },
                { timeout },
                selector
            );
            logger.debug(`Element is enabled: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element is not enabled: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToBeDisabled(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel) => {
                    const element = document.querySelector(sel);
                    return element && element.disabled;
                },
                { timeout },
                selector
            );
            logger.debug(`Element is disabled: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element is not disabled: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToBeChecked(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel) => {
                    const element = document.querySelector(sel);
                    return element && element.checked;
                },
                { timeout },
                selector
            );
            logger.debug(`Element is checked: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element is not checked: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToBeUnchecked(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel) => {
                    const element = document.querySelector(sel);
                    return element && !element.checked;
                },
                { timeout },
                selector
            );
            logger.debug(`Element is unchecked: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element is not unchecked: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToHaveValue(page, selector, value, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel, expectedValue) => {
                    const element = document.querySelector(sel);
                    return element && element.value === expectedValue;
                },
                { timeout },
                selector, value
            );
            logger.debug(`Element has value "${value}": ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element does not have value "${value}": ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToContainValue(page, selector, value, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel, expectedValue) => {
                    const element = document.querySelector(sel);
                    return element && element.value.includes(expectedValue);
                },
                { timeout },
                selector, value
            );
            logger.debug(`Element contains value "${value}": ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element does not contain value "${value}": ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToBeFocused(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel) => {
                    const element = document.querySelector(sel);
                    return element && element === document.activeElement;
                },
                { timeout },
                selector
            );
            logger.debug(`Element is focused: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element is not focused: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToBeInViewport(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel) => {
                    const element = document.querySelector(sel);
                    if (!element) return false;
                    
                    const rect = element.getBoundingClientRect();
                    return rect.top >= 0 && 
                           rect.left >= 0 && 
                           rect.bottom <= window.innerHeight && 
                           rect.right <= window.innerWidth;
                },
                { timeout },
                selector
            );
            logger.debug(`Element is in viewport: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element is not in viewport: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToBeOutOfViewport(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel) => {
                    const element = document.querySelector(sel);
                    if (!element) return true;
                    
                    const rect = element.getBoundingClientRect();
                    return rect.bottom < 0 || 
                           rect.top > window.innerHeight || 
                           rect.right < 0 || 
                           rect.left > window.innerWidth;
                },
                { timeout },
                selector
            );
            logger.debug(`Element is out of viewport: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element is not out of viewport: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToHaveSize(page, selector, width, height, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel, expectedWidth, expectedHeight) => {
                    const element = document.querySelector(sel);
                    if (!element) return false;
                    
                    const rect = element.getBoundingClientRect();
                    return rect.width === expectedWidth && rect.height === expectedHeight;
                },
                { timeout },
                selector, width, height
            );
            logger.debug(`Element has size ${width}x${height}: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element does not have size ${width}x${height}: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToHavePosition(page, selector, x, y, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel, expectedX, expectedY) => {
                    const element = document.querySelector(sel);
                    if (!element) return false;
                    
                    const rect = element.getBoundingClientRect();
                    return Math.abs(rect.left - expectedX) < 1 && Math.abs(rect.top - expectedY) < 1;
                },
                { timeout },
                selector, x, y
            );
            logger.debug(`Element has position ${x},${y}: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element does not have position ${x},${y}: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToHaveStyle(page, selector, property, value, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel, prop, expectedValue) => {
                    const element = document.querySelector(sel);
                    if (!element) return false;
                    
                    const style = window.getComputedStyle(element);
                    return style[prop] === expectedValue;
                },
                { timeout },
                selector, property, value
            );
            logger.debug(`Element has style ${property}="${value}": ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element does not have style ${property}="${value}": ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToHaveCSS(page, selector, property, value, options = {}) {
        return this.waitForElementToHaveStyle(page, selector, property, value, options);
    }

    async waitForElementToHaveAnimation(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel) => {
                    const element = document.querySelector(sel);
                    if (!element) return false;
                    
                    const style = window.getComputedStyle(element);
                    return style.animationName !== 'none' || style.transitionProperty !== 'none';
                },
                { timeout },
                selector
            );
            logger.debug(`Element has animation: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element does not have animation: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToFinishAnimation(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel) => {
                    const element = document.querySelector(sel);
                    if (!element) return true;
                    
                    const style = window.getComputedStyle(element);
                    return style.animationName === 'none' && style.transitionProperty === 'none';
                },
                { timeout },
                selector
            );
            logger.debug(`Element finished animation: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element did not finish animation: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToLoad(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        
        try {
            await page.waitForFunction(
                (sel) => {
                    const element = document.querySelector(sel);
                    if (!element) return false;
                    
                    if (element.tagName === 'IMG') {
                        return element.complete && element.naturalHeight !== 0;
                    }
                    
                    return true;
                },
                { timeout },
                selector
            );
            logger.debug(`Element loaded: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element did not load: ${selector}`, error);
            throw error;
        }
    }

    async waitForElementToBeStable(page, selector, options = {}) {
        const timeout = options.timeout || this.defaultTimeout;
        const stabilityTime = options.stabilityTime || 1000;
        
        try {
            let lastPosition = null;
            let stableCount = 0;
            
            await page.waitForFunction(
                (sel, stabilityTime) => {
                    const element = document.querySelector(sel);
                    if (!element) return false;
                    
                    const rect = element.getBoundingClientRect();
                    const currentPosition = { x: rect.left, y: rect.top };
                    
                    if (lastPosition && 
                        Math.abs(currentPosition.x - lastPosition.x) < 1 && 
                        Math.abs(currentPosition.y - lastPosition.y) < 1) {
                        stableCount++;
                    } else {
                        stableCount = 0;
                    }
                    
                    lastPosition = currentPosition;
                    return stableCount >= 2;
                },
                { timeout },
                selector, stabilityTime
            );
            logger.debug(`Element is stable: ${selector}`);
            return true;
        } catch (error) {
            logger.error(`Element is not stable: ${selector}`, error);
            throw error;
        }
    }
}

module.exports = ElementFinderUtils;
