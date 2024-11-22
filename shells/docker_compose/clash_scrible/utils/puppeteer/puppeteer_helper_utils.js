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