const path = require('path');
const fs = require('fs');
const Base = require('#@base');
const basicSettings = require('./basic_settings/main.js');
const autoInstall = require('./auto_install/main.js');
const functionActivation = require('./function_activation/function_activation.js');
const getLangs = require('./environment_deployment/get_langs.js');

class BaseInstall extends Base {
    constructor() {
        super();
        this.basicSettings = basicSettings;
        this.autoInstall = autoInstall;
        this.functionActivation = functionActivation;
        this.getLangs = getLangs;
    }

    async start() {
        await this.basicSettings.start();
        await this.autoInstall.start();
        await this.functionActivation.start();
        await this.getLangs.start();
    }
}

module.exports = new BaseInstall();
