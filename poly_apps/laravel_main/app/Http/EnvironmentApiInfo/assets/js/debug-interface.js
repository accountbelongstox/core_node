/**
 * Debug Interface Core JavaScript
 * Handles sidebar, navigation, API testing, and other core functionality
 */

let apiData = {};
let publicInfo = {};
let cachedParams = {}; // Browser cache for API parameters
let cachedHeaders = {}; // Browser cache for app headers

// NAMESPACE: Sidebar State Management
function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    // Check if we're on mobile
    if (window.innerWidth <= 768) {
        toggleMobileSidebar();
    } else {
        // Desktop behavior
        const isExpanded = sidebar.classList.toggle('expanded');
        localStorage.setItem('sidebar_expanded', isExpanded);
    }
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (sidebar.classList.contains('expanded')) {
        closeMobileSidebar();
    } else {
        sidebar.classList.add('expanded');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent body scroll
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    sidebar.classList.remove('expanded');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = ''; // Restore body scroll
}

function restoreSidebarState() {
    const sidebar = document.getElementById('main-sidebar');

    // Only restore on desktop
    if (window.innerWidth > 768) {
        const wasExpanded = localStorage.getItem('sidebar_expanded') === 'true';
        if (wasExpanded) {
            sidebar.classList.add('expanded');
        }
    }
}

// Handle window resize
window.addEventListener('resize', function () {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (window.innerWidth > 768) {
        // Desktop: remove mobile classes, restore desktop state
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
        restoreSidebarState();
    } else {
        // Mobile: ensure sidebar is closed by default
        sidebar.classList.remove('expanded');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
});

// NAMESPACE: Navigation Functions
function showSection(sectionType) {
    console.log('[showSection] Switching to section:', sectionType);
    
    // Close mobile sidebar when selecting a menu item
    if (window.innerWidth <= 768) {
        closeMobileSidebar();
    }

    // Update menu active state
    document.querySelectorAll('.menu-item a').forEach(link => {
        link.classList.remove('active');
    });

    const targetLink = document.querySelector(`[data-section="${sectionType}"]`);
    if (targetLink) {
        targetLink.classList.add('active');
        console.log('[showSection] Menu item activated');
    } else {
        console.warn('[showSection] Menu item not found for:', sectionType);
    }

    // Section file mapping
    const sectionFileMap = {
        'dev-tools': '/debug-tools/sections/dev-tools-section.html',
        'system-info': '/debug-tools/sections/system-info-section.html',
        'code-browser': '/debug-tools/sections/code-browser-section.html',
        'static-resources': '/debug-tools/sections/static-resources-section.html',
        'mcp-manager': '/debug-tools/sections/mcp-manager-section.html',
        'learning': '/debug-tools/sections/learning-section.html',
        'octane-tasks': '/debug-tools/sections/octane-tasks-section.html'
    };

    // Section titles and descriptions
    const sectionTitles = {
        'system-info': { title: 'System Information', desc: 'View comprehensive system and application information' },
        'dev-tools': { title: 'Development Tools', desc: 'Professional developer utilities and tools' },
        'api-testing': { title: 'API Testing Dashboard', desc: 'Test and debug your Laravel API endpoints' },
        'code-browser': { title: 'Code Browser', desc: 'Browse, edit files, manage tasks and prompt mappings' },
        'static-resources': { title: 'Static Resources', desc: 'Browse and manage static media files' },
        'mcp-manager': { title: 'MCP Manager', desc: 'Manage MCP features including screenshots, task dispatch, and prompt mappings' },
        'learning': { title: 'Vocabulary Learning', desc: 'Learn and practice vocabulary with interactive tools' },
        'octane-tasks': { title: 'Octane Timer Tasks', desc: 'Monitor and manage Octane timer tasks status' }
    };

    // Hide all sections first
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
        section.style.display = 'none';
    });
    
    // Handle main content body visibility
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        const contentBody = mainContent.querySelector('.content-body');
        if (contentBody) {
            if (sectionType === 'api-testing') {
                contentBody.style.display = 'block';
                console.log('[showSection] Showing API testing content body');
            } else {
                contentBody.style.display = 'none';
                console.log('[showSection] Hiding API testing content body');
            }
        }
    }

    // Update mobile nav title
    const mobileNavTitle = document.getElementById('mobile-nav-title');
    if (mobileNavTitle && sectionTitles[sectionType]) {
        mobileNavTitle.textContent = sectionTitles[sectionType].title;
    }

    // Update page title and description
    const pageTitle = document.getElementById('page-title');
    const pageDescription = document.getElementById('page-description');
    if (sectionTitles[sectionType]) {
        if (pageTitle) pageTitle.textContent = sectionTitles[sectionType].title;
        if (pageDescription) pageDescription.textContent = sectionTitles[sectionType].desc;
    }

    // Handle API testing (no external file)
    if (sectionType === 'api-testing') {
        return;
    }

    // Load section from external file
    const sectionId = `${sectionType}-section`;
    let section = document.getElementById(sectionId);
    const container = document.getElementById('content-sections-container') || document.body;

    // If section doesn't exist, load it from external file
    if (!section && sectionFileMap[sectionType]) {
        const filePath = sectionFileMap[sectionType];
        console.log('[showSection] Loading section from:', filePath);
        
        fetch(filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load section: ${response.statusText}`);
                }
                return response.text();
            })
            .then(html => {
                // Create a temporary container to parse the HTML
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html.trim();
                
                // Find the section element
                section = tempDiv.querySelector(`#${sectionId}`) || tempDiv.querySelector('.content-section');
                
                if (section) {
                    // Insert into container
                    container.appendChild(section);
                    
                    // Show the section
                    section.classList.add('active');
                    section.style.display = 'block';
                    
                    console.log('[showSection] Section loaded and activated:', sectionType);
                    
                    // Initialize module-specific functionality
                    if (sectionType === 'code-browser') {
                        if (typeof CodeBrowser !== 'undefined') {
                            CodeBrowser.init();
                        }
                        initCodeBrowserIntegratedModules();
                    } else if (sectionType === 'static-resources') {
                        if (typeof StaticResourceBrowser !== 'undefined') {
                            StaticResourceBrowser.init();
                        }
                    } else if (sectionType === 'mcp-manager') {
                        if (typeof McpManager !== 'undefined') {
                            McpManager.init();
                        }
                    } else if (sectionType === 'octane-tasks') {
                        if (typeof OctaneTasksManager !== 'undefined') {
                            OctaneTasksManager.init();
                        }
                    }
                } else {
                    console.error('[showSection] Section element not found in loaded HTML');
                }
            })
            .catch(error => {
                console.error('[showSection] Error loading section:', error);
            });
    } else if (section) {
        // Section already exists, just show it
        section.classList.add('active');
        section.style.display = 'block';
        console.log('[showSection] Section activated:', sectionType);
        
        // Initialize module-specific functionality
        if (sectionType === 'code-browser') {
            if (typeof CodeBrowser !== 'undefined') {
                CodeBrowser.init();
            }
            initCodeBrowserIntegratedModules();
        } else if (sectionType === 'static-resources') {
            if (typeof StaticResourceBrowser !== 'undefined') {
                StaticResourceBrowser.init();
            }
        } else if (sectionType === 'mcp-manager') {
            if (typeof McpManager !== 'undefined') {
                McpManager.init();
            }
        } else if (sectionType === 'octane-tasks') {
            if (typeof OctaneTasksManager !== 'undefined') {
                OctaneTasksManager.init();
            }
        }
    } else {
        console.warn('[showSection] Unknown section type or no file mapping:', sectionType);
    }

    // Save active section
    localStorage.setItem('active_section', sectionType);
}

