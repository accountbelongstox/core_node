const elec = require('./electron/elec.js');
const view = require('./electron/view.js');
const ctrl = require('./electron/ctrl.js');
const tray = require('./electron/tray.js');

module.exports = {
    toString: () => '[class Practical2]',
    elec,
    view,
    ctrl,
    tray,
};
