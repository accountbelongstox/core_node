const path = require('path');
const { generateMd5 } = require('./str_utils');
const { ensureJsonFile, fileExists } = require('./file_utils');
const { loadJson, saveJson } = require('./data_utils');
const { groups_json_file, groups_dir } = require('../provider/global_var');
const logger = require('./log_utils');

function ensureGroupsFileAndDefaultGroup() {
    ensureJsonFile(groups_json_file, {});
    const groups = loadJson(groups_json_file, {});
    const defaultGroupMd5 = generateMd5('default');
    if (!(defaultGroupMd5 in groups)) {
        groups[defaultGroupMd5] = {
            created_at: new Date().toISOString(),
            group_name: 'default',
            group_md5: defaultGroupMd5,
            subscription_count: 0
        };
        saveJson(groups_json_file, groups);
    }
    return groups;
}

function handleNewGroup(newGroupName) {
    const groups = ensureGroupsFileAndDefaultGroup();
    const groupMd5 = generateMd5(newGroupName);
    if (groupMd5 in groups) {
        return `Group '${newGroupName}' already exists.`;
    }
    groups[groupMd5] = {
        created_at: new Date().toISOString(),
        group_name: newGroupName,
        group_md5: groupMd5,
        subscription_count: 0
    };
    saveJson(groups_json_file, groups);
    return `Group '${newGroupName}' added successfully.`;
}

function ensureDefaultGroupExists() {
    const defaultGroupName = "default";
    const defaultGroupMd5 = generateMd5(defaultGroupName);
    const defaultGroup = {};
    const defaultValue = {
        created_at: new Date().toISOString(),
        group_name: 'default',
        group_md5: defaultGroupMd5,
        subscription_count: 0
    };
    defaultGroup[defaultGroupMd5] = defaultValue;
    if (!fileExists(groups_json_file)) {
        saveJson(groups_json_file, defaultGroup);
    } else {
        const groups = loadJson(groups_json_file);
        if (!Object.values(groups).some(group => group.group_name === 'default')) {
            groups[defaultGroupMd5] = defaultValue;
            saveJson(groups_json_file, groups);
        }
    }
}

function getGroupScribleData(group) {
    const groupMd5 = generateMd5(group);
    const groupJsonFile = path.join(groups_dir, `${groupMd5}.json`);
    ensureJsonFile(groupJsonFile, {});
    let groupScribleData = loadJson(groupJsonFile);
    
    logger.logBlue(`Group JSON File: ${groupJsonFile}`);
    logger.logGreen('Group Scrible Data:');

    const currentTime = new Date();
    let hasChanges = false;

    for (const [key, item] of Object.entries(groupScribleData)) {
        if (!item.name) {
            const subscribeUrl = item.subscribe_url;
            const newName = subscribeUrl ? extractDomainAsFilename(subscribeUrl) : getCurrentTimestamp();
            if (item.name !== newName) {
                item.name = newName;
                hasChanges = true;
            }
        }

        if (item.expiryTime) {
            const expiryDate = new Date(item.expiryTime);
            if (expiryDate > currentTime) {
                const remainingTime = expiryDate - currentTime;
                const days = Math.floor(remainingTime / (24 * 60 * 60 * 1000));
                const hours = Math.floor((remainingTime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                item.remainingTime = `${days} days and ${hours} hours`;
            } else {
                item.remainingTime = 'Expired';
            }
        } else {
            item.remainingTime = 'No expiry date set';
        }

        logger.logYellow(`  ${key}:`);
        logger.log(`    Name: ${item.name || 'Not set'}`);
        logger.log(`    Subscribe URL: ${item.subscribe_url || 'Not set'}`);
        logger.log(`    YAML File Name: ${item.yaml_file_name || 'Not set'}`);
        logger.log(`    Expiry Time: ${item.expiryTime || 'Not set'}`);
        logger.log(`    Remaining Time: ${item.remainingTime}`);
    }

    if (hasChanges) {
        saveJson(groupJsonFile, groupScribleData);
        logger.logGreen('Changes detected and saved to the group file.');
    } else {
        logger.logBlue('No changes detected in the group data.');
    }
    return { groupScribleData, groupMd5, groupJsonFile };
}

function getAllGroupNames() {
    const groups = loadJson(groups_json_file, {});
    return Object.values(groups)
        .filter(item => item.group_name)
        .map(item => item.group_name);
}

function getAllGroupsData() {
    const groupNames = getAllGroupNames();
    const allGroupsData = {};
    
    for (const groupName of groupNames) {
        const { groupScribleData, groupMd5, groupJsonFile } = getGroupScribleData(groupName);
        allGroupsData[groupName] = {
            groupScribleData,
            groupMd5,
            groupJsonFile
        };
    }
    
    return allGroupsData;
}

module.exports = {
    ensureGroupsFileAndDefaultGroup,
    handleNewGroup,
    ensureDefaultGroupExists,
    getGroupScribleData,
    getAllGroupNames,
    getAllGroupsData
};
