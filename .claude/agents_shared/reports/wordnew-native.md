# wordnew-native report

## wordnew-native-G2 (2026-09-27, diff base 74e7770)

| Item | Status | Files written | Pending elsewhere |
|---|---|---|---|
| WNN-05 prerequisite gaps + entry parity | done in scope; the B2 half is a verified diff | `scripts/shells/win/win_common/AndroidBuildEnv.ps1`, `scripts/shells/win/install_powershells/Step62_InstallAndroidSdkPackages.ps1`, `scripts/shells/linux/common/android_build_env.sh`, `scripts/shells/linux/debian/install_shells/187_install_android_sdk.sh`, `native/wordnew/android/{build.gradle,variables.gradle}` | B2 writer applies `.claude/agents_shared/reports/wordnew-native-G2-b2.diff` (build_app.ps1, scripts/start_build.ps1, scripts/start_build.sh, scripts/flavor/flavor_build.py) |
| WNN-06 readiness verification | done on Windows; the Linux runs are deferred | this report | the Linux runs, after core-node-e9 reports done (commands below) |

Paths relative to `poly_apps/pycore_laravel_wordnew_ui/` (UI) unless they start with `scripts/` or `.claude/`. The user's sweep commits `93f8de054` (21:48:43) and `5e0eb3dc7` already contain my direct edits; I ran no git writes. Review against 74e7770.

### Decisions (B9: I took the recommended option in each case)
- **B2 files as a diff.** The item names four UI files and says they "need the B2 assignment". REQUIREMENTS §6 and `d22/merge_meta.json` record no B2 writer for them. So, as in G1, I did not edit them. The change is `.claude/agents_shared/reports/wordnew-native-G2-b2.diff` (705 lines, CRLF kept for the CRLF files).
  - `git apply --check` passes from the repo root.
  - `patch --binary -p1` on a copy of the current files gives byte-identical results: build_app.ps1 `99faadc8…`, start_build.ps1 `5d413552…`, start_build.sh `63e06ac8…`, flavor_build.py `af842baa…`.
  - The base copies equal the current tree (`cmp`).
  - The diff is independent of the G1 build_apk.py diff (no shared file), so the two can land in either order.
- **"Android platform directory"** is the Capacitor platform `native/<app>/android`. The SDK platform `platforms;android-36` was already gated by `android.jar`.
  - The new check lists missing `gradlew(.bat)`, wrapper jar/properties, `app/build.gradle` and `capacitor.settings.gradle`.
  - In `start_build -Check` it is informational, not a blocker, because build_apk.py repairs it (`cap add android`, `cap sync`, and the G1 wrapper ensure).
- **build_app.ps1 -Sync** now runs build_apk.py's full Android flow, the same as -Apk (which ends with Gradle). I did not add a sync-only mode, because build_apk.py is outside this item and has the pending G1 diff. `-Platform ios` is refused, as in start_build.
  - The web path (flavor prep plus vite) stays Windows-only, as a thin wrapper over the shared flavor_build.py. It now uses build_apk.py's runner, `bun x vite build`.
  - The delegation now exits with build_apk.py's exit code. Before, it returned 0 even when the build failed.
- **Build-tools pin (F1).** Every Android module is pinned to the installers' constant 36.0.0 through a root `build.gradle` hook, and the value is in `variables.gradle`. I did not move the installers to AGP's default 35.0.0. A pin in `app/build.gradle` alone would leave the library modules on 35.0.0 (proved below).
- **F5 (Linux gvar gates).** start_build.sh names the gate (`INSTALL_JAVA` / `INSTALL_ANDROID_SDK` = false) in its final error. It never flips the gate, because the gate is the user's dd configuration. 187 reads its gate through the library constant.
- **Check modes.**
  - Step62 `-Check` and 187 `--check` report only and always end normally ("no exit codes for return values").
  - `start_build -Check/--check` keeps the script's single exit point: 0 when every prerequisite is ready, 1 otherwise.
  - The license pass is gated on `licenses/android-sdk-license`. Package installs still accept licenses inline.
- **flavor_build.py** now rewrites `capacitor.config.json` and `resources/icon.*` only when their content differs. It writes LF on every OS, because the dual-boot tree is shared. The first Windows run rewrites the ignored `capacitor.config.json` once, from CRLF to LF.

### WNN-05 changes and parity