// Restore sidebar and active section on load
document.addEventListener('DOMContentLoaded', function () {
    restoreSidebarState();

    const activeSection = localStorage.getItem('active_section');
    if (activeSection && activeSection !== 'api-testing') {
        showSection(activeSection);
    }

    updateUserDisplay();
});

// Update user display based on AuthHelper status
async function updateUserDisplay() {
    const isLoggedIn = await AuthHelper.checkAuthStatus();
    const loggedInDiv = document.getElementById('user-logged-in');
    const notLoggedInDiv = document.getElementById('user-not-logged-in');
    const displayNameSpan = document.getElementById('user-display-name');

    if (isLoggedIn && AuthHelper.currentUser) {
        const displayName = AuthHelper.currentUser.username ||
            AuthHelper.currentUser.email ||
            AuthHelper.currentUser.name ||
            'User';
        displayNameSpan.textContent = displayName;
        loggedInDiv.style.display = 'block';
        notLoggedInDiv.style.display = 'none';
    } else {
        loggedInDiv.style.display = 'none';
        notLoggedInDiv.style.display = 'block';
    }
}

// Handle logout
async function handleLogout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }

    try {
        const token = localStorage.getItem('auth_token');
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch('/api/dict/v1/logout', {
            method: 'POST',
            headers: headers
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.removeItem('auth_token');
            AuthHelper.currentUser = null;
            alert('Logout successful!');
            window.location.reload();
        } else {
            alert('Logout failed: ' + (data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Logout error:', error);
        localStorage.removeItem('auth_token');
        AuthHelper.currentUser = null;
        alert('Logout error: Network error');
        window.location.reload();
    }
}

// Cache Management Functions
function saveParamsToServer(appName, endpoint, method, params) {
    const data = {
        app_name: appName,
        api_endpoint: endpoint,
        method: method,
        params: params
    };

    fetch('/api_params_cache/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showStatus('Parameters saved successfully!', 'success');
            } else {
                showStatus('Failed to save parameters: ' + result.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error saving parameters:', error);
            showStatus('Error saving parameters', 'error');
        });
}

function loadParamsFromServer(appName, endpoint) {
    return fetch('/api_params_cache/load?' + new URLSearchParams({
        app_name: appName,
        api_endpoint: endpoint
    }))
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                return result.data;
            }
            return null;
        })
        .catch(error => {
            console.error('Error loading parameters:', error);
            return null;
        });
}

function saveToBrowserCache(appName, endpoint, params) {
    const cacheKey = appName + '_' + endpoint;
    cachedParams[cacheKey] = {
        params: params,
        timestamp: Date.now()
    };
    localStorage.setItem('api_debug_cache', JSON.stringify(cachedParams));
}

function loadFromBrowserCache(appName, endpoint) {
    const cacheKey = appName + '_' + endpoint;
    const cached = localStorage.getItem('api_debug_cache');
    if (cached) {
        cachedParams = JSON.parse(cached);
        return cachedParams[cacheKey]?.params || '';
    }
    return '';
}

function showStatus(message, type) {
    const statusEl = document.createElement('div');
    statusEl.className = 'status-' + type;
    statusEl.textContent = message;
    statusEl.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 10px 20px; border-radius: 4px; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 1000;';
    document.body.appendChild(statusEl);
    setTimeout(() => statusEl.remove(), 3000);
}

// Load initial data
fetch("/api_info")
    .then(response => response.json())
    .then(data => {
        apiData = data.api_reference || {};
        publicInfo = data.public_info || {};

        // Display complete system info (all data including API references)
        const completeInfo = {
            public_info: publicInfo,
            api_reference: apiData
        };
        document.getElementById("system-info").innerHTML =
            "<pre>" + JSON.stringify(completeInfo, null, 2) + "</pre>";

        // Populate app selector
        const appSelect = document.getElementById("app-select");
        Object.keys(apiData).forEach(appName => {
            const option = document.createElement("option");
            option.value = appName;
            option.textContent = appName;
            appSelect.appendChild(option);
        });

        // Load previously selected app from cache
        const cachedApp = localStorage.getItem('selected_app');
        if (cachedApp && apiData[cachedApp]) {
            appSelect.value = cachedApp;
            loadAppAPIs(); // Auto-load the cached app's APIs
        }
    })
    .catch(error => {
        console.error("Error loading API data:", error);
        document.getElementById("system-info").innerHTML =
            "<div class=\"status-error\">Error loading system information</div>";
    });

