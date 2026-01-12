/**
 * API Testing Section - Fully Refactored
 * NO HTML generation in JS - all HTML in templates
 * JS only handles API calls and JSON data processing
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
    SHARED_HEADER_ITEM: '/debug-assets/debug-tools/templates/shared-header-item.html',
    EMPTY_STATE: '/debug-assets/debug-tools/templates/empty-state.html',
    LOADING_STATE: '/debug-assets/debug-tools/templates/loading-state.html',
    ERROR_MESSAGE: '/debug-assets/debug-tools/templates/error-message.html',
    SUCCESS_MESSAGE: '/debug-assets/debug-tools/templates/success-message.html',
    RESPONSE_DISPLAY: '/debug-assets/debug-tools/templates/response-display.html',
    APP_OPTION: '/debug-assets/debug-tools/templates/app-option.html',
    FEATURE_PARAMS_LIST: '/debug-assets/debug-tools/templates/feature-params-list.html',
    FEATURE_RESPONSE_LIST: '/debug-assets/debug-tools/templates/feature-response-list.html',
    STATUS_TOAST: '/debug-assets/debug-tools/templates/status-toast.html'
};

document.addEventListener('DOMContentLoaded', async function() {
    await loadInitialData();
    setupEventListeners();
});

async function loadInitialData() {
    try {
        let data;
        try {
            data = await apiClientInstance.json(ApiClient.PointUrlKey.API_INFO, 'GET');
        } catch (apiError) {
            console.error('API call failed:', apiError);
            data = { api_reference: {}, public_info: {} };
        }
        apiData = data.api_reference || {};
        publicInfo = data.public_info || {};

        const appSelect = document.getElementById("app-select");
        if (!appSelect) return;

        if (apiData && typeof apiData === 'object' && Object.keys(apiData).length > 0) {
            const optionTemplate = await TemplateUtils.loadTemplate(TEMPLATE_URLS.APP_OPTION);
            Object.keys(apiData).forEach(appName => {
                const option = TemplateUtils.renderToElement(optionTemplate, { appName: appName });
                appSelect.appendChild(option);
            });

            const cachedApp = localStorage.getItem('selected_app');
            const firstApp = Object.keys(apiData)[0];
            const selectedApp = cachedApp || firstApp;
            if (selectedApp) {
                appSelect.value = selectedApp;
                localStorage.setItem('selected_app', selectedApp);
                await loadAppAPIs();
            }
        } else {
            const emptyTemplate = await TemplateUtils.loadTemplate(TEMPLATE_URLS.EMPTY_STATE);
            const emptyEl = TemplateUtils.renderToElement(emptyTemplate, { 
                message: 'No applications available' 
            });
            appSelect.parentElement.appendChild(emptyEl);
        }
    } catch (error) {
        console.error('Failed to load initial data:', error);
        const appSelect = document.getElementById("app-select");
        if (appSelect) {
            const errorTemplate = await TemplateUtils.loadTemplate(TEMPLATE_URLS.ERROR_MESSAGE);
            const errorEl = TemplateUtils.renderToElement(errorTemplate, { 
                message: 'Failed to load applications' 
            });
            appSelect.parentElement.appendChild(errorEl);
        }
    }
}

function setupEventListeners() {
    const appSelect = document.getElementById("app-select");
    if (appSelect) {
        appSelect.addEventListener('change', loadAppAPIs);
    }

    const apiSearch = document.getElementById("api-search");
    if (apiSearch) {
        apiSearch.addEventListener('input', (e) => searchAndJumpToAPI(e.target.value));
    }

    document.addEventListener('click', handleDelegatedClick);
    document.addEventListener('change', handleDelegatedChange);
}

function handleDelegatedClick(e) {
    const action = e.target.dataset.action;
    if (!action) {
        if (e.target.classList.contains('api-header')) {
            const index = parseInt(e.target.dataset.index);
            const appName = e.target.dataset.appName;
            const endpoint = e.target.dataset.endpoint;
            toggleAPIDetails(index, appName, endpoint);
        }
        return;
    }

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
    if (!appSelectEl) return;

    const selectedApp = appSelectEl.value;
    const apiListDiv = document.getElementById("api-list");
    const searchContainer = document.getElementById("api-search-container");

    if (!apiListDiv || !searchContainer) return;

    DomUtils.clear(apiListDiv);
    DomUtils.addClass(searchContainer, 'hidden');
    currentAppAPIs = [];

    if (!selectedApp || !apiData || !apiData[selectedApp]) {
        const emptyTemplate = await TemplateUtils.loadTemplate(TEMPLATE_URLS.EMPTY_STATE);
        const emptyEl = TemplateUtils.renderToElement(emptyTemplate, { 
            message: 'Select an application to view and test its available APIs' 
        });
        apiListDiv.appendChild(emptyEl);
        return;
    }

    localStorage.setItem('selected_app', selectedApp);
    const appAPIs = apiData[selectedApp];
    DomUtils.removeClass(searchContainer, 'hidden');

    if (appAPIs.supported_headers && typeof appAPIs.supported_headers === 'object') {
        await populateSharedHeaders(selectedApp, appAPIs.supported_headers);
    }

    currentAppAPIs = [];
    const apiSearchEl = document.getElementById("api-search");
    if (apiSearchEl) apiSearchEl.value = "";

    const endpoints = appAPIs.endpoints || [];
    if (endpoints.length === 0) {
        const emptyTemplate = await TemplateUtils.loadTemplate(TEMPLATE_URLS.EMPTY_STATE);
        const emptyEl = TemplateUtils.renderToElement(emptyTemplate, { 
            message: 'No endpoints found for this application' 
        });
        apiListDiv.appendChild(emptyEl);
        return;
    }

    for (const [index, api] of endpoints.entries()) {
        currentAppAPIs.push({ ...api, apiIndex: index + 1 });
        const apiItem = await createAPIItem(api, index, selectedApp);
        if (apiItem) {
            apiListDiv.appendChild(apiItem);
        }
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
        if (featureDocs) {
            featureDocsContainer.appendChild(featureDocs);
        }
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
        const descTemplate = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/feature-description.html');
        const descEl = TemplateUtils.renderToElement(descTemplate, { description: TemplateUtils.escapeHtml(description) });
        descContainer.appendChild(descEl);
    }

    const ctrlContainer = featureDocs.querySelector('.controller-container');
    if (ctrlContainer && controller) {
        const ctrlTemplate = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/feature-controller.html');
        const ctrlEl = TemplateUtils.renderToElement(ctrlTemplate, { controller: TemplateUtils.escapeHtml(controller) });
        ctrlContainer.appendChild(ctrlEl);
    }

    const tagsContainer = featureDocs.querySelector('.tags-container');
    if (tagsContainer && parsedFeature.tags.length > 0) {
        const tagsTemplate = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/feature-tags.html');
        const tagsEl = TemplateUtils.renderToElement(tagsTemplate, { tags: parsedFeature.tags.join(', ') });
        tagsContainer.appendChild(tagsEl);
    }

    const paramsContainer = featureDocs.querySelector('.parameters-container');
    if (paramsContainer && Object.keys(parsedFeature.params).length > 0) {
        const paramsTitleTemplate = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/feature-params-title.html');
        const paramsTitleEl = TemplateUtils.renderToElement(paramsTitleTemplate, {});
        paramsContainer.appendChild(paramsTitleEl);
        
        const paramsListTemplate = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/feature-params-list.html');
        const paramsListContainerTemplate = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/parameters-list-container.html');
        
        let paramsItemsHtml = '';
        Object.values(parsedFeature.params).forEach(param => {
            const required = param.requirement === 'required' ? '* ' : '  ';
            paramsItemsHtml += TemplateUtils.renderTemplate(paramsListTemplate, {
                required: required,
                name: TemplateUtils.escapeHtml(param.name),
                type: TemplateUtils.escapeHtml(param.type),
                requirement: TemplateUtils.escapeHtml(param.requirement),
                example: TemplateUtils.escapeHtml(param.example)
            });
        });
        
        const paramsList = TemplateUtils.renderToElement(paramsListContainerTemplate, { items: paramsItemsHtml });
        paramsContainer.appendChild(paramsList);
    }

    const responseContainer = featureDocs.querySelector('.response-container');
    if (responseContainer && Object.keys(parsedFeature.response).length > 0) {
        const responseTitleTemplate = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/feature-response-title.html');
        const responseTitleEl = TemplateUtils.renderToElement(responseTitleTemplate, {});
        responseContainer.appendChild(responseTitleEl);
        
        const responseListTemplate = await TemplateUtils.loadTemplate(TEMPLATE_URLS.FEATURE_RESPONSE_LIST);
        const responseListContainerTemplate = await TemplateUtils.loadTemplate('/debug-assets/debug-tools/templates/response-list-container.html');
        
        let responseItemsHtml = '';
        Object.values(parsedFeature.response).forEach(resp => {
            responseItemsHtml += TemplateUtils.renderTemplate(responseListTemplate, {
                name: TemplateUtils.escapeHtml(resp.name),
                type: TemplateUtils.escapeHtml(resp.type),
                example: TemplateUtils.escapeHtml(resp.example)
            });
        });
        
        const responseList = TemplateUtils.renderToElement(responseListContainerTemplate, { items: responseItemsHtml });
        responseContainer.appendChild(responseList);
    }

    return featureDocs;
}

async function populateSharedHeaders(appName, supportedHeaders) {
    const apiListDiv = document.getElementById('api-list');
    if (!apiListDiv) return;

    const existingSharedHeaders = apiListDiv.querySelector('.shared-headers-card');
    if (existingSharedHeaders) {
        existingSharedHeaders.remove();
    }

    const cachedAppHeaders = loadAppHeadersFromCache(appName);
    const template = await TemplateUtils.loadTemplate(TEMPLATE_URLS.SHARED_HEADERS_SECTION);
    const section = TemplateUtils.renderToElement(template, { appName: appName });

    const headersGrid = section.querySelector(`#shared-headers-${appName}`);
    if (!headersGrid) return;

    const headerItemTemplate = await TemplateUtils.loadTemplate(TEMPLATE_URLS.SHARED_HEADER_ITEM);

    if (!supportedHeaders || typeof supportedHeaders !== 'object') {
        return;
    }

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
    apiClientInstance.post(ApiClient.PointUrlKey.API_HEADERS_CACHE_SAVE, saveData).catch(err => {
        console.error('Failed to save header:', err);
    });
    showStatus(`Header "${headerName}" saved for ${appName}`, 'success');
}

function saveAllAppHeaders(appName) {
    const headers = {};
    const supportedHeaders = apiData[appName]?.supported_headers || {};
    Object.keys(supportedHeaders).forEach(headerName => {
        const input = document.querySelector(`.shared-header-input[data-app-name="${appName}"][data-header-name="${headerName}"]`);
        if (input) headers[headerName] = input.value;
    });
    const cacheKey = 'app_headers_' + appName;
    localStorage.setItem(cacheKey, JSON.stringify(headers));
    cachedHeaders[appName] = headers;
    const saveData = { app_name: appName, headers: headers };
    apiClientInstance.post(ApiClient.PointUrlKey.API_HEADERS_CACHE_SAVE, saveData).catch(err => {
        console.error('Failed to save headers:', err);
    });
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
    apiClientInstance.post(ApiClient.PointUrlKey.API_HEADERS_CACHE_RESET, resetData).catch(err => {
        console.error('Failed to reset headers:', err);
    });
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
        DomUtils.toggleClass(details, 'hidden');
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
    apiClientInstance.post(ApiClient.PointUrlKey.API_PARAMS_CACHE_SAVE, saveData).catch(err => {
        console.error('Failed to save params:', err);
    });
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
    apiClientInstance.get(url).then(async response => {
        const result = await response.json();
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
    if (!apiInfo || !apiInfo.endpoints) return;

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

    DomUtils.removeClass(responseDiv, 'hidden');
    
    const loadingTemplate = await TemplateUtils.loadTemplate(TEMPLATE_URLS.LOADING_STATE);
    const loadingEl = TemplateUtils.renderToElement(loadingTemplate, { message: 'Sending request...' });
    DomUtils.clear(responseDiv);
    responseDiv.appendChild(loadingEl);

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
            const errorTemplate = await TemplateUtils.loadTemplate(TEMPLATE_URLS.ERROR_MESSAGE);
            const errorEl = TemplateUtils.renderToElement(errorTemplate, { 
                message: `Invalid JSON in parameters: ${e.message}` 
            });
            DomUtils.clear(responseDiv);
            responseDiv.appendChild(errorEl);
            return;
        }
    }

    try {
        const response = await fetch(url, requestOptions);
        const text = await response.text();
        const responseText = ApiUtils.formatResponse(response, text);
        
        const responseTemplate = await TemplateUtils.loadTemplate(TEMPLATE_URLS.RESPONSE_DISPLAY);
        const responseEl = TemplateUtils.renderToElement(responseTemplate, { 
            content: TemplateUtils.escapeHtml(responseText) 
        });
        DomUtils.clear(responseDiv);
        responseDiv.appendChild(responseEl);

        if (response.ok && params) {
            saveToBrowserCache(appName, endpoint, params);
        }
    } catch (error) {
        const errorTemplate = await TemplateUtils.loadTemplate(TEMPLATE_URLS.ERROR_MESSAGE);
        const errorEl = TemplateUtils.renderToElement(errorTemplate, { 
            message: `Request failed: ${error.message}` 
        });
        DomUtils.clear(responseDiv);
        responseDiv.appendChild(errorEl);
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
        if (details) DomUtils.removeClass(details, 'hidden');
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

async function showStatus(message, type) {
    const typeClass = type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white';
    const template = await TemplateUtils.loadTemplate(TEMPLATE_URLS.STATUS_TOAST);
    const statusEl = TemplateUtils.renderToElement(template, { 
        message: message,
        typeClass: typeClass
    });
    document.body.appendChild(statusEl);
    setTimeout(() => {
        if (statusEl.parentNode) {
            statusEl.parentNode.removeChild(statusEl);
        }
    }, 3000);
}
