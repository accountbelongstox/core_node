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