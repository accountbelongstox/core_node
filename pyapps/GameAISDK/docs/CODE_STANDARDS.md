# GameAISDK code standards (key points)

- **Imports:** At file top only. Platform-specific imports allowed once guarded (e.g. `if sys.platform == 'win32':`). Fix circular imports by structure, not lazy import in except.
- **No import in except:** Do not put or move imports inside try/except.
- **Exceptions:** Catch concrete types (IOError, OSError, ValueError, etc.). Handlers must log and re-raise or return a clear result; no no-op catch.
- **Language:** Code, comments, docstrings, logs in English. UI strings and config keys unchanged.
- **Third-party:** Use `pycore.pyfoundations.third_party` getters (e.g. `get_third_package_cv2`); call at top level.
- **pycore sys.path:** Before any pycore import, add the path that contains the `pycore` package to `sys.path` (e.g. walk up from `__file__` until a dir containing `pycore` exists, then `sys.path.insert(0, _dir)`). Required so imports resolve when running from sub-app or tool entry points.
- **Docs:** Key points only; no filler.

Rule file: `.cursor/rules/game-aisdk.mdc`.
