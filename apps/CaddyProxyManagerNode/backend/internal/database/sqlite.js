import { Sequelize } from 'sequelize';
import config from '../../config/index.js';
import logger from '../logger/logger.js';
import { Errors } from '../errors/errors.js';

const dbPath = `${config.dataFolder}/database.sqlite`;

export const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: (msg) => logger.debug(msg),
    define: {
        timestamps: true,
        underscored: true
    }
});

export const initDatabase = async () => {
    try {
        await sequelize.authenticate();
        logger.info('Database connection established');
        await sequelize.sync();
        logger.info('Database synchronized');
        return true;
    } catch (error) {
        logger.error('DatabaseError', error);
        throw Errors.DatabaseUnavailable;
    }
};

export const closeDatabase = async () => {
    try {
        await sequelize.close();
        logger.info('Database connection closed');
    } catch (error) {
        logger.error('DatabaseError', error);
        throw error;
    }
}; 