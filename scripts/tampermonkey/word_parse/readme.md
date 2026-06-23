<script src="https://cdn.jsdelivr.net/gh/accountbelongstox/core_node@main/scripts/bing_word_parse/bwpaser.1.0.js"></script>
https://cdn.jsdelivr.net/gh/accountbelongstox/core_node@main/scripts/bing_word_parse/bwpaser.1.0.js

const bingWordParse = new BingWordParse({
  baseUrl: 'https://your-api-endpoint.com',  // Required: API endpoint for word data
  staticPath: '/path/to/assets',            // Optional: Path to static assets (images, audio)
  isDebug: false,                            // Optional: Enable debug mode (default: false)
  initElement: Element       // Optional: DOM element to render in (default: document.body)
});
