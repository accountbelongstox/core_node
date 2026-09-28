const { getFileDetails } = require('./file_utils');
const { cleanString, nCleanProxyItem, replaceFlagWithCountry, generateMd5 } = require('./str_utils');
const groupingRules = require('../provider/rules');
const logger = require('./log_utils');
const fs = require('fs');
const path = require('path');
const {
    proxyBlacklist,
    proxySet,
    proxyGroups,
    filteredProxyList
} = require('../provider/global_var');
const common_names = []

// Helper function to count leading spaces before the first non-space character
function countLeadingSpaces(line) {
    return (line.match(/^\s*/) || [''])[0].length;
}

// Function to merge YAML items into a single string
function mergeYamlItem(item) {
    if (!Array.isArray(item) || item.length === 1) {
        return item[0];
    }
    const dataObject = {};
    for (let i = 1; i < item.length; i++) {
        const line = item[i].trim();
        const keyValue = line.split(':');
        if (keyValue.length === 2) {
            const key = keyValue[0].trim();
            const value = keyValue[1].trim();
            dataObject[key] = value;
        }
    }

    const mergedString = `- {${Object.entries(dataObject).map(([k, v]) => `${k}: ${v}`).join(', ')}}`;
    return mergedString;
}

// Function to parse YAML file and extract proxies
async function parseYamlForProxies(filePath,urlEntity, logPrefix = "") {
    logger.logGreen(logPrefix + '---------------------------------------->>');
    logger.logGreen(logPrefix + 'Start parsing file: ' + filePath);

    const fileDetail = getFileDetails(filePath);
    const lines = fileDetail.lines;
    const lastModified = fileDetail.lastModified;
    const expiryDate = new Date(urlEntity ? urlEntity.expiryTime : fileDetail.expiryDate);
    const remainingDays = Math.floor((expiryDate - new Date()) / (24 * 60 * 60 * 1000));
    let proxiesLineIndex = -1;
    let proxiesIndentation = 0;
    const proxiesList = [];

    // Step 1: Find the line with `proxies:`
    const proxiesRegex = /^\s*proxies:/;
    for (let i = 0; i < lines.length; i++) {
        if (proxiesRegex.test(lines[i])) {
            proxiesLineIndex = i;
            proxiesIndentation = countLeadingSpaces(lines[i]);
            break;
        }
    }

    // If `proxies:` line is not found, return empty list
    if (proxiesLineIndex === -1) {
        logger.logYellow(logPrefix + '\tNo proxies section found in the YAML file.');
        return { proxies: [], groups: {} };
    }

    // Step 2: Collect all subsequent lines with higher indentation than `proxies:`
    for (let i = proxiesLineIndex + 1; i < lines.length; i++) {
        const lineIndentation = countLeadingSpaces(lines[i]);
        if (lineIndentation <= proxiesIndentation) {
            break;
        }
        if (lineIndentation > proxiesIndentation && lines[i].trim()) {
            proxiesList.push(lines[i].trim());
        }
    }

    const processedProxies = {};
    let totalProxyStrings = 0;
    let totalRenames = 0;
    let noNameCount = 0;
    const noNameItems = [];

    for (const item of proxiesList) {
        totalProxyStrings++;
        const nameMatch = item.match(/name:\s*([^\n,]*)/);
        const name = nameMatch ? nameMatch[1].trim() : '';
        if (name === "") {
            logger.logYellow(logPrefix + `\t\tWarning: Proxy item has no name`);
            noNameCount++;
            noNameItems.push(item);
            continue;
        }
        const {updataName,purename} = await nCleanProxyItem(name, proxySet);

        if (name !== updataName) {
            totalRenames++;
            logger.logBlue(logPrefix + `\t\tRenamed: ${name} -> ${updataName}`);
        }

        const proxyString = item.replace(name, updataName);

        const proxyObject = {
            id: generateMd5(proxyString),
            purename: name,
            originName: name,
            name: updataName,
            proxyString,
        };
        proxySet[proxyObject.id] = proxyObject;
        processedProxies[proxyObject.id] = proxyObject;
    }

    if (totalProxyStrings > 0) {
        logger.logGreen(logPrefix + `Total proxy strings processed: ${totalProxyStrings}`);
    } else {
        logger.logYellow(logPrefix + `Total proxy strings processed: ${totalProxyStrings}`);
    }
    if (totalRenames > 0) {
        logger.logYellow(logPrefix + `Total renames performed: ${totalRenames}`);
    }
    if (noNameCount > 0) {
        logger.logRed(logPrefix + `Total items without name: ${noNameCount}`);
        noNameItems.forEach((item, index) => {
            logger.logRed(logPrefix + `  ${index + 1}. ${item}`);
        });
    }

    logger.logGreen(logPrefix + '<<----------------------------------------');

    return {
        filePath,
        lastModified,
        expiryDate,
        remainingDays,
        fileDetail,
        proxies: processedProxies,
        totalProxyStrings,
        totalRenames,
        noNameCount,
    };
}

