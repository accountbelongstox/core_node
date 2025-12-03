/**
 * API Testing Section
 * FILE: api-testing-section.js
 * PURPOSE: API Testing functionality for iframe-based section
 */

let apiData = {};
let publicInfo = {};
let cachedParams = {};
let cachedHeaders = {};
let currentAppAPIs = [];
let searchTimeout;

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
        const appInfo = apiData[appName];
        const option = document.createElement("option");
        option.value = appName;
        option.textContent = appName;
        appSelect.appendChild(option);
    });

    const cachedApp = localStorage.getItem('selected_app');
    const firstApp = Object.keys(apiData)[0];
    const selectedApp = cachedApp ? cachedApp : firstApp;
    appSelect.value = selectedApp;
    localStorage.setItem('selected_app', selectedApp);
    loadAppAPIs();
}

function setupEventListeners() {
    const appSelect = document.getElementById("app-select");
    appSelect.addEventListener('change', loadAppAPIs);

    const apiSearch = document.getElementById("api-search");
    apiSearch.addEventListener('input', (e) => searchAndJumpToAPI(e.target.value));

    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const sectionType = this.dataset.tab;
            window.parent.showSection(sectionType);
            setActiveTab(this);
        });
    });
}

function setActiveTab(activeTab) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    activeTab.classList.add('active');
}

async function loadAppAPIs() {
    const appSelectEl = document.getElementById("app-select");
    const selectedApp = appSelectEl.value;
    const apiListDiv = document.getElementById("api-list");
    const searchContainer = document.getElementById("api-search-container");

    while (apiListDiv.firstChild) {
        apiListDiv.removeChild(apiListDiv.firstChild);
    }
    searchContainer.classList.add('hidden');
    currentAppAPIs = [];

    if (!selectedApp) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'api-list-empty';
        emptyMsg.textContent = 'Select an application to view and test its available APIs';
        apiListDiv.appendChild(emptyMsg);
        return;
    }

    localStorage.setItem('selected_app', selectedApp);

    const appAPIs = apiData[selectedApp];
    const fragment = document.createDocumentFragment();

    searchContainer.classList.remove('hidden');

    populateSharedHeaders(selectedApp, appAPIs.supported_headers);

    currentAppAPIs = [];
    const apiSearchEl = document.getElementById("api-search");
    apiSearchEl.value = "";

    const endpoints = appAPIs.endpoints;
    for (const [index, api] of endpoints.entries()) {
        currentAppAPIs.push({ ...api, apiIndex: index + 1 });
        const apiItem = await createAPIItem(api, index, selectedApp);
        fragment.appendChild(apiItem);
    }

    apiListDiv.appendChild(fragment);
    attachAPIItemListeners();
}

function createCardElement() {
    const card = document.createElement('div');
    card.className = 'card';
    return card;
}

