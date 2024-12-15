import { readJson } from "#@/ncore/utils/linux/tool/reader.js"

export default {
    config: readJson('./config/config.json'),
    settings: readJson('./config/settings.json'),
    users: readJson('./config/users.json'),
    custom: readJson('./config/custom.json'),
}   