const packageMap = {
    // Basic development environment
    buildEssentials: {
        apt: ['build-essential', 'gcc', 'g++', 'make', 'automake', 'autoconf', 'pkg-config'],
        apk: ['build-base', 'gcc', 'g++', 'make', 'automake', 'autoconf', 'pkgconfig'],
        opkg: ['gcc', 'make', 'binutils', 'pkg-config'],
        yum: ['gcc', 'gcc-c++', 'make', 'automake', 'autoconf', 'kernel-devel'],
        pacman: ['base-devel'],
        zypper: ['gcc', 'gcc-c++', 'make', 'automake', 'autoconf'],
        winget: ['GnuWin32.Make', 'Microsoft.VisualStudio.2022.BuildTools']
    },

    // Python environment
    python: {
        apt: ['python3', 'python3-pip', 'python3-venv', 'python3-dev'],
        apk: ['python3', 'python3-dev', 'py3-pip', 'py3-virtualenv'],
        opkg: ['python3', 'python3-pip'],
        yum: ['python3', 'python3-pip', 'python3-devel', 'python3-virtualenv'],
        pacman: ['python', 'python-pip', 'python-virtualenv'],
        zypper: ['python3', 'python3-pip', 'python3-virtualenv', 'python3-devel'],
        winget: ['Python.Python.3.11']
    },

    // Version control
    git: {
        apt: ['git', 'git-lfs'],
        apk: ['git', 'git-lfs'],
        opkg: ['git', 'git-http'],
        yum: ['git', 'git-lfs'],
        pacman: ['git', 'git-lfs'],
        zypper: ['git', 'git-lfs'],
        winget: ['Git.Git']
    },

    // Compression tools
    compression: {
        apt: ['p7zip-full', 'zip', 'unzip', 'tar', 'gzip', 'bzip2', 'xz-utils'],
        apk: ['p7zip', 'zip', 'unzip', 'tar', 'gzip', 'bzip2', 'xz'],
        opkg: ['p7zip', 'zip', 'unzip', 'tar', 'gzip', 'bzip2', 'xz-utils'],
        yum: ['p7zip', 'p7zip-plugins', 'zip', 'unzip', 'tar', 'gzip', 'bzip2', 'xz'],
        pacman: ['p7zip', 'zip', 'unzip', 'tar', 'gzip', 'bzip2', 'xz'],
        zypper: ['p7zip', 'zip', 'unzip', 'tar', 'gzip', 'bzip2', 'xz'],
        winget: ['7zip.7zip', 'Info-ZIP.Zip', 'Info-ZIP.UnZip']
    },

    // Network tools
    networkTools: {
        apt: ['wget', 'curl', 'net-tools', 'iputils-ping', 'telnet', 'netcat'],
        apk: ['wget', 'curl', 'net-tools', 'iputils', 'busybox-extras'],
        opkg: ['wget', 'curl', 'net-tools', 'iputils-ping'],
        yum: ['wget', 'curl', 'net-tools', 'iputils', 'telnet', 'nc'],
        pacman: ['wget', 'curl', 'net-tools', 'iputils', 'inetutils', 'netcat'],
        zypper: ['wget', 'curl', 'net-tools', 'iputils', 'telnet', 'netcat'],
        winget: ['cURL.cURL', 'Microsoft.PowerShell']
    },

    // Node.js environment
    nodejs: {
        apt: ['nodejs', 'npm'],
        apk: ['nodejs', 'npm'],
        opkg: ['node', 'node-npm'],
        yum: ['nodejs', 'npm'],
        pacman: ['nodejs', 'npm'],
        zypper: ['nodejs', 'npm'],
        winget: ['OpenJS.NodeJS.LTS']
    },

    // Text editors
    textEditors: {
        apt: ['vim', 'nano'],
        apk: ['vim', 'nano'],
        opkg: ['vim', 'nano'],
        yum: ['vim-enhanced', 'nano'],
        pacman: ['vim', 'nano'],
        zypper: ['vim', 'nano'],
        winget: ['vim.vim', 'Microsoft.VisualStudioCode']
    },

    // System monitoring tools
    systemTools: {
        apt: ['htop', 'iotop', 'iftop', 'sysstat'],
        apk: ['htop', 'iotop', 'iftop', 'sysstat'],
        opkg: ['htop'],
        yum: ['htop', 'iotop', 'iftop', 'sysstat'],
        pacman: ['htop', 'iotop', 'iftop', 'sysstat'],
        zypper: ['htop', 'iotop', 'iftop', 'sysstat'],
        winget: ['Microsoft.Sysinternals.ProcessExplorer', 'Microsoft.PowerToys']
    }
};

// Common package sets
const commonPackageSets = {
    minimal: ['git', 'compression', 'networkTools', 'textEditors'],
    development: ['buildEssentials', 'git', 'python', 'nodejs', 'compression', 'networkTools', 'textEditors'],
    server: ['buildEssentials', 'git', 'networkTools', 'systemTools', 'textEditors'],
    complete: Object.keys(packageMap)
};

// Get package list for specific system and package set
function getPackagesForSystem(system, packageSet = 'minimal') {
    if (!packageMap || !system) return [];

    const packages = new Set();
    const categories = commonPackageSets[packageSet] || commonPackageSets.minimal;

    categories.forEach(category => {
        const categoryPackages = packageMap[category]?.[system] || [];
        categoryPackages.forEach(pkg => packages.add(pkg));
    });

    return Array.from(packages);
}

// Get packages for a specific category
function getPackagesForCategory(system, category) {
    if (!packageMap || !system || !packageMap[category]) return [];
    return packageMap[category][system] || [];
}

module.exports = {
    packageMap,
    commonPackageSets,
    getPackagesForSystem,
    getPackagesForCategory
}; 