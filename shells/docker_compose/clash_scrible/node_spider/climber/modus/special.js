'use strict';
const Util = require('../../node_provider/utils.js')

class Special {
    async init(browser, page) {
        this.browser = browser
        this.pageModus = page
        const methods = Object.getOwnPropertyNames(Special.prototype)
            .filter(name => typeof Special.prototype[name] === 'function' && name !== 'constructor');
        console.log('Total Special of methods:', methods.length);
    }

    async getElements(tag, isVisible = true, distanceFromTop = null, minWidth = null, minHeight = null) {
        const elements = await this.pageModus.$$(tag);
        const filteredElements = [];
        for (const element of elements) {
            const rect = await element.boundingBox();
            const isElementVisible = isVisible ? await element.isIntersectingViewport() : true;
            const meetsCriteria =
                (!distanceFromTop || (rect && rect.y >= distanceFromTop)) &&
                (!minWidth || (rect && rect.width >= minWidth)) &&
                (!minHeight || (rect && rect.height >= minHeight));

            if (isElementVisible && meetsCriteria) {
                filteredElements.push(element);
            }
        }
        return filteredElements;
    }

    async getElement(tag, isVisible = true, distanceFromTop = null, minWidth = null, minHeight = null) {
        const elements = await this.getElements(tag, isVisible, distanceFromTop, minWidth, minHeight);
        return elements.length > 0 ? elements[0] : null;
    }
}
Special.toString = () => '[class Special]';
module.exports = Special;