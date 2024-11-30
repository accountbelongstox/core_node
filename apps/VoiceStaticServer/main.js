import { sysarg } from '#@utils_native';
import httpMain from './http/main.js';

class Main   {
    constructor() {
    }

    async start() {
        const httpServer = await httpMain.start()
        console.log(`start ...`)
        console.log(httpServer);
        const action = sysarg.getArg('action');

    }
}

// Export both the class and an instance
export { Main };
export default new Main();
