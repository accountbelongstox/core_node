'use strict';

    const Base = require('#@base');

    class JSON_ extends Base {
        constructor() {
            super();
        }

        copy(originJSON, option = {}) {
            return { ...originJSON, ...option };
        }

        merge(originJSON, option = {}) {
            return { ...originJSON, ...option };
        }

        deepUpdate(target, source) {
            if (typeof target !== 'object' || target === null) {
                target = {};
            }
            if (typeof source !== 'object' || source === null) {
                return target;
            }
            for (const key in source) {
                if (source.hasOwnProperty(key)) {
                    if (typeof source[key] === 'object' && typeof target[key] === 'object') {
                        this.deepUpdate(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            }
            return target;
        }

        printKeys(obj, depth = 0, maxDepth = 10) {
            if (depth > maxDepth) return;
            for (const key in obj) {
                console.log('  '.repeat(depth) + key);
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    this.printKeys(obj[key], depth + 1, maxDepth);
                }
            }
        }

        containsAnyKey(obj, targetKeys) {
            if (typeof obj !== 'object' || obj === null) return false;
            for (const key in obj) {
                if (targetKeys.some(targetKey => key.toLowerCase() === targetKey.toLowerCase())) return true;
                if (typeof obj[key] === 'object') {
                    if (this.containsAnyKey(obj[key], targetKeys)) return true;
                }
            }
            return false;
        }

        serializeData(data, maxDepth = 100, currentDepth = 0, seen = new Set(), exclude = {}) {
            const serialize = (obj, maxDepth = 100, currentDepth = 0, seen = new Set(), exclude = {}) => {
                if (currentDepth >= maxDepth) return null;
                if (obj === null || typeof obj !== 'object') return obj;
                if (seen.has(obj)) return null;
                seen.add(obj);
                const result = Array.isArray(obj) ? [] : {};
                for (const key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        const value = obj[key];
                        if (exclude.hasOwnProperty(key)) {
                            if (exclude[key].value !== undefined) {
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
            };

            return serialize(data, maxDepth, currentDepth, seen, exclude);
        }

        strToJSON(data) {
            if (Buffer.isBuffer(data)) {
                data = data.toString('utf-8');
            }
            try {
                return JSON.parse(data);
            } catch (e) {
                console.log('strToJSON');
                console.log(e);
                return {};
            }
        }

        toJSON(data, maxDepth = 100, currentDepth = 0, seen = new Set(), exclude = {}) {
            if (typeof data === 'string') {
                return this.strToJSON(data);
            } else {
                return this.serializeData(data, maxDepth, currentDepth, seen, exclude);
            }
        }

        findOneByKey(json, keyToFind) {
            const search = (obj) => {
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
            };
            return search(json);
        }

        findByKey(json, keyToFind) {
            const results = [];
            const search = (obj) => {
                if (Array.isArray(obj)) {
                    obj.forEach(item => search(item));
                } else if (obj && typeof obj === 'object') {
                    for (const key in obj) {
                        if (key === keyToFind) {
                            results.push(obj[key]);
                        } else if (obj[key] && typeof obj[key] === 'object') {
                            search(obj[key]);
                        }
                    }
                }
            };

            search(json);

            return results;
        }
    }

    JSON_.toString = () => '[class JSON]';
    module.exports = new JSON_();