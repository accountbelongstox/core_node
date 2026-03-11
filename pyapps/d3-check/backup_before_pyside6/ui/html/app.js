// Application State
const AppState = {
    currentTab: 'main',
    macroRunning: false,
    currentConfig: 'config1',
    language: 'en'
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeWindowControls();
    initializeMacroControls();
    initializeLanguageSelector();
    loadSkills();
    startStatusUpdates();
});

// Tab System
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to selected tab
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');

    AppState.currentTab = tabName;
    logMessage(`Switched to ${tabName} tab`, 'info');
}

// Window Controls
function initializeWindowControls() {
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');
    const closeBtn = document.getElementById('closeBtn');

    minimizeBtn.addEventListener('click', () => {
        callPythonMethod('minimize_window');
    });

    maximizeBtn.addEventListener('click', () => {
        callPythonMethod('maximize_window');
    });

    closeBtn.addEventListener('click', () => {
        callPythonMethod('close_window');
    });
}

// Macro Controls
function initializeMacroControls() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');

    startBtn.addEventListener('click', () => {
        startMacro();
    });

    stopBtn.addEventListener('click', () => {
        stopMacro();
    });
}

function startMacro() {
    AppState.macroRunning = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('stopBtn').disabled = false;
    document.getElementById('statusText').textContent = 'Running';

    callPythonMethod('start_macro', { config: AppState.currentConfig });
    logMessage('Macro started', 'info');
}

function stopMacro() {
    AppState.macroRunning = false;
    document.getElementById('startBtn').disabled = false;
    document.getElementById('stopBtn').disabled = true;
    document.getElementById('statusText').textContent = 'Stopped';

    callPythonMethod('stop_macro');
    logMessage('Macro stopped', 'info');
}

// Language Selector
function initializeLanguageSelector() {
    const languageSelect = document.getElementById('languageSelect');

    languageSelect.addEventListener('change', (e) => {
        AppState.language = e.target.value;
        callPythonMethod('change_language', { language: e.target.value });
        logMessage(`Language changed to ${e.target.value}`, 'info');
    });
}

// Load Skills
function loadSkills() {
    const skillList = document.getElementById('skillList');

    // Request skills from Python backend
    callPythonMethod('get_skills', null, (skills) => {
        skillList.innerHTML = '';
        skills.forEach((skill, index) => {
            const skillElement = createSkillElement(skill, index);
            skillList.appendChild(skillElement);
        });
    });

    // Demo data if no backend response
    setTimeout(() => {
        if (skillList.children.length === 0) {
            const demoSkills = [
                { name: 'Primary Attack', key: '1', delay: 100 },
                { name: 'Secondary Attack', key: '2', delay: 150 },
                { name: 'Defensive Skill', key: '3', delay: 200 }
            ];

            demoSkills.forEach((skill, index) => {
                const skillElement = createSkillElement(skill, index);
                skillList.appendChild(skillElement);
            });
        }
    }, 500);
}

function createSkillElement(skill, index) {
    const div = document.createElement('div');
    div.className = 'skill-item';
    div.innerHTML = `
        <span>${index + 1}. ${skill.name}</span>
        <span>Key: ${skill.key} | Delay: ${skill.delay}ms</span>
    `;
    return div;
}

// Logging System
function logMessage(message, type = 'info') {
    const logContainer = document.getElementById('logContainer');
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    logEntry.innerHTML = `
        <span class="log-time">${timeStr}</span>
        <span class="log-message">${message}</span>
    `;

    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;

    // Keep only last 100 entries
    while (logContainer.children.length > 100) {
        logContainer.removeChild(logContainer.firstChild);
    }
}

// Status Updates
function startStatusUpdates() {
    setInterval(() => {
        callPythonMethod('get_window_status', null, (status) => {
            document.getElementById('windowStatus').textContent = status.detected ? 'Detected' : 'Not Detected';
        });
    }, 1000);
}

// Python Bridge Communication
function callPythonMethod(method, params = null, callback = null) {
    // This will be overridden by Python webview API
    if (typeof pywebview !== 'undefined' && pywebview.api) {
        pywebview.api.call_method(method, params).then(result => {
            if (callback) callback(result);
        });
    } else {
        console.log(`[Mock] Python call: ${method}`, params);

        // Mock responses for testing
        if (callback) {
            if (method === 'get_window_status') {
                callback({ detected: false });
            } else if (method === 'get_skills') {
                callback([]);
            }
        }
    }
}

// Expose API for Python to call
window.AppAPI = {
    updateStatus: (status) => {
        document.getElementById('statusText').textContent = status;
    },

    updateWindowStatus: (detected) => {
        document.getElementById('windowStatus').textContent = detected ? 'Detected' : 'Not Detected';
    },

    log: (message, type = 'info') => {
        logMessage(message, type);
    },

    setMacroState: (running) => {
        AppState.macroRunning = running;
        document.getElementById('startBtn').disabled = running;
        document.getElementById('stopBtn').disabled = !running;
        document.getElementById('statusText').textContent = running ? 'Running' : 'Ready';
    }
};
