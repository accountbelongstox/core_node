/**
 * Encyclopedia - Global Key-Value Store
 *
 * Simple dictionary-based encyclopedia for storing and querying data.
 * Singleton pattern ensures single global instance.
 *
 * Usage:
 *   const { ENCYCLOPEDIA } = require('#@foundation');
 *   ENCYCLOPEDIA.add('config.port', 3000);
 *   const port = ENCYCLOPEDIA.get('config.port');
 */

class Encyclopedia {
    constructor() {
        if (Encyclopedia._instance) {
            return Encyclopedia._instance;
        }

        this._data = new Map();
        Encyclopedia._instance = this;
    }

    add(key, value) {
        this._data.set(key, value);
    }

    get(key, defaultValue = null) {
        return this._data.has(key) ? this._data.get(key) : defaultValue;
    }

    query(key) {
        return this.get(key);
    }

    has(key) {
        return this._data.has(key);
    }

    remove(key) {
        return this._data.delete(key);
    }

    clear() {
        this._data.clear();
    }

    keys() {
        return Array.from(this._data.keys());
    }

    values() {
        return Array.from(this._data.values());
    }

    items() {
        return Array.from(this._data.entries());
    }

    export() {
        const result = {};
        this._data.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    exportList() {
        const result = [];
        this._data.forEach((value, key) => {
            result.push({ key, value });
        });
        return result;
    }

    importDict(data, merge = false) {
        if (!merge) {
            this._data.clear();
        }

        Object.entries(data).forEach(([key, value]) => {
            this._data.set(key, value);
        });
    }

    importList(data, merge = false) {
        if (!merge) {
            this._data.clear();
        }

        data.forEach(item => {
            if (item.key !== undefined && item.value !== undefined) {
                this._data.set(item.key, item.value);
            }
        });
    }

    search(keyword, caseSensitive = false) {
        const results = [];
        const searchKey = caseSensitive ? keyword : keyword.toLowerCase();

        this._data.forEach((value, key) => {
            const keyToCheck = caseSensitive ? key : key.toLowerCase();
            if (keyToCheck.includes(searchKey)) {
                results.push(key);
            }
        });

        return results;
    }

    filterByValue(value) {
        const results = [];
        this._data.forEach((v, k) => {
            if (v === value) {
                results.push(k);
            }
        });
        return results;
    }

    count() {
        return this._data.size;
    }

    size() {
        return this._data.size;
    }
}

const ENCYCLOPEDIA = new Encyclopedia();

module.exports = {
    Encyclopedia,
    ENCYCLOPEDIA
};
