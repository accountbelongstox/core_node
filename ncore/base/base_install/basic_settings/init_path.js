const path = require('path');
const fs = require('fs');
const someModule = require('../some_module.js');

class InitPath {
    constructor() {
        this.path = path;
        this.fs = fs;
        this.someModule = someModule;
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
module.exports = initPathInstance;
