'use strict';

import debug from 'debug';
import path from 'path';
import extend from '../../../../utils/extend';
import assert from 'assert';
import { Console } from 'console';

const log = debug('ee-core:config');

export default { 
  /**
   * Load config/config.js
   *
   * Will merge config.default.js and config.${env}.js
   *
   * @function EggLoader#loadConfig
   * @since 1.0.0
   */
  loadConfig() {
    this.timing.start('Load Config');
    this.configMeta = {};
    const target = {}; 
    // 
    // Load Application config first
    const appConfig = this._preloadAppConfig();

    for (const filename of this.getTypeFiles('config')) {
      for (const unit of this.getLoadUnits()) {
        const isApp = unit.type === 'app';
        const config = this._loadConfig(unit.path, filename, isApp ? undefined : appConfig, unit.type);

        if (!config) {
          continue;
        }

        log('Loaded config %s, %s, %j', unit.path, filename, config);
        extend(true, target, config);
      }
    }

    // Load env from process.env.EE_APP_CONFIG
    const envConfig = this._loadConfigFromEnv();
    log('Loaded config from private env, %j', envConfig);
    extend(true, target, envConfig);

    // You can manipulate the order of app.config.coreMiddleware and app.config.appMiddleware in app.js
    target.coreMiddleware = target.coreMiddlewares = target.coreMiddleware || [];
    target.appMiddleware = target.appMiddlewares = target.middleware || [];

    this.config = target;
    this.timing.end('Load Config');
  },

  _preloadAppConfig() {
    const names = [
      'config.default',
      `config.${this.serverEnv}`,
    ];

    const target = {};
    for (const filename of names) {
      const config = this._loadConfig(this.options.baseDir, filename, undefined, 'app');
      extend(true, target, config);
    }
    return target;
  },

  _loadConfig(dirpath, filename, extraInject, type) {
    const isPlugin = type === 'plugin';
    const isApp = type === 'app';
    let filepath = this.resolveModule(path.join(dirpath, 'config', filename));
    console.log(`filepath`, filepath);
    // Compatible with config.js
    if (filename === 'config.default' && !filepath) {
      filepath = this.resolveModule(path.join(dirpath, 'config/config'));
    }

    const config = this.loadFile(filepath, this.appInfo, extraInject);

    if (!config) return null;

    if (isPlugin || isApp) {
      assert(!config.coreMiddleware, 'Cannot define coreMiddleware in app or plugin');
    }
    if (!isApp) {
      assert(!config.middleware, 'Cannot define middleware in ' + filepath);
    }

    // Store config meta, check where the property of config comes from.
    this._setConfigMeta(config, filepath);

    return config;
  },

  _loadConfigFromEnv() {
    const envConfigStr = process.env.EE_APP_CONFIG;
    if (!envConfigStr) return;
    try {
      const envConfig = JSON.parse(envConfigStr);
      this._setConfigMeta(envConfig, '<process.env.EE_APP_CONFIG>');
      return envConfig;
    } catch (err) {
      this.options.logger.warn('[ee-core] [core/.../config] process.env.EE_APP_CONFIG is not valid JSON: %s', envConfigStr);
    }
  },

  _setConfigMeta(config, filepath) {
    config = extend(true, {}, config);
    setConfig(config, filepath);
    extend(true, this.configMeta, config);
  },
};

/**
 * Recursively set config meta data
 * @param {Object} obj - Config object
 * @param {string} filepath - File path
 */
function setConfig(obj, filepath) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    // Ignore console
    if (key === 'console' && val && typeof val.Console === 'function' && val.Console === Console) {
      obj[key] = filepath;
      continue;
    }
    if (val && Object.getPrototypeOf(val) === Object.prototype && Object.keys(val).length > 0) {
      setConfig(val, filepath);
      continue;
    }
    obj[key] = filepath;
  }
}
