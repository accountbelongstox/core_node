const DomainContext = require('./domain_context.js');
const FileMapper = require('./file_mapper.js');
const CssProcessor = require('./css_processor.js');
const ResourceExtractor = require('./resource_extractor.js');
const ResourceDownloader = require('./resource_downloader.js');
const UrlRewriter = require('./url_rewriter.js');
const UnifiedResourceProcessor = require('./unified_resource_processor.js');

module.exports = {
  DomainContext,
  FileMapper,
  CssProcessor,
  ResourceExtractor,
  ResourceDownloader,
  UrlRewriter,
  UnifiedResourceProcessor
};
