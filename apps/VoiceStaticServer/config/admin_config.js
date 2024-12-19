const { readJson } = require("#@/ncore/utils/linux/tool/reader.js");

    module.exports = {
        config: readJson('./config/config.json'),
        settings: readJson('./config/settings.json'),
        users: readJson('./config/users.json'),
        custom: readJson('./config/custom.json'),
    };