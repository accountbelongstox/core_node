import { sysarg } from '#@utils_native';

class Main   {
    constructor() {
    }

    async start() {
        console.log(`start ...`)
        const action = sysarg.getArg('action');

    }
}

// Export both the class and an instance
export { Main };
export default new Main();
