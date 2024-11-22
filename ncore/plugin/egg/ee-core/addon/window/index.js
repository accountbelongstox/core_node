import { BrowserWindow } from 'electron';

/**
 * Window Addon
 * @class
 */
class WinAddon {
  constructor(app) {
    this.app = app;
    this.windowContentsIdMap = {};
  }

  /**
   * Create a window
   *
   * @function
   * @since 1.0.0
   * @param {string} name - The name of the window.
   * @param {object} opt - Options for the window.
   * @returns {BrowserWindow} The created BrowserWindow instance.
   */
  create(name, opt) {
    // todo Check if name is unique
    // if (this.windowContentsIdMap.hasOwnProperty(name)) {
    //   throw new Error(`[addon] [window] Name: ${name} already exists!`);
    // }

    // [todo] Use extend to avoid multi-dimensional object overwriting
    const options = {
      x: 10,
      y: 10,
      width: 980,
      height: 650,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
      ...opt
    };

    const win = new BrowserWindow(options);
    const winContentsId = win.webContents.id;

    win.webContents.on('did-finish-load', () => {
      this.registerWCid(name, winContentsId);
    });

    win.webContents.on('destroyed', () => {
      this.removeWCid(name);
    });

    win.webContents.on('render-process-gone', () => {
      this.removeWCid(name);
    });

    return win;
  }

  /**
   * Get window Contents ID
   *
   * @function
   * @since 1.0.0
   * @param {string} name - The name of the window.
   * @returns {number|null} The Contents ID or null if not found.
   */
  getWCid(name) {
    return this.windowContentsIdMap[name] || null;
  }

  /**
   * Get main window Contents ID
   *
   * @function
   * @since 1.0.0
   * @returns {number|null} The Contents ID or null if not found.
   */
  getMWCid() {
    return this.windowContentsIdMap['main'] || null;
  }

  /**
   * Register window Contents ID
   *
   * @function
   * @since 1.0.0
   * @param {string} name - The name of the window.
   * @param {number} id - The Contents ID of the window.
   */
  registerWCid(name, id) {
    this.windowContentsIdMap[name] = id;
  }

  /**
   * Remove window Contents ID
   *
   * @function
   * @since 1.0.0
   * @param {string} name - The name of the window.
   */
  removeWCid(name) {
    delete this.windowContentsIdMap[name];
  }
}

export default WinAddon;
