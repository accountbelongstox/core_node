# DotCore Architecture Design

Reference: **pycore** (multi-entry, shared libraries). This document defines the directory structure and project roles.

---

## 1. Design Principles

- **Multiple entry points**: Several runnable hosts (CLI, CallModule service, etc.).
- **Shared libraries**: Foundations (BCL-only), Common (constants/config), Utils, Infrastructure.
- **Dependency direction**: Hosts → Utils/Infrastructure → Common → Foundations. No reverse dependencies.

---

## 2. Directory Structure

```
dotcore/
├── DESIGN.md                    # This file
├── dotcore.sln
├── Directory.Build.props        # Shared MSBuild properties
├── Directory.Packages.props     # Central package versions (optional)
├── src/
│   ├── DotCore.Foundations/     # Base library, BCL/minimal deps only (pyfoundations)
│   ├── DotCore.Common/          # Constants, paths, global config (pygvar)
│   ├── DotCore.Utils/           # Shared utilities (pyutils common)
│   ├── DotCore.Infrastructure/  # DB, file, network abstractions (database, etc.)
│   └── Hosts/
│       ├── DotCore.Cli/         # Console multi-command entry (python -m pycore)
│       └── DotCore.Host.CallModule/  # Service entry (callmodule)
└── tests/
    └── DotCore.Foundations.Tests/
```

---

## 3. Project Roles

| Project | Role | Depends on | Pycore analogue |
|---------|------|------------|-----------------|
| **DotCore.Foundations** | Color output, event bus, commander, base types. **No third-party packages.** | (none) | pyfoundations |
| **DotCore.Common** | App name, paths (cache/tmp/public), global constants. | Foundations | pygvar |
| **DotCore.Utils** | Shared utilities (logging, file, helpers). May use third-party. | Foundations, Common | pyutils (common) |
| **DotCore.Infrastructure** | Database, external I/O, optional integrations. | Foundations, Common | database, pyutils parts |
| **DotCore.Cli** | Console host: multi-tool routing (e.g. `dotcore tool-name --args`). | Foundations, Common, Utils | pycore/__main__.py |
| **DotCore.Host.CallModule** | HTTP/WebSocket service host (e.g. port 59000). | Foundations, Common, Utils, Infrastructure (optional) | callmodule |

---

## 4. Adding New Entries or Libraries

- **New host**: Add `src/Hosts/DotCore.Host.<Name>/` and reference required libs; add project to solution.
- **New shared lib**: Add `src/DotCore.<Name>/`, follow dependency rule (no dependency on Hosts or higher-level libs than needed), add to solution.

---

## 5. Build

From repo root or `dotcore/`:

```bash
dotnet build dotcore/dotcore.sln
dotnet run --project dotcore/src/Hosts/DotCore.Cli/DotCore.Cli.csproj -- tool-name
dotnet run --project dotcore/src/Hosts/DotCore.Host.CallModule/DotCore.Host.CallModule.csproj -- --port 59000
```
