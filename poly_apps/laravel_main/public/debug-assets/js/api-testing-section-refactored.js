/**
 * API Testing Section - Refactored
 * All HTML generation moved to templates
 * JS only handles API calls and data processing
 */

let apiData = {};
let publicInfo = {};
let cachedParams = {};
let cachedHeaders = {};
let currentAppAPIs = [];
let searchTimeout;

const TEMPLATE_URLS = {
    API_ITEM: '/debug-assets/debug-tools/templates/api-item.html',
    FEATURE_DOCS: '/debug-assets/debug-tools/templates/feature-docs.html',
    SHARED_HEADERS_SECTION: '/debug-assets/debug-tools/templates/shared-headers-section.html',
    SHARED_HEADER_ITEM: '/debug-assets/debug-tools/templates/shared-header-item.html'
};

document.addEventListener('DOMContentLoaded', async function() {
    await loadInitialData();
    setupEventListeners();
});

async function loadInitialData() {
    const data = await apiClientInstance.json(ApiClient.PointUrlKey.API_INFO, 'GET');
    apiData = data.api_reference;
    publicInfo = data.public_info;

    const appSelect = document.getElementById("app-select");
    Object.keys(apiData).forEach(appName => {
        const option = document.createElement("option");
        option.value = appName;
        option.textContent = appName;
        appSelect.appendChild(option);
    });

    const cachedApp = localStorage.getItem('selected_app');
    const firstApp = Object.keys(apiData)[0];
    const selectedApp = cachedApp || firstApp;
    appSelect.value = selectedApp;
    localStorage.setItem('selected_app', selectedApp);
    await loadAppAPIs();
}

function setupEventListeners() {
    const appSelect = document.getElementById("app-select");
    appSelect.addEventListener('change', loadAppAPIs);

    const apiSearch = document.getElementById("api-search");
    apiSearch.addEventListener('input', (e) => searchAndJumpToAPI(e.target.value));

    document.addEventListener('click', handleDelegatedClick);
    document.addEventListener('change', handleDelegatedChange);
}

function handleDelegatedClick(e) {
    const action = e.target.dataset.action;
    if (!action) return;

    const index = e.target.dataset.index ? parseInt(e.target.dataset.index) : null;
    const appName = e.target.dataset.appName;
    const endpoint = e.target.dataset.endpoint;
    const method = e.target.dataset.method;

    switch (action) {
        case 'test-api':
            testAPI(index, method, appName, endpoint);
            break;
        case 'save-params':
            saveParams(index, appName, endpoint, method);
            break;
        case 'load-params':
            loadParamsWithReset(index, appName, endpoint);
            break;
        case 'copy-headers':
            copyHeaders(index, appName);
            break;
        case 'save-headers-server':
            saveAllAppHeaders(appName);
            break;
        case 'reset-headers-server':
            resetAppHeaders(appName);
            break;
        case 'copy-headers-json':
            copyAppHeaders(appName);
            break;
    }

    if (e.target.classList.contains('api-header')) {
        toggleAPIDetails(index, appName, endpoint);
    }
}

function handleDelegatedChange(e) {
    if (e.target.classList.contains('shared-header-input')) {
        const appName = e.target.dataset.appName;
        const headerName = e.target.dataset.headerName;
        saveAppHeader(appName, headerName, e.target.value);
    }
}

async function loadAppAPIs() {
    const appSelectEl = document.getElementById("app-select");
    const selectedApp = appSelectEl.value;
    const apiListDiv = document.getElementById("api-list");
    const searchContainer = document.getElementById("api-search-container");

    apiListDiv.innerHTML = '';
    searchContainer.classList.add('hidden');
    currentAppAPIs = [];

    if (!selectedApp) {
        apiListDiv.innerHTML = '<p class="text-center text-gray-500 py-8">Select an application to view and test its available APIs</p>';
        return;
    }

    localStorage.setItem('selected_app', selectedApp);
    const appAPIs = apiData[selectedApp];
    searchContainer.classList.remove('hidden');

    await populateSharedHeaders(selectedApp, appAPIs.supported_headers);

    currentAppAPIs = [];
    document.getElementById("api-search").value = "";

    const endpoints = appAPIs.endpoints;
    for (const [index, api] of endpoints.entries()) {
        currentAppAPIs.push({ ...api, apiIndex: index + 1 });
        const apiItem = await createAPIItem(api, index, selectedApp);
        apiListDiv.appendChild(apiItem);
    }
}

