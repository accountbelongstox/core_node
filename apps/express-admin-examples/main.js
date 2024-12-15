
import express from 'express';
import admin from 'express-admin';
import { readJson } from '#@/ncore/utils/linux/tool/reader.js';
import config from './config/sqlite/config.js';
import custom from './config/custom.js';

var name = `sqlite`

if (!name) {
  console.log('Specify database engine name to use: mysql, pg or sqlite')
  process.exit()
}

const adminConfig = {
  config,
  settings: readJson(`./config/${name}/settings.json`),
  users: readJson(`./config/users.json`),
  custom,
}

console.log(adminConfig);

class Main   {
    constructor() {
    }

    async start() {
        express()
        .use(admin(adminConfig))
        .listen(3000)
    }
}

// Export both the class and an instance
export { Main };
export default new Main();
