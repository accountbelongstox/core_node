const { generateMd5, trimPunctuation, cleanWord, cleanSentence } = require('#@ncore/utils/tool/libs/strtool.js');
const { DataTypes } = require('#@/ncore/utils/db_tool/libs/sequelize_db.js');
const logger = require('#@logger');

const logSpacename = 'Provider-Types';
const logInterval = 20;
const ITEM_TYPE = {
    WORD: 'word',
    SENTENCE: 'sentence'
};

const sequelize_init_tables = {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
    },
    md5: {
        type: DataTypes.STRING(32),
        allowNull: false,
        unique: true
    },
    type: {
        type: DataTypes.CHAR,
        allowNull: false
    },
    translation: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    image_files: {
        type: DataTypes.JSON,
        allowNull: true
    },
    voice_files: {
        type: DataTypes.JSON,
        allowNull: true
    },
    last_modified: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}

/**
 * Get default value based on DataTypes
 * @param {Object} schema - Field schema from sequelize_init_tables
 * @returns {any} Default value for the type
 */
const getDefaultValueForType = (schema) => {
    if (schema.defaultValue !== undefined) {
        return schema.defaultValue;
    }

    switch (schema.type) {
        case DataTypes.INTEGER:
            return 0;
        case DataTypes.FLOAT:
        case DataTypes.DOUBLE:
            return 0.0;
        case DataTypes.STRING:
        case DataTypes.TEXT:
        case DataTypes.CHAR:
            return '';
        case DataTypes.BOOLEAN:
            return false;
        case DataTypes.DATE:
            return Math.floor(Date.now() / 1000);
        case DataTypes.JSON:
        case DataTypes.JSONB:
            return {};
        case DataTypes.ARRAY:
            return [];
        default:
            return null;
    }
};

/**
 * Validate and wrap data according to sequelize_init_tables schema
 * @param {Object} data - Data to validate and wrap
 * @returns {Object} - Data with all required fields from sequelize_init_tables
 */
const validateAndWrapQueueItem = (data) => {
    try {
        if (!data || typeof data !== 'object') {
            return null;
        }

        const result = {};
        const validKeys = new Set(Object.keys(sequelize_init_tables));

        // Copy only valid fields and handle missing required fields
        Object.entries(data).forEach(([key, value]) => {
            if (validKeys.has(key)) {
                result[key] = value;
            } else {
                logger.interval(`Unknown field will be removed: ${key}`, logInterval, logSpacename, 'warn');
            }
        });

        // Add missing fields with appropriate defaults based on schema
        Object.entries(sequelize_init_tables).forEach(([key, schema]) => {
            if (key === 'id') {
                return; // Skip id field as it's auto-generated
            }

            if (!result.hasOwnProperty(key)) {
                if (!schema.allowNull) {
                    // logger.interval(`Missing required field: ${key}`, logInterval, logSpacename, 'warn');
                    return null;
                }
                // Get appropriate default value based on field type
                result[key] = getDefaultValueForType(schema);
            }
        });

        return result;
    } catch (error) {
        logger.error('Error validating data:', error);
        return null;
    }
};

const ensureQueueItem = (input, rawItemType) => {
    try {
        // If input is already a valid queue item, return it
        if (input &&
            typeof input === 'object' &&
            'content' in input &&
            'type' in input &&
            'md5' in input) {
            if (rawItemType) {
                input.type = rawItemType;
                input.content = ITEM_TYPE.SENTENCE == input.type ? cleanSentence(input.content) : cleanWord(input.content);
            } else if (!input.type) {
                logger.warn(`[ItemType] No type in input`);
                return null;
            }
            return validateAndWrapQueueItem(input);
        }

        let inputTrim = null;
        if (!rawItemType) {
            inputTrim = cleanWord(input);
            rawItemType = inputTrim.includes(' ') ? ITEM_TYPE.SENTENCE : ITEM_TYPE.WORD;
        }

        let trimmedContent = ITEM_TYPE.SENTENCE == rawItemType ?
            cleanSentence(input) :
            (inputTrim ? inputTrim : cleanWord(input));

        const queueItem = {
            content: trimmedContent,
            type: rawItemType,
            md5: generateMd5(trimmedContent)
        };

        return validateAndWrapQueueItem(queueItem);
    } catch (error) {
        logger.error('Error ensuring queue item:', error);
        return null;
    }
};

module.exports = {
    ensureQueueItem,
    ITEM_TYPE,
    sequelize_init_tables,
    validateAndWrapQueueItem
};