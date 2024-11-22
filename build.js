const { execSync } = require('child_process');
const path = require('path');

const newDir = path.join(__dirname, 'ncore', 'plugin', 'strapi_v4');
process.chdir(newDir);

console.log('Current working directory:', process.cwd());

execSync('npx strapi build', { stdio: 'inherit' });
