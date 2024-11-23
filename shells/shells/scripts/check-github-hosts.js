import fs from 'fs/promises';
import { EOL } from 'os';

const HOSTS_FILE = process.platform === 'win32' 
    ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
    : '/etc/hosts';

class HostsManager {
    constructor() {
        this.hostsFile = HOSTS_FILE;
        this.githubHosts = new Map([
            ['alive.github.com', '140.82.113.26'],
            ['live.github.com', '140.82.114.26'],
            ['github.githubassets.com', '185.199.109.154'],
            ['central.github.com', '140.82.114.21'],
            ['desktop.githubusercontent.com', '185.199.110.133'],
            ['assets-cdn.github.com', '185.199.110.153'],
            ['camo.githubusercontent.com', '185.199.109.133'],
            ['github.map.fastly.net', '185.199.111.133'],
            ['github.global.ssl.fastly.net', '146.75.121.194'],
            ['gist.github.com', '140.82.121.4'],
            ['github.io', '185.199.109.153'],
            ['github.com', '140.82.121.4'],
            ['github.blog', '192.0.66.2'],
            ['api.github.com', '140.82.121.5'],
            ['raw.githubusercontent.com', '185.199.108.133'],
            ['user-images.githubusercontent.com', '185.199.110.133'],
            ['favicons.githubusercontent.com', '185.199.111.133'],
            ['avatars5.githubusercontent.com', '185.199.111.133'],
            ['avatars4.githubusercontent.com', '185.199.109.133'],
            ['avatars3.githubusercontent.com', '185.199.109.133'],
            ['avatars2.githubusercontent.com', '185.199.108.133'],
            ['avatars1.githubusercontent.com', '185.199.111.133'],
            ['avatars0.githubusercontent.com', '185.199.111.133'],
            ['avatars.githubusercontent.com', '185.199.111.133'],
            ['codeload.github.com', '140.82.121.10'],
            ['github-cloud.s3.amazonaws.com', '3.5.12.192'],
            ['github-com.s3.amazonaws.com', '3.5.30.90'],
            ['github-production-release-asset-2e65be.s3.amazonaws.com', '52.217.164.249'],
            ['github-production-user-asset-6210df.s3.amazonaws.com', '52.216.154.116'],
            ['github-production-repository-file-5c1aeb.s3.amazonaws.com', '3.5.30.87'],
            ['githubstatus.com', '185.199.108.153'],
            ['github.community', '140.82.114.18'],
            ['github.dev', '51.137.3.17'],
            ['collector.github.com', '140.82.112.21'],
            ['pipelines.actions.githubusercontent.com', '13.107.42.16'],
            ['media.githubusercontent.com', '185.199.109.133'],
            ['cloud.githubusercontent.com', '185.199.111.133'],
            ['objects.githubusercontent.com', '185.199.111.133']
        ]);
    }

    print(message, type = 'info') {
        const colors = {
            success: '\x1b[32m', // Green
            error: '\x1b[31m',   // Red
            info: '\x1b[36m',    // Cyan
            reset: '\x1b[0m'     // Reset
        };

        const prefix = {
            success: '✓',
            error: '✗',
            info: 'ℹ'
        };

        console.log(`${colors[type]}${prefix[type]} ${message}${colors.reset}`);
    }

    handleError(error, context) {
        const errorMessage = `Error ${context}: ${error.message}`;
        this.print(errorMessage, 'error');
        
        if (error.code === 'EACCES') {
            this.print('Permission denied. Try running with sudo or administrator privileges.', 'error');
        }
    }

    async readHostsFile() {
        try {
            return await fs.readFile(this.hostsFile, 'utf8');
        } catch (error) {
            this.handleError(error, 'Reading hosts file');
            throw error;
        }
    }

    async writeHostsFile(content) {
        try {
            await fs.writeFile(this.hostsFile, content, 'utf8');
        } catch (error) {
            this.handleError(error, 'Writing hosts file');
            throw error;
        }
    }

    parseHostsContent(content) {
        const lines = content.split(/\r?\n/);
        const hostsMap = new Map();
        let githubSection = false;
        let githubStartIndex = -1;
        let githubEndIndex = -1;

        lines.forEach((line, index) => {
            if (line.includes('#Github Hosts Start')) {
                githubSection = true;
                githubStartIndex = index;
                return;
            }
            if (line.includes('#Github Hosts End')) {
                githubSection = false;
                githubEndIndex = index;
                return;
            }

            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [ip, ...domains] = trimmedLine.split(/\s+/);
                domains.forEach(domain => {
                    hostsMap.set(domain, { ip, index });
                });
            }
        });

        return {
            hostsMap,
            githubStartIndex,
            githubEndIndex,
            lines
        };
    }

    generateUpdatedContent(originalLines, startIndex, endIndex) {
        const header = [
            '#Github Hosts Start',
            `#Update Time: ${new Date().toISOString().split('T')[0]}`,
            '#Project Address: https://github.com/maxiaof/github-hosts',
            '#Update URL: https://raw.githubusercontent.com/maxiaof/github-hosts/master/hosts'
        ];

        const hostEntries = Array.from(this.githubHosts.entries())
            .map(([domain, ip]) => `${ip} ${domain}`);

        const newContent = [
            ...header,
            ...hostEntries,
            '#Github Hosts End'
        ];

        if (startIndex === -1) {
            return [...originalLines, '', ...newContent].join(EOL);
        }

        return [
            ...originalLines.slice(0, startIndex),
            ...newContent,
            ...originalLines.slice(endIndex + 1)
        ].join(EOL);
    }

    async updateHosts() {
        try {
            const content = await this.readHostsFile();
            const { lines, githubStartIndex, githubEndIndex } = this.parseHostsContent(content);
            const updatedContent = this.generateUpdatedContent(lines, githubStartIndex, githubEndIndex);
            await this.writeHostsFile(updatedContent);
            this.print('Hosts file has been updated successfully.', 'success');
        } catch (error) {
            this.handleError(error, 'Updating hosts file');
        }
    }
}

// Run the script
const manager = new HostsManager();
manager.updateHosts(); 