// Voice Subtitle Framework - Main JavaScript
// Handles module switching, player controls, queue management, and background features

// ========== Initialize API Client ==========
const api = new VoiceSubtitleAPI(CONFIG);

// ========== Initialize LAN Scanner ==========
const lanScanner = new LANScanner(CONFIG);

// ========== RPC Client ==========
const rpcClient = new FastAPIWsRpcClient(CONFIG.WEBSOCKET.URL, CONFIG.WEBSOCKET.OPTIONS);

// ========== State ==========
let currentQueue = [];
let currentIndex = 0;
let isPlaying = false;
let activeModule = CONFIG.UI.DEFAULT_MODULE;
let selectedItems = new Set();
let isSubtitleMode = false;

// ========== DOM Elements ==========
// Audio Player
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const speedSelect = document.getElementById('speedSelect');
const volumeSlider = document.getElementById('volumeSlider');
const subtitleText = document.getElementById('subtitleText');

// Status
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// Navigation
const navItems = document.querySelectorAll('.nav-item');

// Modules
const modules = {
    'voice-player': document.getElementById('module-voice-player'),
    'queue-manager': document.getElementById('module-queue-manager'),
    'window-automation': document.getElementById('module-window-automation'),
    'code-sync': document.getElementById('module-code-sync'),
    'task-queue': document.getElementById('module-task-queue')
};

// ========== Initialization ==========
async function init() {
    try {
        await rpcClient.connect();
        console.log('[RPC] Connected to WebSocket');
        updateStatus(true);

        // Fetch initial data
        await Promise.all([
            fetchQueue(),
            fetchCategories(),
            updateStatistics()
        ]);

        // Start auto-refresh
        setInterval(async () => {
            await fetchQueue();
            await updateStatistics();
        }, CONFIG.DEFAULTS.AUTO_REFRESH_INTERVAL);

        // Setup event listeners
        setupEventListeners();
    } catch (error) {
        console.error('[RPC] Connection failed:', error);
        updateStatus(false);
    }
}