async function createAPIItem(api, index, appName) {
    const apiPath = api.path;
    const feature = api.feature;

    const featureParts = feature.split('|');
    const authAndMethod = featureParts[0];
    const description = featureParts[1];
    const controller = featureParts[2];

    const method = extractMethodFromFeature(authAndMethod);
    const endpoint = extractEndpointFromPath(apiPath);
    const fullUrl = apiPath;

    const featureDocs = await createFeatureDocs(feature, authAndMethod, method, description, controller);
    const presetJson = generatePresetJson(feature, method, appName);

    const apiItem = document.createElement('div');
    apiItem.className = 'api-item';
    apiItem.id = `api-item-${index}`;

    const apiNumber = document.createElement('div');
    apiNumber.className = 'api-number';
    apiNumber.textContent = '#' + (index + 1);

    const apiHeader = document.createElement('div');
    apiHeader.className = 'api-header';
    apiHeader.dataset.index = index;
    apiHeader.dataset.appName = appName;
    apiHeader.dataset.endpoint = endpoint;

    const headerContent = document.createElement('div');
    const methodSpan = document.createElement('span');
    methodSpan.className = 'api-method method-' + method.toLowerCase();
    methodSpan.textContent = method;

    const endpointStrong = document.createElement('strong');
    endpointStrong.className = 'api-endpoint';
    endpointStrong.textContent = endpoint;

    const descSpan = document.createElement('span');
    descSpan.textContent = ' ' + description;

    headerContent.appendChild(methodSpan);
    headerContent.appendChild(endpointStrong);
    headerContent.appendChild(descSpan);

    const toggle = document.createElement('span');
    toggle.id = 'toggle-' + index;
    toggle.textContent = '▼';

    apiHeader.appendChild(headerContent);
    apiHeader.appendChild(toggle);

    const detailsDiv = document.createElement('div');
    detailsDiv.id = 'details-' + index;
    detailsDiv.className = 'api-details hidden';

    const featureDocsContainer = document.createElement('div');
    featureDocsContainer.className = 'feature-docs-container';
    const tempDiv = document.createElement('div');
    tempDiv.insertAdjacentHTML('afterbegin', featureDocs);
    const featureDocsElement = tempDiv.firstElementChild;
    if (featureDocsElement) {
        featureDocsContainer.appendChild(featureDocsElement);
    }

    const urlFormGroup = document.createElement('div');
    urlFormGroup.className = 'form-group';
    const urlLabel = document.createElement('label');
    urlLabel.className = 'form-label';
    urlLabel.textContent = 'API Endpoint URL:';
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.id = 'url-' + index;
    urlInput.className = 'form-control';
    urlInput.value = fullUrl;
    urlFormGroup.appendChild(urlLabel);
    urlFormGroup.appendChild(urlInput);

    const paramsFormGroup = document.createElement('div');
    paramsFormGroup.className = 'form-group';
    const paramsLabel = document.createElement('label');
    paramsLabel.className = 'form-label';
    paramsLabel.textContent = 'Request Parameters (JSON):';
    const paramsTextarea = document.createElement('textarea');
    paramsTextarea.id = 'params-' + index;
    paramsTextarea.className = 'form-control';
    paramsTextarea.placeholder = 'Enter JSON parameters';
    paramsTextarea.rows = 6;
    paramsTextarea.value = presetJson;
    paramsFormGroup.appendChild(paramsLabel);
    paramsFormGroup.appendChild(paramsTextarea);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group';

    const testBtn = document.createElement('button');
    testBtn.className = 'btn btn-primary';
    testBtn.dataset.action = 'test-api';
    testBtn.dataset.index = index;
    testBtn.dataset.method = method;
    testBtn.dataset.appName = appName;
    testBtn.dataset.endpoint = endpoint;
    testBtn.textContent = 'Send Request';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-secondary';
    saveBtn.dataset.action = 'save-params';
    saveBtn.dataset.index = index;
    saveBtn.dataset.appName = appName;
    saveBtn.dataset.endpoint = endpoint;
    saveBtn.dataset.method = method;
    saveBtn.textContent = 'Save Params';

    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn btn-secondary';
    loadBtn.dataset.action = 'load-params';
    loadBtn.dataset.index = index;
    loadBtn.dataset.appName = appName;
    loadBtn.dataset.endpoint = endpoint;
    loadBtn.textContent = 'Load Params';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-success';
    copyBtn.dataset.action = 'copy-headers';
    copyBtn.dataset.index = index;
    copyBtn.dataset.appName = appName;
    copyBtn.textContent = 'Copy Headers';

    btnGroup.appendChild(testBtn);
    btnGroup.appendChild(saveBtn);
    btnGroup.appendChild(loadBtn);
    btnGroup.appendChild(copyBtn);

    const responseArea = document.createElement('div');
    responseArea.id = 'response-' + index;
    responseArea.className = 'response-area';

    detailsDiv.appendChild(featureDocsContainer);
    detailsDiv.appendChild(urlFormGroup);
    detailsDiv.appendChild(paramsFormGroup);
    detailsDiv.appendChild(btnGroup);
    detailsDiv.appendChild(responseArea);

    apiItem.appendChild(apiNumber);
    apiItem.appendChild(apiHeader);
    apiItem.appendChild(detailsDiv);

    return apiItem;
}

