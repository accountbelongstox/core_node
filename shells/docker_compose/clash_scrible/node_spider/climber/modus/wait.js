'use strict';
const { getMethodNames } = require('../../utils/classUtils.js');

class Wait {
    constructor(browser, page) {
        this.browser = browser;
        this.pageModus = page;
        this.methods = getMethodNames(Wait.prototype, true, 'Wait');
    }

    async sleep(milliseconds) {//调用sleep
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    async waitElement(selector, timeout = 10000, deep = 0) {
        if (timeout >= deep) {
            return false;
        }

        try {
            const element = await driver.findElement(By.css(selector));
            return true;
        } catch (error) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            deep++;
            return waitElement(selector, timeout, deep);
        }
    }

    

    async isReady() {
        await this.sleep(100);
        if (await this.getCurrentURL() === "about:blank") {
            return false;
        }
        const js = "return document.readyState";
        const ready = await this.executeJS(js);
        return ready === "complete";
    }

    async openReadyWait() {
        if (!(await this.isReady())) {
            await this.sleep(1000); // 1秒
            console.log("openReadyWait");
            return this.openReadyWait();
        } else {
            return true;
        }
    }


}

module.exports = Wait;



