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

const WORDS_MAIN_SET = new Set();
let LastModified = null;
const logger = require('#@logger');
const { arrtool } = require('#@btools');

function diffToMainWordsSet(wordsArrayOrText) {
    const diff = arrtool.arrDiff(wordsArrayOrText, WORDS_MAIN_SET);
    return diff;
}

function isDiffToMainWordsSet(wordsArrayOrText) {
    const diff = diffToMainWordsSet(wordsArrayOrText);
    return diff.length > 0;
}

function addToMainWordsSet(wordsArrayOrText) {
    const lastModified = new Date();
    if (Array.isArray(wordsArrayOrText)) {
        wordsArrayOrText.forEach(item => {
            if (typeof item === 'string') {
                if (!WORDS_MAIN_SET.has(item)) {
                    WORDS_MAIN_SET.add(item);
                    LastModified = lastModified;
                }
            } else if (typeof item === 'object' && item !== null) {
                const content = item.content;
                if (!WORDS_MAIN_SET.has(content)) {
                    WORDS_MAIN_SET.add(content);
                    LastModified = lastModified;
                }
            }
        });
    } else if (typeof wordsArrayOrText === 'object' && wordsArrayOrText !== null) {
        const content = wordsArrayOrText.content;
        if (!WORDS_MAIN_SET.has(content)) {
            WORDS_MAIN_SET.add(content);
            LastModified = lastModified;
        }
    }
    if (typeof wordsArrayOrText === 'string') {
        if (!WORDS_MAIN_SET.has(wordsArrayOrText)) {
            WORDS_MAIN_SET.add(wordsArrayOrText);
            LastModified = lastModified;
        }
    }
    return WORDS_MAIN_SET
}

const hasWordInMainSet = (wordOrItem) => {
    if (typeof wordOrItem == 'object') {
        wordOrItem = wordOrItem.content;
    }
    return WORDS_MAIN_SET.has(wordOrItem);
}
const getMainSet = () => {
    return WORDS_MAIN_SET;
}
function getMainWordsSetCountObject() {
    return {
        size: WORDS_MAIN_SET.size,
        first: Array.from(WORDS_MAIN_SET).shift(),
        last: Array.from(WORDS_MAIN_SET).pop(),
        randomList: arrtool.randomList(Array.from(WORDS_MAIN_SET), 10).join(','),
        lastModified: LastModified
    }
}
function showMainWordsSet() {
    const separator = `--------------------------------`;
    const showMessage = `Main Words Set: ${WORDS_MAIN_SET.size}`;
    const firstMessage = `First Word: ${Array.from(WORDS_MAIN_SET).shift()}`;
    const lastMessage = `Last Word: ${Array.from(WORDS_MAIN_SET).pop()}`;
    const lastModifiedMessage = `Last Modified: ${LastModified}`;
    const messageMerge = `${separator}\n${showMessage}\n${firstMessage}\n${lastMessage}\n${lastModifiedMessage}\n${separator}`;
    logger.success(messageMerge);
}
module.exports = {
    addToMainWordsSet,
    hasWordInMainSet,
    getMainSet,
    showMainWordsSet,
    getMainWordsSetCountObject,
    diffToMainWordsSet,
    isDiffToMainWordsSet,
};