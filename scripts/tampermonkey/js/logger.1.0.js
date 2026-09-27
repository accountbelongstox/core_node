(function (global, factory) {
  // Support CommonJS/Node.js
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(global);
  }
  else if (typeof define === 'function' && define.amd) {
    define(factory);
  }
  else {
    factory(global);
  }
})(typeof window !== 'undefined' ? window : this, function (global) {
  // Logger implementation
  const logger = {
    log: (...args) =>
      console.log("%c[LOG]", "color: blue; font-weight: bold", ...args),
    warn: (...args) =>
      console.log("%c[WARN]", "color: orange; font-weight: bold", ...args),
    error: (...args) =>
      console.log("%c[ERROR]", "color: red; font-weight: bold", ...args),
    info: (...args) =>
      console.log("%c[INFO]", "color: green; font-weight: bold", ...args),
    debug: (...args) =>
      console.log("%c[DEBUG]", "color: purple; font-weight: bold", ...args),
    custom: (color = "black", label = "CUSTOM", ...args) =>
      console.log(`%c[${label}]`, `color: ${color}; font-weight: bold`, ...args),
  };

  // Don't overwrite existing logger
  if (typeof global.logger === 'undefined') {
    global.logger = logger;
  }

  return logger;
});
