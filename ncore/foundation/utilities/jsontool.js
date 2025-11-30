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

const logger = require('#@logger');

function copy(originJSON, option = {}) {
    let optionCopy = { ...originJSON, ...option };
    return optionCopy;
}

function merge(originJSON, option = {}) {
    let optionCopy = { ...originJSON, ...option };
    return optionCopy;
}

function deepUpdate(target, source) {
    if (typeof target !== "object") {
        target = {}
    }
    if (typeof source !== "object") {
        return target
    }
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (typeof source[key] === 'object' && typeof target[key] === 'object') {
                deepUpdate(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }
    return target
}

function printKeys(obj, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) return;
    for (let key in obj) {
        logger.debug('  '.repeat(depth) + key);
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            printKeys(obj[key], depth + 1, maxDepth);
        }
    }
}

function containsAnyKey(obj, targetKeys) {
    if (typeof obj !== 'object' || obj === null) return false;
    for (let key in obj) {
        if (targetKeys.some(targetKey => key.toLowerCase() === targetKey.toLowerCase())) return true;
        if (typeof obj[key] === 'object') {
            if (containsAnyKey(obj[key], targetKeys)) return true;
        }
    }
    return false;
}

function serializeData(data, maxDepth = 100, currentDepth = 0, seen = new Set(), exclude = {}) {
    function serialize(obj, maxDepth = 100, currentDepth = 0, seen = new Set(), exclude = {}) {
        if (currentDepth >= maxDepth) { return null; }
        if (obj === null || typeof obj !== 'object') { return obj; }
        if (seen.has(obj)) { return null; }
        seen.add(obj);
        let result = Array.isArray(obj) ? [] : {};
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                let value = obj[key];
                if (exclude.hasOwnProperty(key)) {
                    if (exclude[key].value != undefined) {
                        result[key] = exclude[key].value;
                    }
                    continue;
                }
                if (typeof value === 'function') {
                    result[key] = null;
                    continue;
                }
                result[key] = serialize(value, maxDepth, currentDepth + 1, seen, exclude);
            }
        }
        seen.delete(obj);
        return result;
    }

    data = serialize(data, maxDepth, currentDepth, seen, exclude)
    return data
}

function strToJSON(data) {
    if (Buffer.isBuffer(data)) {
        data = data.toString('utf-8');
    }
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (e) {
            logger.debug('strToJSON');
            logger.debug(e);
            return {}
        }
    }
    return data
}

function toJSON(data, maxDepth = 100, currentDepth = 0, seen = new Set(), exclude = {}) {
    if (typeof data === 'string') {
        return strToJSON(data)
    } else {
        return serializeData(data, maxDepth, currentDepth, seen, exclude)
    }
}

function toJSONSimple(data) {
    if (typeof data === 'string') {
        return strToJSON(data)
    } else {
        return data
    }
}

function findOneByKey(json, keyToFind) {
    function search(obj) {
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const result = search(item);
                if (result) {
                    return result;
                }
            }
        } else if (obj && typeof obj === 'object') {
            for (const [key, value] of Object.entries(obj)) {
                if (key === keyToFind) {
                    return value;
                }
                if (typeof value === 'object') {
                    const result = search(value);
                    if (result) {
                        return result;
                    }
                }
            }
        }
        return null;
    }
    return search(json);
}

function findByKey(json, keyToFind) {
    let results = [];
    function search(obj) {
        if (Array.isArray(obj)) {
            obj.forEach(item => search(item));
        } else if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach(key => {
                if (key === keyToFind) {
                    results.push(obj[key]);
                } else if (obj[key] && typeof obj[key] === 'object') {
                    search(obj[key]);
                }
            });
        }
    }
    search(json);
    return results;
}

function isNotEmptyObject(data) {
    if (typeof data === 'object' && data !== null) {
        return Object.keys(data).length > 0;
    }
    return false;
}

function isValideJson(data) {
    if (typeof data === 'object' && data !== null) {
        return true;
    }
    return false;
}

module.exports = {
    copy,
    merge,
    deepUpdate,
    printKeys,
    containsAnyKey,
    serializeData,
    strToJSON,
    toJSON,
    toJSONSimple,
    findOneByKey,
    findByKey,
    isNotEmptyObject,
    isValideJson
};