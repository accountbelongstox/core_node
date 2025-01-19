// WebSocket connection
let ws = null;

// Log container element
const logContainer = document.getElementById('log-container') || createLogContainer();

function createLogContainer() {
    const container = document.createElement('div');
    container.id = 'log-container';
    container.style.cssText = `
        position: fixed;
        bottom: 0;
        right: 0;
        width: 400px;
        max-height: 300px;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        font-family: monospace;
        padding: 10px;
        border-top-left-radius: 5px;
        z-index: 9999;
    `;
    document.body.appendChild(container);
    return container;
}

// Initialize WebSocket connection
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        appendLog('success', 'WebSocket connected');
    };
    
    ws.onclose = () => {
        appendLog('error', 'WebSocket disconnected');
        // Try to reconnect after 5 seconds
        setTimeout(initWebSocket, 5000);
    };
    
    ws.onerror = (error) => {
        appendLog('error', `WebSocket error: ${error.message}`);
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
        appendLog(logData.level, logData.message, logData.data);
    }
    // Handle other event types here
}

// Append log message to container
function appendLog(level, message, data = null) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${level}`;
    
    // Style based on log level
    const colors = {
        info: '#4A90E2',
        warn: '#F5A623',
        error: '#D0021B',
        success: '#7ED321',
        debug: '#9013FE'
    };
    
    logEntry.style.cssText = `
        padding: 5px;
        border-left: 3px solid ${colors[level] || '#fff'};
        margin: 2px 0;
        word-wrap: break-word;
    `;
    
    // Add timestamp
    const timestamp = new Date().toLocaleTimeString();
    logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> ${message}`;
    
    // Add data if present
    if (data) {
        const dataElement = document.createElement('pre');
        dataElement.style.cssText = `
            margin: 5px 0 0 10px;
            font-size: 12px;
            color: #888;
        `;
        dataElement.textContent = JSON.stringify(data, null, 2);
        logEntry.appendChild(dataElement);
    }
    
    // Add to container and scroll to bottom
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // Keep only last 100 messages
    while (logContainer.children.length > 100) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

// Start WebSocket connection
initWebSocket();

// Export functions for external use
window.logger = {
    appendLog
};
