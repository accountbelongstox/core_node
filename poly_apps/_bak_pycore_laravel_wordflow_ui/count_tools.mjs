import fs from 'fs';

const files = [
  'config/tools.config.ts',
  'config/tools.config.extended.ts',
  'config/tools.config.advanced.ts'
];

let total = 0;
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  // Match tool configurations like: toolName: {
  const matches = content.match(/^\s+\w+:\s*\{$/gm);
  const count = matches ? matches.length : 0;
  console.log(`${file}: ${count} tools`);
  total += count;
});

console.log(`\nTotal: ${total} tool configurations`);
