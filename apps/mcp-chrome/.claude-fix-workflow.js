export const meta = {
  name: 'mcp-chrome-bug-fixes',
  description: 'Fix all 62 confirmed bugs in apps/mcp-chrome in parallel by area (disjoint file sets) with inline reusability/extensibility optimization',
  phases: [{ title: 'Fix', detail: '12 area agents fix their bugs + apply inline optimization, return structured report' }],
}

const ROOT = '/mnt/dev_nvme1n1p1/programing/core_node/apps/mcp-chrome'
const BUGS_FILE = '/tmp/confirmed_bugs.json'

const AREAS = [
  { key: 'native-server', label: 'native-server (Node MCP + native messaging)', files: [
    'app/native-server/src/native-messaging-host.ts','app/native-server/src/server/index.ts','app/native-server/src/server/singleton.ts',
    'app/native-server/src/mcp/mcp-server.ts','app/native-server/src/mcp/mcp-server-stdio.ts','app/native-server/src/mcp/register-tools.ts',
    'app/native-server/src/cli.ts','app/native-server/src/file-handler.ts','app/native-server/src/index.ts',
    'app/native-server/src/scripts/postinstall.ts','app/native-server/src/scripts/register.ts','app/native-server/src/scripts/browser-config.ts','app/native-server/src/scripts/utils.ts',
  ]},
  { key: 'offscreen-bg-core', label: 'offscreen audio + background core', files: [
    'app/chrome-extension/entrypoints/offscreen/audio-recorder.ts','app/chrome-extension/entrypoints/offscreen/main.ts','app/chrome-extension/utils/offscreen-manager.ts',
    'app/chrome-extension/entrypoints/background/index.ts','app/chrome-extension/entrypoints/background/native-host.ts','app/chrome-extension/entrypoints/background/storage-manager.ts',
    'app/chrome-extension/entrypoints/background/api-health-listener.ts','app/chrome-extension/entrypoints/background/api/BaseApiClient.ts','app/chrome-extension/entrypoints/background/api/WorkerApiClient.ts','app/chrome-extension/services/ApiManager.ts',
  ]},
  { key: 'media-tools', label: 'media tools', files: [
    'app/chrome-extension/entrypoints/background/tools/browser/screenshot.ts','app/chrome-extension/entrypoints/background/tools/browser/gif-recorder.ts',
    'app/chrome-extension/entrypoints/background/tools/audio.ts','app/chrome-extension/entrypoints/background/tools/browser/audio.ts',
    'app/chrome-extension/entrypoints/background/tools/browser/download.ts','app/chrome-extension/entrypoints/background/tools/browser/file-upload.ts','app/chrome-extension/entrypoints/background/tools/browser/performance.ts',
  ]},
  { key: 'network-capture', label: 'network capture', files: [
    'app/chrome-extension/entrypoints/background/tools/browser/network-capture.ts','app/chrome-extension/entrypoints/background/tools/browser/network-capture-debugger.ts',
    'app/chrome-extension/entrypoints/background/tools/browser/network-capture-web-request.ts','app/chrome-extension/entrypoints/background/tools/browser/network-request.ts','app/chrome-extension/inject-scripts/network-helper.js',
  ]},
  { key: 'task-center', label: 'task center', files: [
    'app/chrome-extension/entrypoints/background/services/task-center/TaskCenter.ts','app/chrome-extension/entrypoints/background/services/task-center/SimpleWorkerBase.ts',
    'app/chrome-extension/entrypoints/background/services/task-center/ITaskProcessor.ts','app/chrome-extension/entrypoints/background/services/task-center/init-processors.ts',
    'app/chrome-extension/entrypoints/background/services/task-center/task-history-store.ts','app/chrome-extension/entrypoints/background/task-center-listener.ts',
  ]},
  { key: 'utils-vector', label: 'vector DB / similarity / caches', files: [
    'app/chrome-extension/utils/vector-database.ts','app/chrome-extension/utils/semantic-similarity-engine.ts','app/chrome-extension/utils/simd-math-engine.ts',
    'app/chrome-extension/utils/content-indexer.ts','app/chrome-extension/utils/text-chunker.ts','app/chrome-extension/utils/lru-cache.ts',
    'app/chrome-extension/utils/media-cache.ts','app/chrome-extension/utils/model-cache-manager.ts','app/chrome-extension/utils/inline-similarity-host.ts','app/chrome-extension/workers/similarity.worker.js',
  ]},
  { key: 'bing-dictionary', label: 'bing dictionary', files: [
    'app/chrome-extension/entrypoints/background/services/bing-dictionary-worker-service.ts','app/chrome-extension/entrypoints/background/services/bing-tab-pool.ts',
    'app/chrome-extension/entrypoints/background/services/bing-result.ts','app/chrome-extension/entrypoints/background/services/bing-worker-ops.ts',
    'app/chrome-extension/entrypoints/background/tools/browser/bing-dictionary.ts','app/chrome-extension/entrypoints/background/bing-dictionary-client-listener.ts',
  ]},
  { key: 'browser-interaction', label: 'browser interaction tools', files: [
    'app/chrome-extension/entrypoints/background/tools/browser/computer.ts','app/chrome-extension/entrypoints/background/tools/browser/element-picker.ts',
    'app/chrome-extension/entrypoints/background/tools/browser/keyboard.ts','app/chrome-extension/entrypoints/background/tools/browser/interaction.ts',
    'app/chrome-extension/entrypoints/background/tools/browser/read-page.ts','app/chrome-extension/entrypoints/background/tools/browser/javascript.ts',
    'app/chrome-extension/entrypoints/background/tools/browser/inject-script.ts','app/chrome-extension/entrypoints/background/tools/browser/window.ts',
    'app/chrome-extension/entrypoints/background/tools/browser/common.ts','app/chrome-extension/entrypoints/background/tools/base-browser.ts',
  ]},
  { key: 'inject-scripts', label: 'inject scripts', files: [
    'app/chrome-extension/inject-scripts/web-fetcher-helper.js','app/chrome-extension/inject-scripts/web-ops.js',
    'app/chrome-extension/inject-scripts/accessibility-tree-helper.js','app/chrome-extension/inject-scripts/interactive-elements-helper.js',
    'app/chrome-extension/inject-scripts/click-helper.js','app/chrome-extension/inject-scripts/fill-helper.js',
    'app/chrome-extension/inject-scripts/keyboard-helper.js','app/chrome-extension/inject-scripts/inject-bridge.js',
    'app/chrome-extension/inject-scripts/screenshot-helper.js','app/chrome-extension/inject-scripts/file-upload-helper.js',
  ]},
  { key: 'popup-shared', label: 'popup composables + shared + control panel', files: [
    'app/chrome-extension/entrypoints/popup/composables/useBookStudyGenerator.ts','app/chrome-extension/entrypoints/popup/composables/useBingDictionaryClient.ts',
    'app/chrome-extension/entrypoints/popup/composables/useTaskCenter.ts','app/chrome-extension/entrypoints/popup/composables/useGeminiImage.ts',
    'app/chrome-extension/entrypoints/popup/composables/useArticleStudyGuide.ts','app/chrome-extension/entrypoints/popup/composables/studyReplyParser.ts',
    'app/chrome-extension/entrypoints/popup/composables/useCacheStore.ts','app/chrome-extension/entrypoints/popup/composables/useExtensionConfig.ts',
    'app/chrome-extension/composables/usePersistedRef.ts','app/chrome-extension/composables/useAppStore.ts',
    'packages/shared/src/tools.ts','packages/shared/src/types.ts','packages/shared/src/constants.ts','advanced-control-panel/App.tsx',
  ]},
  { key: 'firefox-port', label: 'firefox port', files: [
    'app/chrome-extension/utils/browser-shim.ts','app/chrome-extension/utils/firefox-main-world-relay.ts',
    'app/chrome-extension/entrypoints/background/tools/browser/console-firefox.ts','app/chrome-extension/entrypoints/background/tools/browser/dialog-firefox.ts',
    'app/chrome-extension/entrypoints/background/tools/browser/file-upload-firefox.ts','app/chrome-extension/entrypoints/background/tools/browser/network-capture-body-firefox.ts','app/chrome-extension/entrypoints/background/tools/browser/performance-firefox.ts',
  ]},
  { key: 'ai-web-workers', label: 'AI web workers', files: [
    'app/chrome-extension/entrypoints/background/services/chatgpt-worker-service.ts','app/chrome-extension/entrypoints/background/services/gemini-worker-service.ts',
    'app/chrome-extension/entrypoints/background/services/gemini-image-worker-service.ts','app/chrome-extension/entrypoints/background/services/notebooklm-worker-service.ts',
    'app/chrome-extension/entrypoints/background/deepseek-polling-service.ts','app/chrome-extension/utils/deepseek-task-queue.ts',
    'app/chrome-extension/entrypoints/background/tools/browser/web-chat-job-base.ts','app/chrome-extension/entrypoints/background/web-chat-job-listener-factory.ts',
    'app/chrome-extension/entrypoints/background/chatgpt-text-listener.ts','app/chrome-extension/entrypoints/background/gemini-text-listener.ts',
    'app/chrome-extension/entrypoints/background/gemini-image-listener.ts','app/chrome-extension/entrypoints/background/grok-text-listener.ts',
    'app/chrome-extension/entrypoints/background/copilot-text-listener.ts','app/chrome-extension/entrypoints/background/notebooklm-listener.ts',
  ]},
]

