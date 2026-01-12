/**
 * DOM Utilities
 * Common DOM operations without HTML generation
 * Only manipulates existing elements and data
 */

const DomUtils = {
    /**
     * Show element
     * @param {string|HTMLElement} element - Element ID or element
     */
    show(element) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) el.classList.remove('hidden');
    },

    /**
     * Hide element
     * @param {string|HTMLElement} element - Element ID or element
     */
    hide(element) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) el.classList.add('hidden');
    },

    /**
     * Toggle element visibility
     * @param {string|HTMLElement} element - Element ID or element
     */
    toggle(element) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) el.classList.toggle('hidden');
    },

    /**
     * Set text content safely
     * @param {string|HTMLElement} element - Element ID or element
     * @param {string} text - Text content
     */
    setText(element, text) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) el.textContent = text;
    },

    /**
     * Get text content
     * @param {string|HTMLElement} element - Element ID or element
     * @returns {string} Text content
     */
    getText(element) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        return el ? el.textContent : '';
    },

    /**
     * Set value
     * @param {string|HTMLElement} element - Element ID or element
     * @param {string} value - Value
     */
    setValue(element, value) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el && 'value' in el) el.value = value;
    },

    /**
     * Get value
     * @param {string|HTMLElement} element - Element ID or element
     * @returns {string} Value
     */
    getValue(element) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        return el && 'value' in el ? el.value : '';
    },

    /**
     * Add class
     * @param {string|HTMLElement} element - Element ID or element
     * @param {string} className - Class name
     */
    addClass(element, className) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) el.classList.add(className);
    },

    /**
     * Remove class
     * @param {string|HTMLElement} element - Element ID or element
     * @param {string} className - Class name
     */
    removeClass(element, className) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) el.classList.remove(className);
    },

    /**
     * Toggle class
     * @param {string|HTMLElement} element - Element ID or element
     * @param {string} className - Class name
     */
    toggleClass(element, className) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) el.classList.toggle(className);
    },

    /**
     * Clear element content
     * @param {string|HTMLElement} element - Element ID or element
     */
    clear(element) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el) el.innerHTML = '';
    },

    /**
     * Append child using template
     * @param {string|HTMLElement} parent - Parent element ID or element
     * @param {HTMLElement} child - Child element
     */
    append(parent, child) {
        const parentEl = typeof parent === 'string' ? document.getElementById(parent) : parent;
        if (parentEl && child) parentEl.appendChild(child);
    },

    /**
     * Remove element
     * @param {string|HTMLElement} element - Element ID or element
     */
    remove(element) {
        const el = typeof element === 'string' ? document.getElementById(element) : element;
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }
};

window.DomUtils = DomUtils;

