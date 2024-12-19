import Base from '#@base';
import { sysarg } from '#@utils_native';

class Main extends Base {
    constructor() {
        super();
    }

    async start() {
        const action = sysarg.getArg('action');

        switch (action) {
            case 'init':
                console.log('Initializing the application...');
                // Add initialization logic here
                break;

            case 'compile-docker':
                console.log('Compiling Docker environment...');
                break;

            case 'show-system-info':
                console.log('Displaying system information...');
                // Add system information display logic here
                break;

            default:
                console.log(`Unknown action: ${action}. Please specify a valid action.`);
                break;
        }
    }
}

// Export both the class and an instance
export { Main };
export default new Main();
