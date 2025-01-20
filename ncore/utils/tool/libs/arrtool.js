function extractList(result) {
    while (result.length === 1 && Array.isArray(result[0])) {
        result = result[0];
    }
    const isTwoDimensionalList = result.every(item => Array.isArray(item));
    if (isTwoDimensionalList) {
        result = result.map(item => item[0]);
    }
    return result;
}

function splitList(result, splitSymbol = [null, false, true]) {
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
                const extractedItem = extractList(item);
                extractedItem.forEach(strip => splitList[step].push(strip));
            }
        }
    }
    return splitList;
}

function list2DTo1DIfPossible(arr) {
    if (!Array.isArray(arr)) {
        return arr;
    }
    if (arr.every(item => Array.isArray(item) && item.length === 1)) {
        return arr.map(item => item[0]);
    }
    return arr;
}

function getSingleList(arr) {
    if (!Array.isArray(arr)) {
        return arr;
    }
    return arr.length === 1 ? arr[0] : arr;
}

function uniqueList(listArr) {
    const uniqueList = [...new Set(listArr)];
    return uniqueList.filter(w => w !== "");
}

function getListValue(listArr, arrLen, defaultValue = null) {
    if (!listArr || listArr.length === 0) {
        return defaultValue;
    }
    return listArr.length >= arrLen + 1 ? listArr[arrLen] : defaultValue;
}

function setListDefaultValue(lst, index, defaultValue = null) {
    if (index >= lst.length) {
        lst.push(...Array(index - lst.length + 1).fill(null));
    }
    lst[index] = defaultValue;
    return lst;
}

function clearValue(arr, values = null) {
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
    return arr.filter(item => !values.includes(item) && !values.includes(item.toString().trim()));
}

function deduplicationList(origList) {
    return [...new Set(origList)];
}

function filterValue(arr, value) {
    return arr.filter(item => (typeof item === "string" ? item.trim() : item) !== value);
}

function copy(originalArray) {
    return [...originalArray];
}

function arrDiff(arr1, arr2) {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    const diff1 = new Set([...set1].filter(x => !set2.has(x)));
    return [...diff1];
}

function toEnglishArray(s) {
    if (Array.isArray(s)) {
        s = s.join(" ");
    }
    s = s.trim();
    const pattern = /[^a-zA-Z]+/g;
    return s.split(pattern);
}

function textToLines(text) {
    return text ? text.split("\n") : [];
}

function removeSpaces(textArr) {
    return textArr.map(line => line.trim());
}

function arrayPriority(items, keywords) {
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

function arrayLastChat(items, prefix) {
    let lastIndex = -1;
    for (let i = 0; i < items.length; i++) {
        if (items[i].toUpperCase().startsWith(prefix.toUpperCase())) {
            lastIndex = i;
        }
    }
    return lastIndex;
}

function removeEmptyLines(inputArray) {
    return inputArray.filter(line => line.trim() && !line.match(/^\s*$/));
}

function takeAValueThatDoesNotContain(indexArray, length) {
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

function fill(arr, start = 0, end = arr.length, fillValue = null) {
    for (let i = start; i < end; i++) {
        arr[i] = fillValue;
    }
    return arr;
}

function generateRandomRectangle(x, y, w, h, safe = true) {
    if (safe) {
        const { scaledDownX, scaledDownY, scaledDownW, scaledDownH } = scaledDownRectangle(x, y, w, h, 30, 30, 10);
        console.log(scaledDownX, scaledDownY, scaledDownW, scaledDownH);
    }
    const randomX = Math.floor(Math.random() * (x + w + 1));
    const randomY = Math.floor(Math.random() * (y + h + 1));
    return [randomX, randomY];
}

function offsetRectangle(x, y, w, h, wOffset = 10, hOffset = 0) {
    x += wOffset;
    y += hOffset;
    w -= wOffset;
    h -= hOffset;
    return [x, y, w, h];
}

function scaledDownRectangle(x, y, w, h, wMax = 30, hMax = 30, scale = 10) {
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

function generateRandomRectangleSafe(x, y, w, h) {
    const { scaledDownX, scaledDownY, scaledDownW, scaledDownH } = scaledDownRectangle(x, y, w, h);
    return generateRandomRectangle(scaledDownX, scaledDownY, scaledDownW, scaledDownH);
}

function calculateRectangleCenter(x, y, w, h) {
    if (y === undefined) {
        [x, y, w, h] = x;
    }
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    return [Math.floor(centerX), Math.floor(centerY)];
}

function to2DList(arr) {
    if (!Array.isArray(arr)) {
        return [[arr]];
    }
    if (arr.length === 0) {
        return [[]];
    }
    if (!Array.isArray(arr[0])) {
        return [arr];
    }
    return arr;
}

function isArray(input) {
    return Array.isArray(input);
}

function isAllNumbers(...inputs) {
    const items = inputs.reduce((acc, input) => {
        if (Array.isArray(input)) {
            return acc.concat(input);
        }
        return acc.concat([input]);
    }, []);

    return items.length > 0 && items.every(item =>
        typeof item === 'number' && !isNaN(item)
    );
}

function isAllStrings(...inputs) {
    const items = inputs.reduce((acc, input) => {
        if (Array.isArray(input)) {
            return acc.concat(input);
        }
        return acc.concat([input]);
    }, []);

    return items.length > 0 && items.every(item =>
        typeof item === 'string'
    );
}

function hasNoUndefined(...inputs) {
    const items = inputs.reduce((acc, input) => {
        if (Array.isArray(input)) {
            return acc.concat(input);
        }
        return acc.concat([input]);
    }, []);

    return items.every(item => item !== undefined);
}

function delayForEach(array, delay = 1) {
    return {
        forEach: function(callback) {
            return new Promise((resolve) => {
                let index = 0;
                const iterate = () => {
                    if (index < array.length) {
                        callback(array[index], index);
                        index++;
                        setTimeout(iterate, delay);
                    } else {
                        resolve();
                    }
                };
                iterate();
            });
        }
    };
}

function smartDelayForEach(array,delaySet=0.5) {
    return {
        forEach: function(callback) {
            return new Promise((resolve) => {
                let index = 0;
                const shouldDelay = array.length > 10000;
                const delay = shouldDelay ? delaySet : 0;
                
                const iterate = () => {
                    if (index < array.length) {
                        callback(array[index], index);
                        index++;
                        if (shouldDelay) {
                            setTimeout(iterate, delay);
                        } else {
                            iterate();
                        }
                    } else {
                        resolve();
                    }
                };
                iterate();
            });
        }
    };
}

module.exports = {
    extractList,
    splitList,
    list2DTo1DIfPossible,
    getSingleList,
    uniqueList,
    getListValue,
    setListDefaultValue,
    clearValue,
    deduplicationList,
    filterValue,
    copy,
    arrDiff,
    toEnglishArray,
    textToLines,
    removeSpaces,
    arrayPriority,
    arrayLastChat,
    removeEmptyLines,
    takeAValueThatDoesNotContain,
    fill,
    generateRandomRectangle,
    offsetRectangle,
    scaledDownRectangle,
    generateRandomRectangleSafe,
    calculateRectangleCenter,
    to2DList,
    isArray,
    isAllNumbers,
    isAllStrings,
    hasNoUndefined,
    delayForEach,
    smartDelayForEach
};
