/**
 * Package manager configurations map
 * @type {Object.<string, {type: string, commands: {install: string, update: string, search: string, check: string, list?: string, clean: string}}>}
 */
const packageManagerMap = {
    opkg: {
        type: 'opkg',
        commands: {
            install: 'opkg install',
            update: 'opkg update',
            search: 'opkg find',
            check: 'opkg list-installed | grep -q',
            list: 'opkg list-installed',
            clean: 'opkg clean'
        }
    },
    apk: {
        type: 'apk',
        commands: {
            install: 'apk add',
            update: 'apk update',
            search: 'apk search -v',
            check: 'apk info -e',
            list: 'apk info',
            clean: 'apk cache clean'
        }
    },
    apt: {
        type: 'apt',
        commands: {
            install: 'apt install -y',
            update: 'apt update',
            search: 'apt search',
            check: 'dpkg -l',
            clean: 'apt-get clean'
        }
    },
    yum: {
        type: 'yum',
        commands: {
            install: 'yum install -y',
            update: 'yum check-update',
            search: 'yum search',
            check: 'rpm -q',
            clean: 'yum clean all'
        }
    },
    dnf: {
        type: 'dnf',
        commands: {
            install: 'dnf install -y',
            update: 'dnf check-update',
            search: 'dnf search',
            check: 'rpm -q',
            clean: 'dnf clean all'
        }
    },
    pacman: {
        type: 'pacman',
        commands: {
            install: 'pacman -S --noconfirm',
            update: 'pacman -Sy',
            search: 'pacman -Ss',
            check: 'pacman -Q',
            clean: 'pacman -Sc --noconfirm'
        }
    },
    zypper: {
        type: 'zypper',
        commands: {
            install: 'zypper install -y',
            update: 'zypper refresh',
            search: 'zypper search',
            check: 'rpm -q',
            clean: 'zypper clean'
        }
    }
};

module.exports = packageManagerMap; 