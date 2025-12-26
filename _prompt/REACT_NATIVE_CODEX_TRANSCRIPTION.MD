# React Native Codex Transcription

## Overview

Call `npx react-native` create command to create React Native project to `./poly_apps/`.

Extract `~/Downloads/wordflow-ai.zip` (or user download directory) to `poly_apps/qy_original`, then transcribe the code to React Native version in `poly_apps/react_native_qy`. Note: Need to establish unified data model center, settings center, state center (linked with storage), API center. Use React's differential refactoring, but imitate original project's pages and style details 1:1. Use mock data center, set API to disabled, then pages directly get mock data when requesting data.

## Start Script

In `react_native_qy/scripts/start.ps1`, write automatic installation, startup, compilation, debug scripts. All code in English, real-time output information.

**Requirements**:
- Do not use exit code detection, do not use return information
- All rely on direct output information and result detection
- For example, installation detection binary, whether running successfully directly relies on output from execution
- Depend on file's own location for relative paths, do not hardcode paths
- Finally return to original directory, switch directories back and forth
- Installation is automatic, display menu
- Compile multi-platform, DEBUG
- Use adb to automatically install compiled app to phone for testing

## Version Update

Rename `qy_original`, extract this 2.0 version to `poly_apps/qy_original`. 1:1 compare differences between current pages and functionality, update to React Native version in `poly_apps/react_native_qy`.

**Requirements**:
- Establish unified data model center, settings center, state center (linked with storage), API center
- Use React's differential refactoring
- But imitate original project's pages and style details 1:1
- Use mock data center, set API to disabled, then pages directly get mock data when requesting data

## Detailed Refinement

If the imitated effect and original effect have huge differences in `poly_apps/qy_original`, `poly_apps/react_native_qy` needs to carefully 1:1 process page details, perform detailed fine-grained restoration. Only do React Native processing.

## Tailwind CSS Transcription

For Tailwind CSS transcription, 1:1 use NativeWind, automatically call pnpm to install package. Reference documentation: https://www.nativewind.dev/docs/getting-started/installation. Access via web. Note: Not using Expo.

## Project Creation

Call `npx react-native` create command to create a completely new project to `./poly_apps/`. Do not allow modifying content in `package.json` and content in `android`, only allow calling pnpm to add packages. Migrate old code over.

## Build Process

In `scripts/start.ps1`, when encoding, copy project to `_build_${appname}/` (relative to project root) for processing. Process project twice:
1. Ensure all `src` are replaced to `target`
2. Ensure `target` does not have files that do not exist in `src`

Use Python to process. Now no longer process long path issues.

## Code Migration

Continue migrating all files. Do not allow modifying content in `package.json` and content in `android`, only allow calling pnpm to add packages. Migrate old code over, input progress file.

## Kotlin Multiplatform Version

Extract file to `poly_apps/qy_original`, then transcribe the code to Kotlin Multiplatform version under `poly_apps/`. But imitate original project's pages and style details 1:1. Use mock data center, set API to disabled, then pages directly get mock data when requesting data.

