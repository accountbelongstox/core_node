#!/usr/bin/env node
const path = require('path');
const { appdir } = require('#@ncore/globalvars.js');
const config_file = path.join(appdir, 'config', 'bin.js');
console.log(`config_file`, config_file);

class CommandExecutor {
  constructor(command, options = {}) {
    this.command = command;
    this.options = options;
  }

  getOpts() {
    const opts = {
      config: this.options.config || config_file,
      ...this.options
    };
    return opts;
  }

  execute() {
    const opts = this.getOpts();
    switch (this.command) {
      case 'move':
        this.move(opts);
        break;
      case 'rd':
        this.rd(opts);
        break;
      case 'encrypt':
        this.encrypt(opts);
        break;
      case 'clean':
        this.clean(opts);
        break;
      case 'icon':
        this.icon(opts);
        break;
      case 'dev':
        this.dev(opts);
        break;
      case 'build':
        this.build(opts);
        break;
      case 'start':
        this.start(opts);
        break;
      case 'exec':
        this.exec(opts);
        break;
      default:
        console.error(`Unknown command: ${this.command}`);
    }
  }

  move(opts) {
    const moveScript = require('./tools/move');
    moveScript.run(opts);
  }

  rd(opts) {
    const replaceDist = require('./tools/replaceDist');
    replaceDist.run(opts);
  }

  encrypt(opts) {
    const encrypt = require('./tools/encrypt');
    encrypt.run(opts);
  }

  clean(opts) {
    const encrypt = require('./tools/encrypt');
    encrypt.clean(opts);
  }

  icon(opts) {
    const iconGen = require('./tools/iconGen');
    iconGen.run();
  }

  dev(opts) {
    const serve = require('./tools/serve');
    serve.dev(opts);
  }

  build(opts) {
    const serve = require('./tools/serve');
    serve.build(opts);
  }

  start(opts) {
    const serve = require('./tools/serve');
    serve.start(opts);
  }

  exec(opts) {
    const serve = require('./tools/serve');
    serve.exec(opts);
  }
}

const commandExecutor = new CommandExecutor('dev', { cmds: 'custom commands' });
commandExecutor.execute();
