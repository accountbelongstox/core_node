const path = require('path');
const fs = require('fs');
const { ensureDirectoryExists, fileExists, formatFileName, readFirstLine, writeYamlFile, cleanUpOldFiles, getAbsolutePath } = require('./file_utils');
const { sendGetRequest, generateApiUrls, isValidContent } = require('./network_utils');
const { parseYamlForProxies, mergeProxies } = require('./yaml_utils');
const { processProxiesAndGroups, replaceProxiesLinesAndSave, processProxyGroups } = require('./yaml_replace_utils');
const { parseProxyGroups } = require('./parse_proxy_groups');
const { getGroupScribleData } = require('./group_utils');
const { yamls_dir, clash_template,custom_template } = require('../provider/global_var');
const logger = require('./log_utils');

class ProxyProcessor {
    constructor() {
    }

    async processFiles(currentGroup = "default", template = "default") {
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

        await this.downloadYamlFiles(groupScribleData, groupYamlsDir);
        return await this.processYamlFiles(groupYamlsDir, groupScribleData, configProxies, templatePath);
    }

    async downloadYamlFiles(groupScribleData, groupYamlsDir) {
        if (groupScribleData) {
            for (const urlEntity of Object.values(groupScribleData)) {
                const url = urlEntity.subscribe_url;
                if (!url) {
                    logger.logYellow(`No valid content found in ${urlEntity.name}`);
                    continue;
                }
                if (url.startsWith('file::')) {
                    logger.logBlue(`This is a file: ${urlEntity.name}`);
                    continue;
                }
                const fileName = urlEntity.name;
                let yamlFileName = urlEntity.yaml_file_name;
                if (!yamlFileName) {
                    yamlFileName = formatFileName(fileName);
                    yamlFileName = `${yamlFileName}.yaml`;
                }
                const yamlFilePath = path.join(groupYamlsDir, yamlFileName);
                if (!fileExists(yamlFilePath)) {
                    const apiUrls = generateApiUrls(url);

                    for (let index = 0; index < apiUrls.length; index++) {
                        const apiUrl = apiUrls[index];
                        logger.log(`Trying URL ${index + 1}: ${apiUrl}`);

                        try {
                            const responseData = await sendGetRequest(apiUrl);

                            if (isValidContent(responseData)) {
                                logger.logGreen(`Valid content received for ${fileName} content-len: ${responseData.length}`);
                                const yamlContent = responseData.replace(/\n/g, '\n  ');
                                writeYamlFile(yamlFilePath, yamlContent);

                                logger.logGreen(`Content successfully processed from URL ${index + 1}. No need to try further URLs.`);
                                break;
                            } else {
                                logger.logYellow(`Invalid content from URL ${index + 1} for ${fileName}. Trying the next URL if available...`);
                            }
                        } catch (error) {
                            logger.logRed(`Error fetching data from URL ${index + 1} for ${fileName}: ${error}`);
                        }

                        logger.log("Waiting for 3 seconds before trying the next URL...");
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                    logger.log("Finished trying all URLs.");
                }
            }
        }
    }

    async processYamlFiles(groupYamlsDir, groupScribleData, configProxies, templatePath) {
        const files = fs.readdirSync(groupYamlsDir);
        if (files.length === 0) {
            logger.logYellow("No files found in the target directory.");
            return;
        }
        logger.log(files);
        const currentTime = new Date();
        for (const yamlFileName of files) {
            const yamlFilePath = path.join(groupYamlsDir, yamlFileName);
            const proxies = await parseYamlForProxies(yamlFilePath);

            const originalConfigProxies = JSON.parse(JSON.stringify(configProxies));

            const matchingUrlEntity = Object.values(groupScribleData).find(
                urlEntity => urlEntity.yaml_file_name === yamlFileName
            );

            if (matchingUrlEntity) {
                const expiryTime = matchingUrlEntity.expiryTime;
                if (expiryTime) {
                    const expiryDate = new Date(expiryTime);
                    if (expiryDate < currentTime) {
                        logger.logYellow(`Skipping expired file: ${yamlFileName}`);
                        continue;
                    } else {
                        const remainingTime = expiryDate - currentTime;
                        logger.logGreen(`${yamlFileName} is valid. Remaining time: ${Math.floor(remainingTime / (24 * 60 * 60 * 1000))} days and ${Math.floor((remainingTime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))} hours.`);
                    }
                }
            }

            let summary = ['Before merging '];
            for (const key in originalConfigProxies) {
                const count = originalConfigProxies[key].length;
                summary.push(`${key}: ${count}`);
            }
            logger.log(summary.join('; '));

            configProxies = mergeProxies(proxies, configProxies); 

            summary = ['After merging '];
            for (const key in configProxies) {
                const beforeLength = originalConfigProxies[key] ? originalConfigProxies[key].length : 0;
                const afterLength = configProxies[key].length;
                const added = afterLength - beforeLength;
                summary.push(`${key}: ${beforeLength}=>${afterLength},`);
            }
            logger.log(summary.join('; '));
        }

        const proxyGroups = await parseProxyGroups(templatePath);
        const mergedProxies = await processProxiesAndGroups(configProxies);
        const processedProxyGroups = processProxyGroups(proxyGroups, mergedProxies);

        const updatedProxyGroupsText = await replaceProxiesLinesAndSave(templatePath, mergedProxies.proxies.proxies, processedProxyGroups);
        cleanUpOldFiles();
        return updatedProxyGroupsText;
    }
}

module.exports = ProxyProcessor;
