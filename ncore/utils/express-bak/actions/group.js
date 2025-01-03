const { ensureDirectoryExists, fileExists, formatFileName, readFirstLine, writeYamlFile, cleanUpOldFiles, getAbsolutePath } = require('../../utils/file_utils');
const { isValidUrl, saveJson, isValidStringWithProxies } = require('../../utils/data_utils');
const { saveYamlFile } = require('../../utils/data_save_utils');
const { standardResponse } = require('../../utils/html_utils');
const { generateMd5, extractDomainAsFilename, generateUniqueId } = require('../../utils/str_utils');
const { getGroupScribleData, ensureGroupsFileAndDefaultGroup, groups_json_file } = require('../../utils/group_utils');
const { deleteYamlFile } = require('../../utils/data_save_utils');

function createNewGroup(postData) {
    const newGroupName = postData.group_name || '';

    if (!newGroupName) {
        return standardResponse(false, "No group name provided.", null, 400);
    } else {
        const groups = ensureGroupsFileAndDefaultGroup();
        const groupMd5 = generateMd5(newGroupName);
        if (groupMd5 in groups) {
            return standardResponse(true, `Group '${newGroupName}' already exists.`, groups, 200);
        }
        groups[groupMd5] = {
            created_at: new Date().toISOString(),
            group_name: newGroupName,
            group_md5: groupMd5,
            subscription_count: 0
        };
        saveJson(groups_json_file, groups);
        return standardResponse(true, `Group '${newGroupName}' created successfully.`, groups, 200);
    }
}

async function addSubscribeUrl(postData) {
    const group = postData.group || 'default';
    let submittedUrl = postData.urlSubscribleText || '';
    const id = generateUniqueId();

    if (!isValidUrl(submittedUrl) && !isValidStringWithProxies(submittedUrl)) {
        return standardResponse(false, "Invalid URL. Please provide a valid URL.", null, 400);
    }
    const urlMd5 = generateMd5(submittedUrl);

    let { groupScribleData, groupMd5, groupJsonFile } = getGroupScribleData(group);

    const now = new Date();
    const expiryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const name = extractDomainAsFilename(submittedUrl);
    const formattedFileName = formatFileName(name);
    const yamlFileName = `${formattedFileName}.yaml`;

    const validStringWithProxies = isValidStringWithProxies(submittedUrl)
    if (validStringWithProxies) {
        const proxiesText = submittedUrl;
        saveYamlFile(yamlFileName, proxiesText, group);
        submittedUrl = `file::${yamlFileName}`;
    }
    
    let message;
    if (urlMd5 in groupScribleData) {
        groupScribleData[urlMd5] = {
            ...groupScribleData[urlMd5],
            submissionTime: now.toISOString(),
            expiryTime: expiryDate.toISOString(),
            md5: urlMd5,
            subscribe_url: submittedUrl,
            yaml_file_name: yamlFileName,
            id: groupScribleData[urlMd5].id || id,
            name: groupScribleData[urlMd5].name || name
        };
        message = "URL updated successfully.";
    } else {
        groupScribleData[urlMd5] = {
            submissionTime: now.toISOString(),
            md5: urlMd5,
            subscribe_url: submittedUrl,
            expiryTime: expiryDate.toISOString(),
            name: name,
            id: id,
            yaml_file_name: yamlFileName,
        };
        message = "URL submitted successfully.";
    }

    saveJson(groupJsonFile, groupScribleData);

    return standardResponse(true, message, groupScribleData[urlMd5], 200);
}

function groupDataRequest(postData) {
    const groupName = postData.group_name || '';
    if (!groupName) {
        return standardResponse(false, "Group name is required.", null, 400);
    } else {
        const GroupScribleData = getGroupScribleData(groupName);
        const { groupScribleData } = GroupScribleData;
        return standardResponse(true, "Group data retrieved successfully.", groupScribleData, 200);
    }
}

async function updateSubscribeUrl(postData) {
    const group = postData.group || 'default';
    const id = postData.id || '';
    let submissionTime = postData.submissionTime || '';
    let expiryTime = postData.expiryTime || '';
    const subscribeUrl = postData.subscribe_url || '';
    const urlMd5 = postData.url_md5 || '';

    if (!group || !id || !submissionTime || !expiryTime || !subscribeUrl || !urlMd5) {
        return standardResponse(false, "All fields are required and must not be empty.", null, 400);
    }

    try {
        submissionTime = new Date(parseInt(submissionTime));
        expiryTime = new Date(parseInt(expiryTime));
    } catch (error) {
        try {
            submissionTime = new Date(submissionTime);
            expiryTime = new Date(expiryTime);
        } catch (error) {
            return standardResponse(false, "Invalid date format.", null, 400);
        }
    }

    let { groupScribleData, groupMd5, groupJsonFile } = await getGroupScribleData(group);

    if (urlMd5 in groupScribleData) {
        groupScribleData[urlMd5] = {
            ...groupScribleData[urlMd5],
            submissionTime: submissionTime.toISOString(),
            expiryTime: expiryTime.toISOString(),
            subscribe_url: subscribeUrl,
            id: id
        };

        saveJson(groupJsonFile, groupScribleData);

        return standardResponse(true, "URL updated successfully.", groupScribleData[urlMd5], 200);
    }

    const allIds = Object.values(groupScribleData).map(entry => entry.id).filter(Boolean);
    const allMd5s = Object.keys(groupScribleData);

    return standardResponse(false, "No entry found with the provided MD5.", {
        submitted_id: id,
        submitted_md5: urlMd5,
        available_ids: allIds,
        available_md5s: allMd5s
    }, 404);
}

async function deleteSubscribeUrl(postData) {
    const group = postData.group || 'default';
    const urlMd5 = postData.url_md5;

    if (!urlMd5) {
        return standardResponse(false, "URL MD5 is required.", null, 400);
    }

    let { groupScribleData, groupMd5, groupJsonFile } = getGroupScribleData(group);

    if (urlMd5 in groupScribleData) {
        const yamlFileName = groupScribleData[urlMd5].yaml_file_name;
        if (yamlFileName) {
            deleteYamlFile(yamlFileName, group);
        }

        delete groupScribleData[urlMd5];
        saveJson(groupJsonFile, groupScribleData);
        return standardResponse(true, "URL and associated YAML file deleted successfully.", null, 200);
    } else {
        return standardResponse(false, "URL not found in the group.", null, 404);
    }
}

module.exports = {
    createNewGroup,
    addSubscribeUrl,
    groupDataRequest,
    updateSubscribeUrl,
    deleteSubscribeUrl
};