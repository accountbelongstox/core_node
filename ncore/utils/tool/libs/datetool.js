function randomMillisecond(x = 0, y = 1500) {
    return Math.floor(Math.random() * (y - x + 1)) + x;
}
/**
 * Format timestamp to human readable duration
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} Formatted duration string
 */
function formatDurationToStr(timestamp) {
    const seconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    // Calculate remaining values
    const remainingMonths = Math.floor((days % 365) / 30);
    const remainingDays = days % 30;
    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;

    // Format based on duration
    if (years > 0) {
        return `${years}y ${remainingMonths}m ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`;
    }

    if (months > 0) {
        return `${months}m ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`;
    }

    if (days > 0) {
        return `${days}d ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s`;
    }

    if (hours > 0) {
        return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
    }

    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }

    return `${seconds}s`;
}

/**
 * Get current timestamp in seconds
 * @returns {number} Current timestamp in seconds
 */
function getCurrentTimestamp() {
    return Math.floor(Date.now() / 1000);
}

/**
 * Convert date to timestamp
 * @param {Date} date - Date object
 * @returns {number} Timestamp in seconds
 */
function dateToTimestamp(date) {
    return Math.floor(date.getTime() / 1000);
}

/**
 * Convert timestamp to date
 * @param {number} timestamp - Timestamp in seconds
 * @returns {Date} Date object
 */
function timestampToDate(timestamp) {
    return new Date(timestamp * 1000);
}

/**
 * Format date to string
 * @param {Date} date - Date object
 * @param {string} format - Format string (optional)
 * @returns {string} Formatted date string
 */
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
        .replace('YYYY', year.toString())
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

/**
 * Get start of day timestamp
 * @param {Date} date - Date object (optional, defaults to current date)
 * @returns {number} Start of day timestamp in seconds
 */
function getStartOfDay(date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    return Math.floor(startOfDay.getTime() / 1000);
}

/**
 * Get end of day timestamp
 * @param {Date} date - Date object (optional, defaults to current date)
 * @returns {number} End of day timestamp in seconds
 */
function getEndOfDay(date = new Date()) {
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return Math.floor(endOfDay.getTime() / 1000);
}

module.exports = {
    formatDurationToStr,
    getCurrentTimestamp,
    dateToTimestamp,
    timestampToDate,
    formatDate,
    getStartOfDay,
    getEndOfDay,
    randomMillisecond
};