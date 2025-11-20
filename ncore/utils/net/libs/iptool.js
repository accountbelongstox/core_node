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

const os = require('os');

/**
 * Get the local network interface IPv4 address (supports Windows and Linux).
 * Returns 127.0.0.1 if no valid IP is found.
 * @returns {string} Local IP address
 */
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal && iface.address !== '127.0.0.1') {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

/**
 * Check if the machine has a public (non-private, non-loopback) IPv4 address.
 * @returns {boolean} True if a public IP exists, false otherwise.
 */
function hasPublicIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (
                iface.family === 'IPv4' &&
                !iface.internal &&
                iface.address !== '127.0.0.1' &&
                !isPrivateIp(iface.address)
            ) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Check if an IPv4 address is private (RFC1918).
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIp(ip) {
    return (
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
    );
}

module.exports = { getLocalIp, hasPublicIp };
