const path = require('path');
const fs = require('fs');
const { ensureDirectoryExists, fileExists, formatFileName, writeYamlFile } = require('./file_utils');
const { sendGetRequest, generateApiUrls, isValidContent } = require('./network_utils');
const { getGroupScribleData } = require('./group_utils');
const { yamls_dir } = require('../provider/global_var');
const logger = require('./log_utils');
const { parseYamlForProxies, mergeProxies } = require('./nyaml_utils');

async function downloadYamlFiles(currentGroup, forceDownload = false, logPrefix = "", groupScribleData = null, groupMd5 = null) {
    if (!groupScribleData || !groupMd5) {
        const groupData = getGroupScribleData(currentGroup);
        groupScribleData = groupData.groupScribleData;
        groupMd5 = groupData.groupMd5;
    }

    const groupYamlsDir = path.join(yamls_dir, groupMd5);

    const summary = {
        group: currentGroup,
        totalFiles: 0,
        skipped: [],
        downloadSuccess: [],
        downloadFailed: [],
        redownloaded: [],
        expired: [],
        fileErrors: [],
        invalidContent: []
    };

    if (!groupScribleData || Object.keys(groupScribleData).length === 0) {
        logger.logRed(`${logPrefix}No valid group data found for group: ${currentGroup}`);
        logger.logYellow(`${logPrefix}Possible reasons:`);
        logger.log(`${logPrefix}1. The group does not exist.`);
        logger.log(`${logPrefix}2. The group exists but has no subscription nodes.`);
        logger.log(`${logPrefix}3. There might be an issue with the group data file.`);
        logger.logBlue(`${logPrefix}Suggestions:`);
        logger.log(`${logPrefix}- Check if the group name is correct.`);
        logger.log(`${logPrefix}- Ensure that you have added subscription nodes to this group.`);
        logger.log(`${logPrefix}- Verify the integrity of the group data file.`);
        return summary;
    }

    for (const urlEntity of Object.values(groupScribleData)) {
        summary.totalFiles++;
        const url = urlEntity.subscribe_url;
        if (!url) {
            logger.logYellow(`${logPrefix}No valid content found in ${urlEntity.name}`);
            summary.fileErrors.push(urlEntity.name);
            continue;
        }
        if (url.startsWith('file::')) {
            logger.logYellow(`${logPrefix}${urlEntity.name} is a file. Skipping URL download. This file will be read and parsed directly.`);
            summary.skipped.push(urlEntity.name);
            continue;
        }
        const fileName = urlEntity.name;
        let yamlFileName = urlEntity.yaml_file_name;
        if (!yamlFileName) {
            yamlFileName = formatFileName(fileName);
            yamlFileName = `${yamlFileName}.yaml`;
        }
        const yamlFilePath = path.join(groupYamlsDir, yamlFileName);
        const tempFilePath = `${yamlFilePath}.temp`;

        const shouldDownload = forceDownload || !fileExists(yamlFilePath) || isFileOlderThanOneDay(yamlFilePath);

        if (shouldDownload) {
            if (fileExists(yamlFilePath) && isFileOlderThanOneDay(yamlFilePath)) {
                summary.expired.push(yamlFileName);
            }
            if (forceDownload || fileExists(yamlFilePath)) {
                summary.redownloaded.push(yamlFileName);
            }

            const apiUrls = await generateApiUrls(url);
            let downloadSuccess = false;
            for (let index = 0; index < apiUrls.length; index++) {
                const apiUrl = apiUrls[index];
                logger.log(`${logPrefix}Trying URL ${index + 1}: ${apiUrl}`);
                try {
                    const responseData = await sendGetRequest(apiUrl);
                    if (isValidContent(responseData)) {
                        logger.logGreen(`${logPrefix}Valid content received for ${fileName} content-len: ${responseData.length}`);
                        const yamlContent = responseData.replace(/\n/g, '\n  ');
                        writeYamlFile(tempFilePath, yamlContent);
                        
                        const proxies = await parseYamlForProxies(yamlFilePath,logPrefix);
                        const proxiesCount = Object.values(proxies.proxies).length;
                        console.log(`proxiesCount ${proxiesCount}`);
                        if (proxiesCount > 0) {
                            if (fileExists(yamlFilePath)) {
                                fs.unlinkSync(yamlFilePath);
                                logger.logYellow(`${logPrefix}Replaced existing file: ${yamlFilePath}`);
                            }
                            fs.renameSync(tempFilePath, yamlFilePath);
                            logger.logGreen(`${logPrefix}Content successfully processed from URL ${index + 1} and saved to ${yamlFilePath}`);
                            downloadSuccess = true;
                            summary.downloadSuccess.push(yamlFileName);
                        } else {
                            logger.logYellow(`${logPrefix}No valid proxies found in the downloaded content for ${fileName}`);
                            fs.unlinkSync(tempFilePath);
                            summary.invalidContent.push(yamlFileName);
                        }
                        break;
                    } else {
                        logger.logYellow(`${logPrefix}Invalid content from URL ${index + 1} for ${fileName}. Trying the next URL if available...`);
                        if (fileExists(tempFilePath)) {
                            fs.unlinkSync(tempFilePath);
                            logger.logYellow(`${logPrefix}Deleted temporary file due to invalid content: ${tempFilePath}`);
                        }
                        summary.invalidContent.push(yamlFileName);
                    }
                } catch (error) {
                    logger.logRed(`${logPrefix}Error fetching data from URL ${index + 1} for ${fileName}: ${error}`);
                    if (fileExists(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                        logger.logYellow(`${logPrefix}Deleted temporary file due to error: ${tempFilePath}`);
                    }
                }

                logger.log(`${logPrefix}Waiting for 3 seconds before trying the next URL...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            if (!downloadSuccess) {
                summary.downloadFailed.push(yamlFileName);
            }
            logger.log(`${logPrefix}Finished trying all URLs.`);
        } else {
            logger.logBlue(`${logPrefix}Skipping download for ${yamlFileName} as it's up to date.`);
            summary.skipped.push(yamlFileName);
        }
    }

    // 计算���结信息
    summary.totalSkipped = summary.skipped.length;
    summary.totalDownloadSuccess = summary.downloadSuccess.length;
    summary.totalDownloadFailed = summary.downloadFailed.length;
    summary.totalRedownloaded = summary.redownloaded.length;
    summary.totalExpired = summary.expired.length;
    summary.totalFileErrors = summary.fileErrors.length;
    summary.totalInvalidContent = summary.invalidContent.length;

    return summary;
}

function isFileOlderThanOneDay(filePath) {
    const stats = fs.statSync(filePath);
    const fileAge = (new Date().getTime() - stats.mtime.getTime()) / (1000 * 3600 * 24);
    return fileAge > 1;
}

module.exports = {
    downloadYamlFiles
};
