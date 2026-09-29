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