let currentAppAPIs = []; // Store current APIs for searching

function loadAppAPIs() {
    const selectedApp = document.getElementById("app-select").value;
    const apiListDiv = document.getElementById("api-list");
    const searchContainer = document.getElementById("api-search-container");

    // Cache the selected app
    if (selectedApp) {
        localStorage.setItem('selected_app', selectedApp);
    }

    if (!selectedApp || !apiData[selectedApp]) {
        apiListDiv.innerHTML = "<p style=\"text-align: center; color: #666; padding: 40px;\">No APIs found for this app</p>";
        searchContainer.style.display = "none";
        currentAppAPIs = [];
        return;
    }

    // Show search container when app is selected
    searchContainer.style.display = "block";

    const appAPIs = apiData[selectedApp];
    let html = "";

    // Add shared headers management section at the top
    if (appAPIs.supported_headers && typeof appAPIs.supported_headers === 'object') {
        html += createSharedHeadersSection(selectedApp, appAPIs.supported_headers);
    }

    // Store APIs for searching and reset search
    currentAppAPIs = [];
    document.getElementById("api-search").value = "";

    if (typeof appAPIs === "string") {
        html += "<div class=\"card\"><div class=\"card-body\"><p>" + appAPIs + "</p></div></div>";
    } else if (Array.isArray(appAPIs) || typeof appAPIs === "object") {
        // Handle new simplified format with endpoints array
        if (appAPIs.endpoints && Array.isArray(appAPIs.endpoints)) {
            appAPIs.endpoints.forEach((api, index) => {
                currentAppAPIs.push({ ...api, apiIndex: index + 1 });
                html += createAPIItem(api, index, selectedApp);
            });
        } else if (appAPIs.legacy_api_documentation && appAPIs.legacy_api_documentation.apis && Array.isArray(appAPIs.legacy_api_documentation.apis)) {
            // Handle legacy format
            appAPIs.legacy_api_documentation.apis.forEach((api, index) => {
                currentAppAPIs.push({ ...api, apiIndex: index + 1 });
                html += createAPIItem(api, index, selectedApp);
            });
        } else if (Array.isArray(appAPIs)) {
            // Handle direct array format
            appAPIs.forEach((api, index) => {
                currentAppAPIs.push({ ...api, apiIndex: index + 1 });
                html += createAPIItem(api, index, selectedApp);
            });
        } else {
            // Fallback: show raw JSON
            html = "<div class=\"card\"><div class=\"card-body\"><div class=\"json-viewer\"><pre>" + JSON.stringify(appAPIs, null, 2) + "</pre></div></div></div>";
        }
    }

    apiListDiv.innerHTML = html;
}

