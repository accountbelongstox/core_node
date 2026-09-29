const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const dns = require('dns').promises;

function checkDockerEnvironment() {
    if (os.platform() === 'win32') {
        return false;
    }
    try {
        const result = execSync("grep -qE '/docker|/lxc' /proc/1/cgroup && echo 'true' || echo 'false'").toString().trim();
        return result === 'true';
    } catch (error) {
        console.error('Error checking Docker environment:', error);
        return null;
    }
}

const dockerCheck = checkDockerEnvironment();
const isInsideDocker = dockerCheck !== null ? dockerCheck : (fs.existsSync('/.dockerenv') || process.env.IS_DOCKER === 'true');

const isDevelopmentEnvironment = !isInsideDocker && ['win32', 'linux'].includes(os.platform()) && os.release().toLowerCase().includes('microsoft');

function getDevelopmentEnvironmentExplanation() {
    if (isInsideDocker) {
        return "Running inside Docker";
    } else if (isDevelopmentEnvironment) {
        return "Running in WSL development environment";
    } else {
        return "Running in production or unknown environment";
    }
}

const developmentEnvironmentExplanation = getDevelopmentEnvironmentExplanation();

const userDataDir = os.platform() === 'win32'
    ? path.join(os.homedir(), 'AppData', 'Local', 'ClashSubscribe')
    : '/app/data'; 

const local_dir = path.join(__dirname, '..');
const provider_dir = path.join(__dirname);
const base_data_dir = path.join(userDataDir, '.data_cache');
const static_dir = path.join(local_dir, 'views');
const data_dir = path.join(local_dir, 'mate_data');
const cache_dir = path.join(base_data_dir, '.cache');
const puppeteer_dir = path.join(base_data_dir, '.puppeteer');
const groups_json_file = path.join(cache_dir, 'groups.json');
const groups_dir = path.join(cache_dir, 'groups');
const yamls_dir = path.join(cache_dir, 'yamls');
const out_dir = path.join(userDataDir, '.out');
const bak_dir = path.join(userDataDir, '.bak');
const config_dir = path.join(base_data_dir, '.config');
const data_json_file = path.join(provider_dir, 'mate_data.json');
const clash_template = path.join(provider_dir, 'clash_template.yaml');
const custom_template = path.join(provider_dir, 'custom_template.yaml');

const views_dir = path.join(local_dir, 'views');
const tmp_static_dir = base_data_dir;

const log_dir = path.join(base_data_dir, '.log');

const ROUTOR_DOMAIN = "http://192.168.100.1/";

const scriptDir = path.join(userDataDir, '.update_scripts');

const clash_scrible_dir = path.join('conf', 'docker_compose', 'clash_scrible');

function getLanIp() {
    let lanIp = '';
    try {
        const networkInterfaces = os.networkInterfaces();
        for (const interfaceName in networkInterfaces) {
            const interface = networkInterfaces[interfaceName];
            for (const iface of interface) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    lanIp = iface.address;
                    break;
                }
            }
            if (lanIp) break;
        }
    } catch (error) {
        console.error('Error getting LAN IP:', error);
    }
    return lanIp;
}

async function getExternalIp() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error('Error getting external IP:', error);
        return null;
    }
}

async function getDomainIp(domain = 'www.baidu.com') {
    try {
        const addresses = await dns.resolve4(domain);
        return addresses[0];
    } catch (error) {
        console.error(`Error resolving IP for ${domain}:`, error);
        return null;
    }
}

function isMainRouter(ip) {
    const lastOctet = ip.split('.').pop();
    return lastOctet === '1';
}

const lanIp = getLanIp();
const isMainRouterDevice = isMainRouter(lanIp);

const externalIpPromise = getExternalIp();
const domainIpPromise = getDomainIp();

const exportsDir = path.join(userDataDir, '.exports');
const importsDir = path.join(userDataDir, '.imports');
// Create directories
[userDataDir, bak_dir, config_dir, base_data_dir, cache_dir, groups_dir, log_dir, puppeteer_dir, yamls_dir, out_dir, scriptDir, exportsDir, importsDir].forEach(dir => {
    fs.mkdirSync(dir, { recursive: true });
});

const proxyBlacklist = {};
const proxySet = {};
const proxyGroups = {};
const filteredProxyList = {};

module.exports = {
    isDevelopmentEnvironment,
    isInsideDocker,
    developmentEnvironmentExplanation,
    local_dir,
    views_dir,
    tmp_static_dir,
    log_dir,
    base_data_dir,
    static_dir,
    data_dir,
    cache_dir,
    puppeteer_dir,
    groups_json_file,
    groups_dir,
    yamls_dir,
    config_dir,
    out_dir,
    data_json_file,
    ROUTOR_DOMAIN,
    scriptDir,
    userDataDir,
    clash_scrible_dir,
    bak_dir,
    clash_template,
    custom_template,
    lanIp,
    isMainRouterDevice,
    getExternalIp: async () => await externalIpPromise,
    getDomainIp: async () => await domainIpPromise,
    exportsDir,
    importsDir,
    proxyBlacklist,
    proxySet,
    proxyGroups,
    filteredProxyList,
};
