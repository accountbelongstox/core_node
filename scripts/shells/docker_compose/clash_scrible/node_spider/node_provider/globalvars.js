const gdir = require('./globalvar/gdir.js');
const env = require('./globalvar/env.js');

module.exports = {
    toString: () => '[class Globalvar]',
    gdir,
    env,
};
