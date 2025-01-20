const logger = require('#@logger');


async function syncTableStructure(sequelize, model, tableName) {
    // Get current table info
    let tableExists = false;
    try {
        await sequelize.getQueryInterface().describeTable(tableName);
        tableExists = true;
    } catch (error) {
        // Table doesn't exist yet
    }

    if (tableExists) {
        // Get current table structure
        const tableInfo = await sequelize.getQueryInterface().describeTable(tableName);

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
        // If table doesn't exist, create it
        await model.sync();
    }
}

module.exports = {
    syncTableStructure
}; 