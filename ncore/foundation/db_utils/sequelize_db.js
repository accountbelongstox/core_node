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

const { Sequelize, DataTypes, Model } = require('sequelize');
const path = require('path');
const { APP_METADATA_SQLITE_DIR } = require('#@global_dir');
const fs = require('fs');
const logger = require('#@logger');
const { fpath } = require('#@btools');
const { printTableStructure } = require('./sequelize-libs/sequelize_pring');
const { syncTableStructure } = require('./sequelize-libs/sequelize_sync');
const ExitOn = require('#@/ncore/foundation/utilities/process_on.js');
const GlobalDBMaps = {};

function getDBPathFromDBName(dbNameOrPath) {
    const dbNameIsAbsolute = path.isAbsolute(dbNameOrPath);
    const dbPath = dbNameIsAbsolute ? dbNameOrPath : path.join(APP_METADATA_SQLITE_DIR, `${dbNameOrPath}.sqlitemate`);
    const dbName = fpath.getBasenameWithoutExt(dbPath);
    return {
        dbPath,
        dbName
    }
}

async function obtainInstantiationSequelize(dbPath, dbName, debugPrint = false, dbDialect = 'sqlite') {
    if (logger.isDebug) {
        const alreadyExists = Object.keys(GlobalDBMaps);
        console.log(`SequelizeDB Connected alreadyExists:${alreadyExists.join(',')}`);
    }
    logger.debug(`Successfully create new database: ${dbName}`);
    if (!fs.existsSync(APP_METADATA_SQLITE_DIR)) {
        fs.mkdirSync(APP_METADATA_SQLITE_DIR, { recursive: true });
    }
    try {
        const sequelize = new Sequelize({
            dialect: dbDialect,
            storage: dbPath,
            logging: debugPrint ? (msg) => logger.debug(`[Sequelize] ${msg}`) : false,
            retry: {
                max: 5,
                match: [
                    'SQLITE_BUSY',
                    Sequelize.DatabaseError
                ],
                backoffBase: 100,
                backoffExponent: 1.5
            }
        });
        await sequelize.authenticate();
        logger.debug(`Successfully connected to database: ${dbName},authenticate ${await sequelize.authenticate()}`);
        return sequelize;
    } catch (error) {
        logger.error(`Error connecting to database ${dbName}:`, error);
        return null;
    }
}

async function defineSequelizeModelByDefinition(sequelize, modelDefinition, options = { printStructure: true }, dbName, sync = true) {
    const dbTableModels = {};
    for (const [tableName, tableDefinition] of Object.entries(modelDefinition)) {
        const model = sequelize.define(tableName, {
            ...tableDefinition
        }, {
            timestamps: false,
            freezeTableName: true
        });
        try {
            if (sync) {
                await syncTableStructure(sequelize, model, tableName);
            }
            if (options.printStructure) {
                await printTableStructure(sequelize, tableName, dbName);
            }
            dbTableModels[tableName] = model;
        } catch (error) {
            logger.error(`Error during model definition/sync for table ${tableName}:`, error);
        }
    }
    return dbTableModels;
}

async function destroyDatabase(dbName) {
    if (!GlobalDBMaps[dbName]) {
        const sequelize = GlobalDBMaps[dbName]
        try {
            await sequelize.close();
        } catch (e) {
            logger.warn(`${dbName} already closed,`)
        }
        delete GlobalDBMaps[dbName];
    }
}

async function getDatabase(dbNameOrPath, modelDefinition, options = { printStructure: true }) {
    const { dbPath, dbName } = getDBPathFromDBName(dbNameOrPath);
    if (!GlobalDBMaps[dbName]) {
        const sequelize = await obtainInstantiationSequelize(dbPath, dbName);
        let tableModels = null;
        try {
            tableModels = await defineSequelizeModelByDefinition(sequelize, modelDefinition, options, dbName);
        } catch (error) {
            logger.error('Error defining models:', error);
        }
        const close = () => sequelize.close();
        if (!modelDefinition) {
            logger.error(`modelDefinition is null for dbName:${dbName}`);
        }
        GlobalDBMaps[dbName] = {
            sequelize: sequelize,
            tableModels,
            close,
        }
    }
    return GlobalDBMaps[dbName]
}

async function closeDatabase(dbNameOrSequelize) {
    let sequelize;
    if (typeof dbNameOrSequelize !== 'string') {
        sequelize = dbNameOrSequelize;
    } else {
        const dbName = fpath.getBasenameWithoutExt(dbNameOrSequelize);
        sequelize = GlobalDBMaps[dbName].sequelize;
    }
    if (sequelize) {
        await sequelize.close();
        delete GlobalDBMaps[dbName];
        logger.info(`Closed connection to database: ${dbName}`);
    }
}

async function closeAllDatabases() {
    for (const dbName in GlobalDBMaps) {
        const sequelize = GlobalDBMaps[dbName].sequelize;
        if (sequelize) {
            await sequelize.close();
            logger.info(`Closed connection to database: ${dbName}`);
        }
    }
    logger.success('All database connections closed successfully');
    GlobalDBMaps = {};
}
ExitOn.addShutdownHandler(closeAllDatabases);
module.exports = {
    getDatabase,
    closeDatabase,
    closeAllDatabases,
    obtainInstantiationSequelize,
    DataTypes,
    destroyDatabase,
    Model,
    defineSequelizeModelByDefinition
};
