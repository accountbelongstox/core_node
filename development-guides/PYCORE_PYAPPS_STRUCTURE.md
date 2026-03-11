# pycore vs pyapps: Public Class Libraries vs Sub-App Class Libraries

This document is the **canonical definition** of **公共类库 (public class libraries)** and **子app的类库 (sub-app class libraries)** in this repository. It is based on a direct scan of `pycore/` and `pyapps/`.

---

## 1. Definitions

| Term | English | Meaning |
|------|---------|--------|
| **公共类库** | Public class libraries | Shared libraries used by **multiple** apps. One copy, many consumers. Owned at repo level. |
| **子app的类库** | Sub-app class libraries | Code that belongs to **one** app only. Lives inside that app’s directory. Not shared across apps. |

---

## 2. Public class libraries (公共类库) = pycore

- **Location:** `pycore/` at repository root.
- **Scope:** All packages under `pycore/` (excluding `bak/`, `__pycache__`, and auxiliary folders like `scripts`, `static`, `_prompts`) are the public class libraries.
- **Consumers:** Any app under `pyapps/<app>/` may depend on pycore. Apps do **not** depend on each other.
- **.NET counterpart:** `dotcore/`. Each DotCore.* project is the .NET equivalent of the corresponding pycore capability (see [dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md](../dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md)).

**Scanned pycore top-level packages (public class libraries):**

| Package | Role |
|---------|------|
| callmodule | Module-call / RPC service host and routing. |
| database | DB layer, models, table registry, serialization. |
| pyadb | ADB-related utilities. |
| pyctl | Desktop/speech/MCP/browser automation control. |
| pydevice | Device info, server params. |
| pyfoundations | Base types, event bus, paths, system info, task models, third-party init. |
| pygvar | Global vars, constants, WS RPC constants. |
| pyheartbeat | Heartbeat protocol. |
| pylauncher | App launcher, singleton detector. |
| pythreadpool | Thread pool, registry, starters. |
| pyutils | Shared utilities: OCR, hotkey, clipboard, window ops, image tools, API, audio, config, etc. |

Anything under `pycore/<package>/` is **公共类库**. No app-specific logic belongs here.

---

## 3. Sub-app class libraries (子app的类库) = code under pyapps/<app>/

- **Location:** Under each `pyapps/<app>/` (e.g. `pyapps/d3-check/`, `pyapps/GameAISDK/`, `pyapps/speech_transcribe/`).
- **Scope:** All application-specific modules, UI, controllers, providers, utils, and data that are used **only by that app**. Not shared with other pyapps.
- **Dependency rule:** A sub-app may **depend on pycore** (公共类库). A sub-app must **not** depend on another pyapps app’s code.

**Example: d3-check sub-app class libraries (scanned):**

| Directory under pyapps/d3-check/ | Role (sub-app only) |
|----------------------------------|---------------------|
| controller | D3Check-specific controllers (ctl_func, d4func, training). |
| d3utils | D3Check-specific utils (collectors, history, kanai, rosbot_flow). |
| d4utils | D4-specific utilities for this app. |
| d4_modules | D4 feature modules for this app. |
| providor | Config, i18n, constants providers for D3Check. |
| share | Shared UI registry and values within D3Check. |
| ui | Panels, widgets, theme, components for D3Check. |
| config | Datasets and training config for this app. |
| lifecycle | App lifecycle and system init for D3Check. |
| runtime | Runtime state and setup for this app. |
| state | Application state for D3Check. |
| threads | App-specific thread management. |
| timers | App-specific timers. |
| utils | App-specific utilities (not pyutils). |
| data | App-specific data and assets. |
| docs | Design and requirement docs for this app. |

These are **子app的类库**: they belong to d3-check only. Other apps (e.g. GameAISDK, speech_transcribe) have their own directories and do not reference d3-check’s controller, d3utils, ui, etc.

---

## 4. Summary table

| Concept | Python | .NET | Who may depend on it |
|---------|--------|------|----------------------|
| 公共类库 | pycore/ | dotcore/ (DotCore.*) | Any app (pyapps/* or dotapps/*). |
| 子app的类库 | pyapps/<app>/… | dotapps/<App>/… | Only that app. |

---

## 5. References

- [development-guides/DOT_ARCHITECTURE.md](DOT_ARCHITECTURE.md) – Dot layout; dotcore = 公共类库.
- [dotcore/DESIGN.md](../dotcore/DESIGN.md) – DotCore project list.
- [dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md](../dotcore/DOT_PUBLIC_LIBRARY_PROGRESS.md) – pycore ↔ dotcore mapping and progress.
- [pyapps/d3-check/docs/DOT_D3CHECK_*.md](../pyapps/d3-check/docs/) – D3Check port requirements (use 公共类库 + 子app类库 as above).
