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

const logger = require('#@logger');

async function syncTableStructure(sequelize, model, tableName) {
    
    const tables = await sequelize.getQueryInterface().showAllTables();
    const tableExists = tables.includes(tableName);
    console.debug(`tableName: ${tableName}, tables: ${tables}, tableExists: ${tableExists}`);
    logger.debug(`Table ${tableName} does not exist, default sync`);
    await sequelize.sync({ force: false });
    await model.sync();
    return 
    if (tableExists) {
        logger.warn(`Table ${tableName} already exists, Syncing using describeTable`);
        const tableInfo = await sequelize.getQueryInterface().describeTable(tableName);
        const modelAttributes = model.rawAttributes;
        const differences = {
            added: [],
            modified: [],
            removed: []
        };
        for (const [fieldName, fieldDef] of Object.entries(modelAttributes)) {
            if (fieldName === 'id') continue; 
            if (!tableInfo[fieldName]) {
                differences.added.push(fieldName);
            } else {
                const currentType = tableInfo[fieldName].type.toLowerCase();
                const newType = fieldDef.type.toString().toLowerCase();
                if (currentType !== newType) {
                    differences.modified.push(fieldName);
                }
            }
        }
        for (const fieldName of Object.keys(tableInfo)) {
            if (fieldName === 'id') continue;
            if (!modelAttributes[fieldName]) {
                differences.removed.push(fieldName);
            }
        }
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
        if (differences.added.length > 0) {
            for (const column of differences.added) {
                await sequelize.getQueryInterface().addColumn(tableName, column, modelAttributes[column]);
            }
        }
        if (differences.modified.length > 0) {
            for (const column of differences.modified) {
                await sequelize.getQueryInterface().changeColumn(tableName, column, modelAttributes[column]);
            }
        }
        if (differences.removed.length > 0) {
            await sequelize.getQueryInterface().removeColumn(tableName, differences.removed);
        }
    } else {
        logger.debug(`Table ${tableName} does not exist, default sync`);
        await sequelize.sync({ force: false });
        await model.sync();
    }
}

module.exports = {
    syncTableStructure
}; 