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

/**
 * Package manager configurations map
 * @type {Object.<string, {type: string, commands: {install: string, remove: string, update: string, search: string, check: string, list?: string, clean: string}, installedPattern?: string}>}
 */
const packageManagerMap = {
    opkg: {
        type: 'opkg',
        commands: {
            install: 'opkg install',
            remove: 'opkg remove',
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
            remove: 'apk del',
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
            remove: 'apt-get remove -y',
            update: 'apt update',
            search: 'apt search',
            check: 'dpkg -s',
            clean: 'apt-get clean'
        },
        installedPattern: 'Status: install ok installed'
    },
    yum: {
        type: 'yum',
        commands: {
            install: 'yum install -y',
            remove: 'yum remove -y',
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
            remove: 'dnf remove -y',
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
            remove: 'pacman -R --noconfirm',
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
            remove: 'zypper remove -y',
            update: 'zypper refresh',
            search: 'zypper search',
            check: 'rpm -q',
            clean: 'zypper clean'
        }
    }
};

module.exports = packageManagerMap; 