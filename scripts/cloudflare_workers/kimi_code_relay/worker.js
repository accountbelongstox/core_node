// Kimi Code API relay worker.
// Official upstream for Kimi Code keys (sk-kimi-...): https://api.kimi.com/coding/v1
// (api.moonshot.cn is the separate Open Platform and rejects Kimi Code keys.)
// The CLI requests <base>/chat/completions etc., so paths without the /coding/
// prefix are rewritten to /coding/v1<path> before forwarding.

const UPSTREAM_ORIGIN = "https://api.kimi.com";
const API_PREFIX = "/coding/v1";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    let path = url.pathname;
    if (!path.startsWith("/coding/")) {
      path = path === "/" ? API_PREFIX : API_PREFIX + path;
    }

    const target = UPSTREAM_ORIGIN + path + url.search;
    return fetch(new Request(target, request));
  },
};