async function createAPIItem(api, index, appName) {
    const featureParts = api.feature.split('|');
    const authAndMethod = featureParts[0];
    const description = featureParts[1] || '';
    const controller = featureParts[2] || '';

    const method = ApiUtils.extractMethod(authAndMethod);
    const endpoint = ApiUtils.extractEndpoint(api.path);
    const fullUrl = api.path;
    const cachedAppHeaders = loadAppHeadersFromCache(appName);
    const presetJson = ApiUtils.generatePresetJson(api.feature, method, appName, cachedAppHeaders);

    const template = await TemplateUtils.loadTemplate(TEMPLATE_URLS.API_ITEM);
    const apiItem = TemplateUtils.renderToElement(template, {
        index: index,
        number: index + 1,
        method: method,
        endpoint: endpoint,
        description: description,
        appName: appName,
        fullUrl: fullUrl,
        presetJson: presetJson,
        headersInfo: ''
    });

    const featureDocsContainer = apiItem.querySelector('.feature-docs-container');
    if (featureDocsContainer) {
        const featureDocs = await createFeatureDocs(api.feature, authAndMethod, method, description, controller);
        featureDocsContainer.appendChild(featureDocs);
    }

    return apiItem;
}

async function createFeatureDocs(feature, authAndMethod, method, description, controller) {
    const parsedFeature = ApiUtils.parseFeatureString(feature);
    const authRequired = authAndMethod.includes('auth_required') ? 'Required' : 'Not Required';

    const template = await TemplateUtils.loadTemplate(TEMPLATE_URLS.FEATURE_DOCS);
    const featureDocs = TemplateUtils.renderToElement(template, {});

    const authSpan = featureDocs.querySelector('.auth-required');
    if (authSpan) {
        authSpan.textContent = authRequired;
        authSpan.className = `px-2 py-1 rounded text-xs font-medium ${authRequired === 'Required' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`;
    }

    const methodSpan = featureDocs.querySelector('.method-value');
    if (methodSpan) {
        methodSpan.textContent = method;
        methodSpan.className = `px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800`;
    }

    const descContainer = featureDocs.querySelector('.description-container');
    if (descContainer && description) {
        descContainer.innerHTML = `<strong>Description:</strong> ${TemplateUtils.escapeHtml(description)}<br>`;
    }

    const ctrlContainer = featureDocs.querySelector('.controller-container');
    if (ctrlContainer && controller) {
        ctrlContainer.innerHTML = `<strong>Controller:</strong> ${TemplateUtils.escapeHtml(controller)}<br>`;
    }

    const tagsContainer = featureDocs.querySelector('.tags-container');
    if (tagsContainer && parsedFeature.tags.length > 0) {
        tagsContainer.innerHTML = `<strong>Tags:</strong> ${parsedFeature.tags.join(', ')}<br>`;
    }

    const paramsContainer = featureDocs.querySelector('.parameters-container');
    if (paramsContainer && Object.keys(parsedFeature.params).length > 0) {
        let paramsHtml = '<strong>Parameters:</strong><br><div class="parameters-list mt-2 space-y-1">';
        Object.values(parsedFeature.params).forEach(param => {
            const required = param.requirement === 'required' ? '* ' : '  ';
            paramsHtml += `<div class="parameter-item text-sm">${required}<code class="bg-gray-100 px-1 rounded">${TemplateUtils.escapeHtml(param.name)}</code> (${TemplateUtils.escapeHtml(param.type)}) - ${TemplateUtils.escapeHtml(param.requirement)} - Example: "${TemplateUtils.escapeHtml(param.example)}"</div>`;
        });
        paramsHtml += '</div>';
        paramsContainer.innerHTML = paramsHtml;
    }

    const responseContainer = featureDocs.querySelector('.response-container');
    if (responseContainer && Object.keys(parsedFeature.response).length > 0) {
        let responseHtml = '<strong>Response:</strong><br><div class="response-list mt-2 space-y-1">';
        Object.values(parsedFeature.response).forEach(resp => {
            responseHtml += `<div class="response-item text-sm">- <code class="bg-gray-100 px-1 rounded">${TemplateUtils.escapeHtml(resp.name)}</code> (${TemplateUtils.escapeHtml(resp.type)}) - ${TemplateUtils.escapeHtml(resp.example)}</div>`;
        });
        responseHtml += '</div>';
        responseContainer.innerHTML = responseHtml;
    }

    return featureDocs;
}

