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

// WebSocket connection
let ws = null;
let logConsole = null;

// Initialize log console
document.addEventListener('DOMContentLoaded', () => {
    logConsole = new LogConsole();
});

// Initialize WebSocket connection
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        logConsole.appendLog('success', 'WebSocket connected');
    };
    
    ws.onclose = () => {
        logConsole.appendLog('error', 'WebSocket disconnected');
        // Try to reconnect after 5 seconds
        setTimeout(initWebSocket, 5000);
    };
    
    ws.onerror = (error) => {
        logConsole.appendLog('error', `WebSocket error occurred`);
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    };
}

// Handle server messages
function handleServerMessage(data) {
    if (data.event === 'server_log') {
        const logData = data.data;
        logConsole.appendLog(logData.level, logData.message, logData.data);
    }
    // Handle other event types here
}

// Start WebSocket connection
initWebSocket();
