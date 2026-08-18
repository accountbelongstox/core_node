const fs = require('fs');
const path = require('path');
const temp = process.env.TEMP || '/tmp';
const rt = fs.readFileSync(path.join(temp, 'duoreader_runtime.js'), 'utf8');
for (const id of ['4183', '5913', '9269', '5312', '5415']) {
  const m = rt.match(new RegExp(`${id}:"([^"]+)"`));
  console.log(id, m ? m[1] : 'missing');
}