async function createFeatureDocs(feature, authAndMethod, method, description, controller) {
    const parsedFeature = parseFeatureString(feature);
    const authRequired = authAndMethod.includes('auth_required') ? 'Required' : 'Not Required';
    
    const featureDocs = document.createElement('div');
    featureDocs.className = 'feature-docs';

    const title = document.createElement('h5');
    title.className = 'feature-docs-title';
    title.textContent = 'API Details:';
    featureDocs.appendChild(title);

    const content = document.createElement('div');
    content.className = 'feature-docs-content';

    const authStrong = document.createElement('strong');
    authStrong.textContent = 'Authentication: ';
    const authSpan = document.createElement('span');
    authSpan.className = 'auth-required';
    authSpan.textContent = authRequired;
    content.appendChild(authStrong);
    content.appendChild(authSpan);
    content.appendChild(document.createElement('br'));

    const methodStrong = document.createElement('strong');
    methodStrong.textContent = 'Method: ';
    const methodSpan = document.createElement('span');
    methodSpan.className = 'method-value';
    methodSpan.textContent = method;
    content.appendChild(methodStrong);
    content.appendChild(methodSpan);
    content.appendChild(document.createElement('br'));

    const descContainer = document.createElement('div');
    descContainer.className = 'description-container';
    const descStrong = document.createElement('strong');
    descStrong.textContent = 'Description: ';
    const descText = document.createTextNode(description);
    descContainer.appendChild(descStrong);
    descContainer.appendChild(descText);
    descContainer.appendChild(document.createElement('br'));
    content.appendChild(descContainer);

    const controllerContainer = document.createElement('div');
    controllerContainer.className = 'controller-container';
    const ctrlStrong = document.createElement('strong');
    ctrlStrong.textContent = 'Controller: ';
    const ctrlText = document.createTextNode(controller);
    controllerContainer.appendChild(ctrlStrong);
    controllerContainer.appendChild(ctrlText);
    controllerContainer.appendChild(document.createElement('br'));
    content.appendChild(controllerContainer);

    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'tags-container';
    const tagsStrong = document.createElement('strong');
    tagsStrong.textContent = 'Tags: ';
    const tagsText = document.createTextNode(parsedFeature.tags.join(', '));
    tagsContainer.appendChild(tagsStrong);
    tagsContainer.appendChild(tagsText);
    tagsContainer.appendChild(document.createElement('br'));
    content.appendChild(tagsContainer);

    featureDocs.appendChild(content);

    const parametersContainer = document.createElement('div');
    parametersContainer.className = 'parameters-container';
    const paramsTitle = document.createElement('strong');
    paramsTitle.textContent = 'Parameters:';
    parametersContainer.appendChild(paramsTitle);
    parametersContainer.appendChild(document.createElement('br'));
    const paramsDiv = document.createElement('div');
    paramsDiv.className = 'parameters-list';
    Object.values(parsedFeature.params).forEach(param => {
        const paramDiv = document.createElement('div');
        paramDiv.className = 'parameter-item';
        const required = param.requirement === 'required' ? '* ' : '  ';
        const code = document.createElement('code');
        code.textContent = param.name;
        paramDiv.appendChild(document.createTextNode(required));
        paramDiv.appendChild(code);
        paramDiv.appendChild(document.createTextNode(` (${param.type}) - ${param.requirement}`));
        paramDiv.appendChild(document.createTextNode(` - Example: "${param.example}"`));
        paramDiv.appendChild(document.createElement('br'));
        paramsDiv.appendChild(paramDiv);
    });
    parametersContainer.appendChild(paramsDiv);
    featureDocs.appendChild(parametersContainer);

    const responseContainer = document.createElement('div');
    responseContainer.className = 'response-container';
    const responseTitle = document.createElement('strong');
    responseTitle.textContent = 'Response:';
    responseContainer.appendChild(responseTitle);
    responseContainer.appendChild(document.createElement('br'));
    const responseDiv = document.createElement('div');
    responseDiv.className = 'response-list';
    Object.values(parsedFeature.response).forEach(resp => {
        const respDiv = document.createElement('div');
        respDiv.className = 'response-item';
        respDiv.appendChild(document.createTextNode('- '));
        const code = document.createElement('code');
        code.textContent = resp.name;
        respDiv.appendChild(code);
        respDiv.appendChild(document.createTextNode(` (${resp.type})`));
        respDiv.appendChild(document.createTextNode(` - ${resp.example}`));
        respDiv.appendChild(document.createElement('br'));
        responseDiv.appendChild(respDiv);
    });
    responseContainer.appendChild(responseDiv);
    featureDocs.appendChild(responseContainer);

    return featureDocs.outerHTML;
}

