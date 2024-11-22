const fs = require('fs');
const path = require('path');
const Base = require('../base/base.js');

class FPath extends Base {
    constructor() {
        super();
    }

    get_base_name(filePath) {
        if(!filePath)return filePath;
        return path.basename(filePath);
    }

    get_base_dir(filePath) {
        return path.dirname(filePath);
    }

    get_ext(filePath) {
        return path.extname(filePath).slice(1);
    }
}

FPath.toString = () => '[class FPath]';
module.exports = new FPath();
