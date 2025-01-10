const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dns = require('dns');
const { promisify } = require('util');

const resolveDns = promisify(dns.resolve4);

const HOSTS_FILE = process.platform === 'win32' ? 
    'C:\\Windows\\System32\\drivers\\etc\\hosts' : 
    '/etc/hosts';

const GITHUB_DOMAINS = [
    'github.com',
    'api.github.com',
    'raw.githubusercontent.com',
    'gist.githubusercontent.com',
    'codeload.github.com',
    'objects.githubusercontent.com'
];

/**
 * Read current hosts file
 * @returns {Map<string, string>} Map of domain to IP
 */
function readCurrentHosts() {
    try {
        const content = fs.readFileSync(HOSTS_FILE, 'utf8');
        const hostsMap = new Map();

        content.split('\n').forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#')) {
                const [ip, ...domains] = line.split(/\s+/);
                domains.forEach(domain => hostsMap.set(domain, ip));
            }
        });

        return hostsMap;
    } catch (error) {
        console.error('Error reading hosts file:', error.message);
        return new Map();
    }
}

/**
 * Resolve domain using DNS
 * @param {string} domain - Domain to resolve
 * @returns {string|null} IP address or null
 */
async function resolveDomain(domain) {
    try {
        const addresses = await resolveDns(domain);
        return addresses[0]; // Return first IP
    } catch (error) {
        console.error(`Error resolving ${domain}:`, error.message);
        return null;
    }
}

/**
 * Check if IP is valid
 * @param {string} ip - IP address to check
 * @returns {boolean} Whether IP is valid
 */
function isValidIP(ip) {
    return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip);
}

/**
 * Update hosts file
 * @param {Map<string, string>} updates - Map of domain to IP
 * @returns {boolean} Whether update was successful
 */
function updateHostsFile(updates) {
    try {
        const currentHosts = readCurrentHosts();
        let content = fs.readFileSync(HOSTS_FILE, 'utf8');
        let updated = false;

        updates.forEach((ip, domain) => {
            if (!isValidIP(ip)) {
                console.warn(`Invalid IP ${ip} for ${domain}, skipping`);
                return;
            }

            const currentIP = currentHosts.get(domain);
            if (currentIP === ip) {
                console.log(`${domain} already points to ${ip}`);
                return;
            }

            const entry = `${ip}\t${domain}`;
            if (currentIP) {
                // Update existing entry
                const regex = new RegExp(`^.*\\s+${domain}\\s*$`, 'm');
                content = content.replace(regex, entry);
            } else {
                // Add new entry
                content += `\n${entry}`;
            }
            updated = true;
            console.log(`Updated ${domain} -> ${ip}`);
        });

        if (updated) {
            fs.writeFileSync(HOSTS_FILE, content.trim() + '\n');
            console.log('Hosts file updated successfully');
            
            // Flush DNS cache if possible
            try {
                if (process.platform === 'win32') {
                    execSync('ipconfig /flushdns');
                } else if (process.platform === 'darwin') {
                    execSync('dscacheutil -flushcache');
                    execSync('killall -HUP mDNSResponder');
                }
                console.log('DNS cache flushed');
            } catch (error) {
                console.warn('Could not flush DNS cache:', error.message);
            }
        }

        return true;
    } catch (error) {
        console.error('Error updating hosts file:', error.message);
        return false;
    }
}

/**
 * Main function
 */
async function main() {
    console.log('Checking GitHub domains...');
    const updates = new Map();

    for (const domain of GITHUB_DOMAINS) {
        console.log(`\nResolving ${domain}...`);
        const ip = await resolveDomain(domain);
        
        if (ip) {
            console.log(`${domain} -> ${ip}`);
            updates.set(domain, ip);
        } else {
            console.error(`Could not resolve ${domain}`);
        }
    }

    if (updates.size > 0) {
        console.log('\nUpdating hosts file...');
        if (!updateHostsFile(updates)) {
            process.exit(1);
        }
    } else {
        console.log('\nNo updates needed');
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}

module.exports = {
    readCurrentHosts,
    resolveDomain,
    isValidIP,
    updateHostsFile,
    GITHUB_DOMAINS,
    HOSTS_FILE,
    main
}; 