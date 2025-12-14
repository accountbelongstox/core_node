// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

'use strict';

const DEFAULT_SERVER_PORT = 56889;
const MCP_CHROME_PORT = 12306;
const HOST_NAME = 'com.chrome_mcp.native_host';

const TOOL_NAMES = {
    BROWSER: {
        GET_WINDOWS_AND_TABS: 'get_windows_and_tabs',
        SEARCH_TABS_CONTENT: 'search_tabs_content',
        NAVIGATE: 'chrome_navigate',
        SCREENSHOT: 'chrome_screenshot',
        CLOSE_TABS: 'chrome_close_tabs',
        SWITCH_TAB: 'chrome_switch_tab',
        GO_BACK_OR_FORWARD: 'chrome_go_back_or_forward',
        WEB_FETCHER: 'chrome_get_web_content',
        CLICK: 'chrome_click_element',
        FILL: 'chrome_fill_or_select',
        GET_INTERACTIVE_ELEMENTS: 'chrome_get_interactive_elements',
        NETWORK_CAPTURE_START: 'chrome_network_capture_start',
        NETWORK_CAPTURE_STOP: 'chrome_network_capture_stop',
        NETWORK_REQUEST: 'chrome_network_request',
        NETWORK_DEBUGGER_START: 'chrome_network_debugger_start',
        NETWORK_DEBUGGER_STOP: 'chrome_network_debugger_stop',
        KEYBOARD: 'chrome_keyboard',
        HISTORY: 'chrome_history',
        BOOKMARK_SEARCH: 'chrome_bookmark_search',
        BOOKMARK_ADD: 'chrome_bookmark_add',
        BOOKMARK_DELETE: 'chrome_bookmark_delete',
        INJECT_SCRIPT: 'chrome_inject_script',
        SEND_COMMAND_TO_INJECT_SCRIPT: 'chrome_send_command_to_inject_script',
        CONSOLE: 'chrome_console',
        FILE_UPLOAD: 'chrome_upload_file',
        AUDIO_START: 'chrome_audio_start',
        AUDIO_STOP: 'chrome_audio_stop',
        AUDIO_STATUS: 'chrome_audio_status',
        AUDIO_DURATION: 'chrome_audio_duration'
    }
};

module.exports = {
    DEFAULT_SERVER_PORT,
    MCP_CHROME_PORT,
    HOST_NAME,
    TOOL_NAMES
};
