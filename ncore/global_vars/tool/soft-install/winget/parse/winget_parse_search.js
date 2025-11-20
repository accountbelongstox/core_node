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

const { 
    findDoubleSpaces, 
    processSoftwareInfo, 
    sortSearchResults 
} = require('./winget_parse_utils.js');

function parseSearchResults(output, searchTerm) {
    const sections = output.split(/\-\-\-\-\-\-\-\-+/);
    if (sections.length < 2) return [];

    const contentSection = sections[1].trim();
    const lines = contentSection.split('\n').filter(line => line.trim());

    const normalLines = [];  // Array for normal lines
    const ellipsisLines = []; // Array for lines with ellipsis
    const ellipsis = '…';
    const ellipsisLength = ellipsis.length;

    for (const line of lines) {
        const spaceInfo = findDoubleSpaces(line);
        let { firstDoubleSpaceStart, hasDoubleSpace, consecutiveSpaceLength } = spaceInfo;

        if (!hasDoubleSpace) continue;

        let softwareTitle = line.substring(0, firstDoubleSpaceStart + consecutiveSpaceLength);
        let trailingSpaces = 0;
        let contentEndIndex = firstDoubleSpaceStart + consecutiveSpaceLength;

        while (contentEndIndex < line.length && line[contentEndIndex] === ' ') {
            trailingSpaces++;
            contentEndIndex++;
        }

        const packageInfo = processSoftwareInfo(
            line,
            softwareTitle,
            hasDoubleSpace,
            consecutiveSpaceLength,
            trailingSpaces,
            ellipsis,
            ellipsisLength
        );

        if (softwareTitle.includes(ellipsis)) {
            ellipsisLines.push(packageInfo);
        } else {
            normalLines.push(packageInfo);
        }
    }

    // Merge and process results
    const mergedResults = [
        ...normalLines,
        ...ellipsisLines
    ].map(item => ({
        name: item.softwareTitle.trim(),
        id: item.nextContent.split(/\s+/)[0] || '',
        version: item.nextContent.split(/\s+/)[1] || '',
        source: item.nextContent.split(/\s+/).slice(2).join(' ').trim()
    }));

    const sortedResults = sortSearchResults(mergedResults, searchTerm);

    return sortedResults;
}

module.exports = {
    parseSearchResults
}; 