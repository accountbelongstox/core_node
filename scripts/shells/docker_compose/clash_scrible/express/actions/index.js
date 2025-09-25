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

const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const { respondWithJson, standardResponse } = require('../../utils/html_utils');
const { ensureGroupsFileAndDefaultGroup, getGroupScribleData } = require('../../utils/group_utils');
const { static_dir } = require('../../provider/global_var');
const { generateMd5 } = require('../../utils/str_utils');

async function renderForm(currentUrl, currentGroup = "default") {
    const currentGroupMd5 = generateMd5(currentGroup);
    const htmlContent = await fs.readFile(path.join(static_dir, 'form.html'), 'utf-8');

    const { groupScribleData, groupMd5, groupJsonFile } = await getGroupScribleData(currentGroup);
    const jsonDataDisplay = JSON.stringify(groupScribleData, null, 2);
    const subscriptionUrl = new URL(`sub?group=${currentGroup}`, currentUrl).href;

    const groups = await ensureGroupsFileAndDefaultGroup();
    let groupOptions = "";
    for (const [groupMd5, groupData] of Object.entries(groups)) {
        const groupName = groupData.group_name;
        const selected = groupName === currentGroup ? 'selected' : '';
        groupOptions += `<option value="${groupName}" ${selected}>${groupName}</option>\n`;
    }

    // Replace placeholders in HTML
    let updatedHtmlContent = htmlContent
        .replace('{{jsonData}}', jsonDataDisplay)
        .replace('{{subscriptionUrl}}', subscriptionUrl)
        .replace('{{groupOptions}}', groupOptions)
        .replace('{{currentGroup}}', currentGroup)
        .replace('{{currentGroupMD5}}', currentGroupMd5);

    return updatedHtmlContent;
}

async function renderIndex(currentGroup, currentUrl) {
    try {
        const htmlContent = await renderForm(currentUrl, currentGroup);
        return standardResponse(true, "Form loaded.", htmlContent, 200);
    } catch (error) {
        console.error("Error in renderIndex:", error);
        return standardResponse(false, "Failed to render index", null, 500);
    }
}

module.exports = {
    renderIndex
};