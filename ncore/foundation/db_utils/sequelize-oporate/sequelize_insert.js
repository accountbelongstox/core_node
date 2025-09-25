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

const { Sequelize, QueryTypes } = require('sequelize');
const logger = require('#@logger');
const { arrtool } = require('#@btools');
/**
 * Insert records into the database
 * @param {Sequelize} sequelize - The Sequelize instance
 * @param {Object} options - The options object
 * @param {Object} options.model - The model to insert into
 * @param {Object} options.tableName - The name of the table to insert into
 * @param {Object} options.data - The data to insert
 * @param {number} [options.chunkSize=1000] - The number of records to insert in a single transaction
 * @returns {Promise<Object>} A promise that resolves to an object containing the result of the insert operation
 */
async function dbInsert(sequelize, options = {}) {
    if (!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    const {
        model,
        data,
        chunkSize = 1000
    } = options;
    let { tableName } = options;
    if (!tableName) {
        tableName = model.name;
    }
    if (!data) {
        return { success: false, count: 0, error: 'No data provided' };
    }
    if (!Array.isArray(data)) {
        return dbInsertSingle(sequelize, { model, tableName, data: data });
    }
    return dbInsertBulk(sequelize, { model, tableName, data: data, chunkSize });
}

/**
 * Insert a single record
 * @private
 */
async function dbInsertSingle(sequelize, options) {
    if (!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    const { model, data } = options
    let { tableName } = options;
    if (!tableName) {
        tableName = model.name;
    }
    try {
        if (model) {
            const result = await model.create(data);
            return { success: true, count: 1, data: result };
        }

        const fields = Object.keys(data);
        const values = Object.values(data);
        const placeholders = fields.map((_, i) => `:${i}`).join(', ');

        const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`;
        const replacements = values.reduce((acc, val, i) => ({ ...acc, [i]: val }), {});

        await sequelize.query(sql, {
            type: QueryTypes.INSERT,
            replacements,
            raw: true
        });

        return { success: true, count: 1, data };
    } catch (error) {
        logger.error('Error executing single insert:', error);
        return { success: false, count: 0, error: error.message };
    }
}

/**
 * Insert multiple records with transaction and chunking
 * @private
 */
async function dbInsertBulk(sequelize, options) {
    if (!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    const {
        model,
        data,
        prefix  = "",
        chunkSize = 10000
    } = options
    const printPrefix = `insertBulk [${prefix}]`;
    let { tableName } = options;
    if (!tableName) {
        tableName = model.name;
    }
    if (data.length === 0) {
        logger.debug(`${printPrefix} No data to insert`);
        return { success: true, count: 0 };
    }
    const transaction = await sequelize.transaction();

    try {
        if (model) {
            const chunks = arrtool.splitArrayTo2D(data, chunkSize);
            let totalCount = 0;
            let prec = 0;
            for (const chunk of chunks) {
                logger.refresh(`${printPrefix} [${prec.toFixed(2)}%] [${totalCount}/${data.length}] chunkSize:${chunkSize} records to ${tableName}`);
                const result = await model.bulkCreate(chunk, { transaction });
                totalCount += result.length;
                prec = (totalCount / data.length) * 100;
                logger.refresh(`${printPrefix} [${prec.toFixed(2)}%] [${totalCount}/${data.length}] records to ${tableName}`);
            }
            logger.refresh(`${printPrefix} Commit [${prec.toFixed(2)}%] [${totalCount}/${data.length}] transaction  ${tableName}`);
            await transaction.commit();
            logger.success(`${printPrefix} Commit [${prec.toFixed(2)}%] [${totalCount}/${data.length}] transaction  ${tableName} success`);
            return { success: true, count: totalCount };
        }

        if (data.length === 0) {
            await transaction.commit();
            return { success: true, count: 0 };
        }

        const fields = Object.keys(data[0]);
        const placeholders = `(${fields.map(() => '?').join(', ')})`;
        const sql = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES ${placeholders}`;

        const values = data.map(record => fields.map(field => record[field]));

        try {
            const [result] = await sequelize.query(sql, {
                type: QueryTypes.INSERT,
                replacements: values.flat(),
                raw: true,
                transaction
            });

            await transaction.commit();
            return { success: true, count: result?.rowCount || data.length };
        } catch (error) {
            logger.error('insertBulk Error executing bulk insert:', error);
            await transaction.rollback();

            // If chunk is too large, try with smaller chunks
            if (data.length > 100) {
                logger.warn(`Bulk insert failed with ${data.length} records, trying with smaller chunks...`);
                const chunks = chunkArray(data, Math.max(Math.floor(data.length / 2), 100));

                let totalCount = 0;
                for (const chunk of chunks) {
                    const result = await dbInsertBulk(sequelize, { model, tableName, data: chunk, chunkSize });
                    if (result.success) {
                        totalCount += result.count;
                    } else {
                        if (chunk.length > 100) {
                            const subResult = await dbInsertBulk(sequelize, {
                                model,
                                tableName,
                                data: chunk,
                                chunkSize: Math.floor(chunk.length / 2)
                            });
                            if (subResult.success) {
                                totalCount += subResult.count;
                            }
                        } else {
                            for (const record of chunk) {
                                const singleResult = await dbInsertSingle(sequelize, { model, tableName, data: record });
                                if (singleResult.success) {
                                    totalCount += 1;
                                }
                            }
                        }
                    }
                }
                return { success: true, count: totalCount };
            }
            let successCount = 0;
            for (const record of data) {
                const result = await dbInsertSingle(sequelize, { model, tableName, data: record });
                if (result.success) {
                    successCount += 1;
                }
            }
            return { success: true, count: successCount };
        }
    } catch (error) {
        logger.error('insertBulk-Error:');
        console.log(error);
        logger.error(`${error}`);
        await transaction.rollback();
        return { success: false, count: 0, error: error.message };
    }
}

/**
 * Split array into chunks
 * @private
 */
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

module.exports = {
    dbInsert,
    dbInsertSingle,
    dbInsertBulk
}; 