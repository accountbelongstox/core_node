# Code Folder Management System

## Overview

Currently only files have copy path functionality, folders do not. Folders also need to be added. At the same time, cache file expansion state, record index to localStorage. Only record expanded ones, do not record all, because sometimes node_modules directory is very large. Also skip expansion records for all node_modules and other language compilation directories like vite/nuxt/dart/flutter.

## Right Menu Features

### File Delete Function

Right menu adds a file delete function (but only files have it). When deleting, pop up confirmation box (cannot be alert). After deletion, it is not really deleted, but moved to the project root directory's `_delete` directory according to file relative path. At the same time, there is a special menu in this directory, which is to click restore on files. Restore is if file already exists, need to prompt not to overwrite. When deleting, can replace existing files in `_delete` area.

### Rename Function

Except for `_delete` and `_prompts` folders (files in them are excluded), all folders and files can have rename right menu.

## Prompts Directory

Root directory has a special directory, `_prompts`.

In frontend top, display a menu item, which is this project's task prompts. Each menu item is the corresponding file name in `_prompts`. Files in it, regardless of whether they have extensions, are parsed as UTF-8 txt format. Can also create a new task. View this project's translation interface. Frontend will request in real-time to translate content in `_prompts` to English.

## Translation Specification

When a file is not in focus editing, it is in a state that can request translation. That is, initially all files in this folder need to request translation. Translation specification: if file has Chinese, request to translate that line, after getting result, use Chinese key and English result to directly replace that line in backend (simultaneously return frontend result, but frontend only prints). Sometimes after translation succeeds, file may have been edited, then discard one translation result.

File names also need to be translated. When file name is translated, frontend will periodically request to update menu.

## Prompts Editor

When clicking `_prompts` at top, will float an edit box, not together with current file edit box. Floating edit box can be dragged, clicking one makes it top, this is convenient for simultaneously viewing and editing multiple prompts. When not in focus, or no editing for 10 seconds, frontend immediately requests translation. If already translated, no need to request.

**Note**: Prompts is a complex frontend project. You can only use HTML and JS to build.

## Folder Hierarchy Display

After subfolders of folders are expanded, there is no hierarchical effect, all are at the same level. `_prompts` and `_delete` when they don't exist, backend should create them automatically.

**Note**: Frontend should not hardcode paths. Backend should all use mapping paths in `poly_apps\laravel_main\app\Providers\PathMapper.php`, because project paths are inconsistent on each system.

## Tasks/Prompts Menu

Frontend top does not show tasks/prompts menu. If `_prompts` is empty, should also have new menu.

Tasks/Prompts should be in Code Browser area, not global.

## File Creation

After creating prompt file, it is not immediately added to `_prompts` directory. After entering name, automatically add `.md` extension in frontend (if no extension). If there are spaces, frontend automatically merges and prompts. If multiple words, automatically capitalize first letter. Backend should also verify these. Immediately refresh to menu.

Frontend immediately judges and requests translation of file name, update menu. Frontend requests translation of `_prompts` will be timed. Backend defaults to use Google translation (call PyCore call):
- `poly_apps\laravel_main\app\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TranslationController.php`
- `poly_apps\laravel_main\app\Services\TranslationService.php`

## Global User Detection

Add a global method to PHP to get current actual logged-in user. If desktop system (current system generally runs under root), scan `/Home/*/*`, find accessible directories, then check which `/Home/*/` third-level directory is latest modified. That is the actual logged-in user.

Then create a global file and folder creation class, and declare as public method for permission correction. Scan all classes, all use this class. When creating any directory and file, immediately correct permissions to actual logged-in user, so regular users can access. Reading and access are the same, create a dedicated permission correction file library. When accessing any file, immediately correct permissions to solve some previously created folder and file permission access issues, correct to accessible.

## Documentation Update

Update the global file access specification just now to `/www/programing/core_node/development-guides/LARAVEL_GUIDE.md`, but use at most a few lines to describe.

## CSRF Token

`content="{{ csrf_token() }}"` However nothing is displayed, because according to specifications, current HTML pages are directly read, not using Laravel modules, to save memory. Now design how to not use Laravel modules, but also load CSRF token.

## Global Initialization

For all pages, have an initial public solution as a base library. Place in global, not separately in some functional library.

