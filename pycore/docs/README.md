# PyCore 文档中心 (Documentation Hub)

pycore 的文档导航中心,按主题归类。

**约定**:跨模块/顶层设计文档收录在本目录(`pycore/docs/`);**包内 README 与就近设计文档保留在各自包目录**(与代码同处),本索引仅链接到它们,便于统一检索。新增跨模块文档请放入下方对应分类子目录,并在此登记一行。

收录在本目录的文档:
- `pipelines/` — 数据管线契约
- `reports/` — 一次性分析/合规报告

---

## 架构总览 (Architecture)
- [PyCore 库总览](../README.md) — 版本、分层、入口
- [pycore 分层规范 (PYTHON_PYCORE)](../../development-guides/PYTHON_PYCORE.md) — pyfoundations/pyutils/pyctl 导入规则(仓库级权威)
- [pyfoundations 结构树](../pyfoundations/pyfoundations_tree.md) · [pyutils 结构树](../pyutils/pyutils_tree.md)
- [callmodule 路由架构](../callmodule/ROUTING_ARCHITECTURE_REDESIGN.md)
- [PyHeartbeat 架构](../pyheartbeat/PYHEARTBEAT_ARCHITECTURE.md) · [统一架构](../pyheartbeat/UNIFIED_ARCHITECTURE.md) · [集成规范](../pyheartbeat/INTEGRATION_SPECIFICATION.md)
- [pylauncher 重构总览](../pylauncher/ARCHITECTURE_REFACTOR_SUMMARY.md) · [智能单例指南](../pylauncher/SMART_SINGLETON_GUIDE.md)
- [桌面 UI 架构](../pyctl/desktop/ui/ARCHITECTURE.md) · [MCP 控制架构](../pyctl/mcpctl/ARCHITECTURE.md)

## 启动与初始化 (Startup & Init)
- [初始化流程 INIT_FLOW](../pyfoundations/INIT_FLOW.md)
- [CUDA 初始化](../pyfoundations/CUDA_INIT.md) · [CPU/GPU 包选择](../pyfoundations/CPU_GPU_PACKAGES.md) · [OCR 初始化](../pyfoundations/OCR_INIT.md)
- [原生 UI 启动引导流程](../pyutils/native_ui/step4_startup/BOOTSTRAP_FLOW.md)
- [iniscripts 前置安装](../scripts/iniscripts/README.md)

## RPC 与通信 (RPC & Messaging)
- [RPC 协议规范](../pyutils/rpc_v2/RPC_PROTOCOL_SPECIFICATION.md) · [统一消息类型](../pyutils/rpc_v2/UNIFIED_MESSAGE_TYPES.md)
- [RPC v2 架构分析](../pyutils/rpc_v2/RPC_V2_ARCHITECTURE_ANALYSIS.md) · [同步模式快速参考](../pyutils/rpc_v2/SYNC_MODE_QUICK_REFERENCE.md)
- [wsrpc 说明](../pyutils/wsrpc/README.md)

## 数据管线 (Pipelines)
- [媒体同步管线 MEDIA_SYNC_PIPELINE](pipelines/MEDIA_SYNC_PIPELINE.md) — 视频字幕同步(§1–§7)+ **书籍句子/词模型 v2(§8)**(pycore↔laravel_main :9000 幂等入库)
- [翻译缓存架构](../pyutils/translator/CACHE_ARCHITECTURE.md) · [第三方翻译集成](../pyutils/translator/THIRD_PARTY_INTEGRATION.md) · [罗马音/音标](../pyutils/translator/ROMANIZATION_PHONETIC.md)
- [Laravel↔MCP 桥目录扫描 OCR](../pyutils/mcp_bridge_with_laravel/SCAN_DIRECTORY_OCR_GUIDE.md)

## 设备/代码同步 (Code Sync)
- [代码同步网格 CODE_SYNC_MESH](../pyutils/device_sync/CODE_SYNC_MESH.md) · [统一架构](../pyutils/device_sync/UNIFIED_ARCHITECTURE.md)

## 子系统设计 (Subsystems)
- 浏览器自动化:[设计规范](../pyctl/pybrowserauto/PYBROWSERAUTO_DESIGN_SPEC.md) · [架构](../pyctl/pybrowserauto/ARCHITECTURE.md) · [API 参考](../pyctl/pybrowserauto/API_REFERENCE.md)
- 语音/AI:[架构总览](../pyctl/speech/ai/ARCHITECTURE_OVERVIEW.md) · [结构](../pyctl/speech/STRUCTURE.md) · [统一响应指南](../pyctl/speech/rpc/UNIFIED_RESPONSE_GUIDE.md)
- 原生 UI:[文档说明](../pyutils/native_ui/_docs/README.md) · [平台适配用法](../pyutils/native_ui/PLATFORM_ADAPTER_USAGE.md)
- Ultralytics GPU:[统一 GPU 系统](../pyutils/ultralytics/UNIFIED_GPU_SYSTEM_README.md)
- VOC 标注:[设计](../pyutils/voc_annotator/DESIGN.md)
- 库依赖确保 ensure_library:[使用指南](../pyutils/ensure_library/USAGE_GUIDE.md)
- pybrowser 会话:[Cookie 持久化](../pyutils/pybrowser/COOKIE_PERSISTENCE_GUIDE.md)

## 规范与报告 (Standards & Reports)
- [数据库类型标准](../database/DATABASE_TYPE_STANDARDS.md)
- [MCP 编码标准](../pyutils/mcp/MCP_CODING_STANDARDS.md)
- [pycore 规范合规分析报告](reports/COMPLIANCE_ANALYSIS.md)

## 包索引 (Package READMEs)
- [callmodule](../callmodule/README.md) · [database](../database/README.md) · [pyutils](../pyutils/README.md) · [pylauncher](../pylauncher/README.md)
- [pyctl/ai](../pyctl/ai/README.md) · [translator](../pyutils/translator/README.md) · [mcp](../pyutils/mcp/README.md) · [wsrpc](../pyutils/wsrpc/README.md)
