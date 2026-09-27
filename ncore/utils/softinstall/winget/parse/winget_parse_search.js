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