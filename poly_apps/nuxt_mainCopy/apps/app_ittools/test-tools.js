// Test script to verify all 88 tools are loaded
const { ALL_TOOLS, TOOLS_BY_CATEGORY } = require('./complete-tools.ts');

console.log('=== IT Tools Count Verification ===');
console.log(`Total tools loaded: ${ALL_TOOLS.length}`);
console.log('Expected: 88 tools');

console.log('\n=== Tools by Category ===');
Object.entries(TOOLS_BY_CATEGORY).forEach(([category, tools]) => {
  console.log(`${category}: ${tools.length} tools`);
});

console.log('\n=== First 5 Tools ===');
ALL_TOOLS.slice(0, 5).forEach(tool => {
  console.log(`- ${tool.name} (${tool.category})`);
});

console.log('\n=== Verification Complete ===');