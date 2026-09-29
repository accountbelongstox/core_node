// Runs a secret tool (an encrypted file or bundle, disguise.js, batch_decrypt.js,
// bundle_add_file.js, ...) with its password read from stdin, so the password
// never appears in any process command line. The tool keeps its own argv
// interface: the PASSWORD_ARG placeholder marks the password position.
//
// Usage: <password on stdin> | node secret_password_runner.js TOOL_JS [ARGS...]
//   e.g. printf '%s' "$pw" | node secret_password_runner.js KEY.js pwd --password-stdin OUT_DIR

const fs = require('fs');
const path = require('path');
const Module = require('module');

const PASSWORD_ARG = '--password-stdin';
const PRIVATE_UMASK = 0o077;
const TRAILING_NEWLINE = /\r?\n$/;
const LEADING_BOM = /^﻿/;
let toolPath = '';
let toolArgs = [];
let password = '';

function readStdinPassword() {
    if (process.stdin.isTTY) {
        return '';
    }
    return fs.readFileSync(0, 'utf8').replace(LEADING_BOM, '').replace(TRAILING_NEWLINE, '');
}

function main() {
    toolPath = process.argv[2] ? path.resolve(process.argv[2]) : '';
    toolArgs = process.argv.slice(3);
    if (!toolPath || !fs.existsSync(toolPath) || !toolArgs.includes(PASSWORD_ARG)) {
        console.error(`Usage: <password on stdin> | node ${path.basename(__filename)} TOOL_JS [ARGS...] (ARGS must contain ${PASSWORD_ARG})`);
        process.exitCode = 1;
        return;
    }
    password = readStdinPassword();
    if (!password) {
        console.error('[SECRET_RUNNER] Error: no password received on stdin');
        process.exitCode = 1;
        return;
    }
    process.umask(PRIVATE_UMASK);
    process.argv = [process.argv[0], toolPath, ...toolArgs.map((arg) => (arg === PASSWORD_ARG ? password : arg))];
    password = '';
    Module.runMain();
}

main();
