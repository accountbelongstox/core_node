# Python Matrix Development

## Overview

According to specification `development-guides\PYTHON_PYCORE.md`, scan call chain. `pyapps\matrix`

## Project Setup

Copy `~/Downloads/matrixui.zip` (or user download directory) to `poly_apps/` and extract. In `scripts/start.ps1`, write pnpm automatic installation, startup, compilation, debug scripts. All code in English, real-time output information. Do not use exit code detection, do not use return information. All rely on direct output information and result detection. For example, installation detection binary, whether running successfully directly relies on output from execution. Depend on file's own location for relative paths, do not hardcode paths. Finally return to original directory, switch directories back and forth. Installation is automatic, display menu. Compile multi-platform, DEBUG, use adb to automatically install compiled app to phone for testing.

## Frontend UI Startup

Find how to start frontend UI. There is code to start a web project, such as nuxt as frontend, find it.

## Frontend Launcher Extension

Now extend library in `pycore/utils/` to start nuxt/react/vite/nuxt. According to `development-guides\PYTHON_PYCORE.md` specification, when starting a project, there are two modes:
- **Development Mode**: Directly use port to start. But continuously block until UI starts using HTTP client request.
- **Production Mode**: Compile and provide static directory, can use built-in HTTP to start. Can also provide a method for external call to use external routing, so don't need to start two HTTP services in the same system.

Regardless of which launcher, automatically first pnpm install. All code in English, real-time output information. Do not use exit code detection, do not use return information. All rely on direct output information and result detection. For example, installation detection binary, whether running successfully directly relies on output from execution. Depend on file's own location for relative paths, do not hardcode paths. Production mode also needs to judge whether to compile.

## Frontend Launcher Library

Check `pycore\pyutils` to see if there is a dedicated frontend launcher library. Now frontend is `poly_apps\matrix_ui_react`. Find suitable library and provide better solution.

## Native UI Extension

Extend `pycore/pyutils/native_ui` library. When using local UI to start debug mode, block until UI starts successfully. Automatically install pnpm, automatically call startup command, use separate thread to start. According to `development-guides\PYTHON_PYCORE.md` specification, now set `pycore/pyutils/frontend_launcher/` as a subclass of `native_ui`.

## Debug Mode Implementation

Check if logic is correct. Set as frontend debug mode, directly start hot-reload debugging. Also current `\dist` has not implemented pre-compilation. Note: When extending, extend globally, don't just change one place.

Check if requirements are met, correct consistency. Note: You need to comprehensively consider, not just fix one file separately.

## Color Printer and Debug Window

1. All print methods should use color printer library, pass print information through this class.
2. Check if current Debug Log window (Tkinter) is registered to color printer. Debug window is used to display pre-load information. Because after actual compilation, there is no black box window.
3. Debug Log automatically closes after frontend page starts successfully, closed by external call to its close event. Of course, events are handled by thread bus. All threads are prohibited from calling each other, all handled by global thread bus events. Also need to match previous other threads, such as frontend UI thread.

## Thread Bus

Check why global is not correctly using current thread bus. Ensure thread bus registration mechanism is effective, can correctly notify all threads of close and other activities in order.

## Debug Window and Multilingual

Currently there is only one debug window, but this window is not correctly registered to color printer. Check another debug logic, correct. Also, now started debug window has language settings. Check entire project's UI end (non-webview UI) multilingual consistency. Then use thread bus and multilingual global object (note: multilingual has only one global object, created on startup, can call extended key/val in sub-apps). Don't create new everywhere, because this way can't take effect globally. Check consistency, then extend current debug window's multilingual selection, so tray and other window titles (non-webview) can switch language in real-time. Also, code prohibits hardcoding, directly use multilingual.

## WebSocket Connection

Modify to completely use WebSocket connection method. Then update `pyapps\matrix\docs` all files, simultaneously merge documents, delete expired or redundant documents. Now mainly keep endpoint documentation.

## RPC v2 Integration

Please integrate all original routes as RPC v2, managed by a dedicated file. Main only responsible for importing and organizing variables. Simultaneously pass variables through `pycore\pylauncher\launcher.py` to start RPC v2.

Management tools still placed in original folder `pyapps\matrix\api`, replace original. Root directory only has one file main.

## Scrcpy Multi-Device Connection

Find how this project uses scrcpy to connect multiple devices. Especially when there are multiple devices, if using wireless connection, because Android in wireless mode needs phone pair, but this system can directly connect. You need to find actual code to give technical solution. Deduce what adaptations the project's phone end made based on this project, such as whether OTG is enabled, whether root, etc.