function createAPIItem(api, index, appName) {
    // Handle both old and new API data formats
    const apiPath = api.path || "";
    const feature = api.feature || "";

    // Parse feature information: auth_required/POST|Description|Controller
    const featureParts = feature.split('|');
    const authAndMethod = featureParts[0] || "";
    const description = featureParts[1] || "";
    const controller = featureParts[2] || "";

    const method = extractMethodFromFeature(authAndMethod) || api.method || "GET";
    const endpoint = extractEndpointFromPath(apiPath);
    const fullUrl = apiPath || ("/api" + endpoint);

    // Generate enhanced feature documentation using new parser
    let featureDocs = '';
    if (feature) {
        try {
            const parsedFeature = parseFeatureString(feature);

            if (parsedFeature && typeof parsedFeature === 'object') {
                featureDocs = '<div class="feature-docs" style="background: #e8f4f8; padding: 15px; border-radius: 6px; margin-bottom: 15px;">' +
                    '<h5 style="color: #2c3e50; margin-bottom: 10px;">API Details:</h5>' +
                    '<div style="font-size: 13px; color: #34495e; line-height: 1.5;">' +
                    '<strong>Authentication:</strong> ' + (authAndMethod.includes('auth_required') ? 'Required' : 'Not Required') + '<br>' +
                    '<strong>Method:</strong> ' + method + '<br>' +
                    (description ? '<strong>Description:</strong> ' + description + '<br>' : '') +
                    (controller ? '<strong>Controller:</strong> ' + controller + '<br>' : '') +
                    (parsedFeature.tags && parsedFeature.tags.length > 0 ? '<strong>Tags:</strong> ' + parsedFeature.tags.join(', ') + '<br>' : '') +
                    '</div>';

                // Add parameters info if available
                if (parsedFeature.params && Object.keys(parsedFeature.params).length > 0) {
                    featureDocs += '<div style="margin-top: 10px;">' +
                        '<strong style="color: #2c3e50;">Parameters:</strong><br>' +
                        '<div style="font-size: 12px; margin-left: 10px;">';

                    Object.values(parsedFeature.params).forEach(param => {
                        if (param && param.name) {
                            const required = param.requirement === 'required' ? '* ' : '  ';
                            featureDocs += `${required}<code>${param.name}</code> (${param.type || 'string'}) - ${param.requirement || 'optional'}`;
                            if (param.example) featureDocs += ` - Example: "${param.example}"`;
                            featureDocs += '<br>';
                        }
                    });
                    featureDocs += '</div></div>';
                }

                // Add response info if available
                if (parsedFeature.response && Object.keys(parsedFeature.response).length > 0) {
                    featureDocs += '<div style="margin-top: 10px;">' +
                        '<strong style="color: #2c3e50;">Response:</strong><br>' +
                        '<div style="font-size: 12px; margin-left: 10px;">';

                    Object.values(parsedFeature.response).forEach(resp => {
                        if (resp && resp.name) {
                            featureDocs += `- <code>${resp.name}</code> (${resp.type || 'string'})`;
                            if (resp.example) featureDocs += ` - ${resp.example}`;
                            featureDocs += '<br>';
                        }
                    });
                    featureDocs += '</div></div>';
                }

                featureDocs += '</div>';
            }
        } catch (error) {
            console.error('Error parsing feature for documentation:', error);
            featureDocs = '<div class="feature-docs" style="background: #ffebee; padding: 15px; border-radius: 6px; margin-bottom: 15px;">' +
                '<h5 style="color: #c62828;">Feature parsing error</h5>' +
                '<p style="font-size: 12px; color: #666;">Unable to parse feature string for this endpoint.</p>' +
                '</div>';
        }
    }

    // No longer show individual headers info since we have shared headers at app level
    let headersInfo = '';

    // Generate preset JSON based on feature with header linking
    const presetJson = generatePresetJson(feature, method, appName);

    return '<div class="api-item" id="api-item-' + index + '">' +
        '<div class="api-number">#' + (index + 1) + '</div>' +
        '<div class="api-header" onclick="toggleAPIDetails(' + index + ', \'' + appName + '\', \'' + endpoint + '\')">' +
        '<div>' +
        '<span class="api-method method-' + method.toLowerCase() + '">' + method + '</span>' +
        '<strong style="margin-right: 10px;">' + endpoint + '</strong>' +
        (description ? '<small style="color: #666; font-family: monospace;">' + description + '</small>' : '') +
        '</div>' +
        '<span id="toggle-' + index + '">&#9660;</span>' +
        '</div>' +
        '<div id="details-' + index + '" class="api-details">' +
        featureDocs +
        headersInfo +
        '<div class="form-group">' +
        '<label class="form-label">API Endpoint URL:</label>' +
        '<input type="text" id="url-' + index + '" class="form-control" value="' + fullUrl + '">' +
        '</div>' +
        '<div class="form-group">' +
        '<label class="form-label">Request Parameters (JSON):</label>' +
        '<textarea id="params-' + index + '" class="form-control" placeholder="Enter JSON parameters" rows="6">' + presetJson + '</textarea>' +
        '</div>' +
        '<div class="btn-group" style="margin-bottom: 15px;">' +
        '<button class="btn btn-primary" onclick="testAPI(' + index + ', \'' + method + '\', \'' + appName + '\', \'' + endpoint + '\')">Send Request</button>' +
        '<button class="btn btn-secondary" onclick="saveParams(' + index + ', \'' + appName + '\', \'' + endpoint + '\', \'' + method + '\')">Save Params</button>' +
        '<button class="btn btn-secondary" onclick="loadParamsWithReset(' + index + ', \'' + appName + '\', \'' + endpoint + '\')">Load Params</button>' +
        '<button class="btn btn-success" onclick="copyHeaders(' + index + ', \'' + appName + '\')">Copy Headers</button>' +
        '</div>' +
        '<div id="response-' + index + '" class="response-area" style="display: none;"></div>' +
        '</div>' +
        '</div>';
}

function extractMethodFromFeature(feature) {
    if (!feature) return "GET";
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    const upperFeature = feature.toUpperCase();

    // Handle "ANY" method specially - default to POST for parameter generation
    if (upperFeature.includes('ANY')) {
        return "POST";
    }

    for (let method of methods) {
        if (upperFeature.includes(method)) {
            return method;
        }
    }
    return "GET";
}

function extractEndpointFromPath(path) {
    if (!path) return "";
    try {
        const url = new URL(path);
        return url.pathname;
    } catch (e) {
        // If not a valid URL, assume it's already a path
        return path.startsWith('/') ? path : '/' + path;
    }
}

