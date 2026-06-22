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

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { appname } = require('./ncore/globalvars'); // 确保这里导入了 appname

module.exports = {
  mode: 'development', // 或 'production'
  target: 'electron-main', // 指定目标为 Electron 主进程

  entry: {
    main: './main_dev.js'
  },
  output: {
    path: path.resolve(__dirname, '.webpack_dist'),
    filename: '[name].bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: [
          path.resolve(__dirname, 'ncore'),
          path.resolve(__dirname, 'apps'),
        ],
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  plugins: [
    // new CopyPlugin({
    //     patterns: [
    //         // { from: 'src/ncore/otherfiles', to: 'ncore_otherfiles' },
    //         // Add more patterns as needed for other directories or files
    //     ],
    // }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      '@ncore': path.resolve(__dirname, 'ncore'),
      '@plugins': path.resolve(__dirname, 'ncore/plugin'),
      '@apps': path.resolve(__dirname, 'apps'),
      '@egg': path.resolve(__dirname, 'ncore/plugin/egg'),
      '@base': path.resolve(__dirname, 'ncore/globalvar/base'),
      '@globalvars': path.resolve(__dirname, 'ncore/globalvars'),
      '@utils': path.resolve(__dirname, 'ncore/utils.js'),
      '@utils_linux': path.resolve(__dirname, 'ncore/utils_linux.js'),
      '@practicals': path.resolve(__dirname, 'ncore/practicals.js'),
      '@practicals_linux': path.resolve(__dirname, 'ncore/practicals_linux.js'),
      '@app_service': path.resolve(__dirname, `./ncore/apps/${appname}/service`),
      '@app_control': path.resolve(__dirname, `./ncore/apps/${appname}/controller`)
    }
  },
  node: {
    __dirname: false,
    __filename: false
  }
};
