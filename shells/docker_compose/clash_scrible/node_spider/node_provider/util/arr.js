
class Arr {
    constructor() {}

    addToDict(result, key, value) {
        if (!(key in result)) {
            result[key] = [];
        }
        if (!result[key].includes(value)) {
            result[key].push(value);
        }
        return result[key];
    }

    extractList(result) {
        while (result.length === 1 && Array.isArray(result[0])) {
            result = result[0];
        }
        let isTwoDimensionalList = result.every(item => Array.isArray(item));
        if (isTwoDimensionalList) {
            const extractList = result.map(item => item[0]);
            result = extractList;
        }
        return result;
    }

    splitList(result, splitSymbol = [null, false, true], start = 0) {
        if (!Array.isArray(splitSymbol)) {
            splitSymbol = [splitSymbol];
        }
        const splitList = [];
        let index = 0;
        let step = 0;
        for (let i = 0; i < result.length; i++) {
            const item = result[i];
            if (splitSymbol.includes(item)) {
                if (i === 0) {
                    splitList.push([]);
                } else if (i - index > 1) {
                    step += 1;
                    splitList.push([]);
                }
                index = i;
            } else {
                if (i === 0) {
                    splitList.push([]);
                }
                if (!Array.isArray(item)) {
                    splitList[step].push(item);
                } else {
                    item = this.extractList(item);
                    item.forEach(strip => splitList[step].push(strip));
                }
            }
        }
        return splitList;
    }

    list2DTo1DIfPossible(arr) {
        if (!Array.isArray(arr)) {
            return arr;
        }
        if (arr.every(item => Array.isArray(item))) {
            if (arr.every(item => item.length === 1)) {
                return arr.map(item => item[0]);
            } else {
                return arr;
            }
        } else {
            return arr;
        }
    }

    getSingleList(arr) {
        if (!Array.isArray(arr)) {
            return arr;
        }
        if (arr.length === 1) {
            return arr[0];
        } else {
            return arr;
        }
    }

    uniqueList(listArr) {
        const uniqueList = [...new Set(listArr)];
        return uniqueList.filter(w => w !== "");
    }

    getListValue(listArr, arrLen, defaultValue = null) {
        if (!listArr || listArr.length === 0) {
            return defaultValue;
        }
        return listArr.length >= arrLen + 1 ? listArr[arrLen] : defaultValue;
    }

    setListDefaultValue(lst, index, defaultValue = null) {
        if (index >= lst.length) {
            lst.push(...Array(index - lst.length + 1).fill(null));
        }
        lst[index] = defaultValue;
        return lst;
    }

    getDictValue(dictObject, key, defaultValue = null) {
        if (!dictObject) {
            return defaultValue;
        }
        return key in dictObject ? dictObject[key] : defaultValue;
    }

    arrayToQueue(array, unique = true) {
        const queue = new Queue();
        if (unique) {
            const tmpArray = [...new Set(array)];
            array = tmpArray;
        }
        array.forEach(item => queue.enqueue(item));
        return queue;
    }

    clearValue(arr, values = null) {
        const defaultClear = [" ", ""];
        if (!Array.isArray(arr)) {
            return arr;
        }
        if (!values) {
            values = defaultClear;
        }
        if (typeof values === "string") {
            values = [values];
        }
        const clearedArr = arr.filter(item => !values.includes(item) && !values.includes(item.toString().trim()));
        return clearedArr;
    }

    deduplicationList(origList) {
        const duplicate = [...new Set(origList)];
        return duplicate;
    }

    filterValue(arr, value) {
        const newArr = arr.filter(item => (typeof item === "string" ? item.trim() : item) !== value);
        return newArr;
    }

    copy(originalArray) {
        const copiedArray = [...originalArray];
        return copiedArray;
    }

    arrDiff(arr1, arr2) {
        const set1 = new Set(arr1);
        const set2 = new Set(arr2);
        const diff1 = new Set([...set1].filter(x => !set2.has(x)));
        return [...diff1];
    }

    toEnglishArray(s) {
        if (Array.isArray(s)) {
            s = s.join(" ");
        }
        s = s.trim();
        const pattern = /[^a-zA-Z]+/g;
        s = s.split(pattern);
        return s;
    }

    textToLines(text) {
        let lines = [];
        if (text) {
            lines = text.split("\n");
        }
        return lines;
    }

    removeSpaces(textArr) {
        const processedArr = textArr.map(line => line.trim());
        return processedArr;
    }

