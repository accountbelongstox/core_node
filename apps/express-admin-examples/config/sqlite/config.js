import { APPS_DIR,APP_DIR } from '#@/ncore/gvar/gdir.js';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const DefultConfig = {
    "sqlite": {
        "database": path.join(APP_DIR, 'fixtures/sqlite/x-admin-examples.sqlite')
    },
    "admin": {
        "settings": path.join(APP_DIR, 'config/sqlite/settings.json')
    }
}

export default DefultConfig;

