class Arr {
    constructor() {}

    // Dictionary operations
    addToDict(dict, key, value) {
        if (!(key in dict)) {
            dict[key] = [];
        }
        if (!dict[key].includes(value)) {
            dict[key].push(value);
        }
        return dict[key];
    }

    getDictValue(dict, key, defaultValue = null) {
        return dict?.[key] ?? defaultValue;
    }

    // List operations
    flattenList(result) {
        while (result.length === 1 && Array.isArray(result[0])) {
            result = result[0];
        }
        if (result.every(item => Array.isArray(item))) {
            return result.map(item => item[0]);
        }
        return result;
    }

    splitBySymbol(arr, splitSymbol = [null, false, true]) {
        if (!Array.isArray(splitSymbol)) {
            splitSymbol = [splitSymbol];
        }
        const result = [];
        let currentGroup = [];
        result.push(currentGroup);

        arr.forEach((item, i) => {
            if (splitSymbol.includes(item)) {
                if (i > 0 && currentGroup.length > 0) {
                    currentGroup = [];
                    result.push(currentGroup);
                }
            } else {
                if (Array.isArray(item)) {
                    const flattened = this.flattenList(item);
                    currentGroup.push(...flattened);
                } else {
                    currentGroup.push(item);
                }
            }
        });

        return result.filter(group => group.length > 0);
    }

    flatten2DArray(arr) {
        if (!Array.isArray(arr)) return arr;
        if (arr.every(item => Array.isArray(item) && item.length === 1)) {
            return arr.map(item => item[0]);
        }
        return arr;
    }

    // Array utilities
    unique(arr) {
        return [...new Set(arr)].filter(Boolean);
    }

    getAtIndex(arr, index, defaultValue = null) {
        return arr?.[index] ?? defaultValue;
    }

    setDefault(arr, index, defaultValue = null) {
        if (index >= arr.length) {
            arr.length = index + 1;
            arr.fill(null, arr.length, index);
        }
        arr[index] = defaultValue;
        return arr;
    }

    toQueue(array, unique = true) {
        class Queue {
            constructor() {
                this.items = [];
            }
            enqueue(item) { this.items.push(item); }
            dequeue() { return this.items.shift(); }
            isEmpty() { return this.items.length === 0; }
        }
        
        const queue = new Queue();
        const items = unique ? [...new Set(array)] : array;
        items.forEach(item => queue.enqueue(item));
        return queue;
    }

    removeValues(arr, values = [" ", ""]) {
        if (!Array.isArray(arr)) return arr;
        values = Array.isArray(values) ? values : [values];
        return arr.filter(item => !values.includes(item?.toString().trim()));
    }

    difference(arr1, arr2) {
        return [...new Set(arr1)].filter(x => !new Set(arr2).has(x));
    }

    // Text processing
    extractWords(text) {
        if (Array.isArray(text)) text = text.join(" ");
        return text.trim().split(/[^a-zA-Z]+/g).filter(Boolean);
    }

    toLines(text) {
        return text?.split("\n") ?? [];
    }

    trimLines(lines) {
        return lines.map(line => line.trim());
    }

    removeEmptyLines(lines) {
        return lines.filter(line => line.trim());
    }

    // Array sorting and searching
    sortByKeywords(items, keywords) {
        return [...items].sort((a, b) => {
            const aMatch = keywords.some(k => a.toLowerCase().includes(k.toLowerCase()));
            const bMatch = keywords.some(k => b.toLowerCase().includes(k.toLowerCase()));
            return (bMatch - aMatch);
        });
    }
    
    findLastIndexByPrefix(items, prefix) {
        const upperPrefix = prefix.toUpperCase();
        return items.reduce((lastIndex, item, index) => 
            item.toUpperCase().startsWith(upperPrefix) ? index : lastIndex, -1);
    }

    // Rectangle operations
    generateRandomPoint(x, y, w, h, safe = true) {
        if (safe) {
            const scaled = this.scaleRectangle(x, y, w, h);
            return [
                Math.floor(Math.random() * (scaled.w)) + scaled.x,
                Math.floor(Math.random() * (scaled.h)) + scaled.y
            ];
        }
        return [
            Math.floor(Math.random() * w) + x,
            Math.floor(Math.random() * h) + y
        ];
    }

    scaleRectangle(x, y, w, h, maxWidth = 30, maxHeight = 30, scale = 10) {
        const result = { x, y, w, h };
        if (w > maxWidth) {
            const reduction = (scale / 100) * w;
            result.w = Math.max(maxWidth, w - 2 * reduction);
            result.x += reduction;
        }
        if (h > maxHeight) {
            const reduction = (scale / 100) * h;
            result.h = Math.max(maxHeight, h - 2 * reduction);
            result.y += reduction;
        }
        return result;
    }

    getRectangleCenter(rect) {
        const [x, y, w, h] = Array.isArray(rect) ? rect : [rect.x, rect.y, rect.w, rect.h];
        return [x + w / 2, y + h / 2];
    }

    // Type conversion
    to2DArray(arr) {
        if (!Array.isArray(arr)) return arr;
        return arr.every(item => Array.isArray(item)) ? arr : [arr];
    }

    arrayToObject(arr) {
        return arr.reduce((obj, [key, value]) => {
            if (Array.isArray(arr) && arr.length > 1) {
                obj[key] = value;
            }
            return obj;
        }, {});
    }

    objectToArray(obj) {
        return Object.entries(obj);
    }

    isArray(value) {
        return Array.isArray(value);
    }
}

// Export a singleton instance
const arr = new Arr();
export default arr;