// ========== Module Navigation ==========
function switchModule(moduleName) {
    // Update nav items
    navItems.forEach(item => {
        if (item.dataset.tool === moduleName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Update modules visibility
    Object.keys(modules).forEach(key => {
        if (key === moduleName) {
            modules[key].style.display = 'block';
        } else {
            modules[key].style.display = 'none';
        }
    });

    activeModule = moduleName;

    // Refresh module-specific data
    if (moduleName === 'queue-manager') {
        fetchQueueList();
    } else if (moduleName === 'code-sync') {
        refreshCodeSyncStatus();
    } else if (moduleName === 'task-queue') {
        fetchTasks();
    }
}

// ========== Queue Management ==========
async function fetchQueue() {
    let apiMethod = 'Unknown';
    let apiUrl = 'Unknown';

    try {
        // Get playback mode setting
        const playbackMode = document.querySelector('input[name="playbackMode"]:checked')?.value || CONFIG.DEFAULTS.PLAYBACK_MODE;
        const latestCount = parseInt(document.getElementById('latestCount')?.value || CONFIG.DEFAULTS.LATEST_COUNT);
        const categoryFilter = document.getElementById('categoryFilter')?.value || '';

        let data;

        // Apply playback mode filter using centralized API
        if (playbackMode === 'latest') {
            apiMethod = 'getLatestItems';
            apiUrl = api.getFullUrl(CONFIG.API.QUEUE_LATEST) + `?count=${latestCount}`;
            const result = await api.getLatestItems(latestCount);
            if (result && result.success) {
                data = {
                    success: true,
                    queue: result.items,
                    current_index: 0
                };
            }
        } else if (playbackMode === 'today') {
            apiMethod = 'getTodayItems';
            apiUrl = api.getFullUrl(CONFIG.API.QUEUE_TODAY);
            const result = await api.getTodayItems();
            if (result && result.success) {
                data = {
                    success: true,
                    queue: result.items,
                    current_index: 0
                };
            }
        } else if (categoryFilter) {
            apiMethod = 'getItemsByCategory';
            apiUrl = api.getFullUrl(CONFIG.API.QUEUE_BY_CATEGORY) + `?category=${categoryFilter}`;
            const result = await api.getItemsByCategory(categoryFilter);
            if (result && result.success) {
                data = {
                    success: true,
                    queue: result.items,
                    current_index: 0
                };
            }
        } else {
            // All mode - default
            apiMethod = 'getQueue';
            apiUrl = api.getFullUrl(CONFIG.API.QUEUE);
            data = await api.getQueue();
        }

        if (data && data.success && data.queue) {
            const oldQueueLength = currentQueue.length;
            const oldIndex = currentIndex;

            currentQueue = data.queue;
            currentIndex = data.current_index || 0;

            // Ensure currentIndex is within bounds
            if (currentIndex >= currentQueue.length) {
                currentIndex = currentQueue.length > 0 ? 0 : 0;
            }

            updateQueueInfo();

            // Only auto-play if queue is new or index changed
            const queueChanged = oldQueueLength !== currentQueue.length;

            if (currentQueue.length > 0 && !isPlaying && audioPlayer.paused && queueChanged) {
                console.log('[Queue] Queue changed, starting playback');
                playCurrentItem();
            }
        }
    } catch (error) {
        console.error(`[Queue] Fetch error for ${apiMethod}:`, error);
        console.error(`[Queue] Failed URL: ${apiUrl}`);
    }
}

async function fetchCategories() {
    const apiUrl = api.getFullUrl(CONFIG.API.CATEGORIES);

    try {
        const data = await api.getCategories();

        if (data && data.success) {
            updateCategoriesList(data.categories);
            updateCategoryFilters(data.categories);
        }
    } catch (error) {
        console.error('[Categories] Fetch error:', error);
        console.error('[Categories] Failed URL:', apiUrl);
    }
}

async function updateStatistics() {
    const queueUrl = api.getFullUrl(CONFIG.API.QUEUE);
    const todayUrl = api.getFullUrl(CONFIG.API.QUEUE_TODAY);

    try {
        const [queueData, todayData] = await Promise.all([
            api.getQueue(),
            api.getTodayItems()
        ]);

        document.getElementById('totalItems').textContent = queueData.queue?.length || 0;
        document.getElementById('todayItems').textContent = todayData.count || 0;
    } catch (error) {
        console.error('[Statistics] Update error:', error);
        console.error('[Statistics] Queue URL:', queueUrl);
        console.error('[Statistics] Today URL:', todayUrl);
    }
}

async function fetchQueueList() {
    const apiUrl = api.getFullUrl(CONFIG.API.QUEUE);

    try {
        const data = await api.getQueue();

        if (data && data.success && data.queue) {
            renderQueueTable(data.queue);
        }
    } catch (error) {
        console.error('[Queue List] Fetch error:', error);
        console.error('[Queue List] Failed URL:', apiUrl);
    }
}

async function updateServerIndex(index) {
    const apiUrl = api.getFullUrl(CONFIG.API.SET_INDEX) + `?index=${index}`;

    try {
        const data = await api.setCurrentIndex(index);
        if (data.success) {
            updateQueueInfo();
        }
    } catch (error) {
        console.error('[Queue] Set index error:', error);
        console.error('[Queue] Failed URL:', apiUrl);
    }
}

async function incrementPlayCount(index) {
    const apiUrl = api.getFullUrl(CONFIG.API.INCREMENT_PLAY_COUNT) + `?index=${index}`;

    try {
        await api.incrementPlayCount(index);
    } catch (error) {
        console.error('[Queue] Increment play count error:', error);
        console.error('[Queue] Failed URL:', apiUrl);
    }
}

// ========== Playback Control ==========
function playCurrentItem() {
    if (currentQueue.length === 0) {
        updateSubtitle('', '');
        return;
    }

    const item = currentQueue[currentIndex];
    if (!item) return;

    console.log('[Player] Playing:', item);

    // Update subtitle
    updateSubtitle(item.text, item.audio_path);

    // Load and play audio using centralized API
    const audioUrl = api.getAudioUrl(item.audio_path);
    audioPlayer.src = audioUrl;
    audioPlayer.playbackRate = parseFloat(speedSelect.value);

    audioPlayer.play()
        .then(() => {
            isPlaying = true;
            updatePlayPauseButton();
            console.log('[Player] Started playback');
        })
        .catch(err => {
            console.error('[Player] Play error:', err);
        });
}

// ========== UI Updates ==========
function updateSubtitle(text, audioPath) {
    if (text && text.trim()) {
        subtitleText.className = 'subtitle-text';
        subtitleText.textContent = text;
    } else {
        subtitleText.className = 'empty-state';
        subtitleText.innerHTML = '<div class="icon">🎧</div><div>No subtitle</div>';
    }

    if (audioPath) {
        const fileName = audioPath.split(/[/\\]/).pop();
        document.getElementById('audioFile').textContent = fileName;
    }
}

function updatePlayPauseButton() {
    playPauseBtn.textContent = isPlaying && !audioPlayer.paused ? '⏸' : '▶';
}

function updateQueueInfo() {
    document.getElementById('queueSize').textContent = currentQueue.length;
    document.getElementById('queueIndex').textContent = currentQueue.length > 0 ? currentIndex + 1 : '-';

    const currentItem = currentQueue[currentIndex];
    if (currentItem) {
        document.getElementById('playCount').textContent = currentItem.play_count || 0;
    }
}

function updateStatus(connected) {
    if (connected) {
        statusDot.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = 'Disconnected';
    }
}

function updateCategoriesList(categories) {
    const container = document.getElementById('categoriesList');
    container.innerHTML = '';

    categories.forEach(category => {
        const chip = document.createElement('div');
        chip.className = 'category-chip';
        chip.innerHTML = `
            <span>${category}</span>
            <span style="opacity: 0.6;">›</span>
        `;
        chip.onclick = () => filterByCategory(category);
        container.appendChild(chip);
    });
}

function updateCategoryFilters(categories) {
    const filters = [
        document.getElementById('categoryFilter'),
        document.getElementById('queueCategoryFilter'),
        document.getElementById('bulkCategorySelect')
    ];

    filters.forEach(select => {
        if (!select) return;

        // Clear existing options (except first one)
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Add category options
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
        });
    });
}

function renderQueueTable(queue) {
    const tbody = document.getElementById('queueTableBody');
    tbody.innerHTML = '';

    queue.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = selectedItems.has(index) ? 'selected' : '';

        const createdDate = item.created_at ? new Date(item.created_at).toLocaleString() : '-';

        tr.innerHTML = `
            <td><input type="checkbox" class="item-checkbox" data-index="${index}" ${selectedItems.has(index) ? 'checked' : ''}></td>
            <td>${index + 1}</td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${item.text}</td>
            <td>${item.category || 'normal'}</td>
            <td>${item.play_count || 0}</td>
            <td style="font-size: 12px;">${createdDate}</td>
            <td>
                <button class="bulk-btn" onclick="deleteItem(${index})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Setup checkbox listeners
    document.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            if (e.target.checked) {
                selectedItems.add(index);
            } else {
                selectedItems.delete(index);
            }
            renderQueueTable(currentQueue); // Re-render to update row highlighting
        });
    });
}

async function filterByCategory(category) {
    const apiUrl = api.getFullUrl(CONFIG.API.QUEUE_BY_CATEGORY) + `?category=${category}`;

    try {
        const data = await api.getItemsByCategory(category);

        if (data && data.success) {
            renderQueueTable(data.items);
        }
    } catch (error) {
        console.error('[Filter] Category filter error:', error);
        console.error('[Filter] Failed URL:', apiUrl);
    }
}

// ========== Event Handlers ==========
function setupEventListeners() {
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchModule(item.dataset.tool);
        });
    });

    // Collapsible headers
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.dataset.target;
            const content = document.getElementById(targetId);

            if (content) {
                header.classList.toggle('collapsed');
                content.classList.toggle('collapsed');
            }
        });
    });

    // Player controls
    playPauseBtn.addEventListener('click', () => {
        if (currentQueue.length === 0) return;

        if (audioPlayer.paused) {
            if (!audioPlayer.src) {
                playCurrentItem();
            } else {
                audioPlayer.play();
                isPlaying = true;
            }
        } else {
            audioPlayer.pause();
            isPlaying = false;
        }
        updatePlayPauseButton();
    });

    prevBtn.addEventListener('click', async () => {
        if (currentQueue.length === 0) return;
        currentIndex = (currentIndex - 1 + currentQueue.length) % currentQueue.length;
        await updateServerIndex(currentIndex);
        playCurrentItem();
    });

    nextBtn.addEventListener('click', async () => {
        if (currentQueue.length === 0) return;
        currentIndex = (currentIndex + 1) % currentQueue.length;
        await updateServerIndex(currentIndex);
        playCurrentItem();
    });

    speedSelect.addEventListener('change', (e) => {
        audioPlayer.playbackRate = parseFloat(e.target.value);
    });

    volumeSlider.addEventListener('input', (e) => {
        audioPlayer.volume = e.target.value / 100;
    });

    // Audio events
    audioPlayer.addEventListener('ended', async () => {
        await incrementPlayCount(currentIndex);
        if (currentQueue.length > 0) {
            currentIndex = (currentIndex + 1) % currentQueue.length;
            await updateServerIndex(currentIndex);
            setTimeout(() => {
                if (currentQueue.length > 0) {
                    playCurrentItem();
                }
            }, 300);
        }
    });

    // Quick Add buttons
    document.getElementById('addTextBtn')?.addEventListener('click', addTextToQueue);
    document.getElementById('addImageBtn')?.addEventListener('click', () => {
        document.getElementById('addImageInput').click();
    });
    document.getElementById('addImageInput')?.addEventListener('change', handleImageUpload);
    document.getElementById('addFileBtn')?.addEventListener('click', () => {
        document.getElementById('addFileInput').click();
    });

    // Queue Manager
    document.getElementById('clearQueueBtn')?.addEventListener('click', clearQueue);
    document.getElementById('refreshQueueBtn')?.addEventListener('click', fetchQueueList);
    document.getElementById('selectAllCheckbox')?.addEventListener('change', toggleSelectAll);
    document.getElementById('deleteSelectedBtn')?.addEventListener('click', deleteSelectedItems);
    document.getElementById('changeCategoryBtn')?.addEventListener('click', changeCategoryForSelected);

    // Background features
    document.getElementById('clipboardMonitorToggle')?.addEventListener('change', toggleClipboardMonitor);
    document.getElementById('screenshotMonitorToggle')?.addEventListener('change', toggleScreenshotMonitor);

    // Subtitle mode
    document.getElementById('subtitleModeBtn')?.addEventListener('click', toggleSubtitleMode);
    document.getElementById('subtitleModeExitBtn')?.addEventListener('click', exitSubtitleMode);

    // Settings dialog
    document.getElementById('settingsBtn')?.addEventListener('click', openSettingsDialog);
    document.getElementById('closeSettingsBtn')?.addEventListener('click', closeSettingsDialog);

    // Settings tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            switchSettingsTab(targetTab);
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+M: Toggle subtitle mode
        if (e.ctrlKey && e.key === 'm') {
            e.preventDefault();
            toggleSubtitleMode();
        }

        // Escape: Exit subtitle mode
        if (e.key === 'Escape' && isSubtitleMode) {
            e.preventDefault();
            exitSubtitleMode();
        }
    });

    // Playback settings - reload queue when changed
    document.querySelectorAll('input[name="playbackMode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            console.log('[Settings] Playback mode changed, reloading queue');
            fetchQueue();
        });
    });

    document.getElementById('categoryFilter')?.addEventListener('change', () => {
        console.log('[Settings] Category filter changed, reloading queue');
        fetchQueue();
    });

    document.getElementById('latestCount')?.addEventListener('change', () => {
        const playbackMode = document.querySelector('input[name="playbackMode"]:checked')?.value;
        if (playbackMode === 'latest') {
            console.log('[Settings] Latest count changed, reloading queue');
            fetchQueue();
        }
    });

    // Code Sync controls
    document.getElementById('startSyncBtn')?.addEventListener('click', startCodeSync);
    document.getElementById('stopSyncBtn')?.addEventListener('click', stopCodeSync);
    document.getElementById('codeSyncMode')?.addEventListener('change', (e) => {
        console.log('[Code Sync] Mode selector changed:', e.target.value);
        // Update display based on selected mode
        updateCodeSyncPanelVisibility(e.target.value);
    });

    // Backup toggle
    document.getElementById('enableBackup')?.addEventListener('change', toggleBackup);

    // Task Queue controls
    document.getElementById('refreshTasksBtn')?.addEventListener('click', fetchTasks);
    document.getElementById('taskAutoRefresh')?.addEventListener('change', (e) => {
        taskAutoRefresh = e.target.checked;
        if (taskAutoRefresh) {
            pollActiveTasks();
        } else if (taskRefreshInterval) {
            clearInterval(taskRefreshInterval);
            taskRefreshInterval = null;
        }
    });
    document.getElementById('taskTypeFilter')?.addEventListener('change', () => {
        updateTaskList(currentTasks);
    });
    document.getElementById('taskStatusFilter')?.addEventListener('change', () => {
        updateTaskList(currentTasks);
    });
    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
        document.getElementById('taskTypeFilter').value = '';
        document.getElementById('taskStatusFilter').value = '';
        updateTaskList(currentTasks);
    });
    document.getElementById('closeTaskDetailBtn')?.addEventListener('click', closeTaskDetail);

    // API Config controls
    document.querySelectorAll('input[name="apiMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            switchApiMode(e.target.value);
        });
    });
    document.getElementById('testConnectionBtn')?.addEventListener('click', testConnection);
    document.getElementById('applyCustomUrlBtn')?.addEventListener('click', applyCustomUrl);
    document.getElementById('enableAutoDiscovery')?.addEventListener('change', (e) => {
        toggleAutoDiscovery(e.target.checked);
    });
    document.getElementById('scanNowBtn')?.addEventListener('click', () => {
        if (isScanning) {
            stopLanScanning();
        } else {
            startLanScanning();
        }
    });
    document.getElementById('scanInterval')?.addEventListener('change', (e) => {
        CONFIG.REMOTE_API.SCAN_INTERVAL = parseInt(e.target.value) * 1000;
        console.log('[API Config] Scan interval updated:', e.target.value, 'seconds');
    });
    document.getElementById('scanTimeout')?.addEventListener('change', (e) => {
        CONFIG.REMOTE_API.SCAN_TIMEOUT = parseInt(e.target.value);
        console.log('[API Config] Scan timeout updated:', e.target.value, 'ms');
    });
}

// ========== Quick Add Functions ==========
async function addTextToQueue() {
    const textarea = document.getElementById('addTextInput');
    const text = textarea.value.trim();

    if (!text) {
        dialog.error('Please enter text to add');
        return;
    }

    const apiUrl = api.getFullUrl(CONFIG.API.ADD_TEXT);

    try {
        const data = await api.addText(text, CONFIG.DEFAULTS.LANGUAGES, CONFIG.DEFAULTS.CATEGORY);

        if (data.success) {
            textarea.value = '';
            dialog.success('Text added to queue successfully!');
            await fetchQueue();
        }
    } catch (error) {
        console.error('[Add Text] Error:', error);
        console.error('[Add Text] Failed URL:', apiUrl);
        dialog.error('Failed to add text to queue');
    }
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const preview = document.getElementById('imagePreview');
    preview.textContent = `Uploading: ${file.name}...`;

    const uploadUrl = api.getFullUrl(CONFIG.API.FILE_UPLOAD);
    const imageUrl = api.getFullUrl(CONFIG.API.ADD_IMAGE);

    try {
        // Upload file using centralized API
        const uploadData = await api.uploadFile(file);
        if (!uploadData.success) {
            throw new Error('File upload failed');
        }

        const uploadedPath = uploadData.file_path;
        preview.textContent = `Processing: ${file.name}...`;

        // Process image with Gemini and add to queue
        const processData = await api.addImage(uploadedPath, CONFIG.DEFAULTS.LANGUAGES, 'image');

        if (processData.success) {
            preview.textContent = `✓ Added: ${file.name}`;
            setTimeout(() => {
                preview.textContent = '';
                event.target.value = ''; // Reset file input
            }, 3000);
            await fetchQueue();
        } else {
            throw new Error('Image processing failed');
        }
    } catch (error) {
        console.error('[Add Image] Error:', error);
        console.error('[Add Image] Upload URL:', uploadUrl);
        console.error('[Add Image] Process URL:', imageUrl);
        preview.textContent = `✗ Failed: ${file.name}`;
        dialog.error('Failed to process image');
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileInfo = document.getElementById('fileInfo');
    fileInfo.textContent = `Reading: ${file.name}...`;

    const apiUrl = api.getFullUrl(CONFIG.API.ADD_TEXT);

    try {
        // Read text from file
        const text = await file.text();

        if (!text || text.trim().length < 10) {
            throw new Error('File content is too short');
        }

        fileInfo.textContent = `Processing: ${file.name}...`;

        // Add to queue using centralized API
        const data = await api.addText(text, CONFIG.DEFAULTS.LANGUAGES, 'file');

        if (data.success) {
            fileInfo.textContent = `✓ Added: ${file.name}`;
            setTimeout(() => {
                fileInfo.textContent = '';
                event.target.value = ''; // Reset file input
            }, 3000);
            await fetchQueue();
        } else {
            throw new Error('Failed to add file content');
        }
    } catch (error) {
        console.error('[Add File] Error:', error);
        console.error('[Add File] Failed URL:', apiUrl);
        fileInfo.textContent = `✗ Failed: ${file.name}`;
        dialog.error('Failed to process file');
    }
}

// ========== Queue Management Functions ==========
async function clearQueue() {
    if (!confirm('Are you sure you want to clear the entire queue?')) return;

    const apiUrl = api.getFullUrl(CONFIG.API.CLEAR_QUEUE);

    try {
        const data = await api.clearQueue();
        if (data.success) {
            await fetchQueue();
            await fetchQueueList();
        }
    } catch (error) {
        console.error('[Clear Queue] Error:', error);
        console.error('[Clear Queue] Failed URL:', apiUrl);
    }
}

function toggleSelectAll(event) {
    const checked = event.target.checked;
    if (checked) {
        currentQueue.forEach((_, index) => selectedItems.add(index));
    } else {
        selectedItems.clear();
    }
    renderQueueTable(currentQueue);
}

async function deleteItem(index) {
    if (!confirm('Delete this item?')) return;

    const apiUrl = api.getFullUrl(CONFIG.API.REMOVE_ITEMS);

    try {
        const data = await api.removeItems([index]);
        if (data.success) {
            await fetchQueue();
            await fetchQueueList();
        }
    } catch (error) {
        console.error('[Delete Item] Error:', error);
        console.error('[Delete Item] Failed URL:', apiUrl);
    }
}

async function deleteSelectedItems() {
    if (selectedItems.size === 0) {
        dialog.error('No items selected');
        return;
    }

    if (!confirm(`Delete ${selectedItems.size} selected items?`)) return;

    const apiUrl = api.getFullUrl(CONFIG.API.REMOVE_ITEMS);

    try {
        const data = await api.removeItems(Array.from(selectedItems));
        if (data.success) {
            selectedItems.clear();
            await fetchQueue();
            await fetchQueueList();
        }
    } catch (error) {
        console.error('[Delete Selected] Error:', error);
        console.error('[Delete Selected] Failed URL:', apiUrl);
    }
}

async function changeCategoryForSelected() {
    const select = document.getElementById('bulkCategorySelect');
    const newCategory = select.value;

    if (!newCategory) {
        dialog.error('Please select a category');
        return;
    }

    if (selectedItems.size === 0) {
        dialog.error('No items selected');
        return;
    }

    const apiUrl = api.getFullUrl(CONFIG.API.CHANGE_CATEGORY);

    try {
        const promises = Array.from(selectedItems).map(index =>
            api.changeItemCategory(index, newCategory)
        );

        await Promise.all(promises);
        selectedItems.clear();
        await fetchQueue();
        await fetchQueueList();
        await fetchCategories();
        dialog.success('Categories updated successfully!');
    } catch (error) {
        console.error('[Change Category] Error:', error);
        console.error('[Change Category] Failed URL:', apiUrl);
        dialog.error('Failed to update categories');
    }
}

// ========== Background Features ==========
async function toggleClipboardMonitor(event) {
    const enabled = event.target.checked;
    console.log('[Clipboard Monitor]', enabled ? 'Enabled' : 'Disabled');

    const apiUrl = enabled
        ? api.getFullUrl(CONFIG.API.CLIPBOARD_START)
        : api.getFullUrl(CONFIG.API.CLIPBOARD_STOP);

    try {
        const data = enabled ? await api.startClipboardMonitor() : await api.stopClipboardMonitor();

        if (data.success) {
            dialog.success(data.message);
        } else {
            event.target.checked = !enabled;
            dialog.error('Failed to toggle clipboard monitoring');
        }
    } catch (error) {
        console.error('[Clipboard Monitor] Error:', error);
        console.error('[Clipboard Monitor] Failed URL:', apiUrl);
        event.target.checked = !enabled;
        dialog.error('Error toggling clipboard monitoring');
    }
}

async function toggleScreenshotMonitor(event) {
    const enabled = event.target.checked;
    const interval = parseInt(document.getElementById('screenshotInterval').value);
    console.log('[Screenshot Monitor]', enabled ? `Enabled (${interval}s)` : 'Disabled');

    const apiUrl = enabled
        ? api.getFullUrl(CONFIG.API.SCREENSHOT_START)
        : api.getFullUrl(CONFIG.API.SCREENSHOT_STOP);

    try {
        if (enabled) {
            const data = await api.startScreenshotMonitor(interval);
            if (data.success) {
                dialog.success(data.message);
            } else {
                event.target.checked = false;
                dialog.error('Failed to start screenshot monitoring');
            }
        } else {
            const data = await api.stopScreenshotMonitor();
            if (data.success) {
                dialog.success(data.message);
            } else {
                event.target.checked = true;
                dialog.error('Failed to stop screenshot monitoring');
            }
        }
    } catch (error) {
        console.error('[Screenshot Monitor] Error:', error);
        console.error('[Screenshot Monitor] Failed URL:', apiUrl);
        event.target.checked = !enabled;
        dialog.error('Error toggling screenshot monitoring');
    }
}

// ========== Subtitle Mode ==========

function enterSubtitleMode() {
    console.log('[Subtitle Mode] Entering subtitle mode...');

    isSubtitleMode = true;

    // Add CSS class to body
    document.body.classList.add('subtitle-mode');

    // Update button state
    const btn = document.getElementById('subtitleModeBtn');
    if (btn) {
        btn.classList.add('active');
        const icon = document.getElementById('subtitleModeIcon');
        if (icon) icon.textContent = '🎬';
    }

    // Show exit button
    const exitBtn = document.getElementById('subtitleModeExitBtn');
    if (exitBtn) {
        exitBtn.style.display = 'flex';
    }

    // Send RPC event to adjust window
    try {
        rpcClient.call('thread_bus.trigger_event', {
            event_name: 'voice_subtitle.subtitle_mode_enter',
            data: {
                timestamp: new Date().toISOString()
            }
        }).then(() => {
            console.log('[Subtitle Mode] Window adjustment requested');
        }).catch(err => {
            console.error('[Subtitle Mode] Failed to request window adjustment:', err);
        });
    } catch (error) {
        console.error('[Subtitle Mode] RPC call error:', error);
    }
}

function exitSubtitleMode() {
    console.log('[Subtitle Mode] Exiting subtitle mode...');

    isSubtitleMode = false;

    // Remove CSS class from body
    document.body.classList.remove('subtitle-mode');

    // Update button state
    const btn = document.getElementById('subtitleModeBtn');
    if (btn) {
        btn.classList.remove('active');
        const icon = document.getElementById('subtitleModeIcon');
        if (icon) icon.textContent = '📺';
    }

    // Hide exit button
    const exitBtn = document.getElementById('subtitleModeExitBtn');
    if (exitBtn) {
        exitBtn.style.display = 'none';
    }

    // Send RPC event to restore window
    try {
        rpcClient.call('thread_bus.trigger_event', {
            event_name: 'voice_subtitle.subtitle_mode_exit',
            data: {
                timestamp: new Date().toISOString()
            }
        }).then(() => {
            console.log('[Subtitle Mode] Window restoration requested');
        }).catch(err => {
            console.error('[Subtitle Mode] Failed to request window restoration:', err);
        });
    } catch (error) {
        console.error('[Subtitle Mode] RPC call error:', error);
    }
}

function toggleSubtitleMode() {
    if (isSubtitleMode) {
        exitSubtitleMode();
    } else {
        enterSubtitleMode();
    }
}

// ========== Task Queue Functions ==========

// Task queue state
let taskRefreshInterval = null;
let taskAutoRefresh = true;
let currentTasks = [];

async function fetchTasks() {
    const apiUrl = api.getFullUrl(CONFIG.API.TASKS) + '?limit=50';

    try {
        const data = await api.getAllTasks(50);

        if (data && data.success && data.tasks) {
            currentTasks = data.tasks;
            updateTaskList(data.tasks);
            updateTaskStatistics(data.tasks);

            // Start polling active tasks
            if (taskAutoRefresh) {
                pollActiveTasks();
            }
        }
    } catch (error) {
        console.error('[Task Queue] Fetch error:', error);
        console.error('[Task Queue] Failed URL:', apiUrl);
    }
}

function updateTaskList(tasks) {
    const tbody = document.getElementById('taskTableBody');

    // Apply filters
    const typeFilter = document.getElementById('taskTypeFilter')?.value || '';
    const statusFilter = document.getElementById('taskStatusFilter')?.value || '';

    let filteredTasks = tasks;
    if (typeFilter) {
        filteredTasks = filteredTasks.filter(t => t.task_type === typeFilter);
    }
    if (statusFilter) {
        filteredTasks = filteredTasks.filter(t => t.status === statusFilter);
    }

    if (!filteredTasks || filteredTasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No tasks found</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    filteredTasks.forEach(task => {
        const tr = document.createElement('tr');
        tr.classList.add('task-row');
        if (task.status === 'processing') {
            tr.classList.add('processing');
        } else if (task.status === 'failed') {
            tr.classList.add('failed');
        }

        // Type icon
        const typeIcon = getTaskTypeIcon(task.task_type);

        // Status badge
        const statusBadge = getTaskStatusBadge(task.status);

        // Progress bar
        const progress = task.progress || 0;
        const progressBar = `
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progress}%"></div>
                <span class="progress-text">${progress}%</span>
            </div>
        `;

        // Format dates
        const created = new Date(task.created_at).toLocaleString();

        // Calculate time elapsed
        const createdTime = new Date(task.created_at);
        const now = new Date();
        const elapsed = Math.floor((now - createdTime) / 1000);
        const timeStr = formatElapsedTime(elapsed);

        // Input preview
        const inputPreview = getTaskInputPreview(task);

        tr.innerHTML = `
            <td style="text-align: center; font-size: 20px;">${typeIcon}</td>
            <td style="font-size: 11px; font-family: monospace;" title="${task.task_id}">${task.task_id.substring(0, 25)}...</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${inputPreview}">${inputPreview}</td>
            <td>${statusBadge}</td>
            <td>${progressBar}</td>
            <td style="font-size: 12px;">${created}</td>
            <td style="font-size: 12px;">${timeStr}</td>
        `;

        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => showTaskDetail(task));

        tbody.appendChild(tr);
    });
}

function getTaskTypeIcon(type) {
    const icons = {
        'text': '📝',
        'image': '🖼️',
        'voice': '🎵'
    };
    return icons[type] || '📄';
}

function getTaskStatusBadge(status) {
    const badges = {
        'pending': '<span class="status-badge status-pending">⏳ Pending</span>',
        'processing': '<span class="status-badge status-processing">⚙️ Processing</span>',
        'completed': '<span class="status-badge status-completed">✅ Completed</span>',
        'failed': '<span class="status-badge status-failed">❌ Failed</span>'
    };
    return badges[status] || `<span class="status-badge">${status}</span>`;
}

function getTaskInputPreview(task) {
    if (!task.input_data) return '-';

    if (task.input_data.text) {
        return task.input_data.text.substring(0, 50) + (task.input_data.text.length > 50 ? '...' : '');
    }

    if (task.input_data.image_path) {
        return `Image: ${task.input_data.image_path.split('/').pop()}`;
    }

    return JSON.stringify(task.input_data).substring(0, 50) + '...';
}

function formatElapsedTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
}

function updateTaskStatistics(tasks) {
    const stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
    };

    tasks.forEach(task => {
        if (stats.hasOwnProperty(task.status)) {
            stats[task.status]++;
        }
    });

    document.getElementById('tasksPending').textContent = stats.pending;
    document.getElementById('tasksProcessing').textContent = stats.processing;
    document.getElementById('tasksCompleted').textContent = stats.completed;
    document.getElementById('tasksFailed').textContent = stats.failed;
}

async function pollActiveTasks() {
    // Clear existing interval
    if (taskRefreshInterval) {
        clearInterval(taskRefreshInterval);
    }

    // Check if we have any active tasks
    const hasActiveTasks = currentTasks.some(t =>
        t.status === 'pending' || t.status === 'processing'
    );

    if (hasActiveTasks && taskAutoRefresh) {
        // Poll every 2 seconds when there are active tasks
        taskRefreshInterval = setInterval(fetchTasks, 2000);
    } else if (taskAutoRefresh) {
        // Poll every 10 seconds when idle
        taskRefreshInterval = setInterval(fetchTasks, 10000);
    }
}

function showTaskDetail(task) {
    const panel = document.getElementById('taskDetailPanel');

    document.getElementById('detailTaskId').textContent = task.task_id;
    document.getElementById('detailTaskType').textContent = `${getTaskTypeIcon(task.task_type)} ${task.task_type}`;
    document.getElementById('detailTaskStatus').innerHTML = getTaskStatusBadge(task.status);
    document.getElementById('detailTaskProgress').textContent = `${task.progress || 0}%`;
    document.getElementById('detailTaskCreated').textContent = new Date(task.created_at).toLocaleString();
    document.getElementById('detailTaskUpdated').textContent = new Date(task.updated_at).toLocaleString();
    document.getElementById('detailTaskInput').textContent = JSON.stringify(task.input_data, null, 2);

    if (task.result) {
        document.getElementById('detailTaskResult').textContent = JSON.stringify(task.result, null, 2);
    } else {
        document.getElementById('detailTaskResult').textContent = 'No result yet';
    }

    const errorContainer = document.getElementById('detailTaskErrorContainer');
    if (task.error) {
        document.getElementById('detailTaskError').textContent = task.error;
        errorContainer.style.display = 'block';
    } else {
        errorContainer.style.display = 'none';
    }

    panel.style.display = 'block';
}

function closeTaskDetail() {
    document.getElementById('taskDetailPanel').style.display = 'none';
}

// ========== Settings Dialog Functions ==========

function openSettingsDialog() {
    console.log('[Settings] Opening settings dialog');
    document.getElementById('settingsDialog').style.display = 'flex';
    updateApiConfigDisplay();
}

function closeSettingsDialog() {
    console.log('[Settings] Closing settings dialog');
    document.getElementById('settingsDialog').style.display = 'none';
}

function switchSettingsTab(tabName) {
    console.log('[Settings] Switching to tab:', tabName);

    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        if (content.id === `tab-${tabName}`) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    // Refresh tab-specific data
    if (tabName === 'api-config') {
        updateApiConfigDisplay();
    }
}

// ========== API Configuration Functions ==========

// API config state
let isScanning = false;

function updateApiConfigDisplay() {
    // Update current connection status
    const mode = CONFIG.REMOTE_API.ENABLED ? 'Remote' : 'Local';
    const baseUrl = CONFIG.getBaseUrl();
    const apiPrefix = CONFIG.getApiPrefix();

    document.getElementById('currentMode').textContent = mode;
    document.getElementById('currentBaseUrl').textContent = baseUrl;
    document.getElementById('currentApiPrefix').textContent = apiPrefix || 'None';

    // Update radio selection based on whether we're actively using remote
    const selectedMode = CONFIG.REMOTE_API.ENABLED ? 'remote' : 'local';
    const radios = document.querySelectorAll('input[name="apiMode"]');
    radios.forEach(radio => {
        if (radio.value === selectedMode) {
            radio.checked = true;
        }
    });

    // Show/hide remote config panel if remote mode radio is selected
    const remoteRadio = document.querySelector('input[name="apiMode"][value="remote"]');
    const remotePanel = document.getElementById('remoteApiConfig');
    const discoveredPanel = document.getElementById('discoveredServers');

    if (remoteRadio && remoteRadio.checked) {
        remotePanel.style.display = 'block';
        discoveredPanel.style.display = 'block';
    } else {
        remotePanel.style.display = 'none';
        discoveredPanel.style.display = 'none';
    }

    // Update custom URL input
    document.getElementById('customApiUrl').value = CONFIG.REMOTE_API.CUSTOM_URL || '';
    document.getElementById('enableAutoDiscovery').checked = CONFIG.REMOTE_API.AUTO_DISCOVER;
    document.getElementById('scanInterval').value = CONFIG.REMOTE_API.SCAN_INTERVAL / 1000;
    document.getElementById('scanTimeout').value = CONFIG.REMOTE_API.SCAN_TIMEOUT;
}

function switchApiMode(mode) {
    console.log('[API Config] Switching to', mode, 'mode');

    if (mode === 'remote') {
        // Don't enable remote mode until we have a server URL
        // Just start scanning
        updateApiConfigDisplay();

        // Start auto-discovery if enabled
        if (CONFIG.REMOTE_API.AUTO_DISCOVER) {
            startLanScanning();
        } else {
            dialog.info('Please enter a custom URL or enable auto-discovery');
        }
    } else {
        CONFIG.REMOTE_API.ENABLED = false;
        CONFIG.REMOTE_API.CUSTOM_URL = '';

        // Stop scanning
        stopLanScanning();

        updateApiConfigDisplay();
        dialog.success(`Switched to ${mode} mode`);

        // Refresh queue and data with local API
        console.log('[API Config] Refreshing data from local API...');
        fetchQueue();
        fetchCategories();
        updateStatistics();
    }
}

function applyCustomUrl() {
    const url = document.getElementById('customApiUrl').value.trim();

    if (!url) {
        dialog.error('Please enter a valid URL');
        return;
    }

    // Validate URL format
    try {
        new URL(url);
    } catch (e) {
        dialog.error('Invalid URL format');
        return;
    }

    CONFIG.REMOTE_API.CUSTOM_URL = url;
    CONFIG.REMOTE_API.ENABLED = true;

    console.log('[API Config] Custom URL set:', url);

    updateApiConfigDisplay();
    dialog.success('Custom API URL applied');

    // Test connection and refresh data
    testConnection();

    // Refresh data from new API
    console.log('[API Config] Refreshing data from custom URL...');
    fetchQueue();
    fetchCategories();
    updateStatistics();
}

async function testConnection() {
    console.log('[API Config] Testing connection...');

    const apiUrl = api.getFullUrl(CONFIG.API.PING);
    const indicator = document.getElementById('connectionState');
    indicator.innerHTML = '<span class="connection-indicator">🟡</span> Testing...';

    try {
        const data = await api.ping();

        if (data && data.success) {
            indicator.innerHTML = '<span class="connection-indicator">🟢</span> Connected';
            dialog.success('Connection successful!');
            console.log('[API Config] Connection test passed:', data);
        } else {
            indicator.innerHTML = '<span class="connection-indicator">🔴</span> Failed';
            dialog.error('Connection test failed');
        }
    } catch (error) {
        console.error('[API Config] Connection test error:', error);
        console.error('[API Config] Failed URL:', apiUrl);
        indicator.innerHTML = '<span class="connection-indicator">🔴</span> Error';
        dialog.error('Connection error: ' + error.message);
    }
}

function startLanScanning() {
    if (isScanning) {
        console.warn('[API Config] Already scanning');
        return;
    }

    console.log('[API Config] Starting LAN scan...');
    isScanning = true;

    // Update UI
    const statusIndicator = document.querySelector('#scanStatus .status-indicator');
    const statusText = document.querySelector('#scanStatus .status-text');
    const subnetInfo = document.getElementById('subnetInfo');
    if (statusIndicator) statusIndicator.textContent = '🔍';
    if (statusText) statusText.textContent = 'Initializing scan...';
    if (subnetInfo) subnetInfo.textContent = '';

    // Set scan progress callback
    lanScanner.setScanProgressCallback((progress) => {
        if (statusText) {
            if (progress.subnet === 'No servers found') {
                statusText.textContent = 'Scan complete. No servers found.';
            } else {
                statusText.textContent = `Scanning ${progress.subnet}... ${progress.progress}%`;
            }
        }
        if (subnetInfo) {
            if (progress.found > 0) {
                subnetInfo.textContent = `Found ${progress.found} server(s)`;
            } else {
                subnetInfo.textContent = `${progress.subnet}`;
            }
        }
    });

    // Start scanner
    lanScanner.startScanning((servers) => {
        console.log('[API Config] Discovered servers:', servers);
        updateDiscoveredServers(servers);

        // Auto-select first server if no custom URL and auto-discover enabled
        if (servers.length > 0 && !CONFIG.REMOTE_API.CUSTOM_URL && CONFIG.REMOTE_API.AUTO_DISCOVER) {
            CONFIG.REMOTE_API.CUSTOM_URL = servers[0].url;
            CONFIG.REMOTE_API.ENABLED = true;  // Now we can enable remote mode
            updateApiConfigDisplay();
            dialog.success(`Auto-connected to ${servers[0].url}`);

            // Refresh data from new server
            console.log('[API Config] Refreshing data from discovered server...');
            fetchQueue();
            fetchCategories();
            updateStatistics();
        }
    });
}

function stopLanScanning() {
    if (!isScanning) return;

    console.log('[API Config] Stopping LAN scan...');
    isScanning = false;

    lanScanner.stopScanning();

    // Update UI
    const statusIndicator = document.querySelector('#scanStatus .status-indicator');
    const statusText = document.querySelector('#scanStatus .status-text');
    statusIndicator.textContent = '⏸️';
    statusText.textContent = 'Not scanning';
}

function updateDiscoveredServers(servers) {
    const tbody = document.getElementById('serversTableBody');

    if (!servers || servers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No servers discovered</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    servers.forEach((server, index) => {
        const tr = document.createElement('tr');

        const isSelected = CONFIG.REMOTE_API.CUSTOM_URL === server.url;

        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="radio" name="selectedServer" value="${server.url}" ${isSelected ? 'checked' : ''}>
            </td>
            <td>${server.ip}</td>
            <td>${server.port}</td>
            <td style="font-family: monospace; font-size: 12px;">${server.url}</td>
            <td><span class="status-badge status-completed">🟢 Active</span></td>
        `;

        // Add click handler for radio
        const radio = tr.querySelector('input[type="radio"]');
        radio.addEventListener('change', () => {
            if (radio.checked) {
                CONFIG.REMOTE_API.CUSTOM_URL = server.url;
                CONFIG.REMOTE_API.ENABLED = true;
                updateApiConfigDisplay();
                dialog.success(`Selected ${server.url}`);
                testConnection();

                // Refresh data from selected server
                console.log('[API Config] Refreshing data from selected server...');
                fetchQueue();
                fetchCategories();
                updateStatistics();
            }
        });

        tbody.appendChild(tr);
    });

    // Update scan status
    const statusText = document.querySelector('#scanStatus .status-text');
    statusText.textContent = `Scanning... (${servers.length} found)`;
}

