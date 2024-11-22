const path = require('path');
const fs = require('fs');
const { ensureDirectoryExists, fileExists, formatFileName, readFirstLine, writeYamlFile, cleanUpOldFiles, getAbsolutePath } = require('./file_utils');
const { sendGetRequest, generateApiUrls, isValidContent } = require('./network_utils');
const { parseYamlForProxies, mergeProxies } = require('./nyaml_utils');
const { processProxiesAndGroups, replaceProxiesLinesAndSave, processProxyGroups } = require('./yaml_replace_utils');
const { parseProxyGroups } = require('./parse_proxy_groups');
const { getGroupScribleData, getAllGroupNames } = require('./group_utils');
const { downloadYamlFiles } = require('./down_yaml_utils');
const { yamls_dir, clash_template, custom_template,proxySet } = require('../provider/global_var');
const logger = require('./log_utils');
const { generateUniqueId, generateMd5 } = require('./str_utils');
const { getOrSetConfigValue, getConfigValue, deleteConfigValue } = require('./config_utils');
const { clearObject } = require('./tool_utils');

async function processProxy(currentGroup = "default", template = "default") {
    let templatePath;
    if (template === "custom" && fs.existsSync(custom_template)) {
        templatePath = custom_template;
        logger.logGreen("Using custom template");
    } else {
        templatePath = clash_template;
        logger.logBlue("Using default clash template");
    }

    const configProxies = await parseYamlForProxies(templatePath);
    const { groupScribleData, groupMd5, groupJsonFile } = getGroupScribleData(currentGroup);

    const groupYamlsDir = path.join(yamls_dir, groupMd5); 
    ensureDirectoryExists(groupYamlsDir);

    await downloadYamlFiles(groupScribleData, groupYamlsDir);
    return await processYamlFiles(groupYamlsDir, groupScribleData, configProxies, templatePath);
} 

async function loadYamlFiles(currentGroup = "default", logPrefix = "") {

    const { groupScribleData, groupMd5, groupJsonFile } = getGroupScribleData(currentGroup);
    const groupYamlsDir = path.join(yamls_dir, groupMd5);
    const files = fs.readdirSync(groupYamlsDir);
    if (files.length === 0) {
        logger.logYellow("No files found in the target directory.");
        return;
    }
    const proxiesByGroup = {};
    for (const yamlFileName of files) {
        const yamlFilePath = path.join(groupYamlsDir, yamlFileName);
        const urlEntity = Object.values(groupScribleData).find(
            urlEntity => urlEntity.yaml_file_name === yamlFileName
        );
        const proxies = await parseYamlForProxies(yamlFilePath,urlEntity, logPrefix);
        if (!proxiesByGroup[groupMd5]) {
            proxiesByGroup[groupMd5] = {};
        }
        proxiesByGroup[groupMd5][yamlFileName] = proxies;
        // const originalConfigProxies = JSON.parse(JSON.stringify(configProxies));



        // if (matchingUrlEntity) {
        //     const expiryTime = matchingUrlEntity.expiryTime;
        //     if (expiryTime) {
        //         const expiryDate = new Date(expiryTime);
        //         if (expiryDate < currentTime) {
        //             logger.logYellow(`Skipping expired file: ${yamlFileName}`);
        //             continue;
        //         } else {
        //             const remainingTime = expiryDate - currentTime;
        //             logger.logGreen(`${yamlFileName} is valid. Remaining time: ${Math.floor(remainingTime / (24 * 60 * 60 * 1000))} days and ${Math.floor((remainingTime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))} hours.`);
        //         }
        //     }
        // }

        // let summary = ['Before merging '];
        // for (const key in originalConfigProxies) {
        //     const count = originalConfigProxies[key].length;
        //     summary.push(`${key}: ${count}`);
        // }
        // logger.log(summary.join('; '));

        // configProxies = mergeProxies(proxies, configProxies);

        // summary = ['After merging '];
        // for (const key in configProxies) {
        //     const beforeLength = originalConfigProxies[key] ? originalConfigProxies[key].length : 0;
        //     const afterLength = configProxies[key].length;
        //     const added = afterLength - beforeLength;
        //     summary.push(`${key}: ${beforeLength}=>${afterLength},`);
        // }
        // logger.log(summary.join('; '));
    }

    // const proxyGroups = await parseProxyGroups(templatePath);
    // const mergedProxies = await processProxiesAndGroups(configProxies);
    // const processedProxyGroups = processProxyGroups(proxyGroups, mergedProxies);

    // const updatedProxyGroupsText = await replaceProxiesLinesAndSave(templatePath, mergedProxies.proxies.proxies, processedProxyGroups);
    // cleanUpOldFiles();
    // return updatedProxyGroupsText;
    return proxiesByGroup;
}


