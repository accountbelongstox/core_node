const fs = require('fs');

function findDoubleSpaces(line) {
    let firstDoubleSpaceStart = -1;
    let spaceCount = 0;
    let hasDoubleSpace = false;
    let consecutiveSpaceLength = 0;

    for (let i = 0; i < line.length; i++) {
        if (line[i] === ' ') {
            spaceCount++;
            if (spaceCount === 2 && !hasDoubleSpace) {
                hasDoubleSpace = true;
                firstDoubleSpaceStart = i - 1;
                let j = i;
                while (j < line.length && line[j] === ' ') {
                    consecutiveSpaceLength++;
                    j++;
                }
                break;
            }
        } else {
            spaceCount = 0;
        }
    }

    return { firstDoubleSpaceStart, hasDoubleSpace, consecutiveSpaceLength };
}

function processNextContent(line, softwareTitle) {
    let nextContent = line.substring(softwareTitle.length)
        .trim().replace(/\r?\n/g, '')
        .trim().replace(/\r?\n/g, '');

    if (nextContent.endsWith('winget')) {
        nextContent = nextContent.slice(0, -6).trim();
    }

    return nextContent;
}

function processSoftwareInfo(line, softwareTitle, hasDoubleSpace, consecutiveSpaceLength, trailingSpaces, ellipsis, ellipsisLength) {
    let firstDoubleSpaceStart;

    if (softwareTitle.includes(ellipsis)) {
        const ellipsisIndex = softwareTitle.indexOf(ellipsis);
        consecutiveSpaceLength = ellipsisIndex + ellipsisLength;
        firstDoubleSpaceStart = (consecutiveSpaceLength + trailingSpaces) - 1;
        softwareTitle = softwareTitle.substring(0, consecutiveSpaceLength);
    } else {
        firstDoubleSpaceStart = trailingSpaces + consecutiveSpaceLength;
    }

    const totalSpaces = firstDoubleSpaceStart;
    const nextContent = processNextContent(line, softwareTitle);

    return {
        line: line.trim().replace(/\r?\n/g, ''),
        hasDoubleSpace,
        consecutiveSpaceLength,
        trailingSpaces,
        totalSpaces,
        softwareTitle,
        nextContent
    };
}

function calculateMaxSpaces(normalLines, ellipsisLines) {
    const lengthFrequency = {};
    ellipsisLines.forEach(item => {
        lengthFrequency[item.consecutiveSpaceLength] = (lengthFrequency[item.consecutiveSpaceLength] || 0) + 1;
    });

    let mostCommonLength = 0;
    let maxFrequency = 0;
    Object.entries(lengthFrequency).forEach(([length, frequency]) => {
        if (frequency > maxFrequency) {
            maxFrequency = frequency;
            mostCommonLength = parseInt(length);
        }
    });

    const filteredEllipsisLines = ellipsisLines.filter(item =>
        item.consecutiveSpaceLength === mostCommonLength);

    const maxSpaceByNormalLinesLength = normalLines.reduce((max, item) =>
        Math.max(max, item.consecutiveSpaceLength), 0);

    const maxSpaceByDotLength = filteredEllipsisLines.reduce((max, item) =>
        Math.max(max, item.consecutiveSpaceLength), 0);

    const maxSpaceLength = maxSpaceByNormalLinesLength > 0 ?
        maxSpaceByNormalLinesLength : maxSpaceByDotLength;

    return {
        maxSpaceLength,
        maxSpaceByNormalLinesLength,
        maxSpaceByDotLength,
        filteredEllipsisLines,
        lengthFrequency,
        mostCommonLength
    };
}

function extractPackageIdAndVersion(nextContent, packageId) {
    const remainingContent = nextContent.split(packageId)[1]?.trim() || '';
    const version = remainingContent.split(/\s+/)[0] || '';

    return {
        packageId,
        version
    };
}

