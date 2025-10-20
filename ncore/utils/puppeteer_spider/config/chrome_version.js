// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

function getPuppeteerVersion() {
    try {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const puppeteerVersion = packageJson.dependencies.puppeteer || packageJson.devDependencies.puppeteer;

        if (puppeteerVersion) {
            return puppeteerVersion.replace('^', '').replace('~', '');
        } else {
            logger.warn('Puppeteer version not found in package.json. Using default version 23.4.1');
            return '23.4.1';
        }
    } catch (error) {
        logger.warn('Error reading package.json. Using default Puppeteer version 23.4.1');
        return '23.4.1';
    }
}

function getChromeVersion(puppeteerVersion) {
    const versionMap = {
        '23.4.1': '129.0.6668.70',
        '23.4.0': '129.0.6668.58',
        '23.3.1': '128.0.6613.137',
        '23.3.0': '128.0.6613.119',
        '23.2.2': '128.0.6613.119',
        '23.2.1': '128.0.6613.86',
    };

    const majorMinorVersion = puppeteerVersion.split('.').slice(0, 2).join('.');

    for (const [puppeteerVer, chromeVer] of Object.entries(versionMap)) {
        if (puppeteerVer.startsWith(majorMinorVersion)) {
            return chromeVer;
        }
    }

    logger.warn('No matching Chrome version found, using latest');
    return 'latest';
}



