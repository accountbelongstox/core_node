const express = require('express');
const admin = require('express-admin');
const { readJson } = require('#@/ncore/utils/linux/tool/reader.js');
const config = require('./config/sqlite/config.js');
const custom = require('./config/custom.js');
const logger = require('#@/ncore/utils/logger/index.js');
const path = require('path');
const staticPaths = require('../VoiceStaticServer/config/static_paths.js');

var name = `sqlite`;
if (!name) {
    console.log('Specify database engine name to use: mysql, pg or sqlite');
    process.exit();
}
const { APP_DIR } = require("#@/ncore/gvar/gdir.js");
const config_dir = `${APP_DIR}/config`;
const sqlite_config_dir = `${config_dir}/${name}`;
const adminConfig = {
    config,
    settings: readJson(`${sqlite_config_dir}/settings.json`),
    users: readJson(`${config_dir}/users.json`),
    custom,
};
console.log(adminConfig);
class Main {
    constructor() {
    }

    async start() {
        express()
            .use(admin(adminConfig))
            .listen(3000,`0.0.0.0`);
            logger.success(`started!`)

        const app = express();

        // 设置静态路径
        Object.entries(staticPaths).forEach(([prefix, paths]) => {
            if (Array.isArray(paths)) {
                // 如果是路径数组，则添加多个静态目录
                paths.forEach(staticPath => {
                    app.use(prefix, express.static(staticPath));
                });
            } else {
                // 如果是单个路径，直接添加
                app.use(prefix, express.static(paths));
            }
        });
    }
}

module.exports = new Main();