function attachAPIItemListeners() {
    document.querySelectorAll('.api-header').forEach(header => {
        header.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            const appName = this.dataset.appName;
            const endpoint = this.dataset.endpoint;
            toggleAPIDetails(index, appName, endpoint);
        });
    });

    document.querySelectorAll('[data-action="test-api"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            const method = this.dataset.method;
            const appName = this.dataset.appName;
            const endpoint = this.dataset.endpoint;
            testAPI(index, method, appName, endpoint);
        });
    });

    document.querySelectorAll('[data-action="save-params"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            const appName = this.dataset.appName;
            const endpoint = this.dataset.endpoint;
            const method = this.dataset.method;
            saveParams(index, appName, endpoint, method);
        });
    });

    document.querySelectorAll('[data-action="load-params"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            const appName = this.dataset.appName;
            const endpoint = this.dataset.endpoint;
            loadParamsWithReset(index, appName, endpoint);
        });
    });

    document.querySelectorAll('[data-action="copy-headers"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            const appName = this.dataset.appName;
            copyHeaders(index, appName);
        });
    });

    document.querySelectorAll('[data-action="save-headers-server"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const appName = this.dataset.appName;
            saveAllAppHeaders(appName);
        });
    });

    document.querySelectorAll('[data-action="reset-headers-server"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const appName = this.dataset.appName;
            resetAppHeaders(appName);
        });
    });

    document.querySelectorAll('[data-action="copy-headers-json"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const appName = this.dataset.appName;
            copyAppHeaders(appName);
        });
    });

    document.querySelectorAll('.shared-header-input').forEach(input => {
        input.addEventListener('change', function() {
            const appName = this.dataset.appName;
            const headerName = this.dataset.headerName;
            saveAppHeader(appName, headerName, this.value);
        });
    });
}

function populateSharedHeaders(appName, supportedHeaders) {
    const apiListDiv = document.getElementById('api-list');
    const existingSharedHeaders = apiListDiv.querySelector('.shared-headers-card');
    if (existingSharedHeaders) {
        apiListDiv.removeChild(existingSharedHeaders);
    }
    
    const cachedAppHeaders = loadAppHeadersFromCache(appName);
    
    const card = document.createElement('div');
    card.className = 'card shared-headers-card';
    
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header shared-headers-header';
    
    const title = document.createElement('h3');
    title.className = 'shared-headers-title';
    title.textContent = appName + ' - Shared Headers';
    
    const description = document.createElement('p');
    description.className = 'shared-headers-description';
    description.textContent = 'Edit these values to use across all ' + appName + ' APIs. Changes are automatically cached.';
    
    cardHeader.appendChild(title);
    cardHeader.appendChild(description);
    
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body';
    
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    
    const headersGrid = document.createElement('div');
    headersGrid.id = 'shared-headers-' + appName;
    headersGrid.className = 'shared-headers-grid';
    
    for (const [headerName, headerDescription] of Object.entries(supportedHeaders)) {
        const currentValue = cachedAppHeaders[headerName];
        const displayValue = currentValue ? currentValue : '';
        
        const headerItem = document.createElement('div');
        headerItem.className = 'shared-header-item';
        
        const label = document.createElement('label');
        label.className = 'shared-header-label';
        label.textContent = headerName + ':';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control shared-header-input';
        input.dataset.appName = appName;
        input.dataset.headerName = headerName;
        input.value = displayValue;
        
        const hint = document.createElement('small');
        hint.className = 'shared-header-hint';
        hint.textContent = headerDescription;
        
        headerItem.appendChild(label);
        headerItem.appendChild(input);
        headerItem.appendChild(hint);
        
        headersGrid.appendChild(headerItem);
    }
    
    formGroup.appendChild(headersGrid);
    
    const actions = document.createElement('div');
    actions.className = 'shared-headers-actions';
    
    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-success';
    saveBtn.dataset.action = 'save-headers-server';
    saveBtn.dataset.appName = appName;
    saveBtn.textContent = 'Save All Headers';
    
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-secondary';
    resetBtn.dataset.action = 'reset-headers-server';
    resetBtn.dataset.appName = appName;
    resetBtn.textContent = 'Reset to Defaults';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-primary';
    copyBtn.dataset.action = 'copy-headers-json';
    copyBtn.dataset.appName = appName;
    copyBtn.textContent = 'Copy Headers JSON';
    
    btnGroup.appendChild(saveBtn);
    btnGroup.appendChild(resetBtn);
    btnGroup.appendChild(copyBtn);
    actions.appendChild(btnGroup);
    
    cardBody.appendChild(formGroup);
    cardBody.appendChild(actions);
    
    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    
    apiListDiv.insertBefore(card, apiListDiv.firstChild);
    
    attachSharedHeadersListeners(appName);
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
    showStatus('Header "' + headerName + '" saved for ' + appName, 'success');
}

