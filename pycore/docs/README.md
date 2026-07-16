# PyCore Documentation Hub

Navigation hub for pycore documentation, organized by topic.

**Convention:** Cross-module / top-level design docs live in this directory (`pycore/docs/`); **package READMEs and nearby design docs stay in their package directories** (co-located with code). This index links to them for unified search. Add new cross-module docs under the categories below and register one line here.

Docs in this directory:
- `pipelines/` — Data pipeline contracts
- `reports/` — One-off analysis/compliance reports

---

## Architecture Overview
- [PyCore library overview](../README.md) — Version, layers, entry points
- [pycore layering spec (PYTHON_PYCORE)](../../development-guides/PYTHON_PYCORE.md) — pyfoundations/pyutils/pyctl import rules (repo authority)
- [pyfoundations tree](../pyfoundations/pyfoundations_tree.md) · [pyutils tree](../pyutils/pyutils_tree.md)
- [callmodule routing architecture](../callmodule/ROUTING_ARCHITECTURE_REDESIGN.md)
- [PyHeartbeat architecture](../pyheartbeat/PYHEARTBEAT_ARCHITECTURE.md) · [Unified architecture](../pyheartbeat/UNIFIED_ARCHITECTURE.md) · [Integration spec](../pyheartbeat/INTEGRATION_SPECIFICATION.md)
- [pylauncher refactor overview](../pylauncher/ARCHITECTURE_REFACTOR_SUMMARY.md) · [Smart singleton guide](../pylauncher/SMART_SINGLETON_GUIDE.md)
- [Desktop UI architecture](../pyctl/desktop/ui/ARCHITECTURE.md) · [MCP control architecture](../pyctl/mcp/ARCHITECTURE.md)
- [Native UI docs](../pyutils/native_ui/_docs/README.md) · [Platform adapter usage](../pyutils/native_ui/PLATFORM_ADAPTER_USAGE.md)
- [Ultralytics GPU unified system](../pyutils/ultralytics/UNIFIED_GPU_SYSTEM_README.md)
- [VOC annotator design](../pyutils/voc_annotator/DESIGN.md)
- [ensure_library usage guide](../pyutils/ensure_library/USAGE_GUIDE.md)
- [pybrowser session cookie persistence](../pyutils/pybrowser/COOKIE_PERSISTENCE_GUIDE.md)

## Startup & Init
- [Init flow INIT_FLOW](../pyfoundations/INIT_FLOW.md)
- [CUDA init](../pyfoundations/CUDA_INIT.md) · [CPU/GPU package selection](../pyfoundations/CPU_GPU_PACKAGES.md) · [OCR init](../pyfoundations/OCR_INIT.md)
- [Native UI bootstrap flow](../pyutils/native_ui/step4_startup/BOOTSTRAP_FLOW.md)
- [iniscripts pre-install](../scripts/iniscripts/README.md)

## RPC & Messaging
- [RPC protocol spec](../pyutils/rpc_v2/RPC_PROTOCOL_SPECIFICATION.md) · [Unified message types](../pyutils/rpc_v2/UNIFIED_MESSAGE_TYPES.md)
- [RPC v2 architecture analysis](../pyutils/rpc_v2/RPC_V2_ARCHITECTURE_ANALYSIS.md) · [Sync mode quick reference](../pyutils/rpc_v2/SYNC_MODE_QUICK_REFERENCE.md)
- [wsrpc overview](../pyutils/wsrpc/README.md)

## Data Pipelines
- [Media sync pipeline MEDIA_SYNC_PIPELINE](pipelines/MEDIA_SYNC_PIPELINE.md) — Video subtitle sync (§1–§7) + **book sentence/word model v2 (§8)** (pycore↔laravel_main :9000 idempotent ingest)
- [Translation cache architecture](../pyutils/translator/CACHE_ARCHITECTURE.md) · [Third-party translation integration](../pyutils/translator/THIRD_PARTY_INTEGRATION.md) · [Romanization/phonetic](../pyutils/translator/ROMANIZATION_PHONETIC.md)
- [Laravel↔MCP bridge directory scan OCR](../pyutils/mcp_bridge_with_laravel/SCAN_DIRECTORY_OCR_GUIDE.md)

## Device / Code Sync
- [Code sync mesh CODE_SYNC_MESH](../pyutils/codesync/docs/CODE_SYNC_MESH.md) · [Unified architecture](../pyutils/codesync/docs/UNIFIED_ARCHITECTURE.md)

## Subsystems
- Browser automation: [Design spec](../pyctl/pybrowserauto/PYBROWSERAUTO_DESIGN_SPEC.md) · [Architecture](../pyctl/pybrowserauto/ARCHITECTURE.md) · [API reference](../pyctl/pybrowserauto/API_REFERENCE.md)
- Speech/AI: [Architecture overview](../pyctl/speech/ai/ARCHITECTURE_OVERVIEW.md) · [Structure](../pyctl/speech/STRUCTURE.md) · [Unified response guide](../pyctl/speech/rpc/UNIFIED_RESPONSE_GUIDE.md)

## Standards & Reports
- [Database type standards](../database/DATABASE_TYPE_STANDARDS.md)
- [MCP coding standards](../pyutils/mcp/MCP_CODING_STANDARDS.md)
- [pycore compliance analysis report](reports/COMPLIANCE_ANALYSIS.md)

## Package READMEs
- [callmodule](../callmodule/README.md) · [database](../database/README.md) · [pyutils](../pyutils/README.md) · [pylauncher](../pylauncher/README.md)
- [pyctl/ai](../pyctl/ai/README.md) · [translator](../pyutils/translator/README.md) · [mcp](../pyutils/mcp/README.md) · [wsrpc](../pyutils/wsrpc/README.md)
