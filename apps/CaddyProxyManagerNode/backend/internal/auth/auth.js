import bcrypt from 'bcrypt';
import { User } from '../database/models.js';
import { AppError } from '../errors/errors.js';
import { generate } from './jwt.js';
import logger from '../logger/logger.js';

const SALT_ROUNDS = 10;

export const generateSecret = async (password) => {
    if (!password) {
        throw new AppError('no password has been submitted', 'INVALID_PASSWORD');
    }
    try {
        return await bcrypt.hash(password, SALT_ROUNDS);
    } catch (error) {
        logger.error('PasswordHashError', error);
        throw error;
    }
};

export const performLogin = async (email, password) => {
    try {
        // 查找用户
        const user = await User.findOne({ 
            where: { email } 
        });
        
        if (!user) {
            throw new AppError('username or password is wrong', 'INVALID_LOGIN');
        }

        // 验证密码
        const isValid = await bcrypt.compare(password, user.secret);
        if (!isValid) {
            throw new AppError('username or password is wrong', 'INVALID_LOGIN');
        }

        // 生成 JWT token
        return generate(user);
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        logger.error('LoginError', error);
        throw new AppError('login failed', 'LOGIN_ERROR');
    }
};

