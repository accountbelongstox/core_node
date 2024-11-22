const fs = require('fs');
const path = require('path');
const { clash_template,custom_template } = require('../provider/global_var');
const logger = require('./log_utils');

function readClashTemplate() {
    try {
        return fs.readFileSync(clash_template, 'utf8');
    } catch (error) {
        logger.logRed('Error reading Clash template:', error);
        return null;
    }
}

function writeClashTemplate(content) {
    if (!content || content.trim() === '') {
        logger.logRed('Error: Cannot write empty content to Clash template');
        return false;
    }

    try {
        fs.writeFileSync(clash_template, content, 'utf8');
        return true;
    } catch (error) {
        logger.logRed('Error writing Clash template:', error);
        return false;
    }
}

module.exports = {
    readClashTemplate,
    writeClashTemplate,
};
