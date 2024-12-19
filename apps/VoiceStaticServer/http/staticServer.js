const { http } = require('#@utils');
    const { httpServer } = http;

    class StaticServer {
        static #staticPaths = ['../static', '../public'];

        constructor() {}

        async initialize() {
            httpServer.addStatic(StaticServer.#staticPaths, '/');
        }
    }

    module.exports = new StaticServer();