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

const path = require("path");
const { appname } = require(`./ncore/globalvars`);

const transformRequirePathsPlugin = function ({ types: t }) {
  return {
    visitor: {
      CallExpression(path) {
        if (path.node.callee.name === 'require' && path.node.arguments.length > 0) {
          const arg = path.node.arguments[0];
          if (t.isStringLiteral(arg)) {
            let newValue = arg.value;
            newValue = newValue.replace(/^(\.\/|\.\.\/|\s*)(ncore)/g, (match, p1, p2) => {
              return p1 + '.' + p2;
            });
            newValue = newValue.replace(/^\/(ncore)/g, '/.' + '$1');
            if (newValue !== arg.value) {
              path.node.arguments[0] = t.stringLiteral(newValue);
            }
          }
        }
      }
    }
  };
};

const appServicePath = `./ncore/apps/${appname}/service`;
const appControllerPath = `./ncore/apps/${appname}/controller`;

module.exports = {
  plugins: [
    [
      "module-resolver",
      {
        root: ["./"],
        alias: {
          "@": "./",
          "@ncore": "./ncore",
          "@plugins": "./ncore/plugin",
          "@apps": "./apps",
          "@egg": "./ncore/plugin/egg",
          '@base': "./ncore/globalvar/base",
          '@globalvars': "./ncore/globalvars",
          '@utils': "./ncore/utils.js",
          '@utils_linux': "./ncore/utils_linux.js",
          '@practicals': "./ncore/practicals.js",
          '@practicals_linux': "./ncore/practicals_linux.js",
          "@app_service": appServicePath,
          "@app_control": appControllerPath,
        }
      }
    ],
    transformRequirePathsPlugin
  ],
  presets: [
    ["@babel/preset-env", {
      targets: {
        electron: "31.3.0"
      }
    }]
  ],
  ignore: [
    ".ncore/**",
    "build/**",
    "**/stylesheet/**",
    "dist/**",
    "node_modules/**",
    "**/build/**",
    "**/dist/**",
    "**/node_modules/**",
    "**/strapi/**",
    "**/strapi**/**",
    "**/strapi_v4/**",
    "**/.vite/**",
    "**/*.test.js",
    "**/*.spec.js",
    "**/*.chunk.js",
  ]
};
