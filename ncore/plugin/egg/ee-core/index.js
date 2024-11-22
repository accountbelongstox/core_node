/**
 * @namespace EeCore
 */

/**
 * @member {ElectronEgg} EeCore#Index
 * @since 1.0.0
 */
import ElectronEgg from './main/index.js';

/**
 * @member {app} EeCore#app
 * @since 1.0.0
 */
import EE from './ee/index.js';

/**
 * @member {Controller} EeCore#Controller
 * @since 1.0.0
 */
import Controller from './controller/baseContextClass.js';

/**
 * @member {Service} EeCore#Service
 * @since 1.0.0
 */
import Service from './services/baseContextClass.js';

/**
 * @member {Storage}
 * @since 1.0.0
 */
import Storage from './storage/index.js';

/**
 * @member {Utils}
 * @since 1.0.0
 */
import Utils from './old-utils/index.js';

/**
 * @member {Socket}
 * @since 1.0.0
 */
import Socket from './socket/index.js';

export {
  ElectronEgg,
  EE as Application, 
  Controller,
  Service,
  Storage,
  Socket,
  Utils
};
