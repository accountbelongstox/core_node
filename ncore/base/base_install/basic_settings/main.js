const path = require('path');
const fs = require('fs');
const basicSettings = require('./basic_settings.js');
const initPath = require('./init_path.js');

class BasicSettingsMain {
    constructor() {
        this.basicSettings = basicSettings;
        this.initPath = initPath;
    }

    start() {
        basicSettings.start()
        initPath.start()
    }
}

module.exports = new BasicSettingsMain();



