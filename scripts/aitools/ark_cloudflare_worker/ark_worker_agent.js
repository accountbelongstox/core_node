// Cloudflare Worker — Volcengine Ark Agent Plan (Anthropic-compatible)
// Deploy as its own worker. Point Claude Code at this worker URL:
//   ANTHROPIC_BASE_URL=https://<this-worker>.workers.dev
// Upstream: https://ark.cn-beijing.volces.com/api/plan

const UPSTREAM_ORIGIN = "https://ark.cn-beijing.volces.com";
const API_PREFIX = "/api/plan";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? API_PREFIX : API_PREFIX + url.pathname;
    const target = UPSTREAM_ORIGIN + path + url.search;
    return fetch(new Request(target, request));
  },
};