function parseFeatureInfo(feature) {
    if (!feature) return {};
    const parts = feature.split('/');
    return {
        requirements: parts.filter(part => part.includes('required')),
        method: extractMethodFromFeature(feature),
        auth: feature.includes('auth'),
        other: parts.filter(part => !part.includes('required') && !['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].some(m => part.toUpperCase().includes(m)))
    };
}

/**
 * Create shared headers management section for an app
 */
function createSharedHeadersSection(appName, supportedHeaders) {
    const cachedAppHeaders = loadAppHeadersFromCache(appName);

    let html = '<div class="card" style="margin-bottom: 20px; border-left: 4px solid #28a745;">' +
        '<div class="card-header" style="background: linear-gradient(135deg, #f8f9fa, #e9ecef);">' +
        '<h3 style="color: #2c3e50; margin: 0;">' + appName + ' - Shared Headers</h3>' +
        '<p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Edit these values to use across all ' + appName + ' APIs. Changes are automatically cached.</p>' +
        '</div>' +
        '<div class="card-body">' +
        '<div class="form-group">' +
        '<div id="shared-headers-' + appName + '" style="display: grid; grid-template-columns: 1fr 2fr auto; gap: 10px; align-items: center;">';

    Object.keys(supportedHeaders).forEach(headerName => {
        const currentValue = cachedAppHeaders[headerName] || '';
        const description = supportedHeaders[headerName];

        html += '<label style="font-weight: 500; color: #555;">' + headerName + ':</label>' +
            '<input type="text" id="header-' + appName + '-' + headerName + '" ' +
            'class="form-control" placeholder="' + description + '" ' +
            'value="' + currentValue + '" ' +
            'onchange="saveAppHeader(\'' + appName + '\', \'' + headerName + '\', this.value)">' +
            '<small style="color: #666; font-size: 12px;">' + description + '</small>';
    });

    html += '</div>' +
        '</div>' +
        '<div style="padding: 15px; background: #f8f9fa; border-top: 1px solid #e9ecef;">' +
        '<div class="btn-group">' +
        '<button class="btn btn-success" onclick="saveAllAppHeaders(\'' + appName + '\')">Save All Headers</button>' +
        '<button class="btn btn-secondary" onclick="resetAppHeaders(\'' + appName + '\')">Reset to Defaults</button>' +
        '<button class="btn btn-primary" onclick="copyAppHeaders(\'' + appName + '\')">Copy Headers JSON</button>' +
        '</div>' +
        '</div>' +
        '</div>';

    return html;
}

/**
 * Load app headers from browser cache
 */
function loadAppHeadersFromCache(appName) {
    const cacheKey = 'app_headers_' + appName;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch (e) {
            console.error('Failed to parse cached headers:', e);
            return {};
        }
    }
    return {};
}

/**
 * Save individual app header
 */
function saveAppHeader(appName, headerName, value) {
    const cacheKey = 'app_headers_' + appName;
    let headers = loadAppHeadersFromCache(appName);
    headers[headerName] = value;

    localStorage.setItem(cacheKey, JSON.stringify(headers));
    cachedHeaders[appName] = headers;

    // Save to server as well
    saveAppHeadersToServer(appName, headers);

    showStatus('Header "' + headerName + '" saved for ' + appName, 'success');
}

/**
 * Save all app headers at once
 */
function saveAllAppHeaders(appName) {
    const headers = {};
    const supportedHeaders = apiData[appName]?.supported_headers || {};

    Object.keys(supportedHeaders).forEach(headerName => {
        const input = document.getElementById('header-' + appName + '-' + headerName);
        if (input) {
            headers[headerName] = input.value;
        }
    });

    const cacheKey = 'app_headers_' + appName;
    localStorage.setItem(cacheKey, JSON.stringify(headers));
    cachedHeaders[appName] = headers;

    // Save to server as well
    saveAppHeadersToServer(appName, headers);

    showStatus('All headers saved for ' + appName, 'success');
}

/**
 * Reset app headers to defaults
 */
function resetAppHeaders(appName) {
    if (confirm('Are you sure you want to reset all headers for ' + appName + ' to default values? This will clear all cached values.')) {
        const cacheKey = 'app_headers_' + appName;
        localStorage.removeItem(cacheKey);
        delete cachedHeaders[appName];

        // Clear server cache as well
        resetAppHeadersOnServer(appName);

        // Reload the app to refresh the UI
        loadAppAPIs();

        showStatus('Headers reset for ' + appName, 'success');
    }
}

/**
 * Copy app headers as JSON
 */
function copyAppHeaders(appName) {
    const headers = loadAppHeadersFromCache(appName);
    const headersJson = JSON.stringify(headers, null, 2);

    navigator.clipboard.writeText(headersJson).then(() => {
        showStatus('Headers JSON copied to clipboard!', 'success');
    }).catch(err => {
        showStatus('Failed to copy headers', 'error');
        console.error('Copy failed:', err);
    });
}

/**
 * Save app headers to server
 */
function saveAppHeadersToServer(appName, headers) {
    const data = {
        app_name: appName,
        headers: headers
    };

    fetch('/api_headers_cache/save', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                console.error('Failed to save headers to server:', result.message);
            }
        })
        .catch(error => {
            console.error('Error saving headers to server:', error);
        });
}

/**
 * Reset app headers on server
 */
function resetAppHeadersOnServer(appName) {
    fetch('/api_headers_cache/reset', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ app_name: appName })
    })
        .then(response => response.json())
        .then(result => {
            if (!result.success) {
                console.error('Failed to reset headers on server:', result.message);
            }
        })
        .catch(error => {
            console.error('Error resetting headers on server:', error);
        });
}


/**
 * Parse complete feature string into components
 * @param {string} feature - Feature string to parse
 * @returns {object} Parsed feature components
 */
function parseFeatureString(feature) {
    if (!feature || typeof feature !== 'string') {
        return {
            authAndMethod: '',
            description: '',
            controller: '',
            params: {},
            headers: {},
            response: {},
            tags: []
        };
    }

    const parts = feature.split('|');
    const result = {
        authAndMethod: parts[0] || '',
        description: parts[1] || '',
        controller: parts[2] || '',
        params: {},
        headers: {},
        response: {},
        tags: []
    };

    // Parse additional sections
    for (let i = 3; i < parts.length; i++) {
        const section = parts[i];
        if (section.startsWith('params:')) {
            result.params = parseParameterSection(section.substring(7));
        } else if (section.startsWith('headers:')) {
            result.headers = parseParameterSection(section.substring(8));
        } else if (section.startsWith('response:')) {
            result.response = parseParameterSection(section.substring(9));
        } else if (section.startsWith('tags:')) {
            result.tags = section.substring(5).split(',').map(tag => tag.trim());
        }
    }

    return result;
}

/**
 * Parse parameter section (params, headers, response)
 * @param {string} section - Parameter section string
 * @returns {object} Parsed parameters
 */
function parseParameterSection(section) {
    const params = {};
    if (!section) return params;

    // More sophisticated splitting to handle commas inside parentheses
    const paramList = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < section.length; i++) {
        const char = section[i];
        if (char === '(') depth++;
        else if (char === ')') depth--;
        else if (char === ',' && depth === 0) {
            paramList.push(current.trim());
            current = '';
            continue;
        }
        current += char;
    }
    if (current.trim()) {
        paramList.push(current.trim());
    }

    paramList.forEach(param => {
        const parsed = parseParameterDefinition(param.trim());
        if (parsed.name) {
            params[parsed.name] = parsed;
        }
    });

    return params;
}

/**
 * Parse individual parameter definition
 * @param {string} paramDef - Parameter definition like "name(string,required,John Doe)"
 * @returns {object} Parsed parameter details
 */
