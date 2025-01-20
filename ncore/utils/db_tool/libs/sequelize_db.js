const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');
const { APP_METADATA_SQLITE_DIR } = require('#@/ncore/gvar/gdir.js');
const fs = require('fs');
const logger = require('#@logger');
let dbConnections = {};

async function printTableStructure(sequelize, tableName = 'contents',dbName) {
    try {
        const tableInfo = await sequelize.getQueryInterface().describeTable(tableName);
        
        // Get the maximum lengths for formatting
        const maxFieldLength = Math.max(...Object.keys(tableInfo).map(field => field.length));
        const maxTypeLength = Math.max(...Object.values(tableInfo).map(info => info.type.toString().length));
        
        // Create the header
        const separator = '─'.repeat(maxFieldLength + maxTypeLength + 24);
        logger.success(`\n┌${separator}┐`);
        const dbnamePringStr = dbName ? `dbName: ${dbName}` : '';
        if(dbnamePringStr)logger.success(`│ Table Name: ${dbnamePringStr}`);
        logger.success(`│ Table Structure: ${tableName}${' '.repeat(separator.length - tableName.length - 17)}│ `);
        logger.success(`├${separator}┤`);
        logger.success(`│ Field${' '.repeat(maxFieldLength - 5)} │ Type${' '.repeat(maxTypeLength - 4)} │ Null │ Key │`);
        logger.success(`├${separator}┤`);

        // Print each field
        for (const [field, info] of Object.entries(tableInfo)) {
            const type = info.type.toString();
            const nullable = info.allowNull ? 'YES' : 'NO ';
            const key = info.primaryKey ? 'PRI' : '   ';
            
            const fieldPadding = ' '.repeat(maxFieldLength - field.length);
            const typePadding = ' '.repeat(maxTypeLength - type.length);
            
            logger.info(`│ ${field}${fieldPadding} │ ${type}${typePadding} │ ${nullable} │ ${key} │`);
        }
        
        // Close the table
        logger.info(`└${separator}┘\n`);
    } catch (error) {
        logger.error('Error printing table structure:', error);
    }
}

async function getDBConnection(dbName, debugPrint = false) {
    if (dbConnections[dbName]) {
        return dbConnections[dbName];
    }
    if (!fs.existsSync(APP_METADATA_SQLITE_DIR)) {
        fs.mkdirSync(APP_METADATA_SQLITE_DIR, { recursive: true });
    }
    const dbPath = path.join(APP_METADATA_SQLITE_DIR, `${dbName}.sqlitemate`);
    try {
        const sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: dbPath,
            logging: debugPrint ? (msg) => logger.debug(`[Sequelize] ${msg}`) : false,
        });
        await sequelize.authenticate();
        dbConnections[dbName] = sequelize;
        logger.info(`Successfully connected to database: ${dbName}`);
        return sequelize;
    } catch (error) {
        logger.error(`Error connecting to database ${dbName}:`, error);
        return null;
    }
}

async function defineModel(sequelize, modelDefinition, options = { printStructure: true },dbName) {
    const model = sequelize.define('contents', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            unique: true
        },
        ...modelDefinition
    }, {
        timestamps: false,
        freezeTableName: true
    });

    try {
        // First try to get current table info
        let tableExists = false;
        try {
            await sequelize.getQueryInterface().describeTable('contents');
            tableExists = true;
        } catch (error) {
            // Table doesn't exist yet
        }

        if (tableExists) {
            // Get current table structure
            const tableInfo = await sequelize.getQueryInterface().describeTable('contents');
            
            // Compare with model definition
            const modelAttributes = model.rawAttributes;
            const differences = {
                added: [],
                modified: [],
                removed: []
            };

            // Check for added or modified columns
            for (const [fieldName, fieldDef] of Object.entries(modelAttributes)) {
                if (fieldName === 'id') continue; // Skip ID field comparison
                if (!tableInfo[fieldName]) {
                    differences.added.push(fieldName);
                } else {
                    // Compare field types (basic comparison)
                    const currentType = tableInfo[fieldName].type.toLowerCase();
                    const newType = fieldDef.type.toString().toLowerCase();
                    if (currentType !== newType) {
                        differences.modified.push(fieldName);
                    }
                }
            }

            // Check for removed columns
            for (const fieldName of Object.keys(tableInfo)) {
                if (fieldName === 'id') continue; // Skip ID field comparison
                if (!modelAttributes[fieldName]) {
                    differences.removed.push(fieldName);
                }
            }

            // Print sync information if there are changes
            if (differences.added.length > 0 || differences.modified.length > 0 || differences.removed.length > 0) {
                logger.info('Table structure changes detected:');
                if (differences.added.length > 0) {
                    logger.success('Added columns:', differences.added.join(', '));
                }
                if (differences.modified.length > 0) {
                    logger.info('Modified columns:', differences.modified.join(', '));
                }
                if (differences.removed.length > 0) {
                    logger.warn('Removed columns:', differences.removed.join(', '));
                }
            }

            // Handle each type of change separately to avoid ID conflicts
            if (differences.added.length > 0) {
                for (const column of differences.added) {
                    await sequelize.getQueryInterface().addColumn('contents', column, modelAttributes[column]);
                }
            }

            if (differences.modified.length > 0) {
                for (const column of differences.modified) {
                    await sequelize.getQueryInterface().changeColumn('contents', column, modelAttributes[column]);
                }
            }

            if (differences.removed.length > 0) {
                await sequelize.getQueryInterface().removeColumn('contents', differences.removed);
            }
        } else {
            // If table doesn't exist, create it
            await model.sync();
        }

        // Print final table structure if enabled
        if (options.printStructure) {
            logger.info('\nFinal table structure after sync:');
            await printTableStructure(sequelize,`contents`, dbName);
        }

        return model;
    } catch (error) {
        logger.error('Error during model definition/sync:', error);
        throw error;
    }
}

async function getDatabase(dbName, modelDefinition, options = { printStructure: true }) {
    const sequelize = await getDBConnection(dbName);
    const model = await defineModel(sequelize, modelDefinition, options,dbName);
    return { sequelize, model };
}

async function closeDatabase(dbName) {
    const sequelize = dbConnections[dbName];
    if (sequelize) {
        await sequelize.close();
        delete dbConnections[dbName];
        logger.info(`Closed connection to database: ${dbName}`);
    }
}

async function closeAllDatabases() {
    for (const dbName in dbConnections) {
        const sequelize = dbConnections[dbName];
        if (sequelize) {
            await sequelize.close();
            logger.info(`Closed connection to database: ${dbName}`);
        }
    }
    logger.success('All database connections closed successfully');
    dbConnections = {};
}

module.exports = {
    getDatabase,
    closeDatabase,
    closeAllDatabases,
    DataTypes,
    Model,
    defineModel
};
