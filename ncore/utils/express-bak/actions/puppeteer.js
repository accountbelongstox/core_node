const { checkPuppeteerEnvironment, login, openOpenclash, openYacd, getProxyInfo } = require('../../utils/puppeteer/puppeteer_utils');
const { standardResponse } = require('../../utils/html_utils'); 
const os = require('os');
const { isInsideDocker, isDevelopmentEnvironment, developmentEnvironmentExplanation, lanIp,
    isMainRouterDevice,
    getExternalIp,
    getDomainIp } = require('../../provider/global_var');

function authenticate(headers) {
    const authHeader = headers.authorization;
    if (!authHeader) {
        return false;
    }

    const [authType, authString] = authHeader.split(' ');
    if (authType.toLowerCase() !== 'basic') {
        return false;
    }

    const [username, password] = Buffer.from(authString, 'base64').toString().split(':');
    return username === process.env.ROUTER_USERNAME && password === process.env.ROUTER_PASSWORD;
}

async function handlePuppeteerInfo(headers) {
    if (!authenticate(headers)) {
        return standardResponse(false, "Authentication required", null, 401);
    }

    try {
        const info = await checkPuppeteerEnvironment();
        return standardResponse(true, "Puppeteer environment info", info.data, 200);
    } catch (error) {
        return standardResponse(false, error.message, null, 500);
    }
}

async function getSystemInfo() {
    let puppeteerInfo;
    try {
        puppeteerInfo = await checkPuppeteerEnvironment();
    } catch (e) {
        puppeteerInfo = { error: e.toString() };
    }

    const externalIp = await getExternalIp();
    const domainIp = await getDomainIp();

    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    const systemInfo = {
        os: os.type() + ' ' + os.release(),
        node: process.version,
        puppeteer: puppeteerInfo.data,
        lanIp,
        isInsideDocker,
        isMainRouterDevice,
        externalIp,
        domainIp,
        isDevelopmentEnvironment,
        developmentEnvironmentExplanation,
        cpu: `${cpus[0].model} (${cpus.length} cores, ${cpus[0].speed} MHz)`,
        memory: `Total: ${(totalMemory / (1024 * 1024 * 1024)).toFixed(2)} GB, Free: ${(freeMemory / (1024 * 1024 * 1024)).toFixed(2)} GB, Used: ${((totalMemory - freeMemory) / (1024 * 1024 * 1024)).toFixed(2)} GB (${((1 - freeMemory / totalMemory) * 100).toFixed(2)}% used)`
    };

    return standardResponse(true, "System information", systemInfo, 200);
}

async function handlePuppeteerAction(action) {
    const actionMap = {
        'login': login,
        'open_openclash': openOpenclash,
        'open_yacd': openYacd,
        'get_proxy_info': getProxyInfo
    };

    if (!(action in actionMap)) {
        return standardResponse(false, `Unknown action: ${action}`, null, 400);
    }

    try {
        const result = await actionMap[action]();
        return standardResponse(
            result.success,
            result.message,
            result.data,
            result.success ? 200 : 400
        );
    } catch (error) {
        return standardResponse(false, error.message, null, 500);
    }
}

module.exports = {
    handlePuppeteerInfo,
    getSystemInfo,
    handlePuppeteerAction
};
