import Base from '#@base';
import { gdir, com_bin } from '#@globalvars';
import { winpath } from '#@utils_native';

class InitPath extends Base {
    constructor() {
        super();
    }

    start() {
        // Initialize executables
        const executables = [
            com_bin.getGitExecutable(),
            com_bin.get7zExecutable(),
            com_bin.getDDwinExecutable()
        ];

        // Add paths to environment
        executables.forEach(executable => {
            if (executable) {
                this.success(`Setting path for: ${executable}`);
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
