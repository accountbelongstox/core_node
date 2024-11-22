# Plug-in EGG-Eelectron code
    ```
    // 将以下代码加入   /electron/preload/index.js  module.exports = async () 中
        const Ps = require('@egg/ee-core/ps');
        const Conf = require('@egg/ee-core/config');
        const MountEgg = require('../../main/mount_egg');
        const dd_Electron = new MountEgg(Conf,Ps)
        dd_Electron.start()
    ```

# 启动参数 
- --no-interface 如果带该参数,则启动时启动无window窗口的软件