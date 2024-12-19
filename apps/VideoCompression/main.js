const { scanVideoDirectory } = require('#@ncore/utils/video/index.js');


    class appMain  {

      async start() {
        await scanVideoDirectory(`\\\\192.168.100.6\\web\\evidence`);
      }
    }

    module.exports = new appMain();