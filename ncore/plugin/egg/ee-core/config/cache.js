import EE from '../ee';

/**
 * Configuration manager
 */
const conf = {
  /**
   * Retrieve the in-memory configuration
   * @returns {Object} The configuration object
   * @throws {Error} If the frame initialization is incomplete
   */
  _getConfig() {
    const { CoreApp } = EE;
    if (!CoreApp) {
      throw new Error('[ee-core] [config] Frame initialization is not complete!');
    }

    return CoreApp.config;
  },

  /**
   * Get the entire configuration
   * @returns {Object} The configuration object
   */
  all() {
    return this._getConfig();
  },

  /**
   * Get a specific value from the configuration
   * @param {string} key - The key or path to the value
   * @returns {*} The value associated with the key
   */
  getValue(key) {
    return this._objectGet(this._getConfig(), key);
  },

  /**
   * Get a value from an object using a path
   * @param {Object} object - The object to search
   * @param {string|Array} path - The path to the value
   * @param {*} [defaultValue] - The default value if the path is not found
   * @returns {*} The value at the specified path or default value
   */
  _objectGet(object, path, defaultValue) {
    const pathParts = Array.isArray(path) ? path : path.split('.');
    const value = pathParts.reduce((obj, key) => obj && key in obj ? obj[key] : undefined, object);
    return value === undefined ? defaultValue : value;
  }
};

export default conf;