    array_priority(items, keywords) {
        items.sort((a, b) => {
            const aLowerCase = a.toLowerCase();
            const bLowerCase = b.toLowerCase();
            const aContainsKeyword = keywords.some(keyword => aLowerCase.includes(keyword.toLowerCase()));
            const bContainsKeyword = keywords.some(keyword => bLowerCase.includes(keyword.toLowerCase()));
            if (aContainsKeyword && !bContainsKeyword) {
                return -1;
            } else if (!aContainsKeyword && bContainsKeyword) {
                return 1;
            }
            return 0;
        });
        return items;
    }

    copy(originalArray) {
        const copiedArray = [...originalArray];
        return copiedArray;
    }
    
    array_lastchat(items, prefix) {
        let lastIndex = -1;
        for (let i = 0; i < items.length; i++) {
            if (items[i].toUpperCase().startsWith(prefix.toUpperCase())) {
                lastIndex = i;
            }
        }
        return lastIndex
    }
    removeEmptyLines(inputArray) {
        const newImportArray = [];
        for (const line of inputArray) {
            if (!line.trim() || line.match(/^\s*$/)) {
                continue;
            } else {
                newImportArray.push(line);
            }
        }
        return newImportArray;
    }

    takeAValueThatDoesNotContain(indexArray, length) {
        const invertedArray = [];
        for (let i = 0; i < indexArray.length; i += 2) {
            const startIndex = indexArray[i];
            const endIndex = Math.min(indexArray[i + 1] + 1, length);
            invertedArray.push(...Array.from({ length: endIndex - startIndex }, (_, index) => index + startIndex));
        }
        const uniqueInvertedArray = Array.from(new Set(invertedArray));
        uniqueInvertedArray.sort((a, b) => a - b);
        return uniqueInvertedArray;
    }

    fill(arr, start = 0, end = arr.length, fillValue = null) {
        for (let i = start; i < end; i++) {
            arr[i] = fillValue;
        }
        return arr;
    }

    generateRandomRectangle(x, y, w, h, safe = true) {
        if (safe) {
            const { scaledDownX, scaledDownY, scaledDownW, scaledDownH } = this.scaledDownRectangle(x, y, w, h, 30, 30, 10);
            console.log(scaledDownX, scaledDownY, scaledDownW, scaledDownH);
        }
        const randomX = Math.floor(Math.random() * (x + w + 1));
        const randomY = Math.floor(Math.random() * (y + h + 1));
        return [randomX, randomY];
    }

    offsetRectangle(x, y, w, h, wOffset = 10, hOffset = 0) {
        x += wOffset;
        y += hOffset;
        w -= wOffset;
        h -= hOffset;
        return [x, y, w, h];
    }

    scaledDownRectangle(x, y, w, h, wMax = 30, hMax = 30, scale = 10) {
        if (w > wMax) {
            const scaledWidth = (scale / 100) * w;
            const newWidth = w - 2 * scaledWidth;
            w = newWidth > 0 ? newWidth : wMax;
            x += scaledWidth;
        }
        if (h > hMax) {
            const scaledHeight = (scale / 100) * h;
            const newHeight = h - 2 * scaledHeight;
            h = newHeight > 0 ? newHeight : hMax;
            y += scaledHeight;
        }
        return { scaledDownX: Math.floor(x), scaledDownY: Math.floor(y), scaledDownW: Math.floor(w), scaledDownH: Math.floor(h) };
    }

    generateRandomRectangleSafe(x, y, w, h) {
        const { scaledDownX, scaledDownY, scaledDownW, scaledDownH } = this.scaledDownRectangle(x, y, w, h);
        return this.generateRandomRectangle(scaledDownX, scaledDownY, scaledDownW, scaledDownH);
    }

    calculateRectangleCenter(x, y, w, h) {
        if (y === undefined) {
            [x, y, w, h] = x;
        }
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        return [centerX, centerY];
    }

    to2DList(arr) {
        if (Array.isArray(arr)) {
            if (arr.every(item => Array.isArray(item))) {
                return arr;
            } else {
                return [arr];
            }
        } else {
            return arr;
        }
    }

    arrToDict(array) {
        const result = {};
        for (const item of array) {
            if (Array.isArray(item) && item.length > 1) {
                const [key, val] = item;
                result[key] = val;
            }
        }
        return result;
    }

    dictToArr(dictionary) {
        const result = [];
        for (const [key, value] of Object.entries(dictionary)) {
            result.push([key, value]);
        }
        return result;
    }

    isArray(input) {
        return Array.isArray(input);
    }
}

Arr.toString = () => '[class Arrary]';
module.exports = new Arr();
