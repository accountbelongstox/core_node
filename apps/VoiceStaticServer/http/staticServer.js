import { http } from '#@utils';
const {httpServer} = http

class StaticServer   {
    static #staticPaths = ['../static', '../public']
    constructor() {
    }

    async initialize() {
        httpServer.addStatic(StaticServer.#staticPaths, '/')
    }
}

export default new StaticServer();

