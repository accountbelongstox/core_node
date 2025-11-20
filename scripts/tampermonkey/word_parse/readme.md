<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

<script src="https://cdn.jsdelivr.net/gh/accountbelongstox/core_node@main/scripts/bing_word_parse/bwpaser.1.0.js"></script>
https://cdn.jsdelivr.net/gh/accountbelongstox/core_node@main/scripts/bing_word_parse/bwpaser.1.0.js

const bingWordParse = new BingWordParse({
  baseUrl: 'https://your-api-endpoint.com',  // Required: API endpoint for word data
  staticPath: '/path/to/assets',            // Optional: Path to static assets (images, audio)
  isDebug: false,                            // Optional: Enable debug mode (default: false)
  initElement: Element       // Optional: DOM element to render in (default: document.body)
});