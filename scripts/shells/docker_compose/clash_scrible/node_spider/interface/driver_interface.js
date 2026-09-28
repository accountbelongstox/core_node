class DriverInterface {
    bypass() {
        // This method seems to be used for adding plugins or configurations before launching the browser.
    }

    async documentInitialised() {
        // This method appears to check if the document has been initialized by checking the outerHTML of the document.
    }

    async createChromeDriver(options = {}) {
        // This method is responsible for creating and initializing a Chrome driver with given options.
    }

    async loadJQuery() {
        // This method is intended to ensure that jQuery is loaded on the page.
    }

    async loadJQueryWait(loadDeep = 0) {
        // This method checks for jQuery's availability on the page with a certain depth of retries.
    }

    async customBrowser() {
        // This method seems to customize browser settings, particularly around content settings and plugins.
    }

    toString = () => '[class DriverInterface]';
}

module.exports = {
    DriverInterface
}
