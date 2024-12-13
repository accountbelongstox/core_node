// import os from 'os';
// import path from 'path';
// import fs from 'fs';
import Base from '#@base'; 

import get_langs from './environment_deployment/get_langs.js';
import basic_settings from './basic_settings/main.js';
import function_activation from './function_activation/function_activation.js';

class BaseInstall extends Base {

  constructor() {
    super();
  }
  async start() {
    console.log('Starting installation...');
    //.1
    await get_langs.start()
    //.2
    await basic_settings.start()
    //.3
    await function_activation.start()
    
  }
}

export default BaseInstall;
