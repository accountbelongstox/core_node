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

'use strict';
const Util = require('../../node_provider/utils.js');
const path = require('path');
const { getMethodNames } = require('../../utils/classUtils.js');

class Screen {
    constructor(browser, page, imageSaveDir = null) {
        this.browser = browser;
        this.pageModus = page;
        this.imageSaveDir = imageSaveDir || Util.file.getTempImageDir();
        getMethodNames(Screen.prototype, true, 'Screen');
    }

    setSaveDir(newDir) {
        if (newDir) {
            this.imageSaveDir = newDir;
        }
    }

    resolveFilePath(filename = null) {
        if (!filename) {
            filename = Util.strtool.uuid() + '.png';
        }
        filename = Util.strtool.dirNormal(filename);
        if (!path.isAbsolute(filename)) {
            filename = path.join(this.imageSaveDir, filename);
        }

        return filename;
    }

    async screenshotFullPage(filePath = null, page = null) {
        const currentPage = await this.getCurrentPage(page);
        filePath = this.resolveFilePath(filePath);
        await currentPage.screenshot({ path: filePath, fullPage: true });
        return filePath;
    }

    async screenshotOfWebpage(selector = null, filePath = null, page = null) {
        const currentPage = await this.getCurrentPage(page);
        filePath = this.resolveFilePath(filePath);
        if (selector !== null) {
            return this.screenshotOfElement(selector, filePath, currentPage);
        }
        await currentPage.screenshot({ path: filePath });
        return filePath;
    }

    async getImage(page = null, filePath = null) {
        const currentPage = await this.getCurrentPage(page);
        const img = await currentPage.$('.code');
        await currentPage.waitForTimeout(2000);
        const location = await img.boundingBox();
        filePath = this.resolveFilePath(filePath);
        await currentPage.screenshot({ path: filePath, clip: location });
        return filePath;
    }

    async screenshotOfElement(selector = null, filePath = null, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);
        const location = await element.boundingBox();
        filePath = this.resolveFilePath(filePath);
        await currentPage.screenshot({ path: filePath, clip: location });
        return filePath;
    }

    getScreenshotSavePath(filename = null) {
        return this.resolveFilePath(filename);
    }

    async moveMouseRandomCurve(page = null) {
        const currentPage = await this.getCurrentPage(page);
        const { width, height } = await this.getPageSize();
        const curvePoints = Util.math.generateRandomCurvePoints(width, height);
        for (const { x, y } of curvePoints) {
            await currentPage.mouse.move(x, y);
            await currentPage.waitForTimeout(50);
        }
    }

    async getPageSize() {
        const page = await this.getCurrentPage();
        const viewportSize = await page.viewport();
        const { width, height } = viewportSize;
        return { width, height };
    }

    async screenClick(x, y, page = null) {
        const currentPage = await this.getCurrentPage(page);
        await currentPage.mouse.click(x, y);
    }

    async getCurrentPage(page = null) {
        page = await this.pageModus.getCurrentPage(page);
        return page;
    }
}

Screen.toString = () => '[class Screen]';
module.exports = Screen;