async function populateSharedHeaders(appName, supportedHeaders) {
    const apiListDiv = document.getElementById('api-list');
    const existingSharedHeaders = apiListDiv.querySelector('.shared-headers-card');
    if (existingSharedHeaders) {
        existingSharedHeaders.remove();
    }

    const cachedAppHeaders = loadAppHeadersFromCache(appName);
    const template = await TemplateUtils.loadTemplate(TEMPLATE_URLS.SHARED_HEADERS_SECTION);
    const section = TemplateUtils.renderToElement(template, { appName: appName });

    const headersGrid = section.querySelector(`#shared-headers-${appName}`);
    const headerItemTemplate = await TemplateUtils.loadTemplate(TEMPLATE_URLS.SHARED_HEADER_ITEM);

    for (const [headerName, headerDescription] of Object.entries(supportedHeaders)) {
        const currentValue = cachedAppHeaders[headerName] || '';
        const headerItem = TemplateUtils.renderToElement(headerItemTemplate, {
            headerName: headerName,
            appName: appName,
            headerValue: currentValue,
            headerDescription: headerDescription
        });
        headersGrid.appendChild(headerItem);
    }

    apiListDiv.insertBefore(section, apiListDiv.firstChild);
}

function loadAppHeadersFromCache(appName) {
    const cacheKey = 'app_headers_' + appName;
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : {};
}

function saveAppHeader(appName, headerName, value) {
    const cacheKey = 'app_headers_' + appName;
    let headers = loadAppHeadersFromCache(appName);
    headers[headerName] = value;
    localStorage.setItem(cacheKey, JSON.stringify(headers));
    cachedHeaders[appName] = headers;
    const saveData = { app_name: appName, headers: headers };
    apiClientInstance.json(ApiClient.PointUrlKey.API_HEADERS_CACHE_SAVE, 'POST', saveData);
    showStatus(`Header "${headerName}" saved for ${appName}`, 'success');
}

function saveAllAppHeaders(appName) {
    const headers = {};
    const supportedHeaders = apiData[appName].supported_headers;
    Object.keys(supportedHeaders).forEach(headerName => {
        const input = document.querySelector(`.shared-header-input[data-app-name="${appName}"][data-header-name="${headerName}"]`);
        if (input) headers[headerName] = input.value;
    });
    const cacheKey = 'app_headers_' + appName;
    localStorage.setItem(cacheKey, JSON.stringify(headers));
    cachedHeaders[appName] = headers;
    const saveData = { app_name: appName, headers: headers };
    apiClientInstance.json(ApiClient.PointUrlKey.API_HEADERS_CACHE_SAVE, 'POST', saveData);
    showStatus(`All headers saved for ${appName}`, 'success');
}

