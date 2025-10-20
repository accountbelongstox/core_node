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
const { mathtool } = require('#@ncore/foundation/utilities/index.js')

class Screen {
    async init(browser, page) {
        this.browser = browser
        this.pageModus = page
        const methods = Object.getOwnPropertyNames(Screen.prototype)
            .filter(name => typeof Screen.prototype[name] === 'function' && name !== 'constructor');
        // console.log('Methods:', methods);
        console.log('Total Screen of methods:', methods.length);
    }

    async getCurrentPage(page=null) {
         page = await this.pageModus.getCurrentPage(page)
        return page
    }
    
    async screenshotOfWebpage(selector = null, filePath = null, page = null) {
        const currentPage = await this.getCurrentPage(page);
        filePath = this.getScreenshotSavePath(filePath);
        if (selector !== null) {
            return this.screenshotOfElement(selector, filePath, currentPage);
        }
        await currentPage.screenshot({ path: filePath });
        return filePath;
    }

    getScreenshotSavePath(filename = null) {
        if (filename === null) {
            filename = this.comString.randomString(32, false) + '.png';
        }
        const tempDir = this.comConfig.getPublic('downfile/screenshot');
        this.comFile.mkdir(tempDir);
        const filePath = this.comString.dirNormal(path.join(tempDir, filename));
        return filePath;
    }

    async getImage(page = null) {
        const currentPage = await this.getCurrentPage(page);
        const img = await currentPage.$('.code');
        await currentPage.waitForTimeout(2000); // 2秒
        const location = await img.boundingBox();
        // ... [Rest of the code remains the same]
    }
    
    async screenshotOfElement(selector = null, filePath = null, page = null) {
        const currentPage = await this.getCurrentPage(page);
        const element = await currentPage.$(selector);
        const location = await element.boundingBox();
        filePath = this.getScreenshotSavePath(filePath);
        await currentPage.screenshot({ path: filePath });
    
    }
    
    async moveMouseRandomCurve(page = null) {
        const currentPage = await this.getCurrentPage(page);
        const {width, height} = await this.getPageSize()
        const curvePoints = mathtool.generateRandomCurvePoints(width, height);
        // console.log(`curvePoints`)
        // console.log(curvePoints)
        // mathtool.printMatrix(curvePoints)
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
        const url = 'http://www.example.com'; // 请替换成您的目标网页
        await currentPage.goto(url);
    
        // Assuming you have a way to perform actions like clicking using coordinates on the page
        // The following is a pseudocode representation, as the original method was for WebDriver
        await currentPage.click({ x: x, y: y });
        // ... [Rest of the code remains the same]
    }
    

}

Screen.toString = () => '[class Screen]';
module.exports = Screen;

