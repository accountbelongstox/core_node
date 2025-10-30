## Objective
Port repository contents (guided by core_node_tree.md) to a Java monorepo under D:\programing\core_node\cursor_fuck.

## Assumptions
- core_node_tree.md is unavailable; plan infers structure from current repo layout.
- No tests or docs will be generated beyond this plan unless explicitly requested.
- Keep code English-only and ASCII; production-oriented implementations.

## Target Monorepo Layout (Maven)
D:\programing\core_node\cursor_fuck\
- pom.xml (parent)
- core-platform\ (shared libs)
  - pom.xml
  - src\main\java\
    - com\core\node\foundation\ (from ncore/foundation)
    - com\core\node\utils\ (from ncore/utils)
    - com\core\node\globalvars\ (from ncore/global_vars)
    - com\core\node\db\ (port of ncore/db.js)
  - src\main\resources\

- mcp-adapter\ (wrapper/bridge for mcp_server)
  - pom.xml
  - src\main\java\com\core\node\mcp\

- devops-runner\ (CLI/tooling wrappers of scripts)
  - pom.xml
  - src\main\java\com\core\node\devops\

- apps\
  - ai-translator\ -> com\core\node\apps\aitranslator\
  - video-compression\ -> com\core\node\apps\videocompression\
  - voice-client\ -> com\core\node\apps\voice\
  - web-lan\ -> com\core\node\apps\weblan\

- integration\ (bindings for pycore and external tools)
  - pom.xml
  - src\main\java\com\core\node\integration\

## Mapping Rules
- Node/JS modules -> Java packages with equivalent API surfaces.
- PowerShell/bash automation -> Java Process-based runners in devops-runner.
- Config JSON/JS -> Java config classes + resources.
- Keep external assets (images, static) in resources with original paths mirrored.

## Porting Order (Phased)
1) core-platform (utils, foundation, globalvars, db) – unlocks dependencies.
2) devops-runner – enable operational parity for scripts.
3) mcp-adapter – provide minimal viable adapters.
4) apps (ai-translator, voice, web-lan, video-compression) – per app module.
5) integration – pycore and external tool bindings.

## Implementation Steps
1) Scaffold parent and modules (Maven), set Java 17+, common plugin management.
2) Create baseline packages and placeholder classes per mapping.
3) Incrementally port utilities (string, path, IO, env) needed by runners.
4) Implement ProcessRunner abstractions to invoke existing scripts where full ports are impractical.
5) Replace direct file-path literals with centralized PathResolver.
6) Provide CLI entrypoints per module (picocli or plain main methods).

## Constraints
- No unit tests unless explicitly requested.
- No non-ASCII content in code.
- Avoid introducing new third-party libs unless necessary.

## Deliverables (Phase 1)
- Parent pom.xml and module poms.
- core-platform package skeletons with minimal classes.
- devops-runner with ProcessRunner and EnvManager skeletons.

## Next Actions
- Confirm whether core_node_tree.md will be provided. If yes, align package names and module breakdown exactly per tree.

