// Your converted code here...

    const path = require('path');
    const { APPS_DIR, APP_DIR } = require('#@/ncore/gvar/gdir.js');

    const __filename = __filename;
    const __dirname = path.dirname(__filename);

    const DefultConfig = {
        "sqlite": {
            "database": path.join(APP_DIR, 'fixtures/sqlite/x-admin-examples.sqlite')
        },
        "admin": {
            "settings": path.join(APP_DIR, 'config/sqlite/settings.json')
        }
    };

    module.exports = DefultConfig;