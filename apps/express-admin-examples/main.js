const express = require('express');
    const admin = require('express-admin');
    const { readJson } = require('#@/ncore/utils/linux/tool/reader.js');
    const config = require('./config/sqlite/config.js');
    const custom = require('./config/custom.js');

    var name = `sqlite`;

    if (!name) {
        console.log('Specify database engine name to use: mysql, pg or sqlite');
        process.exit();
    }

    const adminConfig = {
        config,
        settings: readJson(`./config/${name}/settings.json`),
        users: readJson(`./config/users.json`),
        custom,
    };

    console.log(adminConfig);

    class Main {
        constructor() {
        }

        async start() {
            express()
            .use(admin(adminConfig))
            .listen(3000);
        }
    }

    // Export both the class and an instance
    module.exports = new Main();
    module.exports.Main = Main;