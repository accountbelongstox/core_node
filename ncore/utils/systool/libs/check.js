
class Plattools extends Base {
    constructor() {
        super();
        this.initialWorkingDirectory = this.getCwd();
        this.currentDir = this.getCwd();
        this.commandExecutor = new CommandExecutor();
    }

    async runAsAdmin(file_path, callback) {
        file_path = path.normalize(file_path);
        let cmd;
        let result;
        if (!fs.existsSync(file_path)) {
            const baseDir = path.dirname(file_path);
            cmd = `explorer "${baseDir}"`;
            result = { error: 'Executable file does not exist. Opening the parent directory of the executable file.' };
            console.error(result.error);
        } else {
            cmd = `explorer "${file_path}"`;
            result = await this.commandExecutor.execCommand(cmd, true);
        }
        if (callback) {
            callback(result);
        }
    }

    async execByExplorer(command, info = false, cwd = null) {
        let cmd;
        const parsedPath = path.parse(command);

        if (parsedPath.root !== '' && parsedPath.dir !== '') {
            // 如果是文件路径，则在命令中加入双引号
            cmd = `explorer "${command}"`;
        } else {
            cmd = `explorer ${command}`;
        }

        return await this.commandExecutor.spawnAsync(cmd, info, cwd);
    }

    async execByCommand(command, info = false, cwd = null) {
        const cmd = `cmd /c ${command}`;
        return await this.commandExecutor.spawnAsync(cmd, info, cwd);
    }

    isCommand(command) {
        try {
            const result = this.isWindows()
                ? execSync(`where ${command}`, { stdio: 'ignore' })
                : execSync(`which ${command}`, { stdio: 'ignore' });
            return result === 0;
        } catch (e) {
            return false;
        }
    }

    isWsl() {
        try {
            const output = execSync('uname -a').toString().toLowerCase();
            return output.includes('microsoft') || output.includes('wsl');
        } catch (error) {
            return false;
        }
    }

    isWindows() {
        return process.platform === 'win32';
    }

    isLinux() {
        return process.platform === 'linux';
    }

    isCentos() {
        return this.isLinux() && fs.readFileSync('/etc/os-release', 'utf-8').toLowerCase().includes('centos');
    }

    isUbuntu() {
        return this.isLinux() && fs.readFileSync('/etc/os-release', 'utf-8').toLowerCase().includes('ubuntu');
    }

    isDebian() {
        return this.isLinux() && fs.readFileSync('/etc/os-release', 'utf-8').toLowerCase().includes('debian');
    }

    reloadSystemctl() {
        const systemName = os.platform();
        if (systemName === "linux") {
            this.commandExecutor.execCmd(["sudo", "systemctl", "daemon-reload"]);
        } else {
            console.log("Unsupported operating system");
        }
    }
}