function parseParameterDefinition(paramDef) {
    const match = paramDef.match(/^([^(]+)\(([^)]+)\)$/);
    if (!match) {
        return { name: paramDef, type: 'string', requirement: 'optional', example: '' };
    }

    const name = match[1].trim();
    const detailsString = match[2];

    // Split details more carefully - handle commas in examples
    const details = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < detailsString.length; i++) {
        const char = detailsString[i];
        if (char === '"' || char === "'") {
            inQuotes = !inQuotes;
        }
        if (char === ',' && !inQuotes) {
            details.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    details.push(current.trim());

    const result = {
        name: name,
        type: details[0] || 'string',
        requirement: details[1] || 'optional',
        example: details[2] || ''
    };

    return result;
}

/**
 * Generate JSON parameters from feature string with header linking
 * @param {string} feature - Complete feature string
 * @param {string} method - HTTP method
 * @param {string} appName - Application name for header lookup
 * @returns {string} JSON parameter string
 */
function generateParamsFromFeature(feature, method, appName = null) {
    if (!feature || typeof feature !== 'string' || method === 'GET') return '';

    try {
        const parsed = parseFeatureString(feature);
        if (!parsed || typeof parsed !== 'object') {
            return '';
        }

        const jsonParams = {};

        // Get cached headers for the app if available
        let cachedAppHeaders = appName ? loadAppHeadersFromCache(appName) : {};

        // Ensure cachedHeaders is not null or undefined
        if (!cachedAppHeaders || typeof cachedAppHeaders !== 'object') {
            cachedAppHeaders = {};
        }

        // Generate parameters from parsed feature
        if (parsed.params && typeof parsed.params === 'object') {
            // First add all required parameters
            Object.values(parsed.params).forEach(param => {
                if (param && param.name && param.requirement === 'required') {
                    let value = param.example || getDefaultValueForType(param.type);

                    // Check if this parameter references a shared header
                    value = linkParameterToSharedHeader(param.name, value, cachedAppHeaders);

                    jsonParams[param.name] = value;
                }
            });

            // Then add optional parameters that have examples
            Object.values(parsed.params).forEach(param => {
                if (param && param.name && param.requirement === 'optional' && param.example) {
                    let value = param.example;

                    // Check if this parameter references a shared header
                    value = linkParameterToSharedHeader(param.name, value, cachedAppHeaders);

                    jsonParams[param.name] = value;
                }
            });

            // If no required params but have optional params with examples, use them
            if (Object.keys(jsonParams).length === 0) {
                Object.values(parsed.params).forEach(param => {
                    if (param && param.name && param.example) {
                        let value = param.example;

                        // Check if this parameter references a shared header
                        value = linkParameterToSharedHeader(param.name, value, cachedAppHeaders);

                        jsonParams[param.name] = value;
                    }
                });
            }
        }

        return Object.keys(jsonParams).length > 0 ? JSON.stringify(jsonParams, null, 2) : '';

    } catch (error) {
        console.error('Error generating parameters from feature:', error);
        return '';
    }
}

/**
 * Link parameter to shared header value if applicable
 * @param {string} paramName - Parameter name
 * @param {*} paramValue - Current parameter value
 * @param {object} cachedHeaders - Cached header values
 * @returns {*} Linked value or original value
 */
function linkParameterToSharedHeader(paramName, paramValue, cachedHeaders) {
    // Ensure paramValue is a string for processing
    if (paramValue === null || paramValue === undefined) {
        paramValue = '';
    }

    // Convert to string if it's not already
    const paramValueStr = String(paramValue);

    // Ensure cachedHeaders is valid
    if (!cachedHeaders || typeof cachedHeaders !== 'object') {
        return paramValue;
    }

    // Common parameter-to-header mappings
    const paramHeaderMap = {
        'token': 'Authorization',
        'auth_token': 'Authorization',
        'user_token': 'Authorization',
        'access_token': 'Authorization',
        'bearer_token': 'Authorization',
        'client_token': 'X-Client-Token',
        'api_key': 'X-API-Key',
        'username': 'X-Auth-Username',
        'password': 'X-Auth-Password'
    };

    // Check if parameter name maps to a header
    const headerName = paramHeaderMap[paramName.toLowerCase()];
    if (headerName && cachedHeaders[headerName]) {
        return cachedHeaders[headerName];
    }

    // Check for direct header name matches (case insensitive)
    for (const [headerKey, headerValue] of Object.entries(cachedHeaders)) {
        if (headerKey.toLowerCase() === paramName.toLowerCase() && headerValue) {
            return headerValue;
        }
    }

    // Check if parameter value contains header placeholder like {{header_name}}
    try {
        const headerPlaceholderMatch = paramValueStr.match(/\{\{([^}]+)\}\}/);
        if (headerPlaceholderMatch) {
            const placeholderName = headerPlaceholderMatch[1];
            for (const [headerKey, headerValue] of Object.entries(cachedHeaders)) {
                if (headerKey.toLowerCase() === placeholderName.toLowerCase() && headerValue) {
                    return headerValue;
                }
            }
        }
    } catch (error) {
        console.error('Error processing parameter value for header linking:', error);
    }

    return paramValue;
}

/**
 * Get default value for parameter type
 * @param {string} type - Parameter type
 * @returns {*} Default value for the type
 */
function getDefaultValueForType(type) {
    switch (type.toLowerCase()) {
        case 'string': return 'example_string';
        case 'int': case 'integer': return 123;
        case 'boolean': case 'bool': return true;
        case 'array': return ['item1', 'item2'];
        case 'object': return { key: 'value' };
        case 'email': return 'user@example.com';
        case 'date': return '2024-01-01';
        case 'float': case 'decimal': return 12.34;
        case 'file': return null;
        default: return 'example_value';
    }
}

/**
 * Legacy function for backward compatibility
 * Now uses enhanced feature parsing with header linking
 */
function generatePresetJson(feature, method, appName = null) {
    return generateParamsFromFeature(feature, method, appName);
}

function copyHeaders(index, appName) {
    if (apiData[appName] && apiData[appName].supportedHeaders) {
        const headers = JSON.stringify(apiData[appName].supportedHeaders, null, 2);
        navigator.clipboard.writeText(headers).then(() => {
            showStatus('Headers copied to clipboard!', 'success');
        }).catch(err => {
            showStatus('Failed to copy headers', 'error');
        });
    } else {
        showStatus('No supported headers found for this app', 'error');
    }
}

