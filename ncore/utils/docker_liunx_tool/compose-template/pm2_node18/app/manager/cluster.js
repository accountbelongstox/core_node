const directory = require('./provider/directory.js');
const pm2_action = require('./action/pm2_action.js');
const watch_dir = require('./util/watch_dir.js');
const strapi = require('../templates/strapi.js');
const node_provider = require('./provider/node_provider.js');

class Cluste {

  constructor() {
  }

  async initApps() {
    console.log(`strapi`,strapi)
    watch_dir.watchDir((newProjectsList) => {
      const clusters = directory.getClusters(newProjectsList);
     pm2_action.addToProjectArray(clusters)
    });
    node_provider.checkAndDownloadNodeDistHtml();
   


  }



}

module.exports = new Cluste();
