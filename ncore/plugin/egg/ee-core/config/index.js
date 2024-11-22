import Storage from '../storage';

/**
 * Configuration handling class
 * @class Cfg
 * @since 1.0.0
 */
const Cfg = {
  /**
   * Retrieves the core database instance
   * @private
   * @returns {Object} The core database instance
   */
  _getCoreDB() {
    const coreDB = Storage.connection('system');
    return coreDB;
  },

  /**
   * Retrieves all configuration settings
   * @returns {Object} The configuration settings
   */
  all() {
    const cdb = this._getCoreDB();
    const config = cdb.getItem('config');
    console.log('config', config);
    return config;
  },

  /**
   * Sets all configuration settings
   * @param {Object} value - The configuration settings to set
   */
  setAll(value) {
    const cdb = this._getCoreDB();
    cdb.setItem('config', value);
  },

  /**
   * Sets a specific configuration value
   * @param {String} key - The key of the configuration item
   * @param {*} value - The value to set
   */
  setValue(key, value) {
    const cdb = this._getCoreDB();
    cdb.setConfigItem(key, value);
  },

  /**
   * Retrieves a specific configuration value
   * @param {String} key - The key of the configuration item
   * @returns {*} The configuration value
   */
  getValue(key) {
    const cdb = this._getCoreDB();
    return cdb.getConfigItem(key);
  },

  /**
   * Checks if the configuration protocol is 'file://'
   * @param {Object} config - The configuration object
   * @returns {boolean} True if the protocol is 'file://', otherwise false
   */
  isFileProtocol(config) {
    return config.protocol === 'file://';
  },

  /**
   * Checks if the configuration protocol is 'http://' or 'https://'
   * @param {Object} config - The configuration object
   * @returns {boolean} True if the protocol is 'http://' or 'https://', otherwise false
   */
  isWebProtocol(config) {
    return ['http://', 'https://'].includes(config.protocol);
  },
};

export default Cfg;