function saveAllAppHeaders(appName) {
    const headers = {};
    const supportedHeaders = apiData[appName].supported_headers;
    Object.keys(supportedHeaders).forEach(headerName => {
        const input = document.querySelector(`.shared-header-input[data-app-name="${appName}"][data-header-name="${headerName}"]`);
        headers[headerName] = input.value;
    });
    const cacheKey = 'app_headers_' + appName;
    localStorage.setItem(cacheKey, JSON.stringify(headers));
    cachedHeaders[appName] = headers;
    const saveData = { app_name: appName, headers: headers };
    apiClientInstance.json(ApiClient.PointUrlKey.API_HEADERS_CACHE_SAVE, 'POST', saveData);
    showStatus('All headers saved for ' + appName, 'success');
}

function resetAppHeaders(appName) {
    confirm('Are you sure you want to reset all headers for ' + appName + ' to default values? This will clear all cached values.');
    const cacheKey = 'app_headers_' + appName;
    localStorage.removeItem(cacheKey);
    delete cachedHeaders[appName];
    const resetData = { app_name: appName };
    apiClientInstance.json(ApiClient.PointUrlKey.API_HEADERS_CACHE_RESET, 'POST', resetData);
    loadAppAPIs();
    showStatus('Headers reset for ' + appName, 'success');
}

function copyAppHeaders(appName) {
    const headers = loadAppHeadersFromCache(appName);
    const headersJson = JSON.stringify(headers, null, 2);
    navigator.clipboard.writeText(headersJson).then(() => {
        showStatus('Headers JSON copied to clipboard!', 'success');
    });
}

function parseFeatureString(feature) {
    const parts = feature.split('|');
    const authAndMethod = parts[0];
    const description = parts[1];
    const controller = parts[2];
    const result = {
        authAndMethod: authAndMethod,
        description: description,
        controller: controller,
        params: {},
        headers: {},
        response: {},
        tags: []
    };

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

function parseParameterSection(section) {
    const params = {};

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
    paramList.push(current.trim());

    paramList.forEach(param => {
        const parsed = parseParameterDefinition(param.trim());
        params[parsed.name] = parsed;
    });

    return params;
}

function parseParameterDefinition(paramDef) {
    const match = paramDef.match(/^([^(]+)\(([^)]+)\)$/);
    return {
        name: match[1].trim(),
        type: match[2].split(',')[0].trim(),
        requirement: match[2].split(',')[1].trim(),
        example: match[2].split(',')[2].trim()
    };
}

function generateParamsFromFeature(feature, method, appName = null) {
    const parsed = parseFeatureString(feature);
    const jsonParams = {};
    const cachedAppHeaders = loadAppHeadersFromCache(appName);

    Object.values(parsed.params).forEach(param => {
        const value = param.example;
        const finalValue = linkParameterToSharedHeader(param.name, value, cachedAppHeaders);
        jsonParams[param.name] = finalValue;
    });

    return Object.keys(jsonParams).length > 0 ? JSON.stringify(jsonParams, null, 2) : '';
}

function linkParameterToSharedHeader(paramName, paramValue, cachedHeaders) {
    const paramValueStr = String(paramValue);
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

    const headerName = paramHeaderMap[paramName.toLowerCase()];
    const headerValue = cachedHeaders[headerName];
    return headerValue ? headerValue : paramValue;
}

function generatePresetJson(feature, method, appName = null) {
    return generateParamsFromFeature(feature, method, appName);
}

function extractMethodFromFeature(feature) {
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    const upperFeature = feature.toUpperCase();
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
    const url = new URL(path);
    return url.pathname;
}

function toggleAPIDetails(index, appName, endpoint) {
    const details = document.getElementById("details-" + index);
    const toggle = document.getElementById("toggle-" + index);

    details.classList.toggle('hidden');
    toggle.textContent = details.classList.contains('hidden') ? "▼" : "▲";
    loadParams(index, appName, endpoint);
}

function saveParams(index, appName, endpoint, method) {
    const params = document.getElementById("params-" + index).value;
    saveToBrowserCache(appName, endpoint, params);
    const saveData = {
        app_name: appName,
        api_endpoint: endpoint,
        method: method,
        params: params
    };
    apiClientInstance.json(ApiClient.PointUrlKey.API_PARAMS_CACHE_SAVE, 'POST', saveData);
}

function loadParams(index, appName, endpoint) {
    const paramsTextarea = document.getElementById("params-" + index);
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
        paramsTextarea.value = result.data.params;
        saveToBrowserCache(appName, endpoint, result.data.params);
    });
}

