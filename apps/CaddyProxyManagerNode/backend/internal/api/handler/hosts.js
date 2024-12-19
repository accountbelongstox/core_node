const { BaseHandler } = require('./handler.js');
    const { Host, Upstream } = require('../../database/models.js');
    const { CreateHostRequest } = require('../http/requests.js');
    const { HostResponse } = require('../http/responses.js');
    const { findHostById } = require('./helpers.js');
    const jobQueue = require('../../jobqueue/main.js');
    const { sequelize } = require('../../database/sqlite.js');
    const config = require('../../../config/index.js');

    class HostHandler extends BaseHandler {
        async list(ctx) {
            const { offset, limit } = ctx.getPaginationParams();
            
            const hosts = await Host.findAll({
                include: ['Upstreams'],
                offset,
                limit
            });

            ctx.json(hosts.map(host => new HostResponse(host)));
        }

        async create(ctx) {
            const request = new CreateHostRequest(ctx.getBodyParam());
            this.validateRequest(request);

            const result = await sequelize.transaction(async (t) => {
                const host = await Host.create({
                    domains: request.domains,
                    matcher: request.matcher
                }, { transaction: t });

                if (request.upstreams?.length) {
                    await Upstream.bulkCreate(
                        request.upstreams.map(u => ({
                            hostId: host.id,
                            backend: u.backend
                        })),
                        { transaction: t }
                    );
                }

                return host;
            });

            const host = await Host.findByPk(result.id, {
                include: ['Upstreams']
            });

            await jobQueue.addJob({
                type: 'UPDATE_CONFIG',
                data: { hostId: host.id }
            });

            ctx.json(new HostResponse(host), 201);
        }

        async get(ctx) {
            const id = ctx.getUrlParam('id', true);
            const host = await findHostById(id);
            ctx.json(host);
        }

        async update(ctx) {
            const id = ctx.getUrlParam('id', true);
            const request = new CreateHostRequest(ctx.getBodyParam());
            this.validateRequest(request);

            await sequelize.transaction(async (t) => {
                const host = await Host.findByPk(id, { transaction: t });
                if (!host) {
                    throw new AppError('host-not-found', 'NOT_FOUND');
                }

                await host.update({
                    domains: request.domains,
                    matcher: request.matcher
                }, { transaction: t });

                await Upstream.destroy({
                    where: { hostId: id },
                    transaction: t
                });

                if (request.upstreams?.length) {
                    await Upstream.bulkCreate(
                        request.upstreams.map(u => ({
                            hostId: id,
                            backend: u.backend
                        })),
                        { transaction: t }
                    );
                }
            });

            const updatedHost = await findHostById(id);
            
            await jobQueue.addJob({
                type: 'UPDATE_CONFIG',
                data: { hostId: id }
            });

            ctx.json(updatedHost);
        }

        async remove(ctx) {
            const id = ctx.getUrlParam('id', true);
            const host = await Host.findByPk(id);
            
            if (!host) {
                throw new AppError('host-not-found', 'NOT_FOUND');
            }

            await host.destroy();
            
            await jobQueue.addJob({
                type: 'UPDATE_CONFIG',
                data: { hostId: id }
            });

            ctx.json({ success: true });
        }
    }

    const handler = new HostHandler();

    exports.list = (ctx) => handler.handle(ctx, 'list');
    exports.create = (ctx) => handler.handle(ctx, 'create');
    exports.get = (ctx) => handler.handle(ctx, 'get');
    exports.update = (ctx) => handler.handle(ctx, 'update');
    exports.remove = (ctx) => handler.handle(ctx, 'remove');