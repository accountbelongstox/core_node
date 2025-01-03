const ProxyProcessor = require('../../utils/proxy_processor');
const { standardResponse } = require('../../utils/html_utils');

const proxyProcessor = new ProxyProcessor();

async function serveSubscription(currentGroup,template="default") {
    const updatedProxyGroupsText = await proxyProcessor.processFiles(currentGroup,template);
    if (updatedProxyGroupsText) {
        return standardResponse(true, "Subscription updated.", updatedProxyGroupsText, 200);
    } else {
        return standardResponse(false, `Subscription for group "${currentGroup}" not found.`, null, 404);
    }
}

module.exports = {
    serveSubscription
};