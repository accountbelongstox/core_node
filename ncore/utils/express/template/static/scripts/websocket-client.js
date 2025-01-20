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
