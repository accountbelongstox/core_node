// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
