const { getFileDetails } = require('./file_utils');
const logger = require('./log_utils');

function countLeadingSpaces(line) {
    return line.match(/^\s*/)[0].length;
}

function parseProxyGroups(fileDetails) {
    // If fileDetails is a string (file path), call getFileDetails to load the file content
    if (typeof fileDetails === 'string') {
        fileDetails = getFileDetails(fileDetails);
    }

    const lines = fileDetails.lines;
    let proxiesLineIndex = -1;
    let proxiesIndentation = 0;
    const proxiesRegex = /^\s*proxy-groups:/;

    // Step 1: Find the `proxy-groups:` line
    for (let i = 0; i < lines.length; i++) {
        if (proxiesRegex.test(lines[i])) {
            proxiesLineIndex = i;
            proxiesIndentation = countLeadingSpaces(lines[i]);  // Record the indentation of `proxy-groups:` line
            break;
        }
    }

    // If `proxy-groups:` line is not found, return early
    if (proxiesLineIndex === -1) {
        logger.log('No proxy-groups section found in the YAML file.');
        return [];
    }

    // Step 2: Find the end of the proxy-groups section by checking for less indentation
    let endLineIndex = lines.length;
    for (let i = proxiesLineIndex + 1; i < lines.length; i++) {
        const lineIndentation = countLeadingSpaces(lines[i]);
        if (lineIndentation <= proxiesIndentation) {
            endLineIndex = i;
            break;
        }
    }

    // Step 3: Extract the lines from the `proxy-groups:` section
    const proxyGroupLines = lines.slice(proxiesLineIndex + 1, endLineIndex);

    // Step 4: Find the minimum indentation level within the extracted lines
    const minIndentation = Math.min(...proxyGroupLines.filter(line => line.trim()).map(countLeadingSpaces));

    // Step 5: Group the lines into a 2D array based on the minimum indentation level
    const groupedProxies = [];
    let currentGroup = [];

    for (const line of proxyGroupLines) {
        const lineIndentation = countLeadingSpaces(line);

        // If the line has the minimum indentation, start a new group
        if (lineIndentation === minIndentation && line.trim().startsWith('-')) {
            if (currentGroup.length) {
                groupedProxies.push(currentGroup);  // Push the previous group
            }
            currentGroup = [line.trim()];  // Start a new group
        } else {
            // Otherwise, continue adding lines to the current group
            currentGroup.push(line.trim());
        }
    }

    // Push the last group if it exists
    if (currentGroup.length) {
        groupedProxies.push(currentGroup);
    }

    // Step 6: Process each group and return the structured object
    const structuredGroups = groupedProxies.map(group => {
        const result = { proxies: [] };
        let currentKey = null;
        for (const item of group) {
            // Handle the case where the line is `- name: ...`
            const nameMatch = item.match(/^\s*-\s*name:\s*(.*)/);
            if (nameMatch) {
                result.name = nameMatch[1];
            } else {
                // Split each line by ':' if possible
                const parts = item.split(':');
                if (parts.length > 1 && parts[1]) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join(':').trim();
                    result[key] = value;
                    currentKey = key;
                } else if (item.startsWith('-')) {
                    // If it's a proxy, add it to proxies array
                    result.proxies.push(item);
                }
            }
        }
        return result;
    });

    // Step 7: Filter names and proxies
    const validNames = ['DIRECT', 'REJECT', ...structuredGroups.map(group => group.name)];  // Extract all names
    const filteredGroups = structuredGroups.map(group => ({
        ...group,
        proxies: group.proxies
            .map(proxy => proxy.replace('- ', ''))
            .filter(proxy => validNames.includes(proxy))
    }));

    return filteredGroups;
}

// Example usage:
if (require.main === module) {
    const filePath = 'path/to/your/file.yaml';
    const result = parseProxyGroups(filePath);
    logger.log(JSON.stringify(result, null, 2));
}

module.exports = {
    parseProxyGroups
};