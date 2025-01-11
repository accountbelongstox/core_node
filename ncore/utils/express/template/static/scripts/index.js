const currentPort = window.location.port || 3000; 
const currentHost = window.location.hostname; 
const wsUrl = `ws://${currentHost}:${currentPort}`;

const socket = new WebSocket(wsUrl); 
const commandWindow = document.getElementById('commandWindowContent');
const maxMessages = 1000;
let messageQueue = [];

function logMessage(message) {
    messageQueue.push(message);
    if (messageQueue.length > maxMessages) {
        messageQueue.shift();
    }
    commandWindow.textContent = messageQueue.join('\n');
    commandWindow.scrollTop = commandWindow.scrollHeight;
}
logMessage(`Attempting to connect to WebSocket server at ${wsUrl}...`);

socket.onopen = function () {
    logMessage('WebSocket connected!');
    socket.send('Hello from client!');
};

socket.onmessage = function (event) {
    logMessage('Received: ' + event.data);
};

socket.onerror = function (error) {
    logMessage('WebSocket Error: ' + error.message);
    console.log(error);
};

socket.onclose = function () {
    logMessage('WebSocket connection closed');
};
