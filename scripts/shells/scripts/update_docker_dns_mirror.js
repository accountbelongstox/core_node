// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const fs = require('fs');
const https = require('https');
const serviceContract = require('../../../config/service_contract');
const daemonPath = '/etc/docker/daemon.json';
const synologyPath = '/var/packages/ContainerManager/etc/dockerd.json';

const [,, cloudProviderArg, envLocalArg] = process.argv;
const cloudProvider = cloudProviderArg || 'none';
const envLocal = envLocalArg || 'cn';

// DNS settings by provider/location
const dnsMap = {
  tencent: ['119.29.29.29'],
  aliyun: ['223.5.5.5', '223.6.6.6'],
  cn: ['180.76.76.76', '114.114.114.114'],
  default: ['8.8.8.8', '1.1.1.1']
};

// Registry mirror settings
const mirrorMap = {
  tencent: 'https://mirror.ccs.tencentyun.com',
  aliyun: 'https://4idglt5r.mirror.aliyuncs.com',
  huawei: 'https://668bad1d4db74415b0e85c8abdd0eb04.mirror.swr.myhuaweicloud.com',
  default: serviceContract.url('https', serviceContract.serviceDomain('docker_registry'))
};

function getTargetDNS(cloudProvider, envLocal) {
  if (cloudProvider === 'tencent') return dnsMap.tencent;
  if (cloudProvider === 'aliyun') return dnsMap.aliyun;
  if (envLocal === 'cn') return dnsMap.cn;
  return dnsMap.default;
}

function getMirrorUrl(cloudProvider) {
  if (cloudProvider === 'tencent') return mirrorMap.tencent;
  if (cloudProvider === 'aliyun') return mirrorMap.aliyun;
  if (cloudProvider === 'huawei') return mirrorMap.huawei;
  return mirrorMap.default;
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Logger with color
const logger = {
  info: (msg) => console.log('\x1b[36m[INFO]\x1b[0m', msg),
  ok: (msg) => console.log('\x1b[32m[OK]\x1b[0m', msg),
  warn: (msg) => console.log('\x1b[33m[WARN]\x1b[0m', msg),
  error: (msg) => console.log('\x1b[31m[ERROR]\x1b[0m', msg)
};

function testUrl(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = https.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

(async () => {
  let daemon = {};
  let needWrite = false;
  let needRestart = false;
  let daemonExists = fs.existsSync(daemonPath);

  if (envLocal === 'en') {
    logger.info('envLocal is en, skipping all Docker DNS and registry-mirrors settings. No changes will be made.');
    process.exit(0);
  }

  if (!daemonExists) {
    if (fs.existsSync(synologyPath)) {
      logger.warn('Detected Synology environment (/var/packages/ContainerManager/etc/dockerd.json exists).');
      logger.warn('Please configure Docker DNS/mirror via Synology DSM. No changes made.');
      process.exit(0);
    } else {
      logger.info('No existing daemon.json found. Will create a new one.');
      daemon = {};
    }
  } else {
    try {
      daemon = JSON.parse(fs.readFileSync(daemonPath, 'utf8'));
    } catch (e) {
      logger.error('Failed to read or parse ' + daemonPath + ': ' + e);
      process.exit(1);
    }
  }

  // --- Begin envLocal logic ---
  let skipDefault = false;
  if (envLocal === 'en') {
    // If envLocal is 'en', skip default DNS and registry-mirrors logic
    skipDefault = true;
  }

  // DNS logic
  let targetDNS = undefined;
  if (cloudProvider === 'tencent') targetDNS = dnsMap.tencent;
  else if (cloudProvider === 'aliyun') targetDNS = dnsMap.aliyun;
  else if (envLocal === 'cn') targetDNS = dnsMap.cn;
  else if (!skipDefault) targetDNS = dnsMap.default;

  if (typeof targetDNS !== 'undefined') {
    let dnsChanged = !arraysEqual(daemon.DNS, targetDNS);
    if (dnsChanged) {
      daemon.DNS = targetDNS;
      needWrite = true;
      needRestart = true;
      logger.info('Docker DNS will be set to: ' + JSON.stringify(targetDNS));
    } else {
      logger.ok('Docker DNS already set as desired.');
    }
  } else {
    logger.info('envLocal is en and no cloudProvider DNS override, DNS will not be changed.');
  }

  // Registry mirror logic
  let mirrorUrl = undefined;
  if (cloudProvider === 'tencent') mirrorUrl = mirrorMap.tencent;
  else if (cloudProvider === 'aliyun') mirrorUrl = mirrorMap.aliyun;
  else if (cloudProvider === 'huawei') mirrorUrl = mirrorMap.huawei;
  else if (envLocal === 'cn') mirrorUrl = mirrorMap.default;
  // If envLocal is 'en', do not set default mirror

  if (typeof mirrorUrl !== 'undefined') {
    logger.info(`Testing Docker registry mirror: ${mirrorUrl}`);
    const reachable = await testUrl(mirrorUrl);
    if (reachable) {
      if (!daemon['registry-mirrors'] || !arraysEqual(daemon['registry-mirrors'], [mirrorUrl])) {
        daemon['registry-mirrors'] = [mirrorUrl];
        needWrite = true;
        needRestart = true;
        logger.ok('Docker registry-mirrors will be set to: ' + mirrorUrl);
      } else {
        logger.ok('Docker registry-mirrors already set as desired.');
      }
    } else {
      logger.warn(`Mirror URL unreachable within 5s: ${mirrorUrl}. Will not set as registry-mirrors.`);
    }
  } else {
    logger.info('envLocal is en and no cloudProvider mirror override, registry-mirrors will not be changed.');
  }

  if (needWrite) {
    try {
      // Ensure the directory exists before writing
      const path = require('path');
      const dockerDir = path.dirname(daemonPath);

      if (!fs.existsSync(dockerDir)) {
        logger.info('Creating Docker configuration directory: ' + dockerDir);
        fs.mkdirSync(dockerDir, { recursive: true, mode: 0o755 });
      }

      // Only keep DNS and registry-mirrors if creating new file
      if (!daemonExists) {
        daemon = { DNS: daemon.DNS };
        if (daemon['registry-mirrors']) daemon['registry-mirrors'] = [mirrorUrl];
      }

      fs.writeFileSync(daemonPath, JSON.stringify(daemon, null, 2), { mode: 0o644 });
      logger.ok('Docker daemon.json updated.');
      logger.warn('Docker needs to be restarted.');
      process.exit(2); // special code for "need restart"
    } catch (e) {
      logger.error('Failed to write ' + daemonPath + ': ' + e);
      process.exit(1);
    }
  } else {
    logger.info('No changes needed. No restart required.');
    process.exit(0);
  }
})();
