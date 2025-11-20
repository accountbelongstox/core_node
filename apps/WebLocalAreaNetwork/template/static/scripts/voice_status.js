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

// Request state management
let isRequestPending = false;
let nextRequestTimer = null;

/**
 * Safely get nested object value
 * @param {Object} obj - The object to traverse
 * @param {string} path - The path to the value (e.g., 'serverStatus.uptime')
 * @returns {*} The value or null if not found
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((o, key) => o && o[key] !== undefined ? o[key] : null, obj);
}

/**
 * Format a value for display
 * @param {*} value - The value to format
 * @returns {string} Formatted string
 */
function formatValue(value) {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'number') {
        if (Number.isInteger(value)) return value.toString();
        return value.toFixed(2);
    }
    return value.toString();
}

/**
 * Create a tree node HTML
 * @param {string} key - The key name
 * @param {*} value - The value
 * @param {number} level - The indentation level
 * @returns {string} HTML string
 */
function createTreeNode(key, value, level = 0) {
    const indent = '  '.repeat(level);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const children = Object.entries(value)
            .map(([k, v]) => createTreeNode(k, v, level + 1))
            .join('');
        return `
            ${indent}<div class="tree-node">
            ${indent}  <div class="tree-key">${key}:</div>
            ${indent}  <div class="tree-children">
            ${children}
            ${indent}  </div>
            ${indent}</div>
        `;
    } else {
        return `
            ${indent}<div class="tree-node">
            ${indent}  <div class="tree-key">${key}:</div>
            ${indent}  <div class="tree-value">${formatValue(value)}</div>
            ${indent}</div>
        `;
    }
}

function updateStatusDisplay(data) {
    const container = document.getElementById('status-container');
    
    // Create tree structure for each main section
    const sections = {
        'Server Status': getNestedValue(data, 'serverStatus'),
        'Static Status': getNestedValue(data, 'staticStatus'),
        'System Info': getNestedValue(data, 'staticData.system'),
        'Word Statistics': getNestedValue(data, 'staticData.static'),
        'Server Sync': getNestedValue(data, 'staticData.serverSync')
    };

    let html = '<div class="status-container">';
    
    Object.entries(sections).forEach(([title, content]) => {
        if (content) {
            html += `
                <div class="status-section">
                    <h2>${title}</h2>
                    <div class="tree-container">
                        ${createTreeNode(title, content)}
                    </div>
                </div>
            `;
        }
    });
    
    html += '</div>';
    container.innerHTML = html;

    // Add click handlers for tree nodes
    document.querySelectorAll('.tree-node').forEach(node => {
        node.addEventListener('click', (e) => {
            if (e.target.classList.contains('tree-key')) {
                const children = node.querySelector('.tree-children');
                if (children) {
                    children.style.display = 
                        children.style.display === 'none' ? 'block' : 'none';
                }
            }
        });
    });
}

function fetchStatus() {
    if (isRequestPending) {
        console.log('Previous request still pending, skipping this update');
        return;
    }

    isRequestPending = true;

    fetch('/voice_status')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateStatusDisplay(data.data);
            } else {
                throw new Error(data.message || 'Failed to fetch status');
            }
        })
        .catch(error => {
            console.error('Error fetching status:', error);
            const container = document.getElementById('status-container');
            container.innerHTML = `
                <div class="error-section">
                    <h3>Error</h3>
                    <p>Failed to fetch status: ${error.message}</p>
                    <p>Last attempt: ${new Date().toLocaleString()}</p>
                </div>
            `;
        })
        .finally(() => {
            isRequestPending = false;
            if (nextRequestTimer) {
                clearTimeout(nextRequestTimer);
            }
            nextRequestTimer = setTimeout(fetchStatus, 10000);
        });
}

// Initial fetch
fetchStatus();