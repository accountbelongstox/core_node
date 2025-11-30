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

const path = require('path');
const fs = require('fs');
const { findExecutable } = require('../tool/soft-install/executable_finder.js');
const ensure7zip = require('../libs/bdir-libs/ensure_7zip.js');
const { getSystemInfo } = require('../platform-constant/index.js');

let EXE_7Z_PATH = null
let LIUNX_SYSTEM_INFO, TAR_EXECUTABLE, CURL_EXECUTABLE, GIT_EXECUTABLE, DDWIN_EXECUTABLE
let initializedBDirToken = false
const initializedBDir = async () => {
    if (initializedBDirToken) return;
    initializedBDirToken = true;
    LIUNX_SYSTEM_INFO = await getSystemInfo()
    EXE_7Z_PATH = await ensure7zip.ensure7zip();
    TAR_EXECUTABLE = await findExecutable('tar');
    CURL_EXECUTABLE = await findExecutable('curl');
    GIT_EXECUTABLE = await findExecutable('git');
    console.log(`initialized find executable`);
    console.log(`7z:\t ${EXE_7Z_PATH}`)
    console.log(`tar:\t ${TAR_EXECUTABLE}`)
    console.log(`curl:\t ${CURL_EXECUTABLE}`)
    console.log(`git:\t ${GIT_EXECUTABLE}`)

}

const getTarExecutable = async () => {
    await initializedBDir()
    return TAR_EXECUTABLE;
};

const getCurlExecutable = async () => {
    await initializedBDir()
    return CURL_EXECUTABLE;
};

const getGitExecutable = async () => {
    await initializedBDir()
    return GIT_EXECUTABLE;
};

const getDDwinExecutable = async () => {
    await initializedBDir()
    return DDWIN_EXECUTABLE;
};

const get7zExecutable = async () => {
    await initializedBDir()
    return EXE_7Z_PATH
};

module.exports = {
    getTarExecutable,
    getCurlExecutable,
    getGitExecutable,
    getDDwinExecutable,
    get7zExecutable,
    initializedBDir,
};