async function processYamlFiles(currentGroup = "default", template = "default", logPrefix = "") {
    let templatePath;
    if (template === "custom" && fs.existsSync(custom_template)) {
        templatePath = custom_template;
        logger.logGreen("Using custom template");
    } else {
        templatePath = clash_template;
        logger.logBlue("Using default clash template");
    }

    let configProxies = await parseYamlForProxies(templatePath, logPrefix);
    const { groupScribleData, groupMd5, groupJsonFile } = getGroupScribleData(currentGroup);
    const groupYamlsDir = path.join(yamls_dir, groupMd5);
    const files = fs.readdirSync(groupYamlsDir);
    if (files.length === 0) {
        logger.logYellow("No files found in the target directory.");
        return;
    }
    logger.log(files);
    const currentTime = new Date();
    for (const yamlFileName of files) {
        const yamlFilePath = path.join(groupYamlsDir, yamlFileName);
        const proxies = await parseYamlForProxies(yamlFilePath, logPrefix);
        // const originalConfigProxies = JSON.parse(JSON.stringify(configProxies));

        // const matchingUrlEntity = Object.values(groupScribleData).find(
        //     urlEntity => urlEntity.yaml_file_name === yamlFileName
        // );

        // if (matchingUrlEntity) {
        //     const expiryTime = matchingUrlEntity.expiryTime;
        //     if (expiryTime) {
        //         const expiryDate = new Date(expiryTime);
        //         if (expiryDate < currentTime) {
        //             logger.logYellow(`Skipping expired file: ${yamlFileName}`);
        //             continue;
        //         } else {
        //             const remainingTime = expiryDate - currentTime;
        //             logger.logGreen(`${yamlFileName} is valid. Remaining time: ${Math.floor(remainingTime / (24 * 60 * 60 * 1000))} days and ${Math.floor((remainingTime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))} hours.`);
        //         }
        //     }
        // }

        // let summary = ['Before merging '];
        // for (const key in originalConfigProxies) {
        //     const count = originalConfigProxies[key].length;
        //     summary.push(`${key}: ${count}`);
        // }
        // logger.log(summary.join('; '));

        // configProxies = mergeProxies(proxies, configProxies);

        // summary = ['After merging '];
        // for (const key in configProxies) {
        //     const beforeLength = originalConfigProxies[key] ? originalConfigProxies[key].length : 0;
        //     const afterLength = configProxies[key].length;
        //     const added = afterLength - beforeLength;
        //     summary.push(`${key}: ${beforeLength}=>${afterLength},`);
        // }
        // logger.log(summary.join('; '));
    }

    // const proxyGroups = await parseProxyGroups(templatePath);
    // const mergedProxies = await processProxiesAndGroups(configProxies);
    // const processedProxyGroups = processProxyGroups(proxyGroups, mergedProxies);

    // const updatedProxyGroupsText = await replaceProxiesLinesAndSave(templatePath, mergedProxies.proxies.proxies, processedProxyGroups);
    // cleanUpOldFiles();
    // return updatedProxyGroupsText;
}

async function startProxyServer() {
    clearObject(proxySet);
    getOrSetConfigValue('server_starting', true);
    logger.logGreen('Starting proxy server...');
    logger.logYellow('Loading groups, please wait...');

    const groupNames = getAllGroupNames();

    logger.logGreen('Available groups:');
    groupNames.forEach((groupName, index) => {
        logger.logYellow(`  ${index + 1}. ${groupName}`);
    });

    for (const group of groupNames) {
        const groupData = getGroupScribleData(group);
        logger.logBlue(`Starting proxy server... Downloading data for group: ${group}`);
        const downloadResult = await downloadYamlFiles(group, false, "Starting proxy server... \t", groupData.groupScribleData, groupData.groupMd5);
        logger.log(downloadResult);
        logger.logBlue(`Starting proxy server... Loading data for group: ${group}`);
        const result = await loadYamlFiles(group, "Starting proxy server... \t");
        logger.logGreen(`Starting proxy server... Finished processing group: ${group}`);
        console.log(result);
    }

    logger.logGreen('Started proxy server successfully!');
    logger.logYellow(`Started proxy server successfully!`);
    deleteConfigValue('server_starting');
    return 'All groups processed successfully';
}

async function getProxyNodeInfo(group) {
    const server_starting = getConfigValue('server_starting');
    if (server_starting) {
        return { success: false, message: 'Proxy server is not started yet.' };
    }
    await downloadYamlFiles(group);
    const result = await processYamlFiles(group);
    return result;
}

module.exports = {
    startProxyServer,
    processProxy,
    processYamlFiles,
    downloadYamlFiles,
    getProxyNodeInfo
};
