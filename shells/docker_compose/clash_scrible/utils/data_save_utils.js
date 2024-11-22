const fs = require('fs');
const path = require('path');
const { yamls_dir } = require('../provider/global_var');
const { generateMd5 } = require('./str_utils');
const logger = require('./log_utils');

function saveYamlFile(fileName, content, group) {
    const groupMd5 = generateMd5(group);
    const groupDir = path.join(yamls_dir, groupMd5);
    
    if (!fs.existsSync(groupDir)) {
        fs.mkdirSync(groupDir, { recursive: true });
    }
    
    const filePath = path.join(groupDir, fileName);
    fs.writeFileSync(filePath, content, 'utf8');
}

function deleteYamlFile(fileName, group) {
    const groupMd5 = generateMd5(group);
    const groupDir = path.join(yamls_dir, groupMd5);
    const filePath = path.join(groupDir, fileName);
    
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.log(`Deleted YAML file: ${filePath}`);
    } else {
        logger.logYellow(`YAML file not found: ${filePath}`);
    }
}

module.exports = {
    saveYamlFile,
    deleteYamlFile
};