function resetAppHeaders(appName) {
    if (!confirm(`Are you sure you want to reset all headers for ${appName} to default values? This will clear all cached values.`)) {
        return;
    }
    const cacheKey = 'app_headers_' + appName;
    localStorage.removeItem(cacheKey);
    delete cachedHeaders[appName];
    const resetData = { app_name: appName };
    apiClientInstance.json(ApiClient.PointUrlKey.API_HEADERS_CACHE_RESET, 'POST', resetData);
    loadAppAPIs();
    showStatus(`Headers reset for ${appName}`, 'success');
}

function copyAppHeaders(appName) {
    const headers = loadAppHeadersFromCache(appName);
    const headersJson = JSON.stringify(headers, null, 2);
    navigator.clipboard.writeText(headersJson).then(() => {
        showStatus('Headers JSON copied to clipboard!', 'success');
    });
}

function toggleAPIDetails(index, appName, endpoint) {
    const details = document.getElementById("details-" + index);
    const toggle = document.getElementById("toggle-" + index);

    if (details && toggle) {
        details.classList.toggle('hidden');
        toggle.textContent = details.classList.contains('hidden') ? "▼" : "▲";
        loadParams(index, appName, endpoint);
    }
}

function saveParams(index, appName, endpoint, method) {
    const params = document.getElementById("params-" + index)?.value;
    if (!params) return;

    saveToBrowserCache(appName, endpoint, params);
    const saveData = {
        app_name: appName,
        api_endpoint: endpoint,
        method: method,
        params: params
    };
    apiClientInstance.json(ApiClient.PointUrlKey.API_PARAMS_CACHE_SAVE, 'POST', saveData);
    showStatus('Parameters saved', 'success');
}

function loadParams(index, appName, endpoint) {
    const paramsTextarea = document.getElementById("params-" + index);
    if (!paramsTextarea) return;

    const browserCached = loadFromBrowserCache(appName, endpoint);
    if (browserCached) {
        paramsTextarea.value = browserCached;
        return;
    }

    const url = ApiClient.PointUrlKey.API_PARAMS_CACHE_LOAD + '?' + new URLSearchParams({
        app_name: appName,
        api_endpoint: endpoint
    });
    apiClientInstance.json(url, 'GET').then(result => {
        if (result.data && result.data.params) {
            paramsTextarea.value = result.data.params;
            saveToBrowserCache(appName, endpoint, result.data.params);
        }
    }).catch(err => {
        console.error('Failed to load params:', err);
    });
}

function loadParamsWithReset(index, appName, endpoint) {
    if (!confirm('This will reset parameters to parsed defaults and may override your current changes. Continue?')) {
        return;
    }

    const paramsTextarea = document.getElementById("params-" + index);
    if (!paramsTextarea) return;

    const apiInfo = apiData[appName];
    const api = apiInfo.endpoints.find(ep => ep.path.includes(endpoint));
    if (!api) return;

    const method = ApiUtils.extractMethod(api.feature);
    const cachedAppHeaders = loadAppHeadersFromCache(appName);
    const parsedParams = ApiUtils.generatePresetJson(api.feature, method, appName, cachedAppHeaders);
    paramsTextarea.value = parsedParams;
    showStatus('Parameters reset to parsed defaults', 'success');
}

async function testAPI(index, method, appName, endpoint) {
    const url = document.getElementById("url-" + index)?.value;
    const params = document.getElementById("params-" + index)?.value;
    const responseDiv = document.getElementById("response-" + index);

    if (!url || !responseDiv) return;

    responseDiv.classList.remove('hidden');
    responseDiv.innerHTML = '<div class="loading text-gray-500">Sending request...</div>';

    let requestOptions = {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    };

    if (params) {
        try {
            JSON.parse(params);
            requestOptions.body = params;
        } catch (e) {
            responseDiv.innerHTML = `<div class="text-red-600">Invalid JSON in parameters: ${e.message}</div>`;
            return;
        }
    }

    try {
        const response = await fetch(url, requestOptions);
        const text = await response.text();
        const responseText = ApiUtils.formatResponse(response, text);
        responseDiv.innerHTML = `<pre class="bg-gray-50 p-4 rounded text-sm overflow-auto">${TemplateUtils.escapeHtml(responseText)}</pre>`;

        if (response.ok && params) {
            saveToBrowserCache(appName, endpoint, params);
        }
    } catch (error) {
        responseDiv.innerHTML = `<div class="text-red-600">Request failed: ${error.message}</div>`;
    }
}

