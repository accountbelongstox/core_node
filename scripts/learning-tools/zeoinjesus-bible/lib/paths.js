// Shared output-path resolution for the zeoinjesus-bible tools.
//
// Data is written under the per-user data directory rather than inside the repo,
// so the working tree stays clean and the corpus survives a repo re-clone. The
// username is taken automatically from os.homedir() (e.g. C:\Users\<you> on
// Windows, /home/<you> on Linux) — never hard-coded.

const os = require('os');
const path = require('path');

// Root user-data dir for all core_node tools: ~/.core_node
function userDataDir() {
  return path.join(os.homedir(), '.core_node');
}

// Default output dir for this specific tool. Callers mkdir -p this before use.
function defaultOutputDir() {
  return path.join(userDataDir(), 'learning-tools', 'zeoinjesus-bible');
}

module.exports = { userDataDir, defaultOutputDir };