function handleCache(cachePath, key, maxAge, useCache = true) {
    // If cache is disabled, return not exists
    if (!useCache) {
        return { exists: false };
    }

    try {
        if (!fs.existsSync(cachePath)) {
            return { exists: false };
        }

        const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const cachedItem = cache[key];

        if (!cachedItem) {
            return { exists: false };
        }

        const cacheAge = Date.now() - cachedItem.timestamp;
        if (cacheAge < maxAge) {
            return {
                exists: true,
                isValid: true,
                data: cachedItem.data
            };
        }

        return { exists: true, isValid: false };
    } catch (error) {
        return { exists: false, error };
    }
}

function updateCache(cachePath, key, data) {
    try {
        // Read existing cache or create new one
        let cache = {};
        if (fs.existsSync(cachePath)) {
            cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        }

        // Update cache with new data
        cache[key] = {
            timestamp: Date.now(),
            data
        };

        // Save updated cache
        fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
        return true;
    } catch (error) {
        return false;
    }
}

function isValidVersion(str) {
    // Check for empty string or undefined
    if (!str || typeof str !== 'string') {
        return false;
    }

    // Convert to lowercase for case-insensitive comparison
    const lowerStr = str.toLowerCase();

    // Check for invalid keywords
    if (lowerStr.includes('unknown')) {
        return false;
    }

    // Must contain at least one dot
    if (!str.includes('.')) {
        return false;
    }

    // Split by dots and check each part
    const parts = str.split('.');
    if (parts.length < 2) {  // Must have at least 2 parts
        return false;
    }

    // Each part should contain at least one alphanumeric character
    const hasValidParts = parts.every(part => 
        part.length > 0 && /^[a-zA-Z0-9]+$/.test(part)
    );

    return hasValidParts;
}

function normalizeKeywords(keywords) {
    if (!keywords) return [];
    if (Array.isArray(keywords)) return keywords;
    if (typeof keywords === 'string') {
        return keywords.split(',').map(k => k.trim()).filter(k => k);
    }
    return [];
}

function calculateMatchScore(item, keywords) {
    const itemLower = {
        name: item.name.toLowerCase(),
        id: item.id.toLowerCase(),
        version: item.version.toLowerCase(),
        source: item.source.toLowerCase()
    };

    let score = 0;
    for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        if (itemLower.name.includes(keywordLower)) score++;
        if (itemLower.id.includes(keywordLower)) score++;
        if (itemLower.version.includes(keywordLower)) score++;
        if (itemLower.source.includes(keywordLower)) score++;
    }
    return score;
}

function sortSearchResults(results, searchTerms) {

    const keywords = normalizeKeywords(searchTerms);
    
    // Helper functions
    const isAllNonEmpty = item =>
        item.name && item.id && isValidVersion(item.version) && item.source;

    const sorted = results.sort((a, b) => {
        // First compare match scores
        const aScore = calculateMatchScore(a, keywords);
        const bScore = calculateMatchScore(b, keywords);
        if (aScore !== bScore) {
            return bScore - aScore; // Higher score first
        }

        // If scores are equal, continue with existing priority rules
        const aValid = isValidVersion(a.version);
        const bValid = isValidVersion(b.version);

        // First level: Valid version vs Invalid version
        if (aValid !== bValid) {
            return aValid ? -1 : 1;
        }

        // Second level: Among valid versions
        if (aValid && bValid) {
            // Check completeness first
            const aComplete = isAllNonEmpty(a);
            const bComplete = isAllNonEmpty(b);
            
            if (aComplete !== bComplete) {
                return aComplete ? -1 : 1;
            }

            // If still tied, sort by version number
            return b.version.localeCompare(a.version, undefined, { numeric: true });
        }

        // Third level: Among invalid versions
        const aComplete = isAllNonEmpty(a);
        const bComplete = isAllNonEmpty(b);
        if (aComplete !== bComplete) {
            return aComplete ? -1 : 1;
        }

        return a.name.localeCompare(b.name);
    });


    return sorted;
}

module.exports = {
    findDoubleSpaces,
    processSoftwareInfo,
    processNextContent,
    calculateMaxSpaces,
    extractPackageIdAndVersion,
    handleCache,
    updateCache,
    isValidVersion,
    normalizeKeywords,
    calculateMatchScore,
    sortSearchResults
}; 