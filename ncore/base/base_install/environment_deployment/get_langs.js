const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const { getnode_win, getpython_win, getgolang_win, getjava_win, getrust_win, getruby_win, getphp_win, winpath } = require('#@utils_native');
const logger = require('#@utils_logger');

class GetNode {
  constructor() {
  }

  async start() {
    const installersKeyValue = {
      'node': getnode_win,
      'python': getpython_win,
      'golang': getgolang_win,
      'java': getjava_win,
      'php': getphp_win,
      'rust': getrust_win,
      'ruby': getruby_win
    }
    const langs = Object.keys(installersKeyValue);
    logger.info(`Need to install the following languages: ${langs.join(', ')}`);

    for (const langName in installersKeyValue) {
      if (installersKeyValue.hasOwnProperty(langName)) {
        const installer = installersKeyValue[langName];
        logger.info(`Starting ${langName} installation...`);
        await installer.start();
        const details = installer.getDefaultVersion();
        logger.success(`${langName} default version: ${details.versionKey}`,);
        logger.success(`${langName} default rootDir: ${details.installDir}`,);
        logger.success(`details.baseDir`, details.baseDir)
        details.baseDir.forEach((dir) => {
          console.log(`Checking if directory is already in environment variables: ${dir}`);
          if (!winpath.isPath(dir)) {
            logger.success(`Adding directory to environment variables: ${dir}`);
            winpath.addPath(dir);
          } else {
            logger.warning(`Directory already exists in environment variables: ${dir}`);
          }
        });
      }
    }
  }
}

module.exports = new GetNode();
