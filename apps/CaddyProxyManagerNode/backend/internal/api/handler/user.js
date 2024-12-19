const { BaseHandler } = require('./handler.js');
    const { User } = require('../../database/models.js');
    const { CreateUserRequest, LoginRequest } = require('../http/requests.js');
    const { UserResponse, LoginResponse } = require('../http/responses.js');
    const { findUserById } = require('./helpers.js');
    const { performLogin, generateSecret } = require('../../auth/auth.js');
    const { getIsSetup, setIsSetup } = require('../../../config/index.js');

    class UserHandler extends BaseHandler {
        async login(ctx) {
            const request = new LoginRequest(ctx.getBodyParam());
            this.validateRequest(request);

            const response = await performLogin(request.email, request.password);
            ctx.json(new LoginResponse(response.token, response.expires));
        }

        async list(ctx) {
            const { offset, limit } = ctx.getPaginationParams();
            
            const users = await User.findAll({
                offset,
                limit
            });

            ctx.json(UserResponse.fromUsers(users));
        }

        async create(ctx) {
            const request = new CreateUserRequest(ctx.getBodyParam());
            this.validateRequest(request);

            const existingUser = await User.findOne({
                where: { email: request.email }
            });

            if (existingUser) {
                throw new AppError('email-already-exists', 'DUPLICATE_EMAIL');
            }

            const secret = await generateSecret(request.password);
            const user = await User.create({
                name: request.name,
                email: request.email,
                secret
            });

            ctx.json(UserResponse.fromUser(user), 201);
        }

        async get(ctx) {
            const id = ctx.getUrlParam('id', true);
            const user = await findUserById(id);
            ctx.json(user);
        }

        async update(ctx) {
            const id = ctx.getUrlParam('id', true);
            const request = new CreateUserRequest(ctx.getBodyParam());
            this.validateRequest(request);

            const user = await User.findByPk(id);
            if (!user) {
                throw new AppError('user-not-found', 'NOT_FOUND');
            }

            const secret = await generateSecret(request.password);
            await user.update({
                name: request.name,
                email: request.email,
                secret
            });

            ctx.json(UserResponse.fromUser(user));
        }

        async remove(ctx) {
            const id = ctx.getUrlParam('id', true);
            const user = await User.findByPk(id);
            
            if (!user) {
                throw new AppError('user-not-found', 'NOT_FOUND');
            }

            await user.destroy();
            ctx.json({ success: true });
        }

        async getSetup(ctx) {
            ctx.json({ isSetup: getIsSetup() });
        }

        async setup(ctx) {
            if (getIsSetup()) {
                throw new AppError('setup-already-completed', 'SETUP_COMPLETED');
            }

            const request = new CreateUserRequest(ctx.getBodyParam());
            this.validateRequest(request);

            const secret = await generateSecret(request.password);
            await User.create({
                name: request.name,
                email: request.email,
                secret
            });

            setIsSetup(true);
            ctx.json({ success: true });
        }
    }

    const handler = new UserHandler();

    exports.login = (ctx) => handler.handle(ctx, 'login');
    exports.list = (ctx) => handler.handle(ctx, 'list');
    exports.create = (ctx) => handler.handle(ctx, 'create');
    exports.get = (ctx) => handler.handle(ctx, 'get');
    exports.update = (ctx) => handler.handle(ctx, 'update');
    exports.remove = (ctx) => handler.handle(ctx, 'remove');
    exports.getSetup = (ctx) => handler.handle(ctx, 'getSetup');
    exports.setup = (ctx) => handler.handle(ctx, 'setup');