'use strict';

const path = require('path');
const Utils = require('../lib/utils');
const is = require('is-type-of');
const chalk = require('chalk');
const crossSpawn = require('cross-spawn');

module.exports = {

  execProcess: {},

  /**
   * 启动前端、主进程服务
   */
  dev(options = {}) {
    console.log(`--------dev--------`)
    console.log(`options`,options)
    const { config, serve } = options;
    const binCmd = 'dev';
    const binCfg = Utils.loadConfig(config);
    const binCmdConfig = binCfg[binCmd];

    let command = serve;
    if (!command) {
      command = Object.keys(binCmdConfig).join();
    }

    const opt = {
      binCmd,
      binCmdConfig,
      command,
    }
    console.log(`opt`,opt)
    // this.multiExec(opt);
    // if(binCmd == "dev"){
    //   this.multiExecWithBabel(opt);
    // }else{
    //   this.multiExec(opt);
    // }
    console.log(`opt`,opt)
  },

  /**
   * 启动主进程服务
   */
  start(options = {}) {
    const { config } = options;
    const binCmd = 'start';
    const binCfg = Utils.loadConfig(config);
    const binCmdConfig = {
      start: binCfg[binCmd]
    };

    const opt = {
      binCmd,
      binCmdConfig,
      command: binCmd,
    }
    this.multiExec(opt);
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * 构建
   */
  build(options = {}) {
    const { config, cmds } = options;
    const binCmd = 'build';
    const binCfg = Utils.loadConfig(config);
    const binCmdConfig = binCfg[binCmd];

    if (!cmds || cmds == "") {
      // [todo]
      let tip = chalk.bgYellow('Warning') + ' Please modify the ' + chalk.blue('build') + ' config, See: ';
      tip += chalk.underline('https://www.kaka996.com/pages/c492f8/');
      console.log(tip);
      return
    }

    const opt = {
      binCmd,
      binCmdConfig,
      command: cmds,
    }
    this.multiExec(opt);
  },

  /**
   * 执行自定义命令
   */
  exec(options = {}) {
    let { config, command, cmds } = options;
    const binCmd = 'exec';
    const binCfg = Utils.loadConfig(config);
    const binCmdConfig = binCfg[binCmd];

    // 兼容
    if (typeof command === "string") {
      cmds = command;
    }

    const opt = {
      binCmd,
      binCmdConfig,
      command: cmds,
    }
    this.multiExec(opt);
  },

  /**
   * 支持多个命令
   */
  multiExec(opt = {}) {
    //console.log('multiExec opt:', opt)
    const { binCmd, binCmdConfig, command } = opt;

    let cmds;
    const cmdString = command.trim();
    if (cmdString.indexOf(',') !== -1) {
      cmds = cmdString.split(',');
    } else {
      cmds = [cmdString];
    }

    for (let i = 0; i < cmds.length; i++) {
      let cmd = cmds[i];
      let cfg = binCmdConfig[cmd];

      if (!cfg) {
        console.log(chalk.blue(`[ee-init] [${binCmd}] `) + chalk.red(`Error: [${binCmd} ${cmd}] config does not exist` ));
        continue;
      }

      // frontend 如果是 file:// 协议，则不启动
      if (cmd == 'frontend' && cfg.protocol == 'file://') {
        continue;
      }

      console.log(chalk.blue(`[ee-init] [${binCmd}] `) + "Run " + chalk.green(`[${binCmd} ${cmd}]` + " command"));
      console.log(chalk.blue(`[ee-init] [${binCmd}] `) + chalk.green('config:'), JSON.stringify(cfg));

      let execDir = path.join(process.cwd(), cfg.directory);
      let execArgs = is.string(cfg.args) ? [cfg.args] : cfg.args;
      let stdio = cfg.stdio ? cfg.stdio: 'inherit';

      const handler = cfg.sync ? crossSpawn.sync : crossSpawn;

      this.execProcess[cmd] = handler(
          cfg.cmd,
          execArgs,
          { stdio: stdio, cwd: execDir, maxBuffer: 1024 * 1024 * 1024 },
      );
      console.log(chalk.blue(`[ee-init] [${binCmd}] `) + 'The ' + chalk.green(`[${binCmd} ${cmd}]`) + ` command is ${cfg.sync ? 'run completed' : 'running'}`);

      if(!cfg.sync) {
        this.execProcess[cmd].on('exit', () => {
          if (cmd == 'electron') {
            console.log(chalk.blue(`[ee-init] [${binCmd}] `) + chalk.green('Press "CTRL+C" to exit'));
            return
          }
          console.log(chalk.blue(`[ee-init] [${binCmd}] `) + 'The ' + chalk.green(`[${binCmd} ${cmd}]`) + ' command is executed and exits');
        });
      }
    }
  },

  /**
   * 支持多个命令（使用 npx babel-node）
   */
  /**
   * 支持多个命令（使用 npx babel-node）
   */
  multiExecWithBabel(opt = {}) {
    //console.log('multiExecWithBabel opt:', opt)
    const { binCmd, binCmdConfig, command } = opt;
    let cmds;
    const cmdString = command.trim();
    if (cmdString.indexOf(',') !== -1) {
      cmds = cmdString.split(',');
    } else {
      cmds = [cmdString];
    }

    for (let i = 0; i < cmds.length; i++) {
      let cmd = cmds[i];
      let cfg = binCmdConfig[cmd];

      if (!cfg) {
        console.log(chalk.blue(`[ee-init] [${binCmd}] `) + chalk.red(`Error: [${binCmd} ${cmd}] config does not exist` ));
        continue;
      }

      // frontend 如果是 file:// 协议，则不启动
      if (cmd == 'frontend' && cfg.protocol == 'file://') {
        continue;
      }

      console.log(chalk.blue(`[ee-init] [${binCmd}] `) + "Run " + chalk.green(`[${binCmd} ${cmd}]` + " command"));
      console.log(chalk.blue(`[ee-init] [${binCmd}] `) + chalk.green('config:'), JSON.stringify(cfg));

      let execDir = path.join(process.cwd(), cfg.directory);
      let execArgs = is.string(cfg.args) ? [cfg.args] : cfg.args;
      let stdio = cfg.stdio ? cfg.stdio : 'inherit';

      const handler = cfg.sync ? crossSpawn.sync : crossSpawn;
      const baseCmd = 'npx';
      const baseArgs = ['babel-node', '--', cfg.cmd, ...execArgs];

      console.log(`baseArgs`, baseArgs);
      console.log(`execDir`, execDir);
      this.execProcess[cmd] = handler(
          baseCmd,
          baseArgs,
          { stdio: stdio, cwd: execDir, maxBuffer: 1024 * 1024 * 1024 },
      );
      console.log(chalk.blue(`[ee-init] [${binCmd}] `) + 'The ' + chalk.green(`[${binCmd} ${cmd}]`) + ` command is ${cfg.sync ? 'run completed' : 'running'}`);

      if (!cfg.sync) {
        this.execProcess[cmd].on('exit', () => {
          if (cmd == 'electron') {
            console.log(chalk.blue(`[ee-init] [${binCmd}] `) + chalk.green('Press "CTRL+C" to exit'));
            return;
          }
          console.log(chalk.blue(`[ee-init] [${binCmd}] `) + 'The ' + chalk.green(`[${binCmd} ${cmd}]`) + ' command is executed and exits');
        });
      }
    }
  }

}
