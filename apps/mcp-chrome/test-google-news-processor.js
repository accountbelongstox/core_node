#!/usr/bin/env node

/**
 * Google News Processor Test Script
 * Tests the Google News Processor by sending a start command via Chrome extension messaging
 *
 * This script simulates the popup UI sending a message to start the Google News Processor
 */

console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('  Google News Processor Test Script');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('📝 Instructions:');
console.log('1. Make sure the Chrome extension is loaded and running');
console.log('2. Open Chrome DevTools for the extension background page:');
console.log('   chrome://extensions/ → MCP Chrome → "Inspect views: background page"');
console.log('');
console.log('3. In the background console, run the following command:');
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log(`
// Start Google News Processor
chrome.runtime.sendMessage({
  type: 'task_center',
  action: 'start_processor',
  processorType: 'google_news',
  config: {
    apiUrl: 'http://localhost:9000',
    pollInterval: 10  // 10 seconds between searches
  }
}, (response) => {
  console.log('[Test] Response:', response);
});
`);
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('To check status:');
console.log('');
console.log(`
chrome.runtime.sendMessage({
  type: 'task_center',
  action: 'get_status'
}, (response) => {
  console.log('[Test] Status:', JSON.stringify(response, null, 2));
});
`);
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('To stop the processor:');
console.log('');
console.log(`
chrome.runtime.sendMessage({
  type: 'task_center',
  action: 'stop_processor',
  processorType: 'google_news'
}, (response) => {
  console.log('[Test] Stop response:', response);
});
`);
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('💡 Watch the background console for detailed debug output!');
console.log('');
console.log('Expected output:');
console.log('  - Search for each word in the list');
console.log('  - Open Google News tabs (in background)');
console.log('  - Extract headlines and content');
console.log('  - Print detailed debug information');
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('');
