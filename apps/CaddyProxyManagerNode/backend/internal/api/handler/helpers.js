const AppError = require('../../errors/errors.js').AppError;
    const { Host, User } = require('../../database/models.js');
    const { HostResponse, UserResponse } = require('../http/responses.js');

    exports.findHostById = async (id) => {
        const host = await Host.findByPk(id, {
            include: ['Upstreams']
        });
        
        if (!host) {
            throw new AppError('host-not-found', 'NOT_FOUND');
        }
        
        return new HostResponse(host);
    };

    exports.findUserById = async (id) => {
        const user = await User.findByPk(id);
        
        if (!user) {
            throw new AppError('user-not-found', 'NOT_FOUND');
        }
        
        return new UserResponse(user);
    };

    exports.validatePagination = (page, limit) => {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 10;

        if (pageNum < 1) {
            throw new AppError('invalid-page-number', 'VALIDATION_FAILED');
        }

        if (limitNum < 1 || limitNum > 100) {
            throw new AppError('invalid-limit-number', 'VALIDATION_FAILED');
        }

        return {
            offset: (pageNum - 1) * limitNum,
            limit: limitNum
        };
    };