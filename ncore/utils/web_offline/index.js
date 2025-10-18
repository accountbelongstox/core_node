// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const DomainContext = require('./domain_context.js');
const FileMapper = require('./file_mapper.js');
const CssProcessor = require('./css_processor.js');
const ResourceExtractor = require('./resource_extractor.js');
const ResourceDownloader = require('./resource_downloader.js');
const UrlRewriter = require('./url_rewriter.js');

module.exports = {
  DomainContext,
  FileMapper,
  CssProcessor,
  ResourceExtractor,
  ResourceDownloader,
  UrlRewriter
};
