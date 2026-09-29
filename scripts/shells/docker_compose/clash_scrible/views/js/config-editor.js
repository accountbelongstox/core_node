let currentConfig = {};


async function openConfigModal() {
    try {
        const response = await fetch('/config');
        const result = await response.json();
        if (result.success) {
            currentConfig = result.data;
            displayConfigForm(currentConfig);
        } else {
            alert('Failed to fetch config: ' + result.message);
        }
    } catch (error) {
        console.error('Error fetching config:', error);
        alert('Error fetching config. Please try again.');
    }
}

function displayConfigForm(config) {
    const modalHtml = `
        <div id="configEditModal" class="modal show">
            <div class="modal-content">
                <h2>Edit Configuration</h2>
                <form id="configEditForm">
                    ${Object.entries(config).map(([key, value]) => `
                        <div class="input-group">
                            <label for="config-${key}">${key}:</label>
                            <input type="text" id="config-${key}" name="${key}" value=${formatValueForDisplay(value)}>
                        </div>
                    `).join('')}
                </form>
                <div class="modal-buttons">
                    <button id="saveConfigBtn">Save Changes</button>
                    <button id="closeConfigModalBtn">Cancel</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('saveConfigBtn').addEventListener('click', saveConfigChanges);
    document.getElementById('closeConfigModalBtn').addEventListener('click', closeConfigModal);
}

function closeConfigModal() {
    const modal = document.getElementById('configEditModal');
    if (modal) {
        modal.remove();
    }
}

async function saveConfigChanges() {
    const configEditForm = document.getElementById('configEditForm');
    const formData = new FormData(configEditForm);
    const updatedConfig = {};

    for (const [key, value] of formData.entries()) {
        updatedConfig[key] = parseValueForSubmission(value);
    }

    try {
        for (const [key, value] of Object.entries(updatedConfig)) {
            if (JSON.stringify(currentConfig[key]) !== JSON.stringify(value)) {
                const response = await fetch('/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, value })
                });
                const result = await response.json();
                if (!result.success) {
                    throw new Error(`Failed to update ${key}: ${result.message}`);
                }
            }
        }
        alert('Configuration updated successfully');
        closeConfigModal();
    } catch (error) {
        console.error('Error updating config:', error);
        alert('Error updating config. Please try again.');
    }
}

function formatValueForDisplay(value) {
    console.log(`value`,value);
    if (Array.isArray(value)) {
        return value.map(escapeSpecialChars).join(',') + ',';
    }
    value = escapeSpecialChars(value);
    console.log(`value`,value,typeof value);
    return value;
}

function parseValueForSubmission(value) {
    if (value.endsWith(',')) {
        return value.split(',').filter(item => item !== '').map(unescapeSpecialChars);
    }
    return unescapeSpecialChars(value);
}

function escapeSpecialChars(str) {
    if (typeof str !== 'string') {
        return JSON.stringify(str);
    }
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function unescapeSpecialChars(str) {
    if (typeof str !== 'string') {
        return str;
    }
    return str.replace(/\\(.)/g, '$1');
}

function encodeHTMLEntities(str) {
    if (typeof str !== 'string') {
        return JSON.stringify(str);
    }
    return str.replace(/[\u00A0-\u9999<>&]/gim, function(i) {
        return '&#' + i.charCodeAt(0) + ';';
    });
}

function decodeHTMLEntities(str) {
    if (str && typeof str === 'string') {
        let txt = document.createElement('textarea');
        txt.innerHTML = str;
        return txt.value;
    }
    return str;
}

async function getConfigValue(key) {
    try {
        const response = await fetch(`/config/${key}`);
        const result = await response.json();
        if (result.success) {
            return result.data;
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error(`Error getting config value for ${key}:`, error);
        alert(`Error getting config value for ${key}. Please try again.`);
    }
}

async function setConfigValue(key, value) {
    try {
        const response = await fetch('/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value: parseValueForSubmission(value) })
        });
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error(`Error setting config value for ${key}:`, error);
        alert(`Error setting config value for ${key}. Please try again.`);
    }
}

async function deleteConfigValue(key) {
    try {
        const response = await fetch(`/config/${key}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error(`Error deleting config value for ${key}:`, error);
        alert(`Error deleting config value for ${key}. Please try again.`);
    }
}