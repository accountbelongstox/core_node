const gdir = require('./gdir.js');
const env = require('./env.js');
const driversDict = {};
module.exports = {
    toString: () => '[class Globalvar]',
    gdir,
    env,
    driversDict,
};
