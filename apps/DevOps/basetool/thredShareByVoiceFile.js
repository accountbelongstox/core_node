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

const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
function isDebugEnabled() {
    const args = process.argv.slice(2); // Exclude node and script path
    for (const arg of args) {
        const [key, value] = arg.split('=').map(str => str.trim().toLowerCase());

        if (key === 'debug') {
            if (value != "false" || value != "0") {
                return true
            }
            return false;
        }

        if (key === 'debug=true') return true; // Handles cases like --DEBUG=true
        if (key == 'debug=false') return false;
    }

    return false; // Default is false if not found
}
const isDebug = isDebugEnabled()
const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    debug: (...args) => isDebug ? console.log('[DEBUG]', ...args) : null,
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    success: (...args) => console.log('[SUCCESS]', ...args),
}

const CACHE_DIR = path.join(__dirname, '..', '..', '..', '.cache', 'thredShareByVoiceFile');

// Ensure cache directory exists
function ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}
function getContentMd5(contentOrItem) {
    const content = typeof contentOrItem === 'string' ? contentOrItem : contentOrItem.content;
    const md5 = crypto.createHash('md5').update(content).digest('hex');
    return { content, md5 };
}
ensureCacheDir();

function updatePriorityMap() {
    const priorityMap = new Map();
    try {
        const files = fs.readdirSync(CACHE_DIR);

        files.forEach(file => {
            const match = file.match(/Priority-(-?\d+)-([a-f0-9]{32})\.shared/);
            if (match) {
                const priority = parseInt(match[1]);
                const md5 = match[2];
                const cachePath = path.join(CACHE_DIR, file);

                const content = fs.readFileSync(cachePath, 'utf-8');

                priorityMap.set(md5, {
                    priority,
                    cachePath,
                    filename: file,
                    content
                });
            }
        });

        logger.debug(`Updated priority map with ${priorityMap.size} items`);
    } catch (error) {
        logger.error(`Error updating priority map: ${error.message}`);
    }

    return priorityMap;
}

function getMaxPriority() {
    const map = updatePriorityMap();
    let max = 0;
    map.forEach(item => {
        if (item.priority > max) max = item.priority;
    });
    return max;
}

function getMinPriority() {
    const map = updatePriorityMap();
    let min = 0;
    let hasItems = false;
    map.forEach(item => {
        if (!hasItems || item.priority < min) {
            min = item.priority;
            hasItems = true;
        }
    });
    return hasItems ? min : 0;
}

function generatePriority() {
    const max = getMaxPriority();
    const min = getMinPriority();
    return (max === 0 && min === 0) ? 0 :
        (Math.random() > 0.5 ? max + 1 : min - 1);
}

function generateCacheFileName(contentOrItem, priority) {
    const { content, md5 } = getContentMd5(contentOrItem);
    const priorityNum = priority !== undefined ? priority : generatePriority();
    return path.join(CACHE_DIR, `Priority-${priorityNum}-${md5}.shared`);
}

function addItem(contentOrItem, priority = null) {
    const { md5, content } = getContentMd5(contentOrItem);
    const currentMap = updatePriorityMap();

    if (currentMap.has(md5)) {
        logger.debug(`Item already exists in cache: ${md5}`);
        return false;
    }

    const cachePath = generateCacheFileName(content, priority);

    try {
        fs.writeFileSync(cachePath, content, 'utf-8');
        logger.debug(`Added new item: ${path.basename(cachePath)}`);
        return true;
    } catch (error) {
        logger.error(`Failed to add item: ${error.message}`);
        return false;
    }
}

function removeItem(contentOrItem) {
    const { md5, content } = getContentMd5(contentOrItem);
    const currentMap = updatePriorityMap();
    const item = currentMap.get(md5);

    if (!item) return false;

    try {
        fs.unlinkSync(item.cachePath);
        logger.debug(`Removed item: ${item.filename}`);
        return true;
    } catch (error) {
        logger.error(`Failed to remove item: ${error.message}`);
        return false;
    }
}

function getItem(contentOrItem) {
    const { md5, content } = getContentMd5(contentOrItem);
    const currentMap = updatePriorityMap();
    const item = currentMap.get(md5);
    return item ? item.content : null;
}

function getSortedItems() {
    const map = updatePriorityMap();
    return Array.from(map.entries())
        .map(([md5, data]) => ({ md5, ...data }))
        .sort((a, b) => b.priority - a.priority);
}

function getFrontItem() {
    const items = getSortedItems();
    return items.length > 0 ? items[0].content : null;
}

function getBackItem() {
    const items = getSortedItems();
    return items.length > 0 ? items[items.length - 1].content : null;
}

function popFrontItem() {
    const front = getSortedItems()[0];
    if (!front) return null;

    removeItem(front.content);
    return front.content;
}

function popBackItem() {
    const items = getSortedItems();
    const back = items[items.length - 1];
    if (!back) return null;

    removeItem(back.content);
    return back.content;
}

module.exports = {
    updatePriorityMap,
    addItem,
    addFront: (contentOrItem) => addItem(contentOrItem, getMaxPriority() + 1),
    addBack: (contentOrItem) => addItem(contentOrItem, getMinPriority() - 1),
    removeItem,
    getItem,
    getItemCount: () => updatePriorityMap().size,
    getFrontItem,
    getBackItem,
    popFrontItem,
    popBackItem,
    getSortedItems,
    hasItem: (contentOrItem) => {
        const { md5 } = getContentMd5(contentOrItem);
        return updatePriorityMap().has(md5);
    }
};