function searchAndJumpToAPI(searchTerm) {
    clearTimeout(searchTimeout);
    document.querySelectorAll('.api-item').forEach(item => {
        item.classList.remove('search-highlighted');
    });

    searchTimeout = setTimeout(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return;

        let bestMatch = null;
        let bestScore = 0;

        currentAppAPIs.forEach((api, arrayIndex) => {
            const score = calculateMatchScore(api, term, arrayIndex);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = { api, index: arrayIndex, score };
            }
        });

        if (bestMatch) {
            jumpToAPI(bestMatch.index);
        }
    }, 300);
}

function calculateMatchScore(api, term, index) {
    let score = 0;
    const apiNumber = (index + 1).toString();
    const path = api.path.toLowerCase();
    const feature = api.feature.toLowerCase();
    const method = ApiUtils.extractMethod(api.feature).toLowerCase();
    const featureParts = feature.split('|');
    const description = featureParts[1]?.toLowerCase() || '';
    const endpoint = ApiUtils.extractEndpoint(path).toLowerCase();

    if (term === apiNumber) return 1000;
    if (apiNumber.startsWith(term)) score += 500;
    if (endpoint === term) score += 800;
    if (endpoint.startsWith(term)) score += 400;
    if (endpoint.includes(term)) score += 200;
    if (path.includes(term)) score += 150;
    if (method === term) score += 300;
    if (description.includes(term)) score += 100;
    if (feature.includes(term)) score += 50;

    score += calculateFuzzyScore(endpoint, term) * 10;
    score += calculateFuzzyScore(description, term) * 5;

    return score;
}

function calculateFuzzyScore(text, term) {
    let score = 0;
    let termIndex = 0;

    for (let i = 0; i < text.length && termIndex < term.length; i++) {
        if (text[i] === term[termIndex]) {
            score++;
            termIndex++;
            if (i > 0 && text[i - 1] === term[termIndex - 2]) {
                score += 0.5;
            }
        }
    }

    return termIndex === term.length ? score / term.length : 0;
}

function jumpToAPI(apiIndex) {
    const apiItem = document.getElementById('api-item-' + apiIndex);
    if (!apiItem) return;

    apiItem.classList.add('search-highlighted');
    apiItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const details = document.getElementById('details-' + apiIndex);
    const toggle = document.getElementById('toggle-' + apiIndex);

    setTimeout(() => {
        if (details) details.classList.remove('hidden');
        if (toggle) toggle.textContent = '▲';
        const selectedApp = document.getElementById("app-select")?.value;
        if (selectedApp) {
            const api = currentAppAPIs[apiIndex];
            const endpoint = ApiUtils.extractEndpoint(api.path);
            loadParams(apiIndex, selectedApp, endpoint);
        }
    }, 500);

    showStatus(`Jumped to API #${apiIndex + 1}`, 'success');
}

function copyHeaders(index, appName) {
    const headers = apiData[appName]?.supported_headers || {};
    const headersJson = JSON.stringify(headers, null, 2);
    navigator.clipboard.writeText(headersJson).then(() => {
        showStatus('Headers copied to clipboard!', 'success');
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
    cachedParams = cached ? JSON.parse(cached) : {};
    const cachedItem = cachedParams[cacheKey];
    return cachedItem ? cachedItem.params : null;
}

function showStatus(message, type) {
    const statusEl = document.createElement('div');
    statusEl.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 ${
        type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    statusEl.textContent = message;
    document.body.appendChild(statusEl);
    setTimeout(() => statusEl.remove(), 3000);
}

