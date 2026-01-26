/**
 * Template Utilities
 * Unified template loading and rendering system
 * Replaces all createElement/innerHTML with template-based rendering
 */

const TemplateUtils = {
    templateCache: new Map(),

    /**
     * Load template from URL
     * @param {string} url - Template URL
     * @returns {Promise<string>} Template HTML string
     */
    async loadTemplate(url) {
        if (this.templateCache.has(url)) {
            return this.templateCache.get(url);
        }

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load template: ${url}`);
            }
            const html = await response.text();
            this.templateCache.set(url, html);
            return html;
        } catch (error) {
            console.error('Template loading error:', error);
            return '';
        }
    },

    /**
     * Render template with data
     * @param {string} template - Template HTML string
     * @param {Object} data - Data object for replacement
     * @returns {string} Rendered HTML
     */
    renderTemplate(template, data = {}) {
        let html = template;
        for (const [key, value] of Object.entries(data)) {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            html = html.replace(regex, this.escapeHtml(String(value || '')));
        }
        return html;
    },

    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Render template and return DOM element
     * @param {string} template - Template HTML string
     * @param {Object} data - Data object for replacement
     * @returns {HTMLElement} DOM element
     */
    renderToElement(template, data = {}) {
        const html = this.renderTemplate(template, data);
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.firstElementChild || temp;
    },

    /**
     * Load and render template in one call
     * @param {string} url - Template URL
     * @param {Object} data - Data object for replacement
     * @returns {Promise<HTMLElement>} DOM element
     */
    async loadAndRender(url, data = {}) {
        const template = await this.loadTemplate(url);
        return this.renderToElement(template, data);
    },

    /**
     * Clear template cache
     */
    clearCache() {
        this.templateCache.clear();
    }
};

window.TemplateUtils = TemplateUtils;

