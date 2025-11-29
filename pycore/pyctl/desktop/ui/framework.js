// Voice Subtitle Framework - Main JavaScript
// Handles module switching, player controls, queue management, and background features

// ========== Initialize API Client ==========
const api = new VoiceSubtitleAPI(CONFIG);

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
    'code-sync': document.getElementById('module-code-sync')
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
    }
}

// ========== Queue Management ==========
async function fetchQueue() {
    try {
        // Get playback mode setting
        const playbackMode = document.querySelector('input[name="playbackMode"]:checked')?.value || CONFIG.DEFAULTS.PLAYBACK_MODE;
        const latestCount = parseInt(document.getElementById('latestCount')?.value || CONFIG.DEFAULTS.LATEST_COUNT);
        const categoryFilter = document.getElementById('categoryFilter')?.value || '';

        let data;

        // Apply playback mode filter using centralized API
        if (playbackMode === 'latest') {
            const result = await api.getLatestItems(latestCount);
            if (result && result.success) {
                data = {
                    success: true,
                    queue: result.items,
                    current_index: 0
                };
            }
        } else if (playbackMode === 'today') {
            const result = await api.getTodayItems();
            if (result && result.success) {
                data = {
                    success: true,
                    queue: result.items,
                    current_index: 0
                };
            }
        } else if (categoryFilter) {
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
        console.error('[Queue] Fetch error:', error);
    }
}

async function fetchCategories() {
    try {
        const data = await api.getCategories();

        if (data && data.success) {
            updateCategoriesList(data.categories);
            updateCategoryFilters(data.categories);
        }
    } catch (error) {
        console.error('[Categories] Fetch error:', error);
    }
}

async function updateStatistics() {
    try {
        const [queueData, todayData] = await Promise.all([
            api.getQueue(),
            api.getTodayItems()
        ]);

        document.getElementById('totalItems').textContent = queueData.queue?.length || 0;
        document.getElementById('todayItems').textContent = todayData.count || 0;
    } catch (error) {
        console.error('[Statistics] Update error:', error);
    }
}

async function fetchQueueList() {
    try {
        const data = await api.getQueue();

        if (data && data.success && data.queue) {
            renderQueueTable(data.queue);
        }
    } catch (error) {
        console.error('[Queue List] Fetch error:', error);
    }
}

async function updateServerIndex(index) {
    try {
        const data = await api.setCurrentIndex(index);
        if (data.success) {
            updateQueueInfo();
        }
    } catch (error) {
        console.error('[Queue] Set index error:', error);
    }
}

async function incrementPlayCount(index) {
    try {
        await api.incrementPlayCount(index);
    } catch (error) {
        console.error('[Queue] Increment play count error:', error);
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
    try {
        const data = await api.getItemsByCategory(category);

        if (data && data.success) {
            renderQueueTable(data.items);
        }
    } catch (error) {
        console.error('[Filter] Category filter error:', error);
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
}

// ========== Quick Add Functions ==========
async function addTextToQueue() {
    const textarea = document.getElementById('addTextInput');
    const text = textarea.value.trim();

    if (!text) {
        dialog.error('Please enter text to add');
        return;
    }

    try {
        const data = await api.addText(text, CONFIG.DEFAULTS.LANGUAGES, CONFIG.DEFAULTS.CATEGORY);

        if (data.success) {
            textarea.value = '';
            dialog.success('Text added to queue successfully!');
            await fetchQueue();
        }
    } catch (error) {
        console.error('[Add Text] Error:', error);
        dialog.error('Failed to add text to queue');
    }
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const preview = document.getElementById('imagePreview');
    preview.textContent = `Uploading: ${file.name}...`;

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
        preview.textContent = `✗ Failed: ${file.name}`;
        dialog.error('Failed to process image');
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const fileInfo = document.getElementById('fileInfo');
    fileInfo.textContent = `Reading: ${file.name}...`;

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
        fileInfo.textContent = `✗ Failed: ${file.name}`;
        dialog.error('Failed to process file');
    }
}

// ========== Queue Management Functions ==========
async function clearQueue() {
    if (!confirm('Are you sure you want to clear the entire queue?')) return;

    try {
        const data = await api.clearQueue();
        if (data.success) {
            await fetchQueue();
            await fetchQueueList();
        }
    } catch (error) {
        console.error('[Clear Queue] Error:', error);
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

    try {
        const data = await api.removeItems([index]);
        if (data.success) {
            await fetchQueue();
            await fetchQueueList();
        }
    } catch (error) {
        console.error('[Delete Item] Error:', error);
    }
}

async function deleteSelectedItems() {
    if (selectedItems.size === 0) {
        dialog.error('No items selected');
        return;
    }

    if (!confirm(`Delete ${selectedItems.size} selected items?`)) return;

    try {
        const data = await api.removeItems(Array.from(selectedItems));
        if (data.success) {
            selectedItems.clear();
            await fetchQueue();
            await fetchQueueList();
        }
    } catch (error) {
        console.error('[Delete Selected] Error:', error);
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
        dialog.error('Failed to update categories');
    }
}

// ========== Background Features ==========
async function toggleClipboardMonitor(event) {
    const enabled = event.target.checked;
    console.log('[Clipboard Monitor]', enabled ? 'Enabled' : 'Disabled');

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
        event.target.checked = !enabled;
        dialog.error('Error toggling clipboard monitoring');
    }
}

async function toggleScreenshotMonitor(event) {
    const enabled = event.target.checked;
    const interval = parseInt(document.getElementById('screenshotInterval').value);
    console.log('[Screenshot Monitor]', enabled ? `Enabled (${interval}s)` : 'Disabled');

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

// ========== Code Sync Functions ==========

// Code sync state
let codeSyncRefreshInterval = null;

async function startCodeSync() {
    const mode = document.getElementById('codeSyncMode')?.value || 'server';

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
        dialog.error(`Failed to start code sync: ${error.message}`);
    }
}

async function stopCodeSync() {
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
        dialog.error(`Failed to stop code sync: ${error.message}`);
    }
}

async function toggleBackup(event) {
    const enabled = event.target.checked;
    console.log('[Code Sync] Backup toggle:', enabled ? 'Enabled' : 'Disabled');

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
        event.target.checked = !enabled;
        dialog.error(`Error toggling backup: ${error.message}`);
    }
}

async function refreshCodeSyncStatus() {
    try {
        const data = await api.getCodeSyncStatus();

        if (data.success) {
            updateCodeSyncUI(data);
        }
    } catch (error) {
        console.error('[Code Sync] Status refresh error:', error);
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
