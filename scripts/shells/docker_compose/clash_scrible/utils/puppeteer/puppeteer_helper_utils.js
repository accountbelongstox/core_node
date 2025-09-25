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

const fs = require('fs').promises;
const path = require('path');

async function takeScreenshot(page, screenshotDir) {
    await fs.mkdir(screenshotDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
    const screenshotPath = path.join(screenshotDir, `screenshot_${timestamp}.png`);
    await page.screenshot({ path: screenshotPath });
    return screenshotPath;
}
async function cleanOldScreenshots(screenshotDir, maxAgeHours = 24) {
    const currentTime = new Date();
    const files = await fs.readdir(screenshotDir);
    for (const file of files) {
        if (file.startsWith('screenshot_') && file.endsWith('.png')) {
            const filePath = path.join(screenshotDir, file);
            const stats = await fs.stat(filePath);
            const fileAge = (currentTime - stats.mtime) / (1000 * 60 * 60); // Age in hours
            if (fileAge > maxAgeHours) {
                await fs.unlink(filePath);
            }
        }
    }
}

module.exports = {
    takeScreenshot,
    cleanOldScreenshots
};