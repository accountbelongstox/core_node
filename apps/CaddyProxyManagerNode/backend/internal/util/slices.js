/**
 * Returns whether the array contains the given item
 */
export const arrayContainsItem = (array, item) => array.includes(item);

/**
 * Returns whether the array contains the given number
 */
export const arrayContainsInt = (array, item) => array.includes(item);

/**
 * Converts array of integers to comma-separated string
 */
export const convertIntArrayToString = (array) => array.join(',');

/**
 * Converts string array to array of any type (interface{} equivalent)
 */
export const convertStringArrayToAny = (array) => [...array];

module.exports = {
    arrayContainsItem,
    arrayContainsInt,
    convertIntArrayToString,
    convertStringArrayToAny
}; 