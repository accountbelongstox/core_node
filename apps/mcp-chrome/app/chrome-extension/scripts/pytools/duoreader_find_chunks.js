const fs = require('fs');
const path = require('path');

const temp = process.env.TEMP || '/tmp';
const runtimePath = path.join(temp, 'duoreader_runtime.js');
const mainPath = path.join(temp, 'duoreader_main.js');
const ids = ['5913', '5415', '6283', '9269', '5312', '4343'];

function findHashes(text) {
  for (const id of ids) {
    const re = new RegExp(`${id}:"([^"]+)"`);
    const m = text.match(re);
    if (m) console.log(id, m[1]);
  }
}

if (fs.existsSync(runtimePath)) findHashes(fs.readFileSync(runtimePath, 'utf8'));
if (fs.existsSync(mainPath)) findHashes(fs.readFileSync(mainPath, 'utf8'));