Don't close C++ part, you only need to focus on how project calls scrcpy to complete above work. If you don't understand scrcpy well, call MCP to query official documentation: https://github.com/Genymobile/scrcpy?tab=readme-ov-file

## SCRCPY Code Logic Extension

According to `pyapps/matrix/docs/SCRCPY_CODE_LOGIC.md` (scanned code logic), extend current interface. First write:
1. Heartbeat system according to local network, get all available root devices, automatically set to allow 5555 connection.
2. Heartbeat system checks local network if new devices added (skip stably connected).
3. Maintain a device table, update when adding, disconnecting.
4. Heartbeat system checks current newly connected USB adb devices, immediately set to allow wireless connection. Then switch to wireless connection.

**Note**: Don't directly hardcode in `pycore\pythreadpool`, this class doesn't introduce any sub-app classes. Instead, inject heartbeat function in `pycore\pylauncher\launcher.py`, for `pythreadpool` to reference each time.

Need to extend: `python .\pymain.py app=matrix`. View documentation `development-guides\PYTHON_PYCORE.md`

## Feature Priority

| Priority | Feature | Difficulty | Description |
|----------|---------|------------|-------------|
| P0 | Drag and drop install APK | 🟢 Simple | Backend already supports, only need frontend 100 lines of code |
| P0 | Drag and drop transfer files | 🟢 Simple | Backend already supports, only need frontend implementation |
| P1 | Host/Slave input sync | 🟡 Medium | Need to implement GroupSyncService |
| P1 | Shortcut key binding | 🟢 Simple | Frontend keyboard event listening |
| P2 | Multi-device window | 🟡 Medium | Frontend multi Video sync rendering |
| P3 | OpenGL rendering (optional) | 🔴 Complex | Web solution more reasonable |

Complete these. First comprehensively scan documentation. Some implementations are in sub-apps, core class library implementations are in `pycore/utils`. Note: Need to maintain consistency with previous code. Share code, reuse logic. Unify logic consistency. You can adjust unreasonable places in original code. Note: You need overall planning, don't just consider one point separately.

## Singleton Interaction Mode

First solve current `python .\pymain.py app=matrix`. First reference singleton interaction mode, add singleton interaction to frontend thread in this startup chain. When there is new startup, notify old thread to close through separate port. Note: Frontend startup module self-notifies (i.e., notify after starting to frontend step). Then old frontend uses thread bus event to exit separately, because at this time other threads may have exited, only frontend thread becomes dead thread.

## WebSocket Intermittent Closure

What is the reason WebSocket intermittently closes? First find backend problems, simultaneously check frontend and write report in frontend directory (if there are problems).

## Backend Function Consistency

You don't need to manage frontend. Check backend function consistency, compare with QtScrcpy to check endpoint gaps, and design technique follow-up (note: focus on design techniques). Simultaneously update API endpoint documentation (need data format). `pyapps/matrix/docs/` merge documents, remove duplicate outdated content, don't add new document files.

## Global Heartbeat System

Use global HeartbeatSystem only to send signals. ADB logic split into non-blocking asynchronous tasks or sub-thread pool, ensure won't block global 1s tick. Also, if busy, skip heartbeat thread signals.

**Note**: Don't change `pyheartbeat`, you only need to register a signal receiver in it. Only need to change `app_matrix`, only change `ADBHeartbeatThread`.

## Video Stream to Frontend WebGL

According to previous scan, in QTSCRPY, how to directly give video stream to frontend WEB GL. Reference QTSCRCPY implementation solution, then extend current documentation. `pyapps/matrix` how should fastest push stream, without web gl complex decoding.

Now need to check if YUV stream is parsed, video stream push successful.

## Frontend Video Stream Matching

Check frontend where not matched. Also, don't swallow errors, carefully check how QTSCRPY passes video stream.

## Dual Video Stream Playback

Two sets of video stream playback, use Zhang Ailing component. Check endpoints. `pyapps\matrix\docs\API_DOCUMENTATION.md` add modify settings interface, system configuration. Note: Keep multilingual. Then extend endpoints' configuration, and also cache a copy in frontend. After modification, immediately update to backend. Now video will take effect in real-time during modification, frontend and backend simultaneously switch. Use two different components to play test. In current frontend's waiting connection background display video. Backend needs to ensure after switching, immediately restart, use new push stream method (if can not restart, use no-restart solution), use thread bus.

