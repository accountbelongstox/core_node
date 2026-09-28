// const { env } = require("#@global_vars");
const path = require(`path`)
const { gdir, appname, isServer } = require('#@global_vars');
const {
    ROOT_APP_STATIC_DIR,
    APP_METADATA_DIR,
} = gdir;

const VIDEO_EXTENSIONS = [
    '.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm'
];
const LOCAL_VIDEO_DIRS = [
    "D:/MobileBackup"
];

const USER_TEST_SERVER_URL = `http://127.0.0.1:8000`
const config = {
    USER_TEST_SERVER_URL,
    LOCAL_VIDEO_DIRS,
    VIDEO_EXTENSIONS,
}

module.exports = config;

