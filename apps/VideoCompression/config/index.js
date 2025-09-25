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

