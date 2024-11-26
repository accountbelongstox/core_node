import { BaseHandler } from './handler.js';
import { User } from '../../database/models.js';
import { CreateUserRequest, LoginRequest } from '../http/requests.js';
import { UserResponse, LoginResponse } from '../http/responses.js';
import { findUserById } from './helpers.js';
import { performLogin, generateSecret } from '../../auth/auth.js';
import { getIsSetup, setIsSetup } from '../../../config/index.js';

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

export const login = (ctx) => handler.handle(ctx, 'login');
export const list = (ctx) => handler.handle(ctx, 'list');
export const create = (ctx) => handler.handle(ctx, 'create');
export const get = (ctx) => handler.handle(ctx, 'get');
export const update = (ctx) => handler.handle(ctx, 'update');
export const remove = (ctx) => handler.handle(ctx, 'remove');
export const getSetup = (ctx) => handler.handle(ctx, 'getSetup');
export const setup = (ctx) => handler.handle(ctx, 'setup'); 