# pycore

`pycore` is the Python core library for this repository.

Before reading or changing anything under `pycore`, read:

- `development-guides/PYTHON_PYCORE.md`

That document is the primary development guide for `pycore` and defines the required architecture, layering, import rules, threading rules, and implementation constraints.

## Directory Role

`pycore` contains the shared Python runtime, infrastructure, services, and higher-level orchestration used by the project.

Common areas include:

- `pyfoundations`: lowest-level foundation modules
- `pyutils`: reusable utility packages
- `pyctl`: higher-level orchestration and wrappers
- `callmodule`: application-facing service entry and RPC-related integration
- `database`: database models and helpers
- `pylauncher`: launcher and startup flow
- `pythreadpool`: service thread registration and startup

## Development Rule

If you are implementing, refactoring, or reviewing code in `pycore`, use `development-guides/PYTHON_PYCORE.md` as the source of truth.
