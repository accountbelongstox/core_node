const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
function getFullPath(fileName) {
  return path.resolve(process.cwd(), fileName);
}
function checkPackageJson() {
  if (!fs.existsSync(getFullPath('package.json'))) {
    process.chdir('..');
  }
}
function printPaths() {
  console.log(`Current working directory: ${process.cwd()}`);
  console.log(`package.json full path: ${getFullPath('package.json')}`);
}
checkPackageJson();
printPaths();
let outdatedResult = '{}';
try {
  outdatedResult = execSync('npm outdated --json', { encoding: 'utf8' });
} catch (error) {
  outdatedResult = error.stdout;
}
const outdatedPackages = JSON.parse(outdatedResult);
const packageData = JSON.parse(fs.readFileSync(getFullPath('package.json'), 'utf8'));
const packageDataBak = { ...packageData };
const { dependencies, devDependencies } = packageData;
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';
if (dependencies) {
  for (let pkg in dependencies) {
    if (outdatedPackages[pkg]) {
      console.log(`${RED}Updated package (dependencies): ${pkg} from ${dependencies[pkg]} > ^${outdatedPackages[pkg].latest}${RESET}`);
      dependencies[pkg] = `^${outdatedPackages[pkg].latest}`;
    } else {
      console.log(`${GREEN}Unchanged package (dependencies): ${pkg}${RESET}`);
    }
  }
}
if (devDependencies) {
  for (let pkg in devDependencies) {
    if (outdatedPackages[pkg]) {
      console.log(`${RED}Updated package (devDependencies): ${pkg} from ${devDependencies[pkg]} > ^${outdatedPackages[pkg].latest}${RESET}`);
      devDependencies[pkg] = `^${outdatedPackages[pkg].latest}`;
    } else {
      console.log(`${GREEN}Unchanged package (devDependencies): ${pkg}${RESET}`);
    }
  }
}
fs.writeFileSync(getFullPath('updatePackage.json'), JSON.stringify(packageData, null, 2));
fs.writeFileSync(getFullPath('package.bak.json'), JSON.stringify(packageDataBak, null, 2));
console.log('Done! Updated versions saved to updatePackage.json');