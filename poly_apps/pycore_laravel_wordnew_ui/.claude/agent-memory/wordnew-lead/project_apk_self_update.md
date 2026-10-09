---
name: project-apk-self-update
description: How the wordnew APK in-place self update is built (signing keystore secrets, versionCode scheme, AppUpdate plugin, JS updater) and its non-obvious constraints
metadata:
  type: project
---

APK self-update (contract `app_downloads.auto_update`, built 2026-10-10).

- Signing: `scripts/flavor/android_signing.py` keeps ONE project PKCS12 keystore in secrets `CORE_NODE_ANDROID_KEYSTORE_B64` / `CORE_NODE_ANDROID_KEYSTORE_PASSWORD` (`.secret_keys/.secret_ignore`, gitignored), materialised to `artifacts/signing/`. First run seeds it from the machine `~/.android/debug.keystore` key (so phones installed from that machine keep updating in place), re-wrapped with a random password. Both debug and release use it (gradle debug buildType uses signingConfigs.release when the env is set). **Why:** in-place update needs the same key on every build/machine; a fresh key would force uninstall and wipe the audio cache (R14). **How to apply:** other machines must receive the two secrets through the encrypted secret batch before building, otherwise they would generate a different key.
- versionCode = seconds since 2026-01-01 UTC (build_apk.py `build_version_code`), versionName = flavor version. A flavor.json `versionCode` pins it (breaks monotonic order).
- Native plugin `AppUpdate` (own HttpURLConnection download with Range resume, not ProtocolHttp: that one has no resume). Install is refused natively unless package, signer and higher versionCode match.
- Build type reaches the app through manifest meta-data `core_node.build_type` (gradle manifestPlaceholders).