function toggleAutoDiscovery(enabled) {
    CONFIG.REMOTE_API.AUTO_DISCOVER = enabled;
    console.log('[API Config] Auto-discovery:', enabled ? 'Enabled' : 'Disabled');

    if (enabled && CONFIG.REMOTE_API.ENABLED) {
        startLanScanning();
    } else if (!enabled) {
        stopLanScanning();
    }
}

// ========== Code Sync Functions ==========

// Code sync state
let codeSyncRefreshInterval = null;

async function startCodeSync() {
    const mode = document.getElementById('codeSyncMode')?.value || 'server';

    const apiUrl = mode === 'server'
        ? api.getFullUrl(CONFIG.API.CODE_SYNC_START_SERVER)
        : api.getFullUrl(CONFIG.API.CODE_SYNC_START_CLIENT);

    try {
        let data;
        if (mode === 'server') {
            data = await api.startCodeSyncServer();
        } else {
            data = await api.startCodeSyncClient();
        }

        if (data.success) {
            dialog.success(`Code sync ${mode} mode started`);

            // Update UI
            document.getElementById('startSyncBtn').style.display = 'none';
            document.getElementById('stopSyncBtn').style.display = 'inline-block';
            document.getElementById('codeSyncMode').disabled = true;

            // Start auto-refresh
            refreshCodeSyncStatus();
            codeSyncRefreshInterval = setInterval(refreshCodeSyncStatus, 3000);
        } else {
            dialog.error(`Failed to start code sync: ${data.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('[Code Sync] Start error:', error);
        console.error('[Code Sync] Failed URL:', apiUrl);
        dialog.error(`Failed to start code sync: ${error.message}`);
    }
}

async function stopCodeSync() {
    const apiUrl = api.getFullUrl(CONFIG.API.CODE_SYNC_STOP);

    try {
        const data = await api.stopCodeSync();

        if (data.success) {
            dialog.success('Code sync stopped');

            // Update UI
            document.getElementById('startSyncBtn').style.display = 'inline-block';
            document.getElementById('stopSyncBtn').style.display = 'none';
            document.getElementById('codeSyncMode').disabled = false;

            // Stop auto-refresh
            if (codeSyncRefreshInterval) {
                clearInterval(codeSyncRefreshInterval);
                codeSyncRefreshInterval = null;
            }

            // Final status update
            refreshCodeSyncStatus();
        } else {
            dialog.error(`Failed to stop code sync: ${data.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('[Code Sync] Stop error:', error);
        console.error('[Code Sync] Failed URL:', apiUrl);
        dialog.error(`Failed to stop code sync: ${error.message}`);
    }
}

async function toggleBackup(event) {
    const enabled = event.target.checked;
    console.log('[Code Sync] Backup toggle:', enabled ? 'Enabled' : 'Disabled');

    const apiUrl = api.getFullUrl(CONFIG.API.CODE_SYNC_TOGGLE_BACKUP);

    try {
        const data = await api.toggleBackup(enabled);

        if (data.success) {
            dialog.success(`Backup ${enabled ? 'enabled' : 'disabled'}`);
        } else {
            // Revert checkbox on error
            event.target.checked = !enabled;
            dialog.error('Failed to toggle backup setting');
        }
    } catch (error) {
        console.error('[Code Sync] Backup toggle error:', error);
        console.error('[Code Sync] Failed URL:', apiUrl);
        event.target.checked = !enabled;
        dialog.error(`Error toggling backup: ${error.message}`);
    }
}

async function refreshCodeSyncStatus() {
    const apiUrl = api.getFullUrl(CONFIG.API.CODE_SYNC_STATUS);

    try {
        const data = await api.getCodeSyncStatus();

        if (data.success) {
            updateCodeSyncUI(data);
        }
    } catch (error) {
        console.error('[Code Sync] Status refresh error:', error);
        console.error('[Code Sync] Failed URL:', apiUrl);
    }
}

function updateCodeSyncUI(statusData) {
    const mode = statusData.mode || 'disabled';

    // Update status panel
    document.getElementById('syncStatus').textContent = mode === 'disabled' ? 'Stopped' : 'Running';
    document.getElementById('syncModeDisplay').textContent = mode.charAt(0).toUpperCase() + mode.slice(1);

    // Update panel visibility
    updateCodeSyncPanelVisibility(mode);

    // Update server mode stats
    if (mode === 'server' && statusData.server) {
        const server = statusData.server;

        // Display running status, root_dir, and timezone
        document.getElementById('syncRunning').textContent = server.running ? 'Yes' : 'No';
        document.getElementById('syncRootDir').textContent = server.root_dir || '-';
        const serverTz = server.timezone_offset ? `${server.timezone} (${server.timezone_offset})` : (server.timezone || '-');
        document.getElementById('syncTimezone').textContent = serverTz;

        // Calculate total push count across all clients
        const totalPushCount = (server.clients || []).reduce((sum, client) => sum + (client.push_count || 0), 0);

        document.getElementById('serverPushCount').textContent = totalPushCount;
        document.getElementById('serverTotalFiles').textContent = server.total_files || 0;
        document.getElementById('serverChangedFiles').textContent = server.changed_files || 0;
        document.getElementById('serverClientCount').textContent = server.clients_count || 0;

        // Update clients table
        updateClientsTable(server.clients || []);
    }

    // Update client mode stats
    if (mode === 'client' && statusData.client) {
        const client = statusData.client;

        // Display running status, root_dir, and timezone
        document.getElementById('syncRunning').textContent = client.running ? 'Yes' : 'No';
        document.getElementById('syncRootDir').textContent = client.root_dir || '-';
        const clientTz = client.timezone_offset ? `${client.timezone} (${client.timezone_offset})` : (client.timezone || '-');
        document.getElementById('syncTimezone').textContent = clientTz;

        document.getElementById('clientReceivedCount').textContent = client.received_count || 0;
        document.getElementById('clientSkippedCount').textContent = client.skipped_count || 0;
        document.getElementById('clientReceivedFiles').textContent = client.received_files_count || 0;
        document.getElementById('clientConnected').textContent = client.connected ? 'Yes' : 'No';
        document.getElementById('serverHost').textContent = client.server_host || '-';
        document.getElementById('serverPort').textContent = client.server_port || '-';
        document.getElementById('clientId').textContent = client.client_id || '-';

        // Update backup checkbox
        const backupCheckbox = document.getElementById('enableBackup');
        if (backupCheckbox) {
            backupCheckbox.checked = client.enable_backup || false;
        }

        // Update sync logs
        updateSyncLogs(client.logs || []);
    }
}

function updateCodeSyncPanelVisibility(mode) {
    const serverPanel = document.getElementById('serverModePanel');
    const clientPanel = document.getElementById('clientModePanel');

    if (mode === 'server') {
        serverPanel.style.display = 'block';
        clientPanel.style.display = 'none';
    } else if (mode === 'client') {
        serverPanel.style.display = 'none';
        clientPanel.style.display = 'block';
    } else {
        // Default to server panel for disabled state
        serverPanel.style.display = 'block';
        clientPanel.style.display = 'none';
    }
}

function updateClientsTable(clients) {
    const tbody = document.getElementById('clientsTableBody');

    if (!clients || clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No connected clients</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    clients.forEach(client => {
        const lastSeen = new Date(client.last_seen).toLocaleString();

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size: 11px; max-width: 150px; overflow: hidden; text-overflow: ellipsis;" title="${client.id}">${client.id.substring(0, 20)}...</td>
            <td>${client.ip}</td>
            <td>${client.push_count || 0}</td>
            <td>${client.total_files_pushed || 0}</td>
            <td>${client.received_count || 0}</td>
            <td>${client.skipped_count || 0}</td>
            <td style="font-size: 12px;">${lastSeen}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateSyncLogs(logs) {
    const container = document.getElementById('syncLogsContainer');

    if (!logs || logs.length === 0) {
        container.innerHTML = '<div class="empty-state">No sync activity yet</div>';
        return;
    }

    // Define color mapping for actions
    const actionColors = {
        'received': '#4CAF50',
        'skipped': '#2196F3',
        'backup': '#FF9800',
        'error': '#F44336'
    };

    // Reverse logs to show newest first
    const reversedLogs = [...logs].reverse();

    container.innerHTML = reversedLogs.map(log => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        const color = actionColors[log.action] || '#666';

        return `
            <div style="padding: 8px; border-bottom: 1px solid #e0e0e0;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 3px;">
                    <span style="color: ${color}; font-weight: bold;">[${log.action.toUpperCase()}]</span>
                    <span style="opacity: 0.7;">${timestamp}</span>
                </div>
                <div style="margin-left: 10px; color: #333;">
                    <div style="font-weight: 500;">${log.file}</div>
                    <div style="opacity: 0.8; font-size: 11px;">${log.reason}</div>
                    ${log.details ? `<div style="opacity: 0.6; font-size: 10px; margin-top: 2px;">${log.details}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Auto-scroll to top (newest)
    container.scrollTop = 0;
}

// ========== RPC Connection Events ==========
rpcClient.on('connection', () => {
    console.log('[RPC] WebSocket connected');
    updateStatus(true);
    fetchQueue();
});

rpcClient.on('disconnect', () => {
    console.log('[RPC] WebSocket disconnected');
    updateStatus(false);
});

// ========== Start ==========
init();
