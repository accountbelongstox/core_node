const { findDoubleSpaces, processSoftwareInfo, calculateMaxSpaces, extractPackageIdAndVersion } = require('./winget_parse_utils.js');

function parseInstalledPackages(output) {
    const sections = output.split(/\-\-\-\-\-\-\-\-+/);

    if (sections.length < 2) return [];

    const headerSection = sections[0].trim();
    const contentSection = sections[1].trim();

    const lines = contentSection.split('\n').filter(line => line.trim());
    const packages = [];

    const normalLines = [];  // Array 1 for normal lines
    const ellipsisLines = [];  // Array 2 for lines with ellipsis
    const ellipsis = '…';
    const ellipsisLength = ellipsis.length;

    for (const line of lines) {
        const spaceInfo = findDoubleSpaces(line);
        let { firstDoubleSpaceStart, hasDoubleSpace, consecutiveSpaceLength } = spaceInfo;

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
        } else if (hasDoubleSpace) {
            normalLines.push(packageInfo);
        }
    }

    const spaceAnalysis = calculateMaxSpaces(normalLines, ellipsisLines);
    const { maxSpaceLength, maxSpaceByNormalLinesLength, maxSpaceByDotLength,
        filteredEllipsisLines, lengthFrequency, mostCommonLength } = spaceAnalysis;

    const spaceSource = maxSpaceByNormalLinesLength > 0 ? 'normalLines' : 'ellipsisLines';
    const comparisonInfo = `Found from ${spaceSource} with ${spaceSource === 'normalLines' ? normalLines.length : filteredEllipsisLines.length
        } entries`;

    const mergedPackages = [
        ...normalLines.map(item => ({
            ...item,
            softwareTitle: item.softwareTitle.trim().replace(/\r?\n/g, '')
        })),
        ...filteredEllipsisLines.map(item => ({
            ...item,
            softwareTitle: item.softwareTitle.trim().replace(/\r?\n/g, '')
        }))
    ];
    const nextContentAnalysisMergedPackages = analyzeNextContent(mergedPackages);

    return nextContentAnalysisMergedPackages;  // Return the merged array instead of packages
}

function processPackageInfo(nextContent, hasDoubleSpace, consecutiveSpaceLength, trailingSpaces, packageId) {
    const remainingContent = nextContent.split(packageId)[1]?.trim() || '';
    const version = remainingContent.split(/\s+/)[0] || '';

    return {
        packageId,
        version
    };
}

function analyzeNextContent(mergedPackagesInputArray) {
    const normalLines = [];
    const ellipsisLines = [];
    const ellipsis = '…';
    const ellipsisLength = ellipsis.length;

    mergedPackagesInputArray.forEach(item => {
        if (!item.nextContent) return;
        const nextContent = item.nextContent;
        const spaceInfo = findDoubleSpaces(nextContent);
        let { firstDoubleSpaceStart, hasDoubleSpace, consecutiveSpaceLength } = spaceInfo;

        let packageId = item.nextContent.substring(0, firstDoubleSpaceStart + consecutiveSpaceLength).trim();

        let trailingSpaces = 0;
        let contentEndIndex = firstDoubleSpaceStart + consecutiveSpaceLength;
        while (contentEndIndex < nextContent.length && nextContent[contentEndIndex] === ' ') {
            trailingSpaces++;
            contentEndIndex++;
        }

        if (nextContent.includes(ellipsis)) {
            const ellipsisIndex = nextContent.indexOf(ellipsis);
            consecutiveSpaceLength = ellipsisIndex + ellipsisLength;
            firstDoubleSpaceStart = (consecutiveSpaceLength + trailingSpaces) - 1;
            packageId = nextContent.substring(0, consecutiveSpaceLength).trim();
            const softItem = extractPackageIdAndVersion(nextContent, packageId)
            ellipsisLines.push({
                ...item,
                ...softItem,
            });
        } else if (hasDoubleSpace) {
            firstDoubleSpaceStart += trailingSpaces;
            const softItem = extractPackageIdAndVersion(nextContent, packageId)
            normalLines.push({
                ...item,
                ...softItem,
            });
        }
    });
    const spaceAnalysis = calculateMaxSpaces(normalLines, ellipsisLines);
    const { maxSpaceLength, maxSpaceByNormalLinesLength, maxSpaceByDotLength,
        filteredEllipsisLines, lengthFrequency, mostCommonLength } = spaceAnalysis;
    const mergedPackages = [
        ...normalLines.map(item => ({
            ...item,
        })),
        ...ellipsisLines.map(item => ({
            ...item,
        }))
    ];
    
    return mergedPackages;
}

module.exports = parseInstalledPackages; 