const RETURN_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    area: { type: 'string' },
    bugs_total: { type: 'number' },
    bugs_fixed: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      title: { type: 'string' }, file: { type: 'string' }, line: { type: 'number' }, how: { type: 'string' },
    }, required: ['title','file','line','how'] } },
    files_changed: { type: 'array', items: { type: 'string' } },
    optimizations: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      kind: { type: 'string', enum: ['extract-helper','consolidate-dup','reuse-sibling','extensibility-seam','config-driven'] },
      description: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
    }, required: ['kind','description','files'] } },
    cross_area_notes: { type: 'array', items: { type: 'string' } },
    stuck: { type: 'boolean' },
    stuck_reason: { type: 'string' },
  },
  required: ['area','bugs_total','bugs_fixed','files_changed','optimizations','cross_area_notes','stuck'],
}

function fixPrompt(area) {
  return [
    'You are a senior engineer fixing CONFIRMED bugs in the "' + area.label + '" area of the mcp-chrome project (Chrome+Firefox extension + Node native MCP server).',
    '',
    'ROOT: ' + ROOT,
    'BUG DATA: ' + BUGS_FILE + '  (a JSON array of confirmed bugs; each has area/file/line/severity/category/title/summary/failure_scenario/suggested_fix)',
    '',
    'STEP 1 - Load your bugs:',
    'Read ' + BUGS_FILE + ' and select every entry where area === "' + area.key + '". That is your full bug list. Each entry failure_scenario describes the EXACT broken behavior to eliminate, and suggested_fix is the agreed direction.',
    '',
    'STEP 2 - Fix EVERY bug, faithfully and completely:',
    'For each bug: Read the real file at ROOT + "/" + file (enough context around the given line), then apply a minimal, correct fix that eliminates the failure_scenario. Do not leave the broken path reachable. Preserve existing behavior for non-bug paths. Match surrounding code style.',
    '',
    'STEP 3 - Apply INLINE OPTIMIZATION (reusability + extensibility) where the bugs reveal duplication or missing seams. Be surgical, not a rewrite:',
    '- extract-helper: factor repeated patterns into a shared helper WITHIN your area (e.g. a sync onMessage wrapper that returns true + .then/.catch; a safeJoinUnderDir(tempDir, name) path-sanitizer; a reentrancy-guard / serializeCycle(); a withDebuggerSession() finally-cleanup; a clear-timer-on-all-paths discipline; a CSS.escape / XPath-quote helper). Put shared helpers in the most natural existing file in your area (or a new small util file only if clearly justified).',
    '- reuse-sibling: if a sibling file in your area already implements the correct pattern (e.g. accessibility-tree-helper.js already splits aria-labelledby and uses CSS.escape), REUSE it instead of re-implementing.',
    '- consolidate-dup: merge near-identical branches/funcs.',
    '- extensibility-seam / config-driven: where a hard-coded list or branch limits extension (e.g. filter domains, processor registry, stop reasons), make it data-driven or pluggable - but only where a bug already forces the change.',
    'Only apply where it clearly reduces duplication or enables extension that the bugs expose. No speculative refactors.',
    '',
    'STEP 4 - Hard constraints (project AGENTS.md):',
    '- Code/comments/logs in English. No test code. No progress summaries inside source files.',
    '- Modular: if a file you touch exceeds 800 lines AND a clean split is obvious, note it in cross_area_notes rather than forcing a risky split mid-fix.',
    '- You may edit ONLY files in your owned list (below). If a fix needs a file outside your area, do NOT edit it - choose a self-contained alternative (e.g. for computer.ts tabId delegation, inline the work via this.sendMessageToTab(targetTab.id,...) / this.injectContentScript(targetTab.id,...) instead of adding params to cross-area tools) and record the need in cross_area_notes.',
    '- Do NOT run build/test/lint/typecheck. Only edit files.',
    '',
    'OWNED FILES (you may edit any of these, no others):',
    area.files.map(function (f) { return '  ' + f }).join('\n'),
    '',
    'Return the structured report. Set stuck=true ONLY if you genuinely cannot proceed (then explain in stuck_reason). Be precise in bugs_fixed.how (one line each). List every optimization you actually applied.',
  ].join('\n')
}

phase('Fix')
log('Fanning out ' + AREAS.length + ' area fix-agents on disjoint file sets...')

const results = await parallel(AREAS.map(function (a) { return function () {
  return agent(fixPrompt(a), { label: 'fix:' + a.key, phase: 'Fix', schema: RETURN_SCHEMA, effort: 'high' })
    .then(function (r) { return Object.assign({}, r, { _ok: true }) })
    .catch(function (e) { return { area: a.key, _ok: false, _error: String((e && e.message) || e), bugs_total: 0, bugs_fixed: [], files_changed: [], optimizations: [], cross_area_notes: [], stuck: true, stuck_reason: String((e && e.message) || e) } })
}}))

const ok = results.filter(function (r) { return r && r._ok })
const failed = results.filter(function (r) { return r && !r._ok })
const totalFixed = ok.reduce(function (n, r) { return n + ((r.bugs_fixed || []).length) }, 0)
log('DONE. areas_ok=' + ok.length + ' areas_failed=' + failed.length + ' bugs_fixed_reported=' + totalFixed)
return { results: results, ok: ok.length, failed: failed.length, total_fixed_reported: totalFixed }
