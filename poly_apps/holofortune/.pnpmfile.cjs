// pnpm configuration for React Native
// This ensures proper linking of native dependencies

function readPackage(pkg, context) {
  // React Native requires peer dependencies to be installed
  if (pkg.name === 'react-native') {
    pkg.peerDependencies = pkg.peerDependencies || {};
  }
  return pkg;
}

module.exports = {
  hooks: {
    readPackage
  }
};

