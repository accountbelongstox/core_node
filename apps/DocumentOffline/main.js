const CrawlController = require('./controller/crawl_controller.js');

const controller = new CrawlController();

if (require.main === module) {
  controller.start().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = controller;
