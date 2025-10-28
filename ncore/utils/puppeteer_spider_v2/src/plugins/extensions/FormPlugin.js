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
const IPlugin = require('../../interfaces/IPlugin');

class FormPlugin extends IPlugin {
    constructor() {
        super();
        this.name = 'form';
        this.version = '1.0.0';
    }

    async initialize(spider) {
        try {
            this.spider = spider;
            this.isInitialized = true;
            logger.info(`FormPlugin initialized for spider: ${spider.id}`);
        } catch (error) {
            logger.error('Failed to initialize FormPlugin:', error);
            throw error;
        }
    }

    async cleanup() {
        try {
            this.isInitialized = false;
            logger.info('FormPlugin cleaned up');
        } catch (error) {
            logger.error('Failed to cleanup FormPlugin:', error);
        }
    }

    async fillForm(page, formData, options = {}) {
        try {
            const results = {};
            
            for (const [selector, value] of Object.entries(formData)) {
                try {
                    await page.waitForSelector(selector, { timeout: options.timeout || 5000 });
                    
                    // Check if it's a select element
                    const isSelect = await page.evaluate((sel) => {
                        const element = document.querySelector(sel);
                        return element && element.tagName.toLowerCase() === 'select';
                    }, selector);
                    
                    if (isSelect) {
                        await page.select(selector, value);
                    } else {
                        // Clear existing value first
                        await page.evaluate((sel) => {
                            const element = document.querySelector(sel);
                            if (element) {
                                element.value = '';
                            }
                        }, selector);
                        
                        await page.type(selector, value, options);
                    }
                    
                    results[selector] = { success: true, value: value };
                    logger.debug(`Form field filled: ${selector} = ${value}`);
                } catch (error) {
                    results[selector] = { success: false, error: error.message };
                    logger.warn(`Failed to fill form field ${selector}:`, error.message);
                }
            }
            
            logger.info(`Form filled: ${Object.keys(formData).length} fields`);
            return results;
        } catch (error) {
            logger.error('Failed to fill form:', error);
            throw error;
        }
    }

    async getFormData(page, formSelector = 'form') {
        try {
            const formData = await page.evaluate((selector) => {
                const form = document.querySelector(selector);
                if (!form) return null;
                
                const data = {};
                const inputs = form.querySelectorAll('input, select, textarea');
                
                inputs.forEach(input => {
                    const name = input.name || input.id;
                    if (name) {
                        if (input.type === 'checkbox' || input.type === 'radio') {
                            data[name] = input.checked ? input.value : '';
                        } else {
                            data[name] = input.value;
                        }
                    }
                });
                
                return data;
            }, formSelector);
            
            logger.debug(`Form data extracted: ${Object.keys(formData || {}).length} fields`);
            return formData;
        } catch (error) {
            logger.error(`Failed to get form data from ${formSelector}:`, error);
            throw error;
        }
    }

    async submitForm(page, formSelector = 'form', options = {}) {
        try {
            await page.waitForSelector(formSelector, { timeout: options.timeout || 5000 });
            
            const submitButton = options.submitButton || 'input[type="submit"], button[type="submit"], button:not([type])';
            
            if (options.submitButton) {
                await page.click(submitButton);
            } else {
                await page.evaluate((selector) => {
                    const form = document.querySelector(selector);
                    if (form) {
                        form.submit();
                    }
                }, formSelector);
            }
            
            logger.debug(`Form submitted: ${formSelector}`);
        } catch (error) {
            logger.error(`Failed to submit form ${formSelector}:`, error);
            throw error;
        }
    }

    async fillAndSubmitForm(page, formData, options = {}) {
        try {
            const fillResults = await this.fillForm(page, formData, options);
            
            if (options.submit !== false) {
                await this.submitForm(page, options.formSelector, options);
            }
            
            logger.info('Form filled and submitted');
            return fillResults;
        } catch (error) {
            logger.error('Failed to fill and submit form:', error);
            throw error;
        }
    }

    async getFormFields(page, formSelector = 'form') {
        try {
            const fields = await page.evaluate((selector) => {
                const form = document.querySelector(selector);
                if (!form) return [];
                
                const inputs = form.querySelectorAll('input, select, textarea');
                return Array.from(inputs).map(input => ({
                    name: input.name || input.id,
                    type: input.type || input.tagName.toLowerCase(),
                    placeholder: input.placeholder,
                    required: input.required,
                    value: input.value,
                    selector: input.id ? `#${input.id}` : `[name="${input.name}"]`
                }));
            }, formSelector);
            
            logger.debug(`Form fields extracted: ${fields.length} fields`);
            return fields;
        } catch (error) {
            logger.error(`Failed to get form fields from ${formSelector}:`, error);
            throw error;
        }
    }

    async validateForm(page, formSelector = 'form') {
        try {
            const validation = await page.evaluate((selector) => {
                const form = document.querySelector(selector);
                if (!form) return { valid: false, errors: ['Form not found'] };
                
                const errors = [];
                const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
                
                inputs.forEach(input => {
                    if (!input.value.trim()) {
                        errors.push(`Required field ${input.name || input.id} is empty`);
                    }
                });
                
                // Check for HTML5 validation
                if (!form.checkValidity()) {
                    const invalidInputs = form.querySelectorAll(':invalid');
                    invalidInputs.forEach(input => {
                        errors.push(`Invalid value in field ${input.name || input.id}: ${input.validationMessage}`);
                    });
                }
                
                return {
                    valid: errors.length === 0,
                    errors: errors
                };
            }, formSelector);
            
            logger.debug(`Form validation: ${validation.valid ? 'valid' : 'invalid'}`);
            return validation;
        } catch (error) {
            logger.error(`Failed to validate form ${formSelector}:`, error);
            throw error;
        }
    }

    async clearForm(page, formSelector = 'form') {
        try {
            await page.evaluate((selector) => {
                const form = document.querySelector(selector);
                if (!form) return;
                
                const inputs = form.querySelectorAll('input, select, textarea');
                inputs.forEach(input => {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        input.checked = false;
                    } else {
                        input.value = '';
                    }
                });
            }, formSelector);
            
            logger.debug(`Form cleared: ${formSelector}`);
        } catch (error) {
            logger.error(`Failed to clear form ${formSelector}:`, error);
            throw error;
        }
    }

    async getFormAction(page, formSelector = 'form') {
        try {
            const action = await page.evaluate((selector) => {
                const form = document.querySelector(selector);
                return form ? form.action : null;
            }, formSelector);
            
            logger.debug(`Form action: ${action}`);
            return action;
        } catch (error) {
            logger.error(`Failed to get form action from ${formSelector}:`, error);
            throw error;
        }
    }

    async getFormMethod(page, formSelector = 'form') {
        try {
            const method = await page.evaluate((selector) => {
                const form = document.querySelector(selector);
                return form ? form.method : null;
            }, formSelector);
            
            logger.debug(`Form method: ${method}`);
            return method;
        } catch (error) {
            logger.error(`Failed to get form method from ${formSelector}:`, error);
            throw error;
        }
    }
}

module.exports = FormPlugin;