function loadParamsWithReset(index, appName, endpoint) {
    confirm('This will reset parameters to parsed defaults and may override your current changes. Continue?');
    const paramsTextarea = document.getElementById("params-" + index);
    const apiInfo = apiData[appName];
    const api = apiInfo.endpoints.find(ep => ep.path.includes(endpoint));
    const method = extractMethodFromFeature(api.feature);
    const parsedParams = generateParamsFromFeature(api.feature, method, appName);
    paramsTextarea.value = parsedParams;
    showStatus('Parameters reset to parsed defaults', 'success');
}

async function testAPI(index, method, appName, endpoint) {
    const url = document.getElementById("url-" + index).value;
    const params = document.getElementById("params-" + index).value;
    const responseDiv = document.getElementById("response-" + index);

    responseDiv.classList.remove('hidden');
    
    while (responseDiv.firstChild) {
        responseDiv.removeChild(responseDiv.firstChild);
    }
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    const loadingText = document.createTextNode('Sending request...');
    responseDiv.appendChild(loadingDiv);
    responseDiv.appendChild(loadingText);

    let requestOptions = {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    };

    if (params) {
        JSON.parse(params);
        requestOptions.body = params;
    }

    const response = await fetch(url, requestOptions);
    const text = await response.text();
    const result = {
        status: response.status,
        statusText: response.statusText,
        body: text,
        headers: Object.fromEntries(response.headers.entries()),
        ok: response.ok
    };

    let responseText = "Status: " + (result.ok ? "OK" : "ERROR") + " " + result.status + " " + result.statusText + "\n\n";
    responseText += "Headers:\n" + JSON.stringify(result.headers, null, 2) + "\n\n";
    responseText += "Response:\n";

    try {
        const jsonBody = JSON.parse(result.body);
        responseText += JSON.stringify(jsonBody, null, 2);
    } catch (e) {
        responseText += result.body;
    }

    while (responseDiv.firstChild) {
        responseDiv.removeChild(responseDiv.firstChild);
    }
    responseDiv.textContent = responseText;

    if (result.ok && params) {
        saveToBrowserCache(appName, endpoint, params);
    }
}

function searchAndJumpToAPI(searchTerm) {
    clearTimeout(searchTimeout);
    document.querySelectorAll('.api-item').forEach(item => {
        item.classList.remove('search-highlighted');
    });

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

        jumpToAPI(bestMatch.index);
    }, 300);
}

function calculateMatchScore(api, term, index) {
    let score = 0;
    const apiNumber = (index + 1).toString();
    const path = api.path.toLowerCase();
    const feature = api.feature.toLowerCase();
    const method = extractMethodFromFeature(api.feature).toLowerCase();
    const featureParts = feature.split('|');
    const description = featureParts[1].toLowerCase();
    const endpoint = extractEndpointFromPath(path).toLowerCase();

    if (term === apiNumber) {
        return 1000;
    }

    if (apiNumber.startsWith(term)) {
        score += 500;
    }

    if (endpoint === term) {
        score += 800;
    }

    if (endpoint.startsWith(term)) {
        score += 400;
    }

    if (endpoint.includes(term)) {
        score += 200;
    }

    if (path.includes(term)) {
        score += 150;
    }

    if (method === term) {
        score += 300;
    }

    if (description.includes(term)) {
        score += 100;
    }

    if (feature.includes(term)) {
        score += 50;
    }

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
    apiItem.classList.add('search-highlighted');
    apiItem.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const details = document.getElementById('details-' + apiIndex);
    const toggle = document.getElementById('toggle-' + apiIndex);

    setTimeout(() => {
        details.classList.remove('hidden');
        toggle.textContent = '▲';
        const selectedApp = document.getElementById("app-select").value;
        const api = currentAppAPIs[apiIndex];
        const endpoint = extractEndpointFromPath(api.path);
        loadParams(apiIndex, selectedApp, endpoint);
    }, 500);

    showStatus('Jumped to API #' + (apiIndex + 1), 'success');
}

function copyHeaders(index, appName) {
    const headers = JSON.stringify(apiData[appName].supportedHeaders, null, 2);
    navigator.clipboard.writeText(headers).then(() => {
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
    statusEl.className = 'status-' + type;
    statusEl.textContent = message;
    document.body.appendChild(statusEl);
    setTimeout(() => statusEl.remove(), 3000);
}
