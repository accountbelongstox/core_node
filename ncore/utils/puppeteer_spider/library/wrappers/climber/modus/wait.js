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
const { getMethodNames } = require('../../utils/classUtils.js');
const logger = require('#@logger');
const GLOBAL_INSTANCES = require('../../../global_instance_manager');

class Wait {
    constructor(instanceId = null) {
        this.instanceId = instanceId;
        this.browser = null;
        this.pageModus = null;
        this.methods = getMethodNames(Wait.prototype, true, 'Wait');
        this.isInitialized = false;
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



