/**
 * Package manager configurations and distribution mappings
 */

// Package manager configurations
const PACKAGE_MAPS = {
    APT: {
        name: 'apt',
        installCmd: 'apt-get install -y',
        removeCmd: 'apt-get remove',
        updateCmd: 'apt-get update',
        searchCmd: 'apt-cache search',
        listCmd: 'dpkg -l',
        verifyCmd: 'dpkg -s',
        checkCmd: 'which apt',
        distributions: ['debian', 'ubuntu', 'mint', 'kali'],
        defaultPaths: [
            '/usr/bin/apt',
            '/usr/sbin/apt-get'
        ]
    },

    DPKG: {
        name: 'dpkg',
        installCmd: 'dpkg -i',
        removeCmd: 'dpkg -r',
        listCmd: 'dpkg -l',
        verifyCmd: 'dpkg -s',
        checkCmd: 'which dpkg',
        distributions: ['debian', 'ubuntu'],
        defaultPaths: [
            '/usr/bin/dpkg'
        ]
    },

    YUM: {
        name: 'yum',
        installCmd: 'yum install -y',
        removeCmd: 'yum remove',
        updateCmd: 'yum update',
        searchCmd: 'yum search',
        listCmd: 'rpm -qa',
        verifyCmd: 'rpm -q',
        checkCmd: 'which yum',
        distributions: ['centos', 'rhel', 'fedora'],
        defaultPaths: [
            '/usr/bin/yum'
        ]
    },

    DNF: {
        name: 'dnf',
        installCmd: 'dnf install -y',
        removeCmd: 'dnf remove',
        updateCmd: 'dnf update',
        searchCmd: 'dnf search',
        listCmd: 'rpm -qa',
        verifyCmd: 'rpm -q',
        checkCmd: 'which dnf',
        distributions: ['fedora', 'rhel8'],
        defaultPaths: [
            '/usr/bin/dnf'
        ]
    },

    PACMAN: {
        name: 'pacman',
        installCmd: 'pacman -S --noconfirm',
        removeCmd: 'pacman -R',
        updateCmd: 'pacman -Sy',
        searchCmd: 'pacman -Ss',
        listCmd: 'pacman -Q',
        verifyCmd: 'pacman -Qi',
        checkCmd: 'which pacman',
        distributions: ['arch', 'manjaro'],
        defaultPaths: [
            '/usr/bin/pacman'
        ]
    },

    APK: {
        name: 'apk',
        installCmd: 'apk add',
        removeCmd: 'apk del',
        updateCmd: 'apk update',
        searchCmd: 'apk search',
        listCmd: 'apk list',
        verifyCmd: 'apk info',
        checkCmd: 'which apk',
        distributions: ['alpine'],
        defaultPaths: [
            '/sbin/apk'
        ]
    },

    OPKG: {
        name: 'opkg',
        installCmd: 'opkg install',
        removeCmd: 'opkg remove',
        updateCmd: 'opkg update',
        searchCmd: 'opkg find',
        listCmd: 'opkg list-installed',
        verifyCmd: 'opkg status',
        checkCmd: 'which opkg',
        distributions: ['openwrt'],
        defaultPaths: [
            '/bin/opkg'
        ]
    },

    ZYPPER: {
        name: 'zypper',
        installCmd: 'zypper install -y',
        removeCmd: 'zypper remove',
        updateCmd: 'zypper refresh',
        searchCmd: 'zypper search',
        listCmd: 'rpm -qa',
        verifyCmd: 'rpm -q',
        checkCmd: 'which zypper',
        distributions: ['opensuse', 'suse'],
        defaultPaths: [
            '/usr/bin/zypper'
        ]
    },

    EMERGE: {
        name: 'emerge',
        installCmd: 'emerge',
        removeCmd: 'emerge -C',
        updateCmd: 'emerge --sync',
        searchCmd: 'emerge -s',
        listCmd: 'qlist -I',
        verifyCmd: 'equery list',
        checkCmd: 'which emerge',
        distributions: ['gentoo'],
        defaultPaths: [
            '/usr/bin/emerge'
        ]
    },

    XBPS: {
        name: 'xbps',
        installCmd: 'xbps-install -y',
        removeCmd: 'xbps-remove',
        updateCmd: 'xbps-install -Su',
        searchCmd: 'xbps-query -Rs',
        listCmd: 'xbps-query -l',
        verifyCmd: 'xbps-query',
        checkCmd: 'which xbps-install',
        distributions: ['void'],
        defaultPaths: [
            '/usr/bin/xbps-install'
        ]
    }
};

// Distribution to package manager mapping
const DISTRO_MANAGER_MAP = {
    // Debian-based
    'debian': PACKAGE_MAPS.APT,
    'ubuntu': PACKAGE_MAPS.APT,
    'mint': PACKAGE_MAPS.APT,
    'kali': PACKAGE_MAPS.APT,
    'deepin': PACKAGE_MAPS.APT,
    'proxmox': PACKAGE_MAPS.APT,

    // RHEL-based
    'centos': PACKAGE_MAPS.YUM,
    'rhel': PACKAGE_MAPS.YUM,
    'fedora': PACKAGE_MAPS.DNF,
    'rocky': PACKAGE_MAPS.DNF,
    'alma': PACKAGE_MAPS.DNF,

    // Arch-based
    'arch': PACKAGE_MAPS.PACMAN,
    'manjaro': PACKAGE_MAPS.PACMAN,
    'endeavouros': PACKAGE_MAPS.PACMAN,

    // Other distributions
    'alpine': PACKAGE_MAPS.APK,
    'openwrt': PACKAGE_MAPS.OPKG,
    'opensuse': PACKAGE_MAPS.ZYPPER,
    'suse': PACKAGE_MAPS.ZYPPER,
    'gentoo': PACKAGE_MAPS.EMERGE,
    'void': PACKAGE_MAPS.XBPS,

    // Windows
    'windows': {
        name: 'winget',
        type: 'WINGET',
        installCmd: 'winget install',
        removeCmd: 'winget uninstall',
        updateCmd: 'winget upgrade',
        searchCmd: 'winget search',
        listCmd: 'winget list',
        verifyCmd: 'winget show',
        checkCmd: 'winget --version',
        distributions: ['windows'],
        defaultPaths: []
    }
};

/**
 * Get package manager info for a distribution
 * @param {string} id Distribution ID
 * @returns {Object|null} Package manager info with key
 */
function getPackageManagerForDistro(id) {
    const manager = DISTRO_MANAGER_MAP[id.toLowerCase()];
    if (manager) {
        return {
            key: Object.keys(PACKAGE_MAPS).find(key => PACKAGE_MAPS[key] === manager) || 'WINGET',
            ...manager
        };
    }

    // If not found in direct mapping, try to find in PACKAGE_MAPS distributions
    for (const [key, manager] of Object.entries(PACKAGE_MAPS)) {
        if (manager.distributions.includes(id.toLowerCase())) {
            return { key, ...manager };
        }
    }

    return null;
}

module.exports = {
    PACKAGE_MAPS,
    DISTRO_MANAGER_MAP,
    getPackageManagerForDistro
}; 