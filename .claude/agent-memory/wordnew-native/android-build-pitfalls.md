---
name: android-build-pitfalls
description: Capacitor/AGP build pitfalls for the wordnew native build - PS 5.1 Stop preference breaks java -version, AGP default build-tools applies to library modules, B2 build files ship as diffs
metadata:
  type: project
---

- `GlobalVars.ps1` sets `$ErrorActionPreference = "Stop"`. Under PowerShell 5.1, `& java -version 2>&1` then throws (java prints its version on stderr), so any major-version probe returns 0. Set `$ErrorActionPreference = "Continue"` inside the probe function (function scope only).
- AGP 8.13 uses build-tools 35.0.0 for every module that sets no `buildToolsVersion`, library modules included (capacitor-android, plugins). The only fix that covers them is the root `build.gradle` `subprojects { plugins.withId('com.android.application'/'com.android.library') { android.buildToolsVersion = rootProject.ext.buildToolsVersion } }` hook, with the value in `variables.gradle`.
- A Gradle configuration check needs no APK build: copy `native/wordnew/android` to the scratchpad, point `:capacitor-android` at a scratch copy of the module, and print `android.buildToolsVersion` from an init script in `gradle.projectsEvaluated` (`--offline --no-daemon`). Missing plugin dirs only cause deprecation warnings.
- `UI/scripts/*`, `UI/build_app.ps1` and the root build files are B2. Without a recorded writer, deliver a `git diff --no-index --no-prefix a b` handoff under `.claude/agents_shared/reports/` and check it with `git apply --check` from the repo root.
- A scratch run tree with junctions to `flavors/`, `apps/`, `node_modules/`, `config/`, `scripts/` runs the patched start scripts, but `build_apk.py` resolves entries through the junction and reports "entry source is missing"; that is a scratch artifact.

**Why:** these cost a debug round each in G2 (2026-09-27).

**How to apply:** check them before claiming a JDK/SDK prerequisite is missing, before pinning SDK versions, and when a UI build file needs a change.
