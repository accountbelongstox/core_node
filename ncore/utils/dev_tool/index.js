const os = require('os');
const isLinux = os.platform() === 'linux';
const isWindows = os.platform() === 'win32'; // Define isWindows

const pre_dir = './lang_deploy/';
const utils_dir = './utils/';
const wsl_utils_dir = './wsl-uitls/libs/';

const modules = {
    getnode: isWindows ? require(`${pre_dir}getnode_win.js`) : null, // Use isWindows
    getpython: isWindows ? require(`${pre_dir}getpython_win.js`) : null, // Use isWindows
    getenvironments: isWindows ? require(`${pre_dir}getenvironments_win.js`) : null, // Use isWindows
    getgolang: isWindows ? require(`${pre_dir}getgolang_win.js`) : null, // Use isWindows
    getjava: isWindows ? require(`${pre_dir}getjava_win.js`) : null, // Use isWindows
    getrust: isWindows ? require(`${pre_dir}getrust_win.js`) : null, // Use isWindows
    getruby: isWindows ? require(`${pre_dir}getruby_win.js`) : null, // Use isWindows
    getphp: isWindows ? require(`${pre_dir}getphp_win.js`) : null, // Use isWindows
    getflutter: isWindows ? require(`${pre_dir}getflutter_win.js`) : null, // Use isLinux for this one
    getandroidstudio: isWindows ? require(`${pre_dir}getandroidstudio_win.js`) : null, // Use isWindows
    getcmder: isWindows ? require(`${pre_dir}getcmder_win.js`) : null, // Use isWindows
};
const turn_feature = require(`${utils_dir}turn_feature.js`);
const wsl_activator = require(`${wsl_utils_dir}wsl_activator.js`);

module.exports = {
    ...modules,
    turn_feature,
    wsl_activator,
};
