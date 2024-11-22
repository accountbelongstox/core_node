
import Base from '#@base';
import basic_settings from './basic_settings.js';
import init_path from './init_path.js';

class BasicSettings extends Base {
    constructor() {
        super();
    }

    start() {
        basic_settings.start()
        init_path.start()
    }
}

const basicSettingsInstance = new BasicSettings();
export default basicSettingsInstance;