| # | Change | Windows | Linux | Parity |
|---|---|---|---|---|
| P1 | JDK resolver takes the first candidate with major ≥ 21 (the Linux resolver used to stop at the first valid home, e.g. a JDK 17 JAVA_HOME) | `Resolve-AndroidBuildJavaHome` (already did this) | `android_build_resolve_java_home`; PATH java resolved with `readlink -f` | aligned |
| P2 | The java major probe survives the `Stop` preference | `Get-AndroidBuildJavaMajor` sets a local `$ErrorActionPreference = "Continue"` | none | platform-only: in PS 5.1, stderr under 2>&1 becomes a terminating error. `GlobalVars.ps1:2` sets Stop, so every Windows JDK check returned major 0. Bash has no equivalent |
| P3 | License pass gated on `licenses/android-sdk-license` | `Test-AndroidBuildSdkLicensesReady`, Step62 | `android_build_sdk_licenses_ready`, 187 | aligned |
| P4 | Report-only check mode | Step62 `-Check` | 187 `--check` (it also reports the gate) | aligned |
| P5 | Node toolchain detector (node, npx, bun; build_apk.py needs npx) | `Get-AndroidBuildMissingNodeCommands` | `android_build_missing_node_commands` | aligned |
| P6 | Node deps markers: vite, `@capacitor/cli`, `core`, `android` | `Get-AndroidBuildMissingNodeDeps` | `android_build_missing_node_deps` | aligned |
| P7 | Capacitor platform dir markers | `Get-AndroidBuildMissingPlatformFiles` (`gradlew.bat`) | `android_build_missing_platform_files` (`gradlew`) | aligned (the wrapper name differs per OS) |
| P8 | dd install gate reader and names (`ANDROID_BUILD_{JAVA,SDK}_GATE`) | none | `android_build_install_gate`; 187 uses it | platform-only: Windows dd steps have no INSTALL_* gvar gates |
| P9 | cmdline-tools temp dir created only when downloading | Step62 already uses `DOWNLOADS_DIR` only in that branch | 187 (keeps `--check` write-free) | aligned |
| P10 | buildToolsVersion 36.0.0 for app and library modules | `native/wordnew/android` (one Gradle project for both OSes) | same | shared file |
| D1 (diff) | Python step names (F4) | `Step8_InstallDefaultPython.ps1` | `13_install_default_python.sh` | aligned |
| D2 | Node toolchain gate is node+npx+bun, and node deps use the P6 markers (was vite only) | start_build.ps1 | start_build.sh | aligned |
| D3 | `-Check` / `--check` readiness (P5–P7 plus JDK/SDK; runs the step's check mode when the SDK is incomplete) | start_build.ps1 | start_build.sh | aligned |
| D4 | Option names | `-DebugApk`, `-ReleaseApk`, alias `-SkipApkAssets`, alias `-CleanApk` | `--skip-assets`, `--clean` | aligned (table below) |
| D5 | Gate note in the final error (F5) | none | `gate_note` | platform-only (as P8) |
| D6 | -Sync delegates to build_apk.py, `bun x vite`, exit code propagated, iOS refused (F3) | build_app.ps1 | none | platform-only: build_app.ps1 is a Windows convenience wrapper. The build truth (build_apk.py, flavor_build.py) is shared, and Linux reaches it through start_build.sh |
| D7 | Idempotent, LF flavor prep | flavor_build.py (shared) | same | shared file |

Option parity after the diff (both scripts accept both spellings):

| Windows | Linux |
|---|---|
| `-App` | `--app`, `--app=` |
| `-List` | `--list` |
| `-Check` | `--check` |
| `-BuildType ask\|debug\|release` | `--build-type`, `--build-type=` |
| `-DebugApk` / `-ReleaseApk` | `--debug-apk` / `--release-apk` |
| `-Platform android\|ios` | `--platform`, `--platform=` |
| `-SkipAssets` (alias `-SkipApkAssets`) | `--skip-apk-assets`, `--skip-assets` |
| `-Clean` (alias `-CleanApk`) | `--clean-apk`, `--clean` |
| `-NoOpenOutput` | `--no-open-output` |
| `-NonInteractive` | `--non-interactive` |
| `-ForceInstall` (`-f` by prefix) | `-f`, `--force-install` |

WNN-05 verification:
- PowerShell Parser: 0 errors on AndroidBuildEnv.ps1 and Step62 (tree), and on the patched start_build.ps1 and build_app.ps1 (scratch).
- `bash -n` (GNU bash 5.2.37) passes on android_build_env.sh, 187 and the patched start_build.sh.
- `python -m py_compile` passes on the patched flavor_build.py.
- Changed PowerShell files are ASCII. The tree files keep their line endings (LF for the four prerequisite scripts, CRLF for the gradle files). The patched build_app.ps1 no longer has the em-dash and emoji, which PS 5.1 printed as mojibake.
- Linux library, in Git Bash with `CORE_NODE_CACHE_DIR` set so that gvar_common.sh is not sourced:
  - JAVA_HOME = a fake JDK 17 and a fake JDK 21 on PATH: the new resolver gives home = fake_jdk21, major 21, ready. The 74e7770 resolver gives fake_jdk17, major 17, not ready.
  - Missing-list detectors: `[]` for the UI root and `native/wordnew/android`. All markers are listed for a scratch root and for `native/codemart/android`.
  - The gate reader gives `[]` without the gvar store. The license gate is yes for the real SDK root and no for an empty root.
- Windows library (detectors_check.ps1 under GlobalVars): node commands `[]`, UI deps `[]`, wordnew platform `[]`, codemart platform = all five markers, java ready (`D:\.dev_win10\Java21`), caller preference still `Stop`, SDK and licenses ready.
- Fenced files: none of my changed files is fenced. `git diff 74e7770 --name-only` lists gvar_common.sh, gvar_storage_common.sh, mount_common.sh, pyservice_entry.sh, shared_cache_env.sh and SharedCacheEnv.ps1, but those changes are core-node-e9's work and none is mine.

### WNN-06: readiness verification

| # | Command | Exit | Result |
|---|---|---|---|
| 0 | free RAM | — | 1.48 GB (21:27; static checks only at that point), 3.41 GB (21:49), 4.47 / 3.63 / 3.27 GB right before each Gradle run (21:50:54, 21:51:51, 21:53:13), 4.37 GB (21:57) |
| 1 | `python scripts/flavor/flavor_build.py --app wordnew --root UI` (tree, current script), run 1 | 0 | `capacitor.config.json` sha256 `7ed5ec47…` and `resources/icon.svg` `b429d9bf…` unchanged; mtime rewritten |
| 2 | the same, run 2 | 0 | same hashes. `git status` on `resources/` and `capacitor.config.json` is clean. The config matches `flavors/wordnew/flavor.json`: appId `com.corenode.wordnew`, appName `WordNew`, backgroundColor and splash `#0f172a`, webDir `dist`. `android.path` is `native/wordnew/android` and the dir exists. `app/build.gradle` namespace and applicationId are the same id |
| 3 | patched flavor_build.py twice on a scratch root (copy of flavors/wordnew, the config, icon.svg, plus stale icon.png and splash.png) | 0, 0 | run 1: "wrote" config (CRLF→LF), removed the stale icon.png and splash.png, icon.svg "unchanged". Run 2: both "unchanged", with the same mtime and sha256 (`4b9b7efc…`). The JSON equals the tree's apart from CRLF |
| 4 | `python scripts/flavor/build_apk.py --root UI --list` | 0 | `codemart CodeMart com.core-node.codemart`, `wordnew WordNew com.corenode.wordnew`, skipped shell and vortex (Android is not enabled) |
| 5 | `scripts/start_build.ps1 -List` (tree) | 0 | the same list; no step invoked |
| 6 | `Step62_InstallAndroidSdkPackages.ps1 -Check` (tree) | 0 | JDK 21+ `D:\.dev_win10\Java21`, SDK root `C:\Users\mpc\AppData\Local\Android\Sdk`, and cmdline-tools, licenses, platform-tools, android-36, build-tools 36.0.0 and ANDROID_HOME are all ready. Before the P2 fix, the same run reported "JDK 21+ missing" (a false negative) |
| 7 | Step62 `-Check` with `ANDROID_HOME`/`LOCALAPPDATA` pointed at a scratch SDK that has only adb | 0 | missing: cmdline-tools, licenses, platform, build-tools; the scratch SDK is unchanged afterwards |
| 8 | patched `start_build.ps1 -Check -App wordnew` (scratch run tree, junctions to the real dirs) | 0 | node toolchain, python, node deps, JDK, SDK and platform dir are ready; "all build prerequisites are ready"; nothing is invoked |
| 9 | patched `start_build.ps1 -Check -App codemart -SkipApkAssets -CleanApk -DebugApk` | 0 | aliases bind; platform dir reported (informational) as missing all five markers |
| 10 | patched `start_build.ps1 -List` (scratch) | 0 | build_apk.py reached. Entries show as skipped only because `resolve()` follows the scratch junctions out of the scratch root |
| 11 | patched `build_app.ps1 -List` / `-Sync -App nope -NonInteractive` / `-Sync -App wordnew -Platform ios` | 0 / 2 / non-zero | flavor list; build_apk.py reached and its exit 2 propagated; iOS refused before any command |
| 12 | Gradle configuration check (scratch copy of `native/wordnew/android` with the tree's build.gradle, variables.gradle and app/build.gradle, a scratch copy of `@capacitor/android`, init script printing `android.buildToolsVersion`; `gradlew --offline --no-daemon help`, Gradle 8.14.3 / AGP 8.13.0) | 0 | pinned: `:app`, `:capacitor-android` and `:capacitor-cordova-android-plugins` all at 36.0.0. Baseline (hook and ext removed): all three at 35.0.0. With `--warning-mode all`, the only warnings are for the scratch copy's missing plugin dirs. The first attempt exited 1 because my trimmed settings dropped plugin projects; it was a scratch setup error and was fixed |
| 13 | debug APK build | not run | the configuration check (12) confirmed the Gradle configuration, so no APK build was needed. No release build |
| 14 | Linux: `start_build.sh --list`, `187_install_android_sdk.sh --check`, patched `start_build.sh --check --app wordnew` in Debian WSL | deferred | no "done" report from core-node-e9 reached me. At 21:57 it was idle, and its fenced files were committed in `5e0eb3dc7`, but that is not a report. Only `bash -n` and the gvar-free library tests ran |

Deferred Linux commands, to run from `/www/programing/core_node` (or the WSL mount of D:) once core-node-e9 reports done:
- `bash poly_apps/pycore_laravel_wordnew_ui/scripts/start_build.sh --list` (expect exit 0 and the list in row 4);
- `bash scripts/shells/linux/debian/install_shells/187_install_android_sdk.sh --check` (report only; exit 0);
- after the diff lands: `bash poly_apps/pycore_laravel_wordnew_ui/scripts/start_build.sh --check --app wordnew`.

Scratch: `scratchpad/wnn_g2/` holds a/ (base), b/ (patched), apply_test/, flavor_root/, gradle_bt/ and fake JDK/SDK dirs. The run-tree junctions were removed link-only with `[IO.Directory]::Delete`. No Gradle JVM is left running.

### Cross-scope and next owners
- orchestrator: assign the B2 writer for `build_app.ps1`, `scripts/start_build.ps1`, `scripts/start_build.sh` and `scripts/flavor/flavor_build.py`. My recommendation is wordnew-native, with pycore-ui as the fallback. The writer applies it from the repo root with `git apply .claude/agents_shared/reports/wordnew-native-G2-b2.diff` and checks the four sha256 values above.
- The same B2 writer: `flavors/README.md` still documents `-App vortex -Native -Sync -Platform android` and `npm install` / `npx cap sync`. After the diff, -Sync goes through build_apk.py, which refuses flavors whose `platforms` lack android (vortex).
- Still open from G1: the build_apk.py diff (F6), the `.gitignore` wrapper negation (F7), WNN-signing-key, and F2 (commit the regenerated `capacitor.settings.gradle` after the next `cap sync`).
- wordnew-lead: verdict wordnew-native-G2, and the Linux runs of WNN-06 once core-node-e9 reports done (or re-dispatch them to me).

## wordnew-native-G1 (2026-09-27, diff base 74e7770)

| Item | Status | Files written | Pending elsewhere |
|---|---|---|---|
| WNN-01 audit | done | this report | follow-ups F1-F7 below |
| WNN-02 release signing | done (build.gradle landed); the build_apk.py part is a verified diff | `native/wordnew/android/app/build.gradle` | pycore-ui applies `.claude/agents_shared/reports/wordnew-native-build_apk.diff` |
| WNN-03 wrapper repair | done as a verified diff (build_apk.py only) | none in the tree | the same diff; WNN-03-commit (.gitignore negation + user commit) |
| WNN-04 single version | done (build.gradle landed); the resolver is in the same diff | `native/wordnew/android/app/build.gradle` | the same diff |

Paths below are relative to `poly_apps/pycore_laravel_wordnew_ui/` (UI) unless they start with `scripts/`, `.gitignore` or `.claude/`.

### Decisions (B9: I took the recommended option in each case)
- **build_apk.py writer.** No B2 temporary-writer assignment for `UI/scripts/flavor/build_apk.py` exists. I checked REQUIREMENTS §6, TASKS.md and the wordnew-lead report. The file is in the B2 shared layer (`UI/scripts`) and builds every flavor, so I did not edit it.
  - The complete change is `.claude/agents_shared/reports/wordnew-native-build_apk.diff` (216 lines, CRLF kept, paths relative to the repo root).
  - `patch --dry-run` applies it cleanly to the current file (sha256 `258faada…`). The result is byte-identical to the verified copy (sha256 `7681c09e…`).
  - Next owner: pycore-ui, or wordnew-native if the orchestrator assigns it as the B2 writer.
- **Interim state.** build.gradle applies versionName and versionCode only when the Gradle properties are present. So until the diff lands, the unpatched build_apk.py builds APKs with no versionName and versionCode 0 (previously 1/"1.0"). Release builds stay unsigned, as they were. The diff and build.gradle should land together.
- **Gradle contract.** Both files use the same names.
  - Non-secret properties go on argv: `-PcoreNodeVersionName`, `-PcoreNodeVersionCode`.
  - Signing values go only through the process environment: `CORE_NODE_ANDROID_SIGNING_STORE_FILE`, `CORE_NODE_ANDROID_SIGNING_STORE_PASSWORD`, `CORE_NODE_ANDROID_SIGNING_KEY_ALIAS`, `CORE_NODE_ANDROID_SIGNING_KEY_PASSWORD`.
  - I chose Gradle-side names that differ from the secret names because `get_secret_key` step 0 reads an env var with the secret's own name. Reusing those names would mix up the base64 keystore and the temp-file path.
- **Secret names.** They follow the pattern `<APP_ID>_ANDROID_{KEYSTORE,KEYSTORE_PASSWORD,KEY_ALIAS,KEY_PASSWORD}_1`, where APP_ID is upper-cased and `-` becomes `_`. For wordnew that gives the B9 names.
  - The reader is the existing `pycore.pyfoundations.secret_manager.get_secret_key`. It is imported lazily for release builds only, so debug builds do not depend on pycore. It is stdlib-only and imports in 0.84 s.
- **Keystore check.** The existing reader returns only the first non-empty line, so a wrapped base64 keystore (from `base64` without `-w0`, or from `certutil`) would be silently truncated.
  - `keystore_is_complete` accepts the JKS/JCEKS magic, or a PKCS12 DER SEQUENCE whose outer length matches the data length.
  - A truncated or garbled value stops the build with the secret's name, never its value.
- **Fail fast.** The signing secrets are read right after the build type is resolved: before any prompt, before flavor_build.py, before vite and before Gradle. So a missing secret has no side effects.
- **versionCode derivation.** `MAJOR*1000000 + MINOR*1000 + PATCH`, with MINOR and PATCH ≤ 999 and 1 ≤ code ≤ 2100000000 (the Play limit). The version must be strictly `MAJOR.MINOR.PATCH`. The formula is in `--version-info --help`.
  - Behaviour change: a flavor whose `version` is invalid now stops for debug builds too, where it used to fall back to `0.0.0`. Today every Android flavor (codemart, wordnew) has version 1.0.0.

### WNN-01: Capacitor build readiness audit (read-only)

| Area | Status | Evidence (file:line) | Note / fix owner |
|---|---|---|---|
| capacitor.config.json generation | done | Generated by `scripts/flavor/flavor_build.py:47-66`, called from `build_apk.py:199-200` and `build_app.ps1:117`. The current file matches: `capacitor.config.json:2` appId `com.corenode.wordnew` (`flavors/wordnew/flavor.json:5`), `:4` webDir `dist`, `:9-11` android.path `native/wordnew/android`. It is untracked (`UI/.gitignore:27`). | none |
| AGP / Gradle / SDK levels | done | `native/wordnew/android/build.gradle:10` AGP 8.13.0 and `:11` google-services 4.4.4; `gradle/wrapper/gradle-wrapper.properties:3` Gradle 8.14.3; `variables.gradle:2-4` min 24 / compile 36 / target 36; `app/capacitor.build.gradle:5-6` Java 21. Root build.gradle, variables.gradle and the wrapper are byte-identical to the installed `@capacitor/cli` 8.5.1 `android-template.tar.gz` (`@capacitor/core`/`android` 8.5.1). They match `scripts/shells/win/win_common/AndroidBuildEnv.ps1:15-17` and `scripts/shells/linux/common/android_build_env.sh:20-22` (JDK 21, API 36, build-tools 36.0.0). | none |
| build-tools used by AGP | conflict | AGP 8.13.0's default build-tools is 35.0.0 (`ToolsRevisionUtils` in the cached `builder-8.13.0.jar`), and `app/build.gradle` sets no `buildToolsVersion`. The installers ensure only 36.0.0 (`Step62_InstallAndroidSdkPackages.ps1:120-125`, `187_install_android_sdk.sh:115-119`), so the first build auto-downloads 35.0.0, which needs network and a writable SDK. This machine already has 35.0.0. | F1 (wordnew-native): pin `buildToolsVersion` from a `variables.gradle` ext equal to ANDROID_BUILD_TOOLS |
| capacitor.settings.gradle | conflict | `native/wordnew/android/capacitor.settings.gradle:3-60` is tracked and generated, but still points at `node_modules/.pnpm/...@8.4.2`. `node_modules` is the bun layout (no `.pnpm`; migration in `scripts/start_build.ps1:119-125`, `.sh:98-101`). `build_apk.py:220` (`cap sync`) regenerates it before Gradle, so builds work, but each build dirties a tracked file, and opening the project in Gradle/Android Studio without a sync fails. | F2 (user commit after the next sync) |
| Plugin majors | note | `package.json:14` `@capacitor-community/speech-recognition` ^7.0.1 and `:36` `capacitor-voice-recorder` ^7.0.6 are Capacitor 7 plugins, with peer `@capacitor/core >=7.0.0`, running on core 8.5.1. The peer range allows it. `:capacitor-local-notifications` needs `kotlin-gradle-plugin:2.0.21`, which is not in the offline Gradle cache, so the first build needs network. | watch at the first full build |
| Build entries / single truth | done, with a conflict | APK: `build_app.ps1:72-84` (-Apk), `scripts/start_build.ps1:225-235` and `scripts/start_build.sh:249-259` all delegate to `scripts/flavor/build_apk.py`, so it is the single APK build truth, and `package.json` has no competing Capacitor script. Conflict: the `build_app.ps1:109-147` -Native -Sync path is a second web-build and sync flow with no Gradle: `npx vite build` (:124) vs `bun x vite build` (`build_apk.py:205`); unpinned `npx @capacitor/assets generate` without `--assetPath`/colors (:135) vs pinned `@capacitor/assets@3.0.5` (`build_apk.py:214-219`); and a failed sync is only warned (:141). It is Windows-only. | F3 (B2 root build file, pycore-ui): delegate -Sync to build_apk.py or retire it |
| Python step reference | conflict | `scripts/start_build.ps1:66` (and the comment at :7) names `Step8_InstallPython.ps1`, but the file is `Step8_InstallDefaultPython.ps1`. `scripts/start_build.sh:35` names `13_ensure_python.sh`, but the file is `13_install_default_python.sh`. When python is missing, the step logs "not found" (`.ps1:97-99` / `.sh:83-85`) and the build stops (`.ps1:166-168` / `.sh:191-193`). | F4: one-line path fixes on both sides (UI/scripts, B2 writer) |
| JDK 21 prerequisite | done | Windows: `start_build.ps1:185-196` runs Step21 `-ExactPackageName Java` (`scripts/shells/win/win_common/ApplicationsList.ps1:405-406` `Oracle.JDK.21`). Linux: `start_build.sh:209-220` runs `92_install_java.sh:17-29` (Temurin 21.0.1 → `$COMPILE_DIR/java`). The central detectors require major ≥ 21 (`AndroidBuildEnv.ps1:57-99`, `android_build_env.sh:48-82`). The vendors differ (Oracle vs Temurin), which is fine at the major gate. Local JDK: `D:\.dev_win10\Java21`. | none |
| SDK prerequisite | done | `start_build.ps1:198-209` runs Step62, and `start_build.sh:222-233` runs 187. Both install cmdline-tools 14742923, licenses, platform-tools, `platforms;android-36` and `build-tools;36.0.0` from the central constants. SDK root resolution: `AndroidBuildEnv.ps1:115-131` and `android_build_env.sh:94-105`. | see F1 |
| Node deps | done | bun via Step4 / `17_install_node_toolchain_26.sh` (`start_build.ps1:152-161`, `.sh:173-185`); `bun install` gated on `node_modules/vite/bin/vite.js` (`.ps1:112-140`, `.sh:93-114`). `npx` (node) is needed by `build_apk.py:198`. `@capacitor/assets` is not a dependency: `npx --yes` downloads it on every build (network). | none |
| gvar install gates | note | `start_build.sh:174-175` forces the gvar `INSTALL_NODE=true`, but `92_install_java.sh:44-46` and `187_install_android_sdk.sh:36-37` exit early when `INSTALL_JAVA` / `INSTALL_ANDROID_SDK` are `false`, so the build then stops with "JDK 21+ still missing" and gives no reason. Windows has no such gate. | F5 (Linux-only gap; shell-linux or wordnew-native) |
| Release signing | missing at 74e7770 (fixed by WNN-02) | `app/build.gradle:19-23` at 74e7770: the release block has no signingConfig, so `assembleRelease` makes `app-release-unsigned.apk`. `build_apk.py:127-140` copies it as `wordnew-<ver>-release.apk`, which cannot be installed. The secret store has no `WORDNEW_ANDROID_*` entry in `.secret_keys/.secret_ignore/` or `already_encrypted/`. Keystores are ignored by `.gitignore:117,348-349` (`**/*.jks`, `**/*.keystore`); the native `.gitignore:57-58` lines are commented but covered by the root rules. | deferred WNN-signing-key (the user creates and stores the keystore) |
| Gradle wrapper | conflict (repair via WNN-03) | `.gitignore:442` `**/android/gradle/`, `:445` `poly_apps/**/android/gradle/` (the `git check-ignore` match) and `:200` `**/*.jar` all ignore the wrapper, although the comment at `:440` says gradle-wrapper.properties should be committed. The local jar and properties exist and are byte-identical to the Capacitor 8.5.1 template (sha256 `7d3a4ac4…` / `9a479a85…`). `gradlew` and `gradlew.bat` are tracked. | WNN-03-commit: add after `:446` `!poly_apps/pycore_laravel_wordnew_ui/native/*/android/gradle/` and `!poly_apps/pycore_laravel_wordnew_ui/native/*/android/gradle/wrapper/gradle-wrapper.jar`, then the user commits |

#### Windows / Linux parity (build entry; the shell ledgers stay with the shell roles)

| Step | Windows (`scripts/start_build.ps1`) | Linux (`scripts/start_build.sh`) | Status |
|---|---|---|---|
| Arguments | `-App -List -BuildType -Platform -SkipAssets -Clean -NoOpenOutput -NonInteractive -ForceInstall` (:25-46) | `--app --list --build-type/--debug-apk/--release-apk --platform --skip-apk-assets --clean-apk --no-open-output --non-interactive --force-install` (:117-149) | aligned |
| Central constants / detectors | `AndroidBuildEnv.ps1:15-19, 36-160` | `android_build_env.sh:20-24, 33-140` | aligned |
| node + bun | Step4 (:152-161) | 17 (:173-185), plus the `INSTALL_NODE` gvar write | aligned (see F5) |
| python | `Step8_InstallPython.ps1` (:66), a wrong name | `13_ensure_python.sh` (:35), a wrong name | both broken (F4) |
| deps (bun, pnpm cutover) | :112-140 | :93-114 | aligned |
| JDK 21 | Step21 Java (:185-196) | 92 (:209-220) | aligned (vendor differs) |
| SDK | Step62 (:198-209) | 187 (:222-233) | aligned (see F1) |
| Proxy → JAVA_TOOL_OPTIONS | `Set-AndroidBuildJavaProxy` (:220) | `android_build_set_java_proxy` (:244) | aligned |
| iOS | refused with a macOS note (:146-149) | refused (:159-170) | aligned |
| Build | `build_apk.py` (:225-235) | `build_apk.py` (:249-259) | aligned |
| Extra Windows entry | `build_app.ps1` (-Apk delegates; -Sync is a parallel flow) | none | platform-only / F3 |

### WNN-02: release signing from the secret store
- Landed: `native/wordnew/android/app/build.gradle` (CRLF and mode 100755 kept; +29/-2 vs 74e7770).
  - `:5-11` reads the four `CORE_NODE_ANDROID_SIGNING_*` env values through `providers.environmentVariable`.
  - `:33-42` creates `signingConfigs.release` only when all four are present, and `:47-49` applies it to release only in that case.
  - Debug is untouched. It uses Groovy assignment syntax, so Gradle reports no deprecation.
- Diff (build_apk.py):
  - `read_release_signing` (patched :208) resolves the four secret names, reads them with the existing reader, lists the missing ones, and decodes and checks the keystore.
  - `release_signing_environment` (:233-248) writes the keystore to `tempfile.mkstemp` in the system temp dir (0600 on POSIX; refused if the temp dir is inside the repo), yields the env for the assemble call only, and removes the file in `finally`.
  - `main` calls it at :323 (fail fast) and :365-367 (Gradle only).
  - Values never go on argv or into a log; `run()` logs argv only.
- Verification:
  - `python -m py_compile` on the patched copy: PY_COMPILE_OK. The same passes on Debian 13 WSL (Python 3.13.5).
  - Secrets absent, `build_apk.py --root UI --app wordnew --build-type release --non-interactive --assets no --clean no --open no`: exit 2, with zero `Running:` lines (no flavor prep, vite or Gradle). `capacitor.config.json` mtime is unchanged. The output:
    `[apk] ERROR: Release signing secrets are missing: WORDNEW_ANDROID_KEYSTORE_1, WORDNEW_ANDROID_KEYSTORE_PASSWORD_1, WORDNEW_ANDROID_KEY_ALIAS_1, WORDNEW_ANDROID_KEY_PASSWORD_1. Put them in .secret_keys/.secret_ignore/ (the keystore as single-line base64), or decrypt them with the dd.sh / dd.cmd step [SECRETS] ensure_secret_keys_ready. Debug builds need no signing secrets.`
    The same result on Debian WSL (exit 2).
  - Function checks (scratchpad throwaway PKCS12 and JKS from keytool, supplied through the reader's env fallback, never the store). On Windows (temp `D:\.tmp`) and on Debian (`/tmp`):
    - one secret missing: stops and names only it;
    - the first line of wrapped base64, or a certutil header: stops with "not a complete keystore";
    - PKCS12 and JKS: the temp file is outside the repo and byte-identical, the env has 4 values, and the file is removed after the block and after a failure inside it.
  - Gradle (scratch copy with the plugins trimmed, because the offline cache lacks kotlin-gradle-plugin 2.0.21; free RAM 3.58-4.84 GB; `--offline --no-daemon`):
    - no env: `releaseSigningConfig=null`;
    - three of four: `null`;
    - all four: `release`, `storeFile=throwaway.p12`, and `:app:validateSigningRelease` BUILD SUCCESSFUL;
    - no deprecation warnings.
  - `git diff 74e7770` of build.gradle and the diff file contain no keystore, password or alias literal (grep exit 1).
- Deferred: WNN-signing-key (the user creates the keystore and stores the four secrets). Store the keystore as single-line base64: `base64 -w0 release.jks` (Linux) or `[Convert]::ToBase64String([IO.File]::ReadAllBytes(...))` (Windows).

### WNN-03: Gradle wrapper repair (diff only)
- `ensure_gradle_wrapper` (patched :160-178) runs before `gradle_command`, at :356.
  - It fills only the missing `gradle/wrapper/{gradle-wrapper.jar,gradle-wrapper.properties}` from `UI/node_modules/@capacitor/cli/assets/android-template.tar.gz`.
  - It reads the tar members directly (no extractall) and opens each destination with `xb`, so an existing file can never be overwritten.
  - It stops, naming the files, when the template or a member is missing.
- Verification (Windows and Debian WSL, scratch copy of `native/wordnew/android` without `build/` and `.gradle/`, with `gradle/wrapper` removed):
  - both files are restored byte-identical to the template (43764 B, sha256 `7d3a4ac4…`; 253 B, `9a479a85…`);
  - a second run leaves mtime and sha256 unchanged;
  - with only the properties missing, the existing jar's mtime is unchanged;
  - with the template absent, it stops with exit 2;
  - the real project's wrapper files keep the same mtime and sha256.
- Deferred: WNN-03-commit (the `.gitignore` negation above, plus a user commit). Root `.gitignore` has no owner in the path map, so the orchestrator assigns it.

### WNN-04: version declared once
- Landed: build.gradle `:3-4` reads `coreNodeVersionName`/`coreNodeVersionCode`, and `:20-25` applies them when present. `grep` for `versionCode 1` / `versionName "1.0"` in app/build.gradle finds nothing (exit 1).
- Diff: `resolve_app_version` (patched :181-192) reads `flavors/<id>/flavor.json` `version`, which wordnew-native only reads. The build passes `-PcoreNodeVersionName`/`-PcoreNodeVersionCode` to the assemble call (:361-367). The APK artifact name uses the same resolved version (:251). `--version-info` prints the version without Gradle.
- Verification:
  - `build_apk.py --root UI --app wordnew --version-info` prints `[apk] wordnew	versionName=1.0.0	versionCode=1000000` (exit 0; the same on Debian).
  - With no `--app`, it also lists codemart as 1.0.0 / 1000000.
  - Gradle scratch: with the properties, `versionCode=1000000 versionName=1.0.0`; without them, `null/null`.

### Follow-ups (not in G1 scope)
- F1: pin `buildToolsVersion` to the central 36.0.0 (wordnew-native, native/ path; needs a task).
- F2: commit the regenerated `capacitor.settings.gradle` after the next `cap sync` (user).
- F3: `build_app.ps1` -Sync duplicates build_apk.py (B2 root build file; pycore-ui or an assigned writer).
- F4: the python step names in `scripts/start_build.ps1:66` and `.sh:35` (UI/scripts, B2; both sides together).
- F5: `start_build.sh` does not report or override the gvar gates `INSTALL_JAVA` / `INSTALL_ANDROID_SDK`.
- F6: the verified diff for build_apk.py (pycore-ui).
- F7: `.gitignore` wrapper negation (orchestrator assigns; user commit).

### Notes
- The user's sweep commit `2f31f9cd3` ("win0.0.1", 20:31:48) already contains the build.gradle change. I ran no git writes, so review against 74e7770.
- Scratch artifacts are the scratch Gradle project, the throwaway keystores and the logs. They are only in the session scratchpad (`scratchpad/wnn/`). The Debian WSL VM was started for the parity run and left running.
- Changed files: `poly_apps/pycore_laravel_wordnew_ui/native/wordnew/android/app/build.gradle`, `.claude/agents_shared/reports/wordnew-native.md`, `.claude/agents_shared/reports/wordnew-native-build_apk.diff`.
- Blockers: none for wordnew-native. Next owners:
  - wordnew-lead: verdict wordnew-native-G1;
  - pycore-ui: F6;
  - orchestrator: F7 and the B2 decision;
  - user: WNN-signing-key, F2 and the commits.
