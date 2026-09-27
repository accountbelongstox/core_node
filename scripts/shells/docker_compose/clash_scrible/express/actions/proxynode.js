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
