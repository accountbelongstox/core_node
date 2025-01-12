/**
 * SQLite data type map with type definitions and constraints
 */
const SQLITE_TYPES = new Map([
    ['INTEGER', {
        name: 'INTEGER',
        allowLength: false,
        defaultLength: null,
        maxLength: null,
        description: 'Signed integer up to 8 bytes'
    }],
    ['REAL', {
        name: 'REAL',
        allowLength: false,
        defaultLength: null,
        maxLength: null,
        description: 'Floating point value'
    }],
    ['TEXT', {
        name: 'TEXT',
        allowLength: true,
        defaultLength: null,
        maxLength: null,
        description: 'Text string'
    }],
    ['BLOB', {
        name: 'BLOB',
        allowLength: false,
        defaultLength: null,
        maxLength: null,
        description: 'Binary large object'
    }],
    ['VARCHAR', {
        name: 'VARCHAR',
        allowLength: true,
        defaultLength: 255,
        maxLength: null,
        description: 'Variable length text'
    }],
    ['BOOLEAN', {
        name: 'BOOLEAN',
        allowLength: false,
        defaultLength: null,
        maxLength: null,
        description: 'Boolean value (stored as INTEGER)'
    }],
    ['DATETIME', {
        name: 'DATETIME',
        allowLength: false,
        defaultLength: null,
        maxLength: null,
        description: 'Date and time value'
    }],
    ['DATE', {
        name: 'DATE',
        allowLength: false,
        defaultLength: null,
        maxLength: null,
        description: 'Date value'
    }],
    ['TIME', {
        name: 'TIME',
        allowLength: false,
        defaultLength: null,
        maxLength: null,
        description: 'Time value'
    }]
]);

/**
 * Parse SQLite type string into type and length
 * @param {string} typeString - Type string (e.g., "VARCHAR(20)", "INTEGER")
 * @returns {{type: string, length: number|null}} Parsed type and length
 */
function parseType(typeString) {
    if (!typeString) return { type: null, length: null };

    // Remove all spaces and convert to uppercase
    typeString = typeString.replace(/\s+/g, '').toUpperCase();
    
    const matches = typeString.match(/^([A-Z]+)(?:\((\d+)\))?$/);
    if (!matches) return { type: null, length: null };

    const [, type, length] = matches;
    return {
        type: type,
        length: length ? parseInt(length, 10) : null
    };
}

/**
 * Infer best SQLite type for a value
 * @param {*} value - Value to analyze
 * @param {Object} [options] - Options for type inference
 * @param {number} [options.maxLength] - Maximum length for strings
 * @param {boolean} [options.preferVarchar=true] - Prefer VARCHAR over TEXT for strings
 * @returns {{type: string, length: number|null}} Inferred type and length
 */
function inferType(value, options = {}) {
    const { maxLength, preferVarchar = true } = options;

    if (value === null || value === undefined) {
        return { type: 'TEXT', length: null };
    }

    switch (typeof value) {
        case 'number':
            return {
                type: Number.isInteger(value) ? 'INTEGER' : 'REAL',
                length: null
            };

        case 'boolean':
            return { type: 'BOOLEAN', length: null };

        case 'string': {
            // Check if string is a valid date
            const dateValue = new Date(value);
            if (!isNaN(dateValue.getTime())) {
                if (value.includes(':')) {
                    return { type: 'DATETIME', length: null };
                }
                return { type: 'DATE', length: null };
            }

            // Handle text/varchar
            const strLength = value.length;
            if (preferVarchar && strLength <= 255) {
                return {
                    type: 'VARCHAR',
                    length: maxLength ? Math.min(maxLength, Math.max(strLength, 1)) : strLength
                };
            }
            return { type: 'TEXT', length: null };
        }

        case 'object':
            if (value instanceof Date) {
                return { type: 'DATETIME', length: null };
            }
            if (value instanceof Buffer) {
                return { type: 'BLOB', length: null };
            }
            return { type: 'TEXT', length: null };

        default:
            return { type: 'TEXT', length: null };
    }
}

/**
 * Create a flattened map of object properties with their inferred types
 * @param {Object} obj - Object to analyze
 * @param {Object} [options] - Type inference options
 * @param {string} [parentPath=''] - Internal use for recursion
 * @returns {Map<string, {type: string, length: number|null}>} Map of property paths to types
 */
function createTypeMapFromObject(obj, options = {}, parentPath = '') {
    const typeMap = new Map();

    function processValue(key, value, currentPath) {
        const fullPath = currentPath ? `${currentPath}.${key}` : key;

        if (value === null || value === undefined) {
            typeMap.set(fullPath, { type: 'TEXT', length: null });
            return;
        }

        if (Array.isArray(value)) {
            // For arrays, analyze the first non-null element
            const sample = value.find(item => item !== null && item !== undefined);
            if (sample) {
                if (typeof sample === 'object' && !(sample instanceof Date) && !(sample instanceof Buffer)) {
                    // If array contains objects, recurse into the sample object
                    createTypeMapFromObject(sample, options, fullPath);
                } else {
                    typeMap.set(fullPath, inferType(sample, options));
                }
            } else {
                typeMap.set(fullPath, { type: 'TEXT', length: null });
            }
            return;
        }

        if (typeof value === 'object' && !(value instanceof Date) && !(value instanceof Buffer)) {
            // Recurse into nested objects
            createTypeMapFromObject(value, options, fullPath);
        } else {
            typeMap.set(fullPath, inferType(value, options));
        }
    }

    for (const [key, value] of Object.entries(obj)) {
        processValue(key, value, parentPath);
    }

    return typeMap;
}

/**
 * Format type with length for SQL
 * @param {string} type - SQL type
 * @param {number|null} length - Type length
 * @returns {string} Formatted type string
 */
function formatType(type, length) {
    if (!SQLITE_TYPES.has(type)) {
        return 'TEXT';
    }
    const typeInfo = SQLITE_TYPES.get(type);
    if (typeInfo.allowLength && length) {
        return `${type}(${length})`;
    }
    return type;
}

module.exports = {
    SQLITE_TYPES,
    parseType,
    inferType,
    createTypeMapFromObject,
    formatType
};
