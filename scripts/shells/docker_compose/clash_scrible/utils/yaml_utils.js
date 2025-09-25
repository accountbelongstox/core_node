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

const { getFileDetails } = require('./file_utils');
const { cleanString, cleanProxyItem, replaceFlagWithCountry } = require('./str_utils');
const groupingRules = require('../provider/rules');
const logger = require('./log_utils');
const fs = require('fs');
const { 
    proxyBlacklist, 
    proxyArray, 
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
async function parseYamlForProxies(filePath) {
    const fileDetail = getFileDetails(filePath);
    const lines = fileDetail.lines;
    const lastModified = fileDetail.lastModified;
    const expiryDate = fileDetail.expiryDate;
    const remainingDays = fileDetail.remainingDays;

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
        logger.log('No proxies section found in the YAML file.');
        return { proxies: [], groups: {} };
    }

    // Step 2: Collect all subsequent lines with higher indentation than `proxies:`
    for (let i = proxiesLineIndex + 1; i < lines.length; i++) {
        const lineIndentation = countLeadingSpaces(lines[i]);

        // Stop collecting when the line's indentation is less than or equal to the `proxies:` indentation
        if (lineIndentation <= proxiesIndentation) {
            break;
        }
        if (lineIndentation > proxiesIndentation && lines[i].trim()) {
            proxiesList.push(lines[i].trim());
        }
    }

    // Step 3: Process proxiesList to group items
    const groupedProxies = [];
    let currentGroup = [];

    for (const item of proxiesList) {
        if (item.startsWith('-')) {
            if (currentGroup.length) {
                groupedProxies.push(currentGroup);
            }
            currentGroup = [item];
        } else {
            currentGroup.push(item);
        }
    }

    if (currentGroup.length) {
        groupedProxies.push(currentGroup);
    }

    const proxies = [];
    const groups = Object.fromEntries(Object.keys(groupingRules).map(key => [key, []]));

    for (const group of groupedProxies) {
        const mergedGroup = mergeYamlItem(group);
        const nameMatch = mergedGroup.match(/name:\s*([^\n,]*)/);
        const name = nameMatch ? nameMatch[1].trim() : '';
        if (name === "") {
            continue;
        }
        const newName = cleanString(name);
        const proxyItemName = await cleanProxyItem(name,common_names);
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
        }

        proxies.push({ name: proxyItemName, items: newGroup, lastModified, expiryDate });
    }

    return { proxies, ...groups };
}

// Function to merge proxies
function mergeProxies(proxies, configProxies) {
    for (const [groupKey, groupProxies] of Object.entries(proxies)) {
        if (!(groupKey in configProxies)) {
            configProxies[groupKey] = [];
        }
        const group_names = [];
        for (const proxy of groupProxies) {
            const { name, items, expiryDate } = proxy;

            if(group_names.includes(name)){
                continue;
            }
            // const existingProxyIndex = configProxies[groupKey].findIndex(p => p.name === name);
            configProxies[groupKey].push({ name, expiryDate, items });
            group_names.push(name);
            // if (existingProxyIndex === -1) {
            //     configProxies[groupKey].push({ name, expiryDate, items });
            // } else {
            //     const existingProxy = configProxies[groupKey][existingProxyIndex];
            //     if (existingProxy.items === items) {
            //         // logger.log(`Duplicate found for proxy: ${name}`);
            //     } else {
            //         const newName = `"${name.replace(/^"|"$/g, '')}_${configProxies[groupKey].length + 1}"`;
            //         const replacedItem = items.replace(`name: ${name}`, `name: ${newName}`);
            //         configProxies[groupKey].push({ name: newName, expiryDate, items: replacedItem });
            //         logger.log(`Added new proxy with name: ${newName}`);
            //     }
            // }
        }
    }

    return configProxies;
}

// Example usage
if (require.main === module) {
    const filePath = 'path/to/your/file.yaml';
    const proxies = parseYamlForProxies(filePath);
    const configProxies = {};
    const mergedProxies = mergeProxies(proxies, configProxies);
    logger.log(JSON.stringify(mergedProxies, null, 2));
}

module.exports = {
    parseYamlForProxies,
    mergeProxies
};
