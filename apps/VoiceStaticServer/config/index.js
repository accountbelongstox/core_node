const { env } = require("#@/ncore/globalvars.js");
const path = require(`path`)
const config = {
    HTTP_PORT: 15452,
    HTTP_HOST: '0.0.0.0',
    SERVER_URL: 'http://43.159.58.199:15452',
    CLIENTS_URL: 'http://1.94.142.130:15452,http://47.107.84.210:15453',
    OLD_DB_URL: `https://static.local.12gm.com:905/src/download.php?file=%2Fsoftlist%2Fstatic_src%2Fdictionary%2Fdatabase%2FdataOldTranslateControl.db`,
    OLD_DB_NAME: `dataOldTranslateControl.db`,
    STATIC_PATHS: {
    }
}

module.exports = config;

