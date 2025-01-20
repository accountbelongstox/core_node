const BaseInstall = require('#@/apps/base_install/main.js');

    class appMain  {

      // constructor() {
      //   super();
      //   // this === eeApp;
      // }
      async start() {
        
        const baseInstall = new BaseInstall();
        baseInstall.start()
      }
    }

    module.exports = new appMain();