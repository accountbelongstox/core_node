import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';

export function strictParse(str) {
  const obj = JSON.parse(str);
  if (!obj || typeof obj !== 'object') {
    throw new Error('JSON string is not object');
  }
  return obj;
}

export function readSync(filepath) {
  if (!fs.existsSync(filepath)) {
    throw new Error(`${filepath} is not found`);
  }
  return JSON.parse(fs.readFileSync(filepath));
}

export function writeSync(filepath, str, options = {}) {
  if (!('space' in options)) {
    options.space = 2;
  }

  mkdirp.sync(path.dirname(filepath));
  if (typeof str === 'object') {
    str = JSON.stringify(str, options.replacer, options.space) + '\n';
  }

  fs.writeFileSync(filepath, str);
}

export function read(filepath) {
  return fs.promises.stat(filepath)
    .then(function(stats) {
      if (!stats.isFile()) {
        throw new Error(`${filepath} is not found`);
      }
      return fs.promises.readFile(filepath);
    })
    .then(function(buf) {
      return JSON.parse(buf);
    });
}

export function write(filepath, str, options = {}) {
  if (!('space' in options)) {
    options.space = 2;
  }

  if (typeof str === 'object') {
    str = JSON.stringify(str, options.replacer, options.space) + '\n';
  }

  return mkdir(path.dirname(filepath))
    .then(function() {
      return fs.promises.writeFile(filepath, str);
    });
}

function mkdir(dir) {
  return new Promise(function(resolve, reject) {
    mkdirp(dir, function(err) {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}
