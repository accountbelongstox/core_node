const fs = require('fs');
const path = require('path');
const gconfig = require('#@gconfig');
const { pathtool } = require('#@btools');
const { WWWROOT_DIR, SKIP_DIRS } = gconfig;

function getSubDirs(parent = '/') {
    const absParent = pathtool.resolveInside(WWWROOT_DIR, String(parent));
    let dirs = [];
    if (absParent && fs.existsSync(absParent)) {
        const entries = fs.readdirSync(absParent, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !SKIP_DIRS.includes(entry.name)) {
                dirs.push(entry.name);
            }
        }
    }
    return dirs;
}

module.exports = { getSubDirs }; 