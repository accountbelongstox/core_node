const path = require('path');
const fs = require('fs');
const { out_dir } = require('../provider/global_var');
const { getFileDetails } = require('./file_utils');
const { getConfigValue } = require(`./config_utils`);
const groupingRules = require('../provider/rules');
const logger = require('./log_utils');

let filterKeywords;
function countLeadingSpaces(line) {
    return (line.match(/^\s*/) || [''])[0].length;
}
async function initFilterKeywords() {
    const clashNodeKeywordFilter = getConfigValue('clashNodeKeywordFilter');
    filterKeywords = clashNodeKeywordFilter ? clashNodeKeywordFilter.split('|') : [];
}

function generateProxyGroupsText(proxyGroups, proxyGroupsIndentation) {
    return proxyGroups.map(group => {
        let groupText = '';

        // Add name
        groupText += ' '.repeat(proxyGroupsIndentation + 2) + `- name: ${group.name}\n`;

        // Add type
        groupText += ' '.repeat(proxyGroupsIndentation + 4) + `type: ${group.type}\n`;

        // Add dynamic fields (other than name, type, and proxies)
        Object.entries(group).forEach(([key, value]) => {
            if (!['name', 'type', 'proxies'].includes(key)) {
                groupText += ' '.repeat(proxyGroupsIndentation + 4) + `${key}: ${value}\n`;
            }
        });

        // Add proxies
        groupText += ' '.repeat(proxyGroupsIndentation + 4) + 'proxies:\n';

        // Add each proxy item
        const group_names = [];
        group.proxies.forEach(proxyItem => {

            if (!group_names.includes(proxyItem)) {
                if (!proxyItem.startsWith("- ")) {
                    proxyItem = '- ' + proxyItem;
                }
                groupText += ' '.repeat(proxyGroupsIndentation + 6) + proxyItem + '\n';
            }
            group_names.push(proxyItem);
        });

        return groupText.trimEnd();  // Remove last newline
    }).join('\n');
}

// Replace proxies in YAML and save the updated file
async function replaceProxiesLinesAndSave(filePath, proxies, proxyGroups) {
    const fileDetails = await getFileDetails(filePath);
    const lines = fileDetails.lines;

    let proxiesLineIndex = -1;
    let proxiesIndentation = 0;
    const proxiesRegex = /^\s*proxies:/;

    // Step 1: Find the `proxies:` line
    for (let i = 0; i < lines.length; i++) {
        if (proxiesRegex.test(lines[i])) {
            proxiesLineIndex = i;
            proxiesIndentation = countLeadingSpaces(lines[i]);
            break;
        }
    }

    if (proxiesLineIndex === -1) {
        logger.log('No proxies section found in the YAML file.');
        return;
    }

    // Step 2: Find the end of the `proxies:` section
    let endLineIndex = lines.length;
    for (let i = proxiesLineIndex + 1; i < lines.length; i++) {
        if (countLeadingSpaces(lines[i]) <= proxiesIndentation) {
            endLineIndex = i;
            break;
        }
    }

    // Prepare new proxy lines
    const newLines = proxies.map(proxy => ' '.repeat(proxiesIndentation + 2) + proxy.items);

    // Update the lines
    let updatedLines = [
        ...lines.slice(0, proxiesLineIndex + 1),
        ...newLines,
        ...lines.slice(endLineIndex)
    ];

    let proxyGroupsLineIndex = -1;
    let proxyGroupsIndentation = 0;
    const proxyGroupsRegex = /^\s*proxy-groups:/;

    for (let i = 0; i < updatedLines.length; i++) {
        if (proxyGroupsRegex.test(updatedLines[i])) {
            proxyGroupsLineIndex = i;
            proxyGroupsIndentation = countLeadingSpaces(updatedLines[i]);
            break;
        }
    }

    const proxyGroupsText = generateProxyGroupsText(proxyGroups, proxyGroupsIndentation);

    if (proxyGroupsLineIndex === -1) {
        logger.log('No proxy-groups section found in the YAML file.');
        return;
    }

    let proxyGroupsEndLineIndex = updatedLines.length;
    for (let i = proxyGroupsLineIndex + 1; i < updatedLines.length; i++) {
        if (countLeadingSpaces(updatedLines[i]) <= proxyGroupsIndentation) {
            proxyGroupsEndLineIndex = i;
            break;
        }
    }

    updatedLines = [
        ...updatedLines.slice(0, proxyGroupsLineIndex + 1),
        ...proxyGroupsText.split('\n'),
        ...updatedLines.slice(proxyGroupsEndLineIndex)
    ];

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const newFileName = `${path.basename(filePath, '.yaml')}_${timestamp}.yaml`;
    const newFilePath = path.join(out_dir, newFileName);

    const updatedProxyGroupsText = updatedLines.join('\n');
    fs.mkdirSync(path.dirname(newFilePath), { recursive: true });
    fs.writeFileSync(newFilePath, updatedProxyGroupsText, 'utf-8');

    logger.log(`New file created: ${newFilePath}`);
    return updatedProxyGroupsText;
}

// Process proxies and filter based on keywords and expiry dates
async function processProxiesAndGroups(data) {
    if (!filterKeywords) {
        await initFilterKeywords();
    }
    const today = new Date();
    const result = {};
    for (const [key, group] of Object.entries(data)) {
        const names = [];
        const validProxies = [];

        if (key === 'proxies') {
            group.forEach(proxy => {
                const name = proxy.name;
                const expiry = new Date(proxy.expiryDate);

                if (filterKeywords.some(keyword => name.includes(keyword))) {
                    logger.log(`Proxy '${name}' was filtered out.`);
                    return;
                }

                if (expiry < today) {
                    logger.log(`Proxy '${name}' has expired.`);
                } else if ((expiry - today) / (1000 * 60 * 60 * 24) <= 7) {
                    logger.log(`Warning: Proxy '${name}' is expiring soon (within a week).`);
                    validProxies.push({ name, items: proxy.items });
                    names.push(name);
                } else {
                    validProxies.push({ name, items: proxy.items });
                    names.push(name);
                }
            });

            if (validProxies.length > 0) {
                result.proxies = {
                    names,
                    proxies: validProxies
                };
            }
        } else {
            group.forEach(proxy => {
                if (!filterKeywords.some(keyword => proxy.name.includes(keyword))) {
                    names.push(proxy.name);
                } else {
                    logger.log(`Group Proxy '${proxy.name}' was filtered out.`);
                }
            });

            if (names.length > 0) {
                result[key] = names;
            }
        }
    }

    return result;
}

function processProxyGroups(proxyGroups, mergedProxies) {
    let messages = "proxies:";
    proxyGroups.forEach(group => {
        const name = group.name;
        let matchedGroup = null;

        for (const [groupName, keywords] of Object.entries(groupingRules)) {
            if (keywords.some(keyword => name.includes(keyword))) {
                matchedGroup = groupName;
                break;
            }
        }
        if (matchedGroup) {
            if (mergedProxies[matchedGroup]) {
                group.proxies = mergedProxies[matchedGroup].map(item => `- ${item}`);
            }
        }

        if (group.proxies.length === 0) {
            const mergedNames = mergedProxies.proxies?.names || [];
            group.proxies = mergedNames.map(item => `- ${item}`);
        } else {
            messages += `${name}/${group.proxies.length},`;
        }
    });
    logger.log(messages);
    return proxyGroups;
}

module.exports = {
    replaceProxiesLinesAndSave,
    processProxiesAndGroups,
    processProxyGroups
};
