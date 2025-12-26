# Voice Playback System

## Overview

From `python .\pycore_module_caller.py`, view tray menu registration and event registration. First add a "Play Voice" menu item to tray. This function will toggle a function to play sound on the system.

## Extension to PyCore PyCtl

View documentation `development-guides\PYTHON_PYCORE.md`. Note: `pyctl` is used to organize `pycore\pyutils` logic, avoid circular references.

Now reference `pycore\pyfoundations\system_paths.py` as an external cache directory, create a queue:
```json
[{
  "text": "text",
  "voice_path": "voice_path",
  "play_count": "play_count"
}]
```

Then create an index indicating which item is currently playing.

## UI Integration

In `pycore\pylauncher\launcher.py`, pass parameters to `pycore\pyutils\native_ui`, reference `pycore\pyctl\voice_playback/ui/` index as UI interface. Display text, show when playing.

**Note**: This is organized by `python .\pycore_module_caller.py` to pass parameters to make `pycore\pylauncher\launcher.py` simultaneously start `pycore\pyutils\native_ui`. By default, `pycore\pylauncher\launcher.py` does not start `native_ui`.

## Native UI Startup

Start `pycore\pyutils\native_ui` through `pycore\pylauncher\launcher.py`. First view logic in `pycore\pyutils\native_ui`, ensure passing an HTML can start it. Use RPC v2 WebSocket to communicate with main program.

## Multi-language Support

First hardcode multi-language playback, [en], currently only extend this one language, mark as langs.

## HTTP Interface

Through current `http://localhost:59000/` add route, then provide an interface to add text to playback list. Can add text, image, URL, voice, text. Then in `pycore\pyctl` organize logic. When receiving added information, process according to added content:

1. **If image**: Call `pycore\pyutils\ocr` to recognize, then organize recognized content as prompt and pass to `pycore\pyutils\gemini` to summarize, get a complete text. Then call `pycore\pyutils\common` edge TTS, including current `http://localhost:59000/` translator service. According to all languages in langs, translate to target language, finally call `pycore\pyutils\common` edge TTS to get voice, thus simultaneously get subtitle and language.

**Note**: When generating TTS, need to generate cache, use TTS cache table, use `\n` to generate for each paragraph, not generate entire text, then save cache according to paragraph text and MD5 encoding. When playing, also play paragraph by paragraph according to paragraphs in a text.

2. **If file**: Recognize and call file conversion, convert to text. Use libraries in `pycore\pyutils`. If URL, use download, extract text (do not include CSS/JS parts).

## Laravel MCP Interface

According to PyCore development process, view code in PyCore, and develop an MCP interface for Laravel, and extend in web MCP Manager's left menu.

1. Need to reference `pycore.pyctl.desktop` HTML layout
2. Need to reference `pycore\pyutils\gemini` to implement corresponding Laravel public class, and integrate current Laravel's openrouter AI/deepseek to provide a public dispatcher, can call a specific AI according to specification, or call through AUTO
3. Need to implement same functionality as PyCore, but integrate into Laravel's MCP interface. Reference `development-guides\LARAVEL_GUIDE.md`

## Code Sync Server

Add a new interface, in tray can enable this machine as code server, `/code-sync`.

1. Modify methods in `D:\programing\core_node\pycore\pyutils\device_sync`
2. Through `python .\pycore_module_caller.py`, add a method menu in tray, toggle switch to client/switch to server
3. When server, start preparing to push code in `D:\programing\core_node\`, skip node_modules in subdirectories, Python temporary directories, dart/flutter/nuxt/vite/vue temporary and compilation directories
4. When client, every 5 seconds call `D:\programing\core_node\pycore\pyutils\device_sync` to discover other 59000 servers in same local network IP, and establish connection. Immediately scan when first switching.
5. When server receives connection, note do not flash disconnect, record ID value. If client reconnects within 5 minutes, continue as old client.
6. On first connection, push all code to client. After that, push modified code every 5 seconds.
7. Currently client for testing only prompts whether to overwrite, but does not actually overwrite. When server's pushed code modification log is newer than client, client prompts overwrite, otherwise prompts ignore.

**Focus**: First modify `device_sync`.

## Image Processing

If image, call Gemini's image recognition and rewrite text. If Gemini unavailable, call OCR recognition, summarize by other available AI. OCR can only use Gemini and current cornOcr system.

**Extension**: Currently Gemini is 2 seconds per request, OpenRouter AI is 1000 times per day. If above exhausted, use DeepSeek.

According to all languages in langs, translate to target language, finally call edge TTS to get voice, thus simultaneously get subtitle and language.

**Note**: Above separately use translator, TTS set external directory cache, use PHP path map mapping system.

Do not use unnecessary except blocks.

## Frontend Layout

Frontend mainly displays subtitles, can play previous sentence, next sentence, pause, etc. Queue is hidden, click to expand. "Add to Queue" in another sub-menu. Otherwise playback interface too messy. Then click one-click switch subtitle mode can enlarge subtitles to full screen.

## Settings

Add a setting item, target language, default check English, support TTS supported languages (no zh), requested by backend, simultaneously update to configuration, simultaneously effective for current user. Logged in as: establish database. Then according to target language, no matter what language submitted, must first go through AI rewrite to target language, then generate TTS, simultaneously replace asterisks in it, because asterisks in TTS will generate a series of pronunciations. Strictly follow this process, that is, default is multi-voice.

## Playback Logic

When clicking play, sequentially play from currently selected queue item. Need to set an index in backend. Each time start from index to recycle play. When clicking any item in queue, will change index.

When playing, can set rate according to HTML5 capability.

## Grouping

When adding text/image, default use default group. Now can add specified group, and can modify group in queue. Group automatically created when not exists.

After playing, automatically loop play.

