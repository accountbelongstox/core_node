import Utils from '../utils';

const EEApplication = Symbol('Ee#Application');
const BuiltInApp = Symbol('Ee#BuiltInApp');

const EE = {
  /**
   * 兼容1.x版本api
   */
  get Application() {
    const appClass = require('./application'); // 注意：这里如果 `application` 模块也是 ES6 模块，需要用 `import` 语法。
    return appClass;
  },

  /**
   * 设置实例化app对象
   */  
  set app(appObject) {
    if (!this[EEApplication]) {
      this[EEApplication] = appObject;
    }
  },

  /**
   * 获取实例化app对象
   */  
  get app() {
    return this[EEApplication] || null;
  },

  /**
   * 设置全局this到CoreApp (eeApp)
   */  
  set CoreApp(obj) {
    if (!this[BuiltInApp]) {
      this[BuiltInApp] = obj;
    }
  },

  /**
   * 获取 CoreApp (eeApp)
   */  
  get CoreApp() {
    return this[BuiltInApp] || null;
  },

  /**
   * 是否加密
   */  
  isEncrypt(basePath) {
    return Utils.isEncrypt(basePath);
  },
};

export default EE;