function toggleAPIDetails(index, appName, endpoint) {
    const details = document.getElementById("details-" + index);
    const toggle = document.getElementById("toggle-" + index);

    if (details.style.display === "none" || details.style.display === "") {
        details.style.display = "block";
        toggle.innerHTML = "&#9650;";

        // Auto-load cached parameters when opening
        loadParams(index, appName, endpoint);
    } else {
        details.style.display = "none";
        toggle.innerHTML = "&#9660;";
    }
}

function saveParams(index, appName, endpoint, method) {
    const params = document.getElementById("params-" + index).value;

    // Save to browser cache immediately
    saveToBrowserCache(appName, endpoint, params);

    // Save to server cache
    saveParamsToServer(appName, endpoint, method, params);
}

function loadParams(index, appName, endpoint) {
    const paramsTextarea = document.getElementById("params-" + index);

    // Priority: 1. Browser cache (highest), 2. Server cache, 3. Parsed from feature (lowest)

    // Try browser cache first
    const browserCached = loadFromBrowserCache(appName, endpoint);
    if (browserCached) {
        paramsTextarea.value = browserCached;
        return;
    }

    // If no browser cache, try server cache
    loadParamsFromServer(appName, endpoint)
        .then(serverData => {
            if (serverData && serverData.params) {
                paramsTextarea.value = serverData.params;
                // Update browser cache with server data
                saveToBrowserCache(appName, endpoint, serverData.params);
            } else {
                // If no cached data available, use parsed feature as fallback
                if (!paramsTextarea.value) {
                    // Find the API feature for this endpoint
                    const apiInfo = apiData[appName];
                    if (apiInfo && apiInfo.endpoints) {
                        const api = apiInfo.endpoints.find(ep => ep.path && ep.path.includes(endpoint));
                        if (api && api.feature) {
                            const method = extractMethodFromFeature(api.feature);
                            const parsedParams = generateParamsFromFeature(api.feature, method, appName);
                            if (parsedParams) {
                                paramsTextarea.value = parsedParams;
                            }
                        }
                    }
                }
            }
        })
        .catch(error => {
            console.error('Failed to load params:', error);
        });
}

/**
 * Load parameters with reset confirmation (for Load Params button)
 */
function loadParamsWithReset(index, appName, endpoint) {
    if (confirm('This will reset parameters to parsed defaults and may override your current changes. Continue?')) {
        const paramsTextarea = document.getElementById("params-" + index);

        // Find the API feature for this endpoint
        const apiInfo = apiData[appName];
        if (apiInfo && apiInfo.endpoints) {
            const api = apiInfo.endpoints.find(ep => ep.path && ep.path.includes(endpoint));
            if (api && api.feature) {
                const method = extractMethodFromFeature(api.feature);
                const parsedParams = generateParamsFromFeature(api.feature, method, appName);
                if (parsedParams) {
                    paramsTextarea.value = parsedParams;
                    showStatus('Parameters reset to parsed defaults', 'success');
                } else {
                    paramsTextarea.value = '';
                    showStatus('No parameters to parse from feature', 'error');
                }
            } else {
                paramsTextarea.value = '';
                showStatus('No feature string found for this endpoint', 'error');
            }
        } else {
            showStatus('No API info found for this app', 'error');
        }
    }
}

function testAPI(index, method, appName, endpoint) {
    const url = document.getElementById("url-" + index).value;
    const params = document.getElementById("params-" + index).value;
    const responseDiv = document.getElementById("response-" + index);

    responseDiv.style.display = "block";
    responseDiv.innerHTML = '<div class="loading"></div>Sending request...';

    let requestOptions = {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    };

    if (params && (method === "POST" || method === "PUT" || method === "PATCH")) {
        try {
            JSON.parse(params); // Validate JSON
            requestOptions.body = params;
        } catch (e) {
            responseDiv.innerHTML = '<div class="status-error">Error: Invalid JSON parameters</div>';
            return;
        }
    }

    fetch(url, requestOptions)
        .then(response => {
            return response.text().then(text => ({
                status: response.status,
                statusText: response.statusText,
                body: text,
                headers: Object.fromEntries(response.headers.entries()),
                ok: response.ok
            }));
        })
        .then(result => {
            let responseText = "Status: " + (result.ok ? "OK" : "ERROR") + " " + result.status + " " + result.statusText + "\n\n";
            responseText += "Headers:\n" + JSON.stringify(result.headers, null, 2) + "\n\n";
            responseText += "Response:\n";

            try {
                const jsonBody = JSON.parse(result.body);
                responseText += JSON.stringify(jsonBody, null, 2);
            } catch (e) {
                responseText += result.body;
            }

            responseDiv.textContent = responseText;

            // Auto-save successful parameters
            if (result.ok && params) {
                saveToBrowserCache(appName, endpoint, params);
            }
        })
        .catch(error => {
            responseDiv.innerHTML = '<div class="status-error">Error: ' + error.message + '</div>';
        });
}


let searchTimeout;

/**
 * Search APIs and jump to best match
 * @param {string} searchTerm - Search term entered by user
 */
function searchAndJumpToAPI(searchTerm) {
    // Clear previous timeout to avoid excessive searching
    clearTimeout(searchTimeout);

    // Clear previous highlighting
    document.querySelectorAll('.api-item').forEach(item => {
        item.classList.remove('search-highlighted');
    });

    if (!searchTerm || searchTerm.trim() === '') {
        return;
    }

    searchTimeout = setTimeout(() => {
        const term = searchTerm.trim().toLowerCase();
        let bestMatch = null;
        let bestScore = 0;

        currentAppAPIs.forEach((api, arrayIndex) => {
            const score = calculateMatchScore(api, term, arrayIndex);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = { api, index: arrayIndex, score };
            }
        });

        if (bestMatch && bestScore > 0) {
            jumpToAPI(bestMatch.index);
        }
    }, 300); // Debounce search by 300ms
}