async function bakCode() {

    const mergedGroup = mergeYamlItem(item);
    common_names.push(proxyItemName);
    const newGroup = mergedGroup.replace(name, proxyItemName);

    let matchedGroup = null;
    for (const [groupName, keywords] of Object.entries(groupingRules)) {
        if (keywords.some(keyword => proxyItemName.includes(keyword))) {
            matchedGroup = groupName;
            break;
        }
    }
    logger.logBlue(`\t\tMatched group: ${matchedGroup}`);
    const proxies = [];
    const groups = Object.fromEntries(Object.keys(groupingRules).map(key => [key, []]));

    logger.logGreen('\tProcessing proxies:');
    for (const group of groupedProxies) {
        const mergedGroup = mergeYamlItem(group);
        const nameMatch = mergedGroup.match(/name:\s*([^\n,]*)/);
        const name = nameMatch ? nameMatch[1].trim() : '';
        if (name === "") {
            logger.logYellow(`\t\tWarning: Proxy item has no name`);
            continue;
        }
        const proxyItemName = await nCleanProxyItem(name, common_names);
        common_names.push(proxyItemName);
        const newGroup = mergedGroup.replace(name, proxyItemName);

        let matchedGroup = null;
        for (const [groupName, keywords] of Object.entries(groupingRules)) {
            if (keywords.some(keyword => proxyItemName.includes(keyword))) {
                matchedGroup = groupName;
                break;
            }
        }

        if (matchedGroup) {
            groups[matchedGroup].push({ name: proxyItemName, items: newGroup, lastModified, expiryDate });
            logger.logBlue(`\t\tAdded proxy ${proxyItemName} to group ${matchedGroup}`);
        }

        proxies.push({ name: proxyItemName, items: newGroup, lastModified, expiryDate });
        logger.logYellow(`\t\tProcessed proxy: ${proxyItemName}`);
    }

    logger.logGreen('Finished parsing file:');
    logger.logGreen('<<----------------------------------------');

}

// Function to merge proxies
function mergeProxies(proxies, configProxies) {
    logger.logGreen('Merging proxies:');
    for (const [groupKey, groupProxies] of Object.entries(proxies)) {
        if (!(groupKey in configProxies)) {
            configProxies[groupKey] = [];
        }
        const group_names = [];
        for (const proxy of groupProxies) {
            const { name, items, expiryDate } = proxy;

            if (group_names.includes(name)) {
                logger.logYellow(`  Skipping duplicate proxy: ${name}`);
                continue;
            }
            configProxies[groupKey].push({ name, expiryDate, items });
            group_names.push(name);
            logger.logBlue(`  Added proxy ${name} to group ${groupKey}`);
        }
    }

    logger.logGreen('Finished merging proxies');
    return configProxies;
}

// Example usage
if (require.main === module) {
    const filePath = 'path/to/your/file.yaml';
    const proxies = parseYamlForProxies(filePath);
    const configProxies = {};
    const mergedProxies = mergeProxies(proxies, configProxies);
    logger.logGreen('Merged Proxies:');
    console.log(JSON.stringify(mergedProxies, null, 2));
}

module.exports = {
    parseYamlForProxies,
    mergeProxies
};
