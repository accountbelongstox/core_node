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

const { getProxyNodeInfo } = require('../../utils/proxy_node_utils');
const { standardResponse } = require('../../utils/html_utils');
const logger = require('../../utils/log_utils');

async function getProxyNode(req) {
    const group = req.query.group || 'default';
    try {
        const nodeInfo = await getProxyNodeInfo(group);
        return standardResponse(true, "Proxy node info retrieved successfully", nodeInfo, 200);
    } catch (error) {
        logger.logRed(`Failed to get proxy node info: ${error}`);
        return standardResponse(false, `Failed to get proxy node info: ${error}`, null, 500);
    }
}

module.exports = {
    getProxyNode
};
