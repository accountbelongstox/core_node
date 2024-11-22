'use strict';
const { getMethodNames } = require('../../utils/classUtils.js');

class Bot {
    constructor(browser, page) {
        this.browser = browser;
        this.pageModus = page;
        this.methods = getMethodNames(Bot.prototype, true, 'Bot');
    }


    async testBot(driverType) {
        await this.open('https://bot.sannysoft.com/', driverType);
    }

}

module.exports = Bot;



