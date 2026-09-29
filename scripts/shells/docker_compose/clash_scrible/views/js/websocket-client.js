let socket;
let pendingRequests = new Map();
let logMessages = [];
const MAX_LOG_MESSAGES = 1000;
let currentTab = 'all';

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    socket = new WebSocket(wsUrl);

    socket.onopen = function(event) {
        console.log('WebSocket connection established');
        updateCommandOutputDisplay(); // Initialize command output display
    };

    socket.onmessage = function(event) {
        console.log('Received raw message:', event.data);
        const receivedTime = new Date();
        let parsedData;

        try {
            parsedData = JSON.parse(event.data);
        } catch (error) {
            console.error('Failed to parse message:', error);
            parsedData = { rawData: event.data };
        }

        const standardEvent = standardizeEvent(parsedData, receivedTime);
        console.log('Standardized event:', standardEvent);
        handleWebSocketMessage(standardEvent);
    };

    socket.onclose = function(event) {
        console.log('WebSocket connection closed');
        setTimeout(initWebSocket, 5000);
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

function standardizeEvent(data, receivedTime) {
    const event = {
        eventName: data.eventName || 'unknown',
        id: data.id || generateUniqueId(),
        data: data.data || data,
        serverTime: data.serverTime ? new Date(data.serverTime) : null,
        receivedTime: receivedTime,
        duration: null,
        status: data.status || 'success',
        type: data.type || 'default'
    };

    if (pendingRequests.has(event.id)) {
        const sentTime = pendingRequests.get(event.id);
        event.duration = event.receivedTime - sentTime;
        pendingRequests.delete(event.id);
    }

    return event;
}

function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function sendWebSocketMessage(eventName, data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        const message = {
            eventName: eventName,
            id: generateUniqueId(),
            data: data,
            clientTime: new Date().toISOString()
        };
        pendingRequests.set(message.id, new Date());
        socket.send(JSON.stringify(message));
    } else {
        console.error('WebSocket is not open. Unable to send message.');
    }
}

function handleWebSocketMessage(event) {
    if (event.eventName === 'log') {
        addLogMessage(event.data);
    } else if (event.eventName === 'image') {
        addImageLog(event.data.content);
    } else if (event.eventName === 'data') {
        addDataLog(event.data);
    }
    // Handle other event types as needed
}

function addLogMessage(logData) {
    const { message, timestamp, color } = logData;
    const logEntry = {
        type: 'log',
        content: `<span style="color: ${color}">[${timestamp}] ${message}</span>`
    };
    logMessages.push(logEntry);
    if (logMessages.length > MAX_LOG_MESSAGES) {
        logMessages.shift();
    }
    updateCommandOutputDisplay();
}

function addImageLog(imageUrl) {
    const logEntry = {
        type: 'image',
        content: `<img src="${imageUrl}" alt="Log Image">`
    };
    logMessages.push(logEntry);
    if (logMessages.length > MAX_LOG_MESSAGES) {
        logMessages.shift();
    }
    updateCommandOutputDisplay();
}

function addDataLog(data) {
    const logEntry = {
        type: 'data',
        content: `<pre>${JSON.stringify(data, null, 2)}</pre>`
    };
    logMessages.push(logEntry);
    if (logMessages.length > MAX_LOG_MESSAGES) {
        logMessages.shift();
    }
    updateCommandOutputDisplay();
}

function updateCommandOutputDisplay() {
    const commandOutput = document.getElementById('commandOutput');
    const commandOutputSummary = document.getElementById('commandOutputSummary');

    if (logMessages.length > 0) {
        const lastMessage = logMessages[logMessages.length - 1];
        commandOutputSummary.innerHTML = lastMessage.content;

        const filteredMessages = currentTab === 'all' 
            ? logMessages 
            : logMessages.filter(log => log.type === currentTab);

        commandOutput.innerHTML = filteredMessages.map(log => log.content).join('\n');

        if (commandOutput.classList.contains('expanded')) {
            commandOutput.scrollTop = commandOutput.scrollHeight;
        }
    } else {
        commandOutputSummary.innerHTML = '<code>No logs available</code>';
        commandOutput.innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const toggleButton = document.getElementById('toggleCommandOutput');
    const commandOutput = document.getElementById('commandOutput');
    const commandHeader = document.querySelector('.command-header');
    const tabButtons = document.querySelectorAll('.tab-button');

    toggleButton.addEventListener('click', function() {
        commandOutput.classList.toggle('expanded');
        toggleButton.classList.toggle('expanded');
        if (commandOutput.classList.contains('expanded')) {
            commandOutput.style.height = '200px';
            commandOutput.scrollTop = commandOutput.scrollHeight;
        } else {
            commandOutput.style.height = '0';
        }
    });

    commandHeader.addEventListener('click', function(event) {
        if (event.target !== toggleButton && !event.target.classList.contains('tab-button')) {
            toggleButton.click();
        }
    });

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentTab = this.dataset.type;
            updateCommandOutputDisplay();
        });
    });
});

// Initialize WebSocket on page load
window.addEventListener('load', initWebSocket);

// Close WebSocket connection on page unload
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.close();
    }
});

// Export function for use in other scripts
window.sendWebSocketMessage = sendWebSocketMessage;