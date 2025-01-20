const { Sequelize, QueryTypes } = require('sequelize');
const logger = require('#@logger');


async function insert(sequelize, options = {}) {
    if(!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    const {
        model,
        tableName,
        data,
        chunkSize = 1000
    } = options;

    if (!data) {
        return { success: false, count: 0, error: 'No data provided' };
    }

    // Convert single object to array for unified processing
    const records = Array.isArray(data) ? data : [data];
    if (records.length === 0) {
        return { success: true, count: 0 };
    }

    // For single record, use simple insert
    if (records.length === 1) {
        return insertSingle(sequelize, { model, tableName, data: records[0] });
    }

    // For multiple records, try bulk insert with transaction
    return insertBulk(sequelize, { model, tableName, data: records, chunkSize });
}

/**
 * Insert a single record
 * @private
 */
async function insertSingle(sequelize, options) {
    if(!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    const { model, tableName, data } = options
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
async function insertBulk(sequelize, options) {
    if(!options.model && options.models && options.tableName) {
        options.model = options.models[options.tableName]
    }
    const { model, tableName, data, chunkSize } = options
    const transaction = await sequelize.transaction();

    try {
        if (model) {
            const result = await model.bulkCreate(data, { transaction });
            await transaction.commit();
            return { success: true, count: result.length };
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
            await transaction.rollback();

            // If chunk is too large, try with smaller chunks
            if (data.length > 100) {
                logger.warn(`Bulk insert failed with ${data.length} records, trying with smaller chunks...`);
                const chunks = chunkArray(data, Math.max(Math.floor(data.length / 2), 100));
                
                let totalCount = 0;
                for (const chunk of chunks) {
                    const result = await insertBulk(sequelize, { model, tableName, data: chunk, chunkSize });
                    if (result.success) {
                        totalCount += result.count;
                    } else {
                        // If chunk still fails and size > 100, recursively try smaller chunks
                        if (chunk.length > 100) {
                            const subResult = await insertBulk(sequelize, { 
                                model, 
                                tableName, 
                                data: chunk, 
                                chunkSize: Math.floor(chunk.length / 2) 
                            });
                            if (subResult.success) {
                                totalCount += subResult.count;
                            }
                        } else {
                            // For very small chunks, try individual inserts
                            for (const record of chunk) {
                                const singleResult = await insertSingle(sequelize, { model, tableName, data: record });
                                if (singleResult.success) {
                                    totalCount += 1;
                                }
                            }
                        }
                    }
                }
                return { success: true, count: totalCount };
            }

            // For small chunks that still fail, try individual inserts
            let successCount = 0;
            for (const record of data) {
                const result = await insertSingle(sequelize, { model, tableName, data: record });
                if (result.success) {
                    successCount += 1;
                }
            }
            return { success: true, count: successCount };
        }
    } catch (error) {
        await transaction.rollback();
        logger.error('Error executing bulk insert:', error);
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
    insert
}; 