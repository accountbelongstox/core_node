const fs = require('fs');
    const path = require('path');
    const { execSync } = require('child_process');
    const util = require('util');

    const __filename = __filename;
    const __dirname = path.dirname(__filename);
    const writeFileAsync = util.promisify(fs.writeFile);

    class EnvManager {
        constructor(rootDir = null, envName = ".env", delimiter = "=") {
            this.rootDir = rootDir || path.dirname(__filename);
            this.delimiter = delimiter;
            this.localEnvFile = path.join(this.rootDir, envName);
            this.exampleEnvFile = this.findExampleEnvFile(envName);
        }

        findExampleEnvFile(envName) {
            const variants = [
                `${envName}_example`,
                `${envName}-example`,
                `${envName}.example`
            ];
            
            for (const variant of variants) {
                const filePath = path.join(this.rootDir, variant);
                if (fs.existsSync(filePath)) {
                    return filePath;
                }
            }
            return null;
        }

        async initializeEnvFile() {
            if (!fs.existsSync(this.localEnvFile)) {
                await writeFileAsync(this.localEnvFile, "");
            }
            if (this.exampleEnvFile) {
                await this.mergeEnvFiles(this.localEnvFile, this.exampleEnvFile);
            }
            return this.localEnvFile;
        }

        parseEnvFile(filePath) {
            if (!fs.existsSync(filePath)) return [];
            const content = fs.readFileSync(filePath, 'utf8');
            return content.split('\n')
                .map(line => line.split(this.delimiter).map(v => v.trim()))
                .filter(pair => pair.length === 2);
        }

        async mergeEnvFiles(targetFile, sourceFile) {
            const sourceEntries = this.parseEnvFile(sourceFile);
            const targetEntries = this.parseEnvFile(targetFile);
            
            const targetDict = Object.fromEntries(targetEntries);
            const addedKeys = [];

            for (const [key, value] of sourceEntries) {
                if (!(key in targetDict)) {
                    targetDict[key] = value;
                    addedKeys.push(key);
                }
            }

            if (addedKeys.length > 0) {
                const updatedContent = Object.entries(targetDict)
                    .map(([k, v]) => `${k}${this.delimiter}${v}`)
                    .join('\n');
                
                await writeFileAsync(targetFile, updatedContent);
                addedKeys.forEach(key => console.log(`Env-Added key: ${key}`));
            }
        }

        getValue(key) {
            const entries = this.parseEnvFile(this.localEnvFile);
            const entry = entries.find(([k]) => k === key);
            return entry ? entry[1] : "";
        }
    }

    class AutoInstaller {
        constructor() {
            this.currentDirectory = __dirname;
            this.projects = ['.'];
            this.projectPaths = new Set();
            this.dependencyDirs = ['node_provider', 'node_spider'];
            this.dependencyPaths = new Set();
            this.skipDirs = new Set(['node_modules']);
            this.env = new EnvManager(this.currentDirectory);
        }

        async initialize() {
            await this.env.initializeEnvFile();
            this.scanFrontendProjects();
            await this.scanDependencies();
        }

        scanFrontendProjects() {
            const frontend = this.env.getValue('FRONTEND');
            if (frontend && !frontend.startsWith('http')) {
                this.projects.push(frontend);
            }
        }

        async scanDependencies() {
            for (const dir of this.dependencyDirs) {
                await this.scanDirectory(this.currentDirectory, dir);
            }

            for (const project of this.projects) {
                const projectPath = path.join(this.currentDirectory, project);
                this.projectPaths.add(projectPath);
            }
        }

        async scanDirectory(baseDir, targetDir) {
            const entries = fs.readdirSync(baseDir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (this.skipDirs.has(entry.name)) continue;
                
                const fullPath = path.join(baseDir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === targetDir) {
                        this.dependencyPaths.add(fullPath);
                    }
                    await this.scanDirectory(fullPath, targetDir);
                }
            }
        }

        async installDependencies() {
            const yarn = this.getArgValue("yarn", "yarn");
            const git = this.getArgValue("git", "git");

            // Clone missing dependencies
            for (const depPath of this.dependencyPaths) {
                if (!fs.existsSync(depPath) || this.isEmptyDir(depPath)) {
                    if (fs.existsSync(depPath)) {
                        await this.deleteDirectory(depPath);
                    }
                    
                    const basename = path.basename(depPath);
                    const baseDir = path.dirname(depPath);
                    const envKey = basename.toUpperCase();
                    const gitUrl = this.env.getValue(envKey);

                    process.chdir(baseDir);
                    await execSync(`${git} clone ${gitUrl}`, { stdio: 'inherit' });
                }
            }

            // Install node modules
            for (const projectPath of this.projectPaths) {
                if (this.needsNodeModules(projectPath)) {
                    process.chdir(projectPath);
                    await execSync(`${yarn} install`, { stdio: 'inherit' });
                }
            }
        }

        needsNodeModules(directory) {
            return fs.existsSync(path.join(directory, 'package.json')) && 
                   !this.hasNodeModules(directory);
        }

        hasNodeModules(directory) {
            const nodeModulesPath = path.join(directory, 'node_modules');
            return fs.existsSync(nodeModulesPath) && !this.isEmptyDir(nodeModulesPath);
        }

        isEmptyDir(directory) {
            return !fs.existsSync(directory) || 
                   fs.readdirSync(directory).length === 0;
        }

        async deleteDirectory(directory) {
            if (fs.existsSync(directory)) {
                const entries = fs.readdirSync(directory);
                for (const entry of entries) {
                    const fullPath = path.join(directory, entry);
                    if (fs.lstatSync(fullPath).isDirectory()) {
                        await this.deleteDirectory(fullPath);
                    } else {
                        fs.unlinkSync(fullPath);
                    }
                }
                fs.rmdirSync(directory);
            }
        }

        getArgValue(name, defaultValue = null) {
            const args = process.argv;
            const arg = args.find(arg => 
                arg === name || arg.startsWith(`${name}=`)
            );
            
            if (!arg) return defaultValue;
            const [, value] = arg.split('=');
            return value || true;
        }

        async start() {
            await this.initialize();
            await this.installDependencies();
            
            const cmdStart = this.getArgValue("cmd_start");
            if (cmdStart) {
                process.chdir(this.currentDirectory);
                const startCmd = `yarn reload ${this.getArgValue("restart", "restart")}`;
                console.log(`Start-Command: ${startCmd}`);
                await execSync(startCmd, { shell: true, stdio: 'inherit' });
            }
        }
    }

    // Create and export instance
    const autoInstaller = new AutoInstaller();
    module.exports = autoInstaller;