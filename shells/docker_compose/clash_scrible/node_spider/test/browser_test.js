const Browser = require('../climber/main.js');

async function testBrowser() {
    try {
        console.log('Initializing browser...');
        const browser = new Browser();
        
        console.log('Creating driver...');
        const drivers = await browser.createDrivers({ headless: false });
        
        console.log(drivers);
        // console.log(driver.page);
        // await driver.page.open('https://bing.com');
        
        // console.log('Waiting for 5 seconds...');
        // await new Promise(resolve => setTimeout(resolve, 5000));
        
        // console.log('Taking a screenshot...');
        // await driver.screen.screenshot('test_screenshot.png');
        
        // console.log('Closing the browser...');
        // await driver.close();
        
        // console.log('Test completed successfully!');
    } catch (error) {
        console.error('An error occurred during the test:', error);
    }
}

testBrowser();