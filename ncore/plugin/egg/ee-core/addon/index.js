import EE from '../ee';

/**
 * Addon utility
 * @namespace
 */
const Addon = {

  /**
   * Get all addon instances
   *
   * @function
   * @since 1.0.0
   * @throws {Error} Throws an error if CoreApp or addons are not available.
   * @returns {object} The object containing all addon instances.
   */
  all() {
    const { CoreApp } = EE;
    if (!CoreApp) {
      throw new Error('An unknown error or Addons cannot be used by the jobs!');
    }

    const instances = CoreApp.addon || null;
    if (!instances) {
      throw new Error('Addons do not exist or do not call directly at the top!');
    }
    return instances;
  },

  /**
   * Get a specific addon instance
   *
   * @function
   * @since 1.0.0
   * @param {string} name - The name of the addon.
   * @throws {Error} Throws an error if the specified addon does not exist.
   * @returns {object|null} The specified addon instance or null if not found.
   */
  get(name) {
    const instances = this.all();
    const instance = instances[name] || null;
    if (!instance) {
      throw new Error(`Addon class '${name}' does not exist or do not call directly at the top!`);
    }
    return instance;
  },
};

export default Addon;
