// Cloudflare Worker — Volcengine Ark Coding Plan (Anthropic-compatible)
// Deploy as its own worker. Point Claude Code at this worker URL:
//   ANTHROPIC_BASE_URL=https://<this-worker>.workers.dev
// Upstream: https://ark.cn-beijing.volces.com/api/coding

const UPSTREAM_ORIGIN = "https://ark.cn-beijing.volces.com";
const API_PREFIX = "/api/coding";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? API_PREFIX : API_PREFIX + url.pathname;
    const target = UPSTREAM_ORIGIN + path + url.search;
    return fetch(new Request(target, request));
  },
};
