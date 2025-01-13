const chokidar = require('chokidar');

// Path to the directory you want to monitor
const directoryToWatch = '/mnt/d/programing/core_node/public/VoiceStaticServer/output/dictSoundLib';

// Initialize the watcher
const watcher = chokidar.watch(directoryToWatch, {
  persistent: true, // Keep the watcher running
  ignoreInitial: false, // Don't ignore the initial state of the files
});

// Event listener for file changes
watcher
  .on('add', (path) => console.log(`File added: ${path}`))
  .on('change', (path) => console.log(`File changed: ${path}`))
  .on('unlink', (path) => console.log(`File deleted: ${path}`))
  .on('addDir', (path) => console.log(`Directory added: ${path}`))
  .on('unlinkDir', (path) => console.log(`Directory deleted: ${path}`))
  .on('error', (error) => console.error(`Watcher error: ${error}`));

console.log('Watching directory:', directoryToWatch);
