'use strict';
const { getMethodNames } = require('../../utils/classUtils.js');

class Position {
    constructor(browser, page) {
        this.browser = browser;
        this.pageModus = page;
        this.methods = getMethodNames(Position.prototype, true, 'Position');
    }


    async getWindowPosition() {
        const driver = this.getDriver();
        const position = await driver.getWindowPosition();
        return position;
    }
}

module.exports = Position;



