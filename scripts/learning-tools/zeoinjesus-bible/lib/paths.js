// Shared output-path resolution for the zeoinjesus-bible tools.
//
// Data is written under the per-user data directory rather than inside the repo,
// so the working tree stays clean and the corpus survives a repo re-clone. The
// username is taken automatically from os.homedir() (e.g. C:\Users\<you> on
// Windows, /home/<you> on Linux) — never hard-coded.

const os = require('os');
const path = require('path');
const { getSystemCacheDir } = require('../../../../ncore/foundation/common/system_paths');

// Root user-data dir for all core_node tools (centralized via system_paths:
// D:\programing\Users\<user>\.core_node on Windows, /var/_core_node on Linux).
function userDataDir() {
  return getSystemCacheDir();
}

// Default output dir for this specific tool. Callers mkdir -p this before use.
function defaultOutputDir() {
  return path.join(userDataDir(), 'learning-tools', 'zeoinjesus-bible');
}

module.exports = { userDataDir, defaultOutputDir };
