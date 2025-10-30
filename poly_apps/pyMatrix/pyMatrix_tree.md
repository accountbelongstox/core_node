# Directory Tree: pyMatrix

Path: `D:\programing\core_node\poly_apps\pyMatrix`

```
pyMatrix/
├── core/
│   ├── adb/
│   │   ├── __init__.py
│   │   ├── adb_process.py
│   │   └── adb_types.py
│   ├── control/
│   ├── device/
│   │   └── server/
│   ├── group/
│   ├── render/
│   ├── stream/
│   └── __init__.py
├── resources/
│   └── adb/
│       └── windows/
├── tests/
├── ui/  # deprecated: legacy desktop UI (Qt/PyQt). Web is the active frontend.
├── utils/
├── 00_PROJECT_OVERVIEW.md
├── 01_ARCHITECTURE_DESIGN.md
├── 02_BACKEND_PYTHON_IMPLEMENTATION.md
├── 03_FRONTEND_NUXT_IMPLEMENTATION.md  # authoritative for Web frontend
├── 04_DEPLOYMENT_AND_INTEGRATION.md    # Python backend + Nuxt integration
├── 05_COMMUNICATION_SPECIFICATION.md
├── 06_WEB_ARCHITECTURE_SIMPLIFIED.md
├── 07_PYTHON_VS_NODE_PERFORMANCE_ANALYSIS.md  # Python backend retained
├── 08_CORE_LIBRARY_ARCHITECTURE.md
├── 09_PYCORE_MODULES_IMPLEMENTATION.md
├── 10_NEW_PROJECT_STRUCTURE.md
├── README.md
├── pyMatrix_tree.md
└── requirements.txt
```

---

Conflict resolution notes (latest decisions applied):

- Frontend: Web (Nuxt) is the authoritative frontend. Any conflicting Qt/PyQt desktop UI references are considered legacy. See `03_FRONTEND_NUXT_IMPLEMENTATION.md` and `04_DEPLOYMENT_AND_INTEGRATION.md`.
- Backend: Remains Python with PyAV/FFmpeg per `07_PYTHON_VS_NODE_PERFORMANCE_ANALYSIS.md` (Python chosen over Node.js for video processing workloads).
- Documentation set 00–10 is the canonical series for architecture and implementation. When discrepancies exist, prefer the Web-first approach described in 03/04 and the modular core separation in 08/09/10.