/**
 * Calculate match score for an API
 * @param {object} api - API object
 * @param {string} term - Search term
 * @param {number} index - Array index of API
 * @returns {number} Match score (higher is better)
 */
function calculateMatchScore(api, term, index) {
    let score = 0;
    const apiNumber = (index + 1).toString();
    const path = (api.path || '').toLowerCase();
    const feature = (api.feature || '').toLowerCase();
    const method = (extractMethodFromFeature(api.feature) || '').toLowerCase();

    // Parse feature for description
    const featureParts = feature.split('|');
    const description = (featureParts[1] || '').toLowerCase();

    // Extract endpoint from path for easier matching
    const endpoint = extractEndpointFromPath(path).toLowerCase();

    // Exact number match gets highest priority
    if (term === apiNumber) {
        return 1000;
    }

    // Number prefix match
    if (apiNumber.startsWith(term)) {
        score += 500;
    }

    // Exact endpoint match gets high priority
    if (endpoint === term) {
        score += 800;
    }

    // Endpoint starts with term
    if (endpoint.startsWith(term)) {
        score += 400;
    }

    // Endpoint contains term
    if (endpoint.includes(term)) {
        score += 200;
    }

    // Path contains term
    if (path.includes(term)) {
        score += 150;
    }

    // Method match
    if (method === term) {
        score += 300;
    }

    // Description contains term
    if (description.includes(term)) {
        score += 100;
    }

    // Feature contains term
    if (feature.includes(term)) {
        score += 50;
    }

    // Fuzzy matching for endpoints (character-by-character)
    score += calculateFuzzyScore(endpoint, term) * 10;
    score += calculateFuzzyScore(description, term) * 5;

    return score;
}

/**
 * Calculate fuzzy match score
 * @param {string} text - Text to search in
 * @param {string} term - Search term
 * @returns {number} Fuzzy score
 */
function calculateFuzzyScore(text, term) {
    if (!text || !term) return 0;

    let score = 0;
    let termIndex = 0;

    for (let i = 0; i < text.length && termIndex < term.length; i++) {
        if (text[i] === term[termIndex]) {
            score++;
            termIndex++;

            // Bonus for consecutive matches
            if (i > 0 && text[i - 1] === term[termIndex - 2]) {
                score += 0.5;
            }
        }
    }

    // Normalize by term length
    return termIndex === term.length ? score / term.length : 0;
}

/**
 * Jump to and highlight API
 * @param {number} apiIndex - Index of API to jump to
 */
function jumpToAPI(apiIndex) {
    const apiItem = document.getElementById('api-item-' + apiIndex);
    if (apiItem) {
        // Highlight the API
        apiItem.classList.add('search-highlighted');

        // Scroll to the API with smooth animation
        apiItem.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        // Auto-expand the API details if not already open
        const details = document.getElementById('details-' + apiIndex);
        const toggle = document.getElementById('toggle-' + apiIndex);

        if (details && (details.style.display === 'none' || details.style.display === '')) {
            setTimeout(() => {
                details.style.display = 'block';
                if (toggle) toggle.innerHTML = '&#9650;';

                // Load cached parameters for convenience
                const selectedApp = document.getElementById("app-select").value;
                const api = currentAppAPIs[apiIndex];
                if (selectedApp && api && api.path) {
                    const endpoint = extractEndpointFromPath(api.path);
                    loadParams(apiIndex, selectedApp, endpoint);
                }
            }, 500);
        }

        // Show success message
        showStatus('Jumped to API #' + (apiIndex + 1), 'success');
    }
}

async function loadDictionaryStatistics() {
    try {
        const response = await fetch('/api/dict/v1/system/dictionary-statistics');
        const result = await response.json();

        if (result.status === 'success') {
            const container = document.getElementById('dict-stats-container');
            const data = result.data;

            let html = '<div style="display: flex; gap: 20px; align-items: center;">';

            data.languages.forEach(lang => {
                html += `
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <span style="font-weight: 600; color: #333;">${lang.language}</span>
                        <span style="color: #666;">Words: ${lang.total_words.toLocaleString()}</span>
                        <span style="color: #999;">AI Reviewed: ${lang.ai_reviewed.toLocaleString()} (${lang.review_percentage}%)</span>
                    </div>
                `;
            });

            html += `
                <div style="border-left: 2px solid #ddd; padding-left: 20px; display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-weight: 600; color: #333;">Total</span>
                    <span style="color: #666;">Words: ${data.summary.total_words.toLocaleString()}</span>
                    <span style="color: #999;">Reviewed: ${data.summary.total_reviewed.toLocaleString()} (${data.summary.overall_review_percentage}%)</span>
                </div>
            `;

            html += '</div>';
            container.innerHTML = html;
        } else {
            document.getElementById('dict-stats-loading').textContent = 'Failed to load stats';
        }
    } catch (error) {
        console.error('Failed to load dictionary statistics:', error);
        document.getElementById('dict-stats-loading').textContent = 'Stats unavailable';
    }
}

document.addEventListener('DOMContentLoaded', function () {
    loadDictionaryStatistics();
});

// Initialize integrated modules when Code Browser section is shown
let codeBrowserIntegratedModulesInitialized = false;
function initCodeBrowserIntegratedModules() {
    if (codeBrowserIntegratedModulesInitialized) return;
    codeBrowserIntegratedModulesInitialized = true;

    // Initialize Prompts/Tasks Manager (left panel in lower section)
    if (typeof PromptsTasksManager !== 'undefined') {
        PromptsTasksManager.init();
    }

    // Initialize Prompt Mapping Manager in embedded mode (right panel in lower section)
    if (typeof PromptMappingManager !== 'undefined') {
        PromptMappingManager.init('#prompt-mapping-panel-embedded');
    }
}


