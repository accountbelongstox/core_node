import Base from '#@base';
import { gdir, bdir } from '#@globalvars';
import { winpath } from '#@utils_native';
import logger from '#@utils_logger';

class InitPath extends Base {
    constructor() {
        super();
    }

    start() {
        // Initialize executables
        const executables = [
            bdir.getGitExecutable(),
            bdir.get7zExecutable(),
            bdir.getDDwinExecutable()
        ];

        // Add paths to environment
        executables.forEach(executable => {
            if (executable) {
                logger.success(`Setting path for: ${executable}`);
                if (!winpath.isPath(executable)) {
                    winpath.addPath(executable);
                    console.log(`Path added: ${executable}`);
                } else {
                    console.log(`Path already exists: ${executable}`);
                }
            } else {
                console.log(`Executable not found: ${executable}`);
            }
        });

        console.log('Paths initialized successfully.');
    }
}

const initPathInstance = new InitPath();
export default initPathInstance;
