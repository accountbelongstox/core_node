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
