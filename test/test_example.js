import path from 'path';
import Base from '#@base';
import { turn_feature } from '#@utils_native';
import { basedir } from './ncore/globalvars.js';

class ClientMain extends Base {
  static NCORE_DIR = './';
  static distDir = path.resolve(basedir, ClientMain.NCORE_DIR);

  constructor() {
    super();
  }

  async start() {
    turn_feature.start()
  }
}

const clientMain = new ClientMain();
clientMain.start();
