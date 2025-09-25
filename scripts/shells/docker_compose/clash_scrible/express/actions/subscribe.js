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