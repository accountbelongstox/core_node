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

class DataExtractionUtils extends BaseUtils {
    constructor() {
        super();
    }

    async getElementText(page, selector) {
        try {
            const text = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element ? element.textContent.trim() : null;
            }, selector);
            
            logger.debug(`Got text from element ${selector}: ${text}`);
            return text;
        } catch (error) {
            logger.error(`Failed to get text from element ${selector}:`, error);
            throw error;
        }
    }

    async getElementAttribute(page, selector, attribute) {
        try {
            const value = await page.evaluate((sel, attr) => {
                const element = document.querySelector(sel);
                return element ? element.getAttribute(attr) : null;
            }, selector, attribute);
            
            logger.debug(`Got attribute ${attribute} from element ${selector}: ${value}`);
            return value;
        } catch (error) {
            logger.error(`Failed to get attribute ${attribute} from element ${selector}:`, error);
            throw error;
        }
    }

    async getElementProperty(page, selector, property) {
        try {
            const value = await page.evaluate((sel, prop) => {
                const element = document.querySelector(sel);
                return element ? element[prop] : null;
            }, selector, property);
            
            logger.debug(`Got property ${property} from element ${selector}: ${value}`);
            return value;
        } catch (error) {
            logger.error(`Failed to get property ${property} from element ${selector}:`, error);
            throw error;
        }
    }

    async getElementValue(page, selector) {
        return this.getElementProperty(page, selector, 'value');
    }

    async getElementInnerHTML(page, selector) {
        return this.getElementProperty(page, selector, 'innerHTML');
    }

    async getElementOuterHTML(page, selector) {
        return this.getElementProperty(page, selector, 'outerHTML');
    }

    async getAllElementsText(page, selector) {
        try {
            const texts = await page.evaluate((sel) => {
                const elements = document.querySelectorAll(sel);
                return Array.from(elements).map(el => el.textContent.trim());
            }, selector);
            
            logger.debug(`Got texts from ${texts.length} elements: ${selector}`);
            return texts;
        } catch (error) {
            logger.error(`Failed to get texts from elements ${selector}:`, error);
            throw error;
        }
    }

    async getAllElementsAttributes(page, selector, attribute) {
        try {
            const values = await page.evaluate((sel, attr) => {
                const elements = document.querySelectorAll(sel);
                return Array.from(elements).map(el => el.getAttribute(attr));
            }, selector, attribute);
            
            logger.debug(`Got ${attribute} from ${values.length} elements: ${selector}`);
            return values;
        } catch (error) {
            logger.error(`Failed to get ${attribute} from elements ${selector}:`, error);
            throw error;
        }
    }

    async getAllElementsData(page, selector, dataAttribute) {
        try {
            const values = await page.evaluate((sel, dataAttr) => {
                const elements = document.querySelectorAll(sel);
                return Array.from(elements).map(el => el.dataset[dataAttr]);
            }, selector, dataAttribute);
            
            logger.debug(`Got data-${dataAttribute} from ${values.length} elements: ${selector}`);
            return values;
        } catch (error) {
            logger.error(`Failed to get data-${dataAttribute} from elements ${selector}:`, error);
            throw error;
        }
    }

    async getTableData(page, selector) {
        try {
            const tableData = await page.evaluate((sel) => {
                const table = document.querySelector(sel);
                if (!table) return null;
                
                const rows = Array.from(table.querySelectorAll('tr'));
                return rows.map(row => {
                    const cells = Array.from(row.querySelectorAll('td, th'));
                    return cells.map(cell => cell.textContent.trim());
                });
            }, selector);
            
            logger.debug(`Extracted table data from ${selector}`);
            return tableData;
        } catch (error) {
            logger.error(`Failed to extract table data from ${selector}:`, error);
            throw error;
        }
    }

    async getFormData(page, selector) {
        try {
            const formData = await page.evaluate((sel) => {
                const form = document.querySelector(sel);
                if (!form) return null;
                
                const formData = new FormData(form);
                const data = {};
                
                for (let [key, value] of formData.entries()) {
                    data[key] = value;
                }
                
                return data;
            }, selector);
            
            logger.debug(`Extracted form data from ${selector}`);
            return formData;
        } catch (error) {
            logger.error(`Failed to extract form data from ${selector}:`, error);
            throw error;
        }
    }

    async getSelectOptions(page, selector) {
        try {
            const options = await page.evaluate((sel) => {
                const select = document.querySelector(sel);
                if (!select) return null;
                
                return Array.from(select.options).map(option => ({
                    value: option.value,
                    text: option.textContent.trim(),
                    selected: option.selected
                }));
            }, selector);
            
            logger.debug(`Extracted select options from ${selector}`);
            return options;
        } catch (error) {
            logger.error(`Failed to extract select options from ${selector}:`, error);
            throw error;
        }
    }

    async getElementPosition(page, selector) {
        try {
            const position = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (!element) return null;
                
                const rect = element.getBoundingClientRect();
                return {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height
                };
            }, selector);
            
            logger.debug(`Got position for element ${selector}:`, position);
            return position;
        } catch (error) {
            logger.error(`Failed to get position for element ${selector}:`, error);
            throw error;
        }
    }

    async getElementStyle(page, selector, property) {
        try {
            const style = await page.evaluate((sel, prop) => {
                const element = document.querySelector(sel);
                if (!element) return null;
                
                const computedStyle = window.getComputedStyle(element);
                return computedStyle[prop];
            }, selector, property);
            
            logger.debug(`Got style ${property} for element ${selector}: ${style}`);
            return style;
        } catch (error) {
            logger.error(`Failed to get style ${property} for element ${selector}:`, error);
            throw error;
        }
    }

    async getElementClasses(page, selector) {
        try {
            const classes = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element ? Array.from(element.classList) : null;
            }, selector);
            
            logger.debug(`Got classes for element ${selector}:`, classes);
            return classes;
        } catch (error) {
            logger.error(`Failed to get classes for element ${selector}:`, error);
            throw error;
        }
    }

    async getElementTagName(page, selector) {
        try {
            const tagName = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element ? element.tagName.toLowerCase() : null;
            }, selector);
            
            logger.debug(`Got tag name for element ${selector}: ${tagName}`);
            return tagName;
        } catch (error) {
            logger.error(`Failed to get tag name for element ${selector}:`, error);
            throw error;
        }
    }

    async getElementCount(page, selector) {
        try {
            const count = await page.evaluate((sel) => {
                return document.querySelectorAll(sel).length;
            }, selector);
            
            logger.debug(`Found ${count} elements for selector: ${selector}`);
            return count;
        } catch (error) {
            logger.error(`Failed to count elements for selector ${selector}:`, error);
            throw error;
        }
    }

    async isElementVisible(page, selector) {
        try {
            const isVisible = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                if (!element) return false;
                
                const style = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0' &&
                       rect.width > 0 && 
                       rect.height > 0;
            }, selector);
            
            logger.debug(`Element ${selector} visibility: ${isVisible}`);
            return isVisible;
        } catch (error) {
            logger.error(`Failed to check visibility of element ${selector}:`, error);
            return false;
        }
    }

    async isElementEnabled(page, selector) {
        try {
            const isEnabled = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element ? !element.disabled : false;
            }, selector);
            
            logger.debug(`Element ${selector} enabled: ${isEnabled}`);
            return isEnabled;
        } catch (error) {
            logger.error(`Failed to check if element ${selector} is enabled:`, error);
            return false;
        }
    }

    async isElementChecked(page, selector) {
        try {
            const isChecked = await page.evaluate((sel) => {
                const element = document.querySelector(sel);
                return element ? element.checked : false;
            }, selector);
            
            logger.debug(`Element ${selector} checked: ${isChecked}`);
            return isChecked;
        } catch (error) {
            logger.error(`Failed to check if element ${selector} is checked:`, error);
            return false;
        }
    }

    async getPageText(page) {
        try {
            const text = await page.evaluate(() => {
                return document.body.textContent;
            });
            
            logger.debug('Extracted page text');
            return text;
        } catch (error) {
            logger.error('Failed to extract page text:', error);
            throw error;
        }
    }

    async getPageHTML(page) {
        try {
            const html = await page.content();
            logger.debug('Extracted page HTML');
            return html;
        } catch (error) {
            logger.error('Failed to extract page HTML:', error);
            throw error;
        }
    }

    async getPageMeta(page) {
        try {
            const meta = await page.evaluate(() => {
                const metaTags = document.querySelectorAll('meta');
                const metaData = {};
                
                metaTags.forEach(tag => {
                    const name = tag.getAttribute('name') || tag.getAttribute('property');
                    const content = tag.getAttribute('content');
                    
                    if (name && content) {
                        metaData[name] = content;
                    }
                });
                
                return metaData;
            });
            
            logger.debug('Extracted page meta data');
            return meta;
        } catch (error) {
            logger.error('Failed to extract page meta data:', error);
            throw error;
        }
    }

    async getLinks(page, selector = 'a') {
        try {
            const links = await page.evaluate((sel) => {
                const linkElements = document.querySelectorAll(sel);
                return Array.from(linkElements).map(link => ({
                    href: link.href,
                    text: link.textContent.trim(),
                    title: link.title
                }));
            }, selector);
            
            logger.debug(`Extracted ${links.length} links`);
            return links;
        } catch (error) {
            logger.error('Failed to extract links:', error);
            throw error;
        }
    }

    async getImages(page, selector = 'img') {
        try {
            const images = await page.evaluate((sel) => {
                const imageElements = document.querySelectorAll(sel);
                return Array.from(imageElements).map(img => ({
                    src: img.src,
                    alt: img.alt,
                    title: img.title,
                    width: img.width,
                    height: img.height
                }));
            }, selector);
            
            logger.debug(`Extracted ${images.length} images`);
            return images;
        } catch (error) {
            logger.error('Failed to extract images:', error);
            throw error;
        }
    }
}

module.exports = DataExtractionUtils;
