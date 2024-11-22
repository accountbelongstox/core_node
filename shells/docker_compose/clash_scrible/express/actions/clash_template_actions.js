const { readClashTemplate, writeClashTemplate } = require('../../utils/clash_template_utils');
const logger = require('../../utils/log_utils');

async function getClashTemplate() {
    const content = readClashTemplate();
    if (content === null) {
        return [false, 'Failed to read Clash template', 500, null];
    }
    return [true, 'Clash template retrieved successfully', 200, content];
}

async function updateClashTemplate({ content }) {
    if (!content || content.trim() === '') {
        return [false, 'Template content cannot be empty', 400, null];
    }

    const success = writeClashTemplate(content);
    if (success) {
        return [true, 'Clash template updated successfully', 200, content];
    } else {
        return [false, 'Failed to update Clash template', 500, null];
    }
}

module.exports = {
    getClashTemplate,
    updateClashTemplate
};