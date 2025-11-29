const API_BASE = '/api/mcp/v1/voice-subtitle';
const PENDING_TASKS_KEY = 'voice_subtitle_pending_tasks';
let currentQueue = [];
let currentIndex = 0;
let allGroups = [];
let audioPlayer = document.getElementById('audioPlayer');
let currentAudioUrl = null;
let currentAudioItemId = null;
let isPlaying = false;
let userSettings = {};
let availableLanguages = [];
let currentTasks = [];
let taskRefreshTimer = null;
let pendingTaskIds = loadPendingTasksFromStorage();
let playerQueueVisible = false;
let playerQueueFilterGroup = '';
let pendingGroupEditIndex = null;
const groupEditModalEl = document.getElementById('groupEditModal');
if (groupEditModalEl) {
    groupEditModalEl.addEventListener('click', (event) => {
        if (event.target === groupEditModalEl) {
            closeGroupEditModal();
        }
    });
}
document.body.classList.remove('fullscreen-mode');

function loadPendingTasksFromStorage() {
    try {
        const stored = localStorage.getItem(PENDING_TASKS_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function savePendingTasksToStorage() {
    try {
        localStorage.setItem(PENDING_TASKS_KEY, JSON.stringify(pendingTaskIds));
    } catch (e) {
        console.warn('Failed to persist pending tasks', e);
    }
}

function addPendingTaskId(taskId) {
    if (!taskId) return;
    if (!pendingTaskIds.includes(taskId)) {
        pendingTaskIds.push(taskId);
        savePendingTasksToStorage();
    }
}

function removePendingTaskId(taskId) {
    const next = pendingTaskIds.filter(id => id !== taskId);
    if (next.length !== pendingTaskIds.length) {
        pendingTaskIds = next;
        savePendingTasksToStorage();
    }
}

(async function init() {
    await loadUserSettings();
    await loadSupportedLanguages();
    await loadQueue();
    await loadGroups();
    await loadTasks();
    startTaskPolling();
})();

async function loadUserSettings() {
    const response = await fetch(`${API_BASE}/settings`);
    const result = await response.json();

    if (result.success) {
        userSettings = result.settings;
        document.getElementById('userIdentifier').textContent = userSettings.user_identifier || 'Unknown';

        document.getElementById('defaultPlaybackRate').value = userSettings.playback_rate || 1.0;
        document.getElementById('defaultPlaybackRateValue').textContent = (userSettings.playback_rate || 1.0) + 'x';

        document.getElementById('playbackRateSlider').value = userSettings.playback_rate || 1.0;
        document.getElementById('playbackRateValue').textContent = (userSettings.playback_rate || 1.0) + 'x';
        audioPlayer.playbackRate = userSettings.playback_rate || 1.0;

        document.getElementById('autoPlayCheckbox').checked = userSettings.auto_play || false;
        document.getElementById('playMode').value = userSettings.play_mode || 'all';

        updatePlayOptions();
        updateTargetLanguageDisplay();
    }
}

async function loadSupportedLanguages() {
    const response = await fetch(`${API_BASE}/languages`);
    const result = await response.json();

    if (result.success) {
        availableLanguages = result.languages;
        renderLanguageCheckboxes();
        updateTargetLanguageDisplay();
        updateAPIExamples();
    }
}

function renderLanguageCheckboxes() {
    const container = document.getElementById('languageCheckboxes');
    const selectedLangs = Array.isArray(userSettings.target_language)
        ? userSettings.target_language
        : [userSettings.target_language || 'en'];

    container.innerHTML = availableLanguages.map(lang => `
        <div class="language-checkbox">
            <input type="checkbox" id="lang_${lang.code}" value="${lang.code}"
                ${selectedLangs.includes(lang.code) ? 'checked' : ''}>
            <label for="lang_${lang.code}">${lang.native_name}</label>
        </div>
    `).join('');

    filterLanguageOptions(document.querySelector('.language-filter-input')?.value || '');
}

function updateTargetLanguageDisplay() {
    const selectedLangs = Array.isArray(userSettings.target_language)
        ? userSettings.target_language
        : [userSettings.target_language || 'en'];

    const badgesHtml = selectedLangs.map(code => {
        const lang = availableLanguages.find(l => l.code === code);
        return `<span class="lang-badge">${lang ? lang.native_name : code}</span>`;
    }).join('');

    document.getElementById('targetLangBadges').innerHTML = badgesHtml || '<span class="lang-badge">None selected</span>';
}

function filterLanguageOptions(keyword = '') {
    const container = document.getElementById('languageCheckboxes');
    if (!container) {
        return;
    }
    const lower = keyword.trim().toLowerCase();
    container.querySelectorAll('.language-checkbox').forEach(item => {
        const label = item.textContent.toLowerCase();
        item.style.display = !lower || label.includes(lower) ? 'flex' : 'none';
    });
}

function updateAPIExamples() {
    const selectedLangs = Array.isArray(userSettings.target_language)
        ? userSettings.target_language
        : [userSettings.target_language || 'en'];

    const targetLangStr = JSON.stringify(selectedLangs);

    document.getElementById('apiExampleText').textContent = `curl -X POST ${location.origin}${API_BASE}/add \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "text",
    "content": "Hello world",
    "group": "default"
  }'

# Current target languages: ${targetLangStr}
# Text will be AI-rewritten to: ${selectedLangs.join(', ')}`;

    document.getElementById('apiExampleImage').textContent = `curl -X POST ${location.origin}${API_BASE}/add \\
  -F "type=image" \\
  -F "image=@/path/to/image.jpg" \\
  -F "group=default"

# Image will be OCR'd, then AI-rewritten to: ${selectedLangs.join(', ')}`;

    document.getElementById('apiExampleUrl').textContent = `curl -X POST ${location.origin}${API_BASE}/add \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "url",
    "content": "https://example.com/article",
    "group": "news"
  }'

# URL content will be AI-rewritten to: ${selectedLangs.join(', ')}`;
}

async function saveSettings() {
    const checkboxes = document.querySelectorAll('#languageCheckboxes input:checked');
    const targetLanguage = Array.from(checkboxes).map(cb => cb.value);
    const defaultVoice = document.getElementById('defaultVoice').value;
    const playbackRate = parseFloat(document.getElementById('defaultPlaybackRate').value);

    if (targetLanguage.length === 0) {
        showMessage('Please select at least one target language', 'error', 'settings');
        return;
    }

    showMessage('Saving...', 'info', 'settings');

    const response = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            target_language: targetLanguage,
            default_voice: defaultVoice,
            playback_rate: playbackRate
        })
    });

    const result = await response.json();

    if (result.success) {
        userSettings = result.settings;
        showMessage('Settings saved!', 'success', 'settings');

        audioPlayer.playbackRate = playbackRate;
        document.getElementById('playbackRateSlider').value = playbackRate;
        document.getElementById('playbackRateValue').textContent = playbackRate + 'x';

        updateTargetLanguageDisplay();
        updateAPIExamples();
    } else {
        showMessage('Save failed: ' + (result.error || 'Unknown error'), 'error', 'settings');
    }
}

function updatePlaybackRate(rate) {
    audioPlayer.playbackRate = parseFloat(rate);
    document.getElementById('playbackRateValue').textContent = rate + 'x';
}

async function updateAutoPlay() {
    const autoPlay = document.getElementById('autoPlayCheckbox').checked;
    userSettings.auto_play = autoPlay;

    await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_play: autoPlay })
    });
}

async function updatePlayOptions() {
    const playMode = document.getElementById('playMode').value;
    const groupWrapper = document.getElementById('groupSelectWrapper');
    const langWrapper = document.getElementById('languageSelectWrapper');

    groupWrapper.style.display = playMode === 'group' ? 'flex' : 'none';
    langWrapper.style.display = playMode === 'language' ? 'flex' : 'none';

    if (playMode === 'group') {
        const select = document.getElementById('playGroupSelect');
        select.innerHTML = allGroups.map(g => `<option value="${g}">${g}</option>`).join('');
    }

    if (playMode === 'language') {
        const select = document.getElementById('playLanguageSelect');
        const uniqueLangs = [...new Set(currentQueue.map(item => item.language))];
        select.innerHTML = uniqueLangs.map(lang => `<option value="${lang}">${lang}</option>`).join('');
    }

    const playGroup = playMode === 'group' ? document.getElementById('playGroupSelect').value : null;
    const playLanguage = playMode === 'language' ? document.getElementById('playLanguageSelect').value : null;

    await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            play_mode: playMode,
            play_group: playGroup,
            play_language: playLanguage
        })
    });

    await loadQueue();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    const tabs = {
        'player': { button: 0, content: 'playerTab', onLoad: loadQueue },
        'add': { button: 1, content: 'addTab', onLoad: () => { loadGroups(); updateAPIExamples(); } },
        'queue': { button: 2, content: 'queueTab', onLoad: async () => { await loadQueue(); await loadGroups(); renderQueueTab(); } },
        'settings': { button: 3, content: 'settingsTab', onLoad: loadStats }
    };

    if (tabs[tab]) {
        document.querySelectorAll('.tab-button')[tabs[tab].button].classList.add('active');
        document.getElementById(tabs[tab].content).classList.add('active');
        if (tabs[tab].onLoad) tabs[tab].onLoad();
    }
}

async function loadStats() {
    const response = await fetch(`${API_BASE}/stats`);
    const result = await response.json();

    if (result.success) {
        const stats = result.stats;
        const statsDiv = document.getElementById('statsInfo');
        statsDiv.innerHTML = `
            <div style="color: #aaa;">
                <div style="margin-bottom: 10px;">
                    <strong>Processor Version:</strong> ${stats.processor_version || 'N/A'}
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>TTS Cache Count:</strong> ${stats.total_cache_count || 0}
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Total Cache Size:</strong> ${stats.total_cache_size_mb || 0} MB
                </div>
            </div>
        `;
    }
}

function toggleFullscreen() {
    const body = document.body;
    body.classList.toggle('fullscreen-mode');
    const btn = document.querySelector('.fullscreen-toggle');
    if (btn) {
        btn.textContent = body.classList.contains('fullscreen-mode') ? '⬅️ Exit Fullscreen' : '🖥️ Fullscreen Subtitle';
    }
}

async function loadQueue() {
    try {
        const response = await fetch(`${API_BASE}/queue`);
        const result = await response.json();

        if (result.success) {
            currentQueue = result.queue;
            currentIndex = result.current_index || 0;
            updateCurrentSubtitle();
            renderQueueTab();
            if (playerQueueVisible) {
                renderPlayerQueue();
            }
        }
    } catch (error) {
        console.error('Failed to load queue', error);
    }
}

async function loadTasks(fetchRecentOnly = false) {
    try {
        const hasPending = pendingTaskIds.length > 0 && !fetchRecentOnly;
        let url = `${API_BASE}/tasks`;
        if (hasPending) {
            url += `?ids=${pendingTaskIds.join(',')}`;
        } else {
            url += `?limit=20`;
        }

        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            currentTasks = result.tasks || [];
            const updatedEl = document.getElementById('taskLastUpdated');
            if (updatedEl) {
                updatedEl.textContent = 'Updated at ' + new Date().toLocaleTimeString();
            }
            renderTaskList();

            if (hasPending) {
                const finished = currentTasks
                    .filter(task => ['completed', 'failed'].includes(task.status))
                    .map(task => task.id || task.task_id);
                finished.forEach(removePendingTaskId);

                if (pendingTaskIds.length === 0) {
                    await loadTasks(true);
                    await loadQueue();
                    return;
                }
            }
        }
    } catch (error) {
        console.error('Failed to load tasks', error);
    }
}

function startTaskPolling() {
    if (taskRefreshTimer) {
        clearInterval(taskRefreshTimer);
    }
    taskRefreshTimer = setInterval(loadTasks, 7000);
}

async function loadGroups() {
    const response = await fetch(`${API_BASE}/groups`);
    const result = await response.json();

    if (result.success) {
        allGroups = result.groups;
        updateGroupSuggestions();
        updateGroupFilter();
        updatePlayerQueueFilterOptions();
    }
}

function updateGroupSuggestions() {
    const datalist = document.getElementById('groupSuggestions');
    datalist.innerHTML = allGroups.map(group => `<option value="${group}">`).join('');
}

function updateGroupFilter() {
    const select = document.getElementById('groupFilter');
    if (!select) {
        return;
    }
    const currentValue = select.value;
    select.innerHTML = '<option value="">All Groups</option>' +
        allGroups.map(group => `<option value="${group}">${group}</option>`).join('');
    select.value = currentValue;
}

function renderQueueTab() {
    const list = document.getElementById('queueList');
    const filter = document.getElementById('groupFilter').value;

    let filteredQueue = currentQueue;
    if (filter) {
        filteredQueue = currentQueue.filter(item => (item.group || 'default') === filter);
    }

    document.getElementById('queueTotalCount').textContent = currentQueue.length;

    if (filteredQueue.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">${filter ? 'No items in this group' : 'Queue is empty'}</div>
            </div>
        `;
        return;
    }

    list.innerHTML = filteredQueue.map((item, idx) => {
        const realIndex = currentQueue.indexOf(item);
        return `
            <div class="queue-item ${realIndex === currentIndex ? 'active' : ''}">
                <div class="queue-item-content" onclick="jumpToIndex(${realIndex})">
                    <div class="queue-item-text">${truncate(item.translated_text || item.original_text || 'No text', 80)}</div>
                    <div class="queue-item-meta">
                        <span>${item.language}</span>
                        <span>${item.voice}</span>
                        <span>#${realIndex + 1}/${currentQueue.length}</span>
                    </div>
                </div>
                <div class="queue-item-actions">
                    <span class="queue-item-group">${item.group || 'default'}</span>
                    <button class="btn-edit-group" onclick="editItemGroup(${realIndex}, '${item.group || 'default'}')">Edit Group</button>
                    <button class="btn-delete" onclick="deleteQueueItem(${realIndex})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function updatePlayerQueueFilterOptions() {
    const select = document.getElementById('playerQueueGroupFilter');
    if (!select) {
        return;
    }
    const previous = playerQueueFilterGroup || '';
    select.innerHTML = '<option value="">All</option>' +
        allGroups.map(group => `<option value="${group}">${group}</option>`).join('');
    if (previous && !allGroups.includes(previous)) {
        playerQueueFilterGroup = '';
    }
    select.value = playerQueueFilterGroup;
}

function renderTaskList() {
    const container = document.getElementById('taskList');
    if (!container) {
        return;
    }

    if (!currentTasks || currentTasks.length === 0) {
        container.innerHTML = `
            <div class="task-empty-state">
                No active tasks. Submit a request to see progress here.
            </div>
        `;
        return;
    }

    container.innerHTML = currentTasks.map(task => {
        const status = task.status || 'pending';
        const statusClass = `task-status ${status}`;
        const progress = Math.min(100, Math.max(0, task.progress || 0));
        const steps = task.steps || {};
        const stepHtml = Object.entries(steps).map(([key, info]) => {
            const label = info.label || key;
            const stepStatus = info.status || 'pending';
            return `
                <div class="task-step">
                    <strong>${label}</strong>
                    <span class="step-status ${stepStatus}">${stepStatus}</span>
                </div>
            `;
        }).join('');

        const summary = task.result && task.result.summary
            ? Object.entries(task.result.summary)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' | ')
            : '';

        const taskId = task.id || task.task_id;

        return `
            <div class="task-card">
                <div class="task-title-row">
                    <div>
                        <div class="task-id">${taskId}</div>
                        <div style="font-size:12px; color:#999;">${task.task_type || 'unknown'} · ${task.app_name || ''}</div>
                    </div>
                    <div>
                        <div class="${statusClass}">${status}</div>
                        <button class="btn-delete" style="margin-top:8px;" onclick="deleteTask('${taskId}')">Delete</button>
                    </div>
                </div>
                <div class="task-progress-bar">
                    <span style="width: ${progress}%;"></span>
                </div>
                <div class="task-steps">
                    ${stepHtml}
                </div>
                ${summary ? `<div style="margin-top:10px; font-size:12px; color:#bbb;">${summary}</div>` : ''}
            </div>
        `;
    }).join('');
}

function filterByGroup() {
    renderQueueTab();
}

function togglePlayerQueue(forceState) {
    playerQueueVisible = typeof forceState === 'boolean' ? forceState : !playerQueueVisible;
    const panel = document.getElementById('playerQueuePanel');
    const toggleBtn = document.querySelector('.queue-toggle');
    if (panel) {
        panel.classList.toggle('active', playerQueueVisible);
    }
    if (toggleBtn) {
        toggleBtn.textContent = playerQueueVisible ? '📋 Hide Queue' : '📋 Queue';
    }
    if (playerQueueVisible) {
        updatePlayerQueueFilterOptions();
        renderPlayerQueue();
    }
}

function renderPlayerQueue() {
    const list = document.getElementById('playerQueueList');
    if (!list) {
        return;
    }

    if (!currentQueue.length) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <div class="empty-state-text">Queue is empty</div>
            </div>
        `;
        return;
    }
    const select = document.getElementById('playerQueueGroupFilter');
    if (select) {
        select.value = playerQueueFilterGroup;
    }

    const filteredQueue = playerQueueFilterGroup
        ? currentQueue.filter(item => (item.group || 'default') === playerQueueFilterGroup)
        : currentQueue;

    if (!filteredQueue.length) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🗂️</div>
                <div class="empty-state-text">No items in this group</div>
            </div>
        `;
        return;
    }

    list.innerHTML = filteredQueue.map((item, index) => {
        const globalIndex = currentQueue.indexOf(item);
        const textPreview = truncate(item.translated_text || item.original_text || 'No text', 90);
        return `
            <div class="player-queue-item ${globalIndex === currentIndex ? 'active' : ''}">
                <h4>${textPreview}</h4>
                <div class="player-queue-meta">
                    <span>${item.language}</span> ·
                    <span>${item.voice}</span> ·
                    <span>${item.group || 'default'}</span>
                </div>
                <div class="player-queue-actions">
                    <button class="queue-btn-primary" onclick="playFromPlayerQueue(${globalIndex})">Play</button>
                    <button class="queue-btn-secondary" onclick="promptChangeGroup(${globalIndex}, '${item.group || 'default'}')">Group</button>
                    <button class="queue-btn-danger" onclick="deleteQueueItem(${globalIndex})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function setPlayerQueueFilter(group) {
    playerQueueFilterGroup = group || '';
    renderPlayerQueue();
}

function promptChangeGroup(index, currentGroup = 'default') {
    openGroupEditModal(index, currentGroup);
}

async function playFromPlayerQueue(index) {
    await jumpToIndex(index);
    autoStartPlayback(200);
}

function openGroupEditModal(index, currentGroup = 'default') {
    pendingGroupEditIndex = index;
    const modal = document.getElementById('groupEditModal');
    if (!modal) {
        return;
    }
    const pathPreview = currentQueue[index]
        ? truncate(currentQueue[index].translated_text || currentQueue[index].original_text || 'No text', 80)
        : '';
    document.getElementById('groupEditInput').value = currentGroup || 'default';
    document.getElementById('groupEditPath').textContent = pathPreview;
    modal.classList.add('active');
    setTimeout(() => document.getElementById('groupEditInput')?.focus(), 50);
}

function closeGroupEditModal() {
    pendingGroupEditIndex = null;
    document.getElementById('groupEditModal')?.classList.remove('active');
}

async function submitGroupEditModal() {
    if (pendingGroupEditIndex === null) {
        closeGroupEditModal();
        return;
    }
    const value = document.getElementById('groupEditInput').value.trim() || 'default';
    await editItemGroup(pendingGroupEditIndex, value);
    await loadGroups();
    closeGroupEditModal();
    await loadQueue();
    if (playerQueueVisible) {
        renderPlayerQueue();
    }
}

function updateCurrentSubtitle() {
    const current = currentQueue[currentIndex];
    const wrapper = document.getElementById('subtitleText');
    const metaEl = document.getElementById('subtitleMeta');
    const inner = ensureSubtitleInner(wrapper);

    if (!inner || !metaEl) {
        return;
    }

    if (!current) {
        inner.textContent = 'Queue is empty';
        metaEl.textContent = '';
        adjustSubtitleFontSize(inner.textContent, wrapper, inner);
        return;
    }

    const subtitleText = current.translated_text || current.original_text || 'No text';
    inner.textContent = subtitleText;
    metaEl.textContent = `${current.language} | ${current.voice} | ${currentIndex + 1}/${currentQueue.length}`;
    adjustSubtitleFontSize(subtitleText, wrapper, inner);

    const firstAudio = current.tts_files && current.tts_files.length > 0
        ? current.tts_files[0]
        : null;

    if (firstAudio && firstAudio.audio_url) {
        const newUrl = firstAudio.audio_url;
        const newItemId = current.id || `${currentIndex}-${newUrl}`;
        const shouldUpdate = newUrl !== currentAudioUrl || newItemId !== currentAudioItemId;

        if (newUrl && shouldUpdate) {
            currentAudioUrl = newUrl;
            currentAudioItemId = newItemId;
            audioPlayer.src = newUrl;
            audioPlayer.load();
            isPlaying = false;
            const playBtn = document.getElementById('playBtn');
            if (playBtn) {
                playBtn.textContent = '▶️ Play';
            }
        }
    } else {
        currentAudioUrl = null;
        currentAudioItemId = null;
        audioPlayer.removeAttribute('src');
        audioPlayer.load();
        isPlaying = false;
        const playBtn = document.getElementById('playBtn');
        if (playBtn) {
            playBtn.textContent = '▶️ Play';
        }
    }
}

function adjustSubtitleFontSize(text, wrapper = document.getElementById('subtitleText'), inner = ensureSubtitleInner(wrapper)) {
    if (!wrapper || !inner) {
        return;
    }
    const length = text ? text.length : 0;
    let fontSize = 48;
    if (length > 220) {
        fontSize = 22;
    } else if (length > 160) {
        fontSize = 28;
    } else if (length > 120) {
        fontSize = 32;
    } else if (length > 80) {
        fontSize = 40;
    }
    wrapper.style.fontSize = `${fontSize}px`;
    wrapper.style.lineHeight = fontSize >= 40 ? '1.5' : '1.35';
    updateSubtitleScrolling(wrapper, inner);
}

function ensureSubtitleInner(wrapper = document.getElementById('subtitleText')) {
    if (!wrapper) {
        return null;
    }
    let inner = wrapper.querySelector('.subtitle-text-inner');
    if (!inner) {
        inner = document.createElement('span');
        inner.className = 'subtitle-text-inner';
        inner.textContent = wrapper.textContent || '';
        wrapper.textContent = '';
        wrapper.appendChild(inner);
    }
    return inner;
}

function updateSubtitleScrolling(wrapper, inner) {
    wrapper?.classList.remove('scroll-active');
}

async function playPause() {
    const current = currentQueue[currentIndex];
    const playBtn = document.getElementById('playBtn');

    if (!current || !current.tts_files || current.tts_files.length === 0 || !current.tts_files[0].audio_url) {
        showMessage('No audio available for current item', 'error');
        return;
    }

    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
        playBtn.textContent = '▶️ Play';
    } else {
        await audioPlayer.play();
        isPlaying = true;
        playBtn.textContent = '⏸️ Pause';
    }
}

audioPlayer.addEventListener('ended', async () => {
    isPlaying = false;
    document.getElementById('playBtn').textContent = '▶️ Play';
    if (!isLoopEnabled()) {
        return;
    }
    await advancePlaybackLoop();
});

async function previousSubtitle() {
    const response = await fetch(`${API_BASE}/previous`, { method: 'POST' });
    const result = await response.json();

    if (result.success) {
        await loadQueue();
        if (isPlaying) {
            autoStartPlayback();
        }
    }
}

async function nextSubtitle(autoTriggered = false) {
    const response = await fetch(`${API_BASE}/next`, { method: 'POST' });
    const result = await response.json();

    if (result.success) {
        await loadQueue();
        if (!autoTriggered && isPlaying) {
            autoStartPlayback();
        }
    }
}

async function jumpToIndex(index, autoTriggered = false) {
    const response = await fetch(`${API_BASE}/set-index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index })
    });

    const result = await response.json();

    if (result.success) {
        await loadQueue();
        if (!autoTriggered && isPlaying) {
            autoStartPlayback();
        }
        if (document.getElementById('queueTab').classList.contains('active')) {
            renderQueueTab();
        }
    }
}

async function deleteQueueItem(index) {
    if (!confirm('Are you sure you want to delete this item? Associated audio files will also be deleted.')) {
        return;
    }

    const response = await fetch(`${API_BASE}/remove`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index })
    });

    const result = await response.json();

    if (result.success) {
        await loadQueue();
        renderQueueTab();
        showMessage('Item deleted successfully', 'success', 'queue');
    } else {
        showMessage('Delete failed: ' + (result.error || 'Unknown error'), 'error', 'queue');
    }
}

async function editItemGroup(index, currentGroup) {
    const newGroup = prompt('Enter new group name:', currentGroup);

    if (newGroup === null || newGroup === currentGroup) {
        return;
    }

    const response = await fetch(`${API_BASE}/update-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            index: index,
            group: newGroup || 'default'
        })
    });

    const result = await response.json();

    if (result.success) {
        await loadQueue();
        await loadGroups();
        renderQueueTab();
        showMessage('Group updated successfully', 'success', 'queue');
    } else {
        showMessage('Update failed: ' + (result.error || 'Unknown error'), 'error', 'queue');
    }
}

function toggleInputMethod() {
    const type = document.getElementById('inputType').value;
    const contentGroup = document.getElementById('contentGroup');
    const fileGroup = document.getElementById('fileGroup');

    if (type === 'image_file' || type === 'file_upload') {
        contentGroup.style.display = 'none';
        fileGroup.style.display = 'block';
    } else {
        contentGroup.style.display = 'block';
        fileGroup.style.display = 'none';
    }
}

async function addToQueue() {
    const type = document.getElementById('inputType').value;
    const group = document.getElementById('inputGroup').value.trim() || 'default';

    let actualType = type;
    let formData = new FormData();

    if (type === 'image_file') {
        const fileInput = document.getElementById('inputFile');
        if (!fileInput.files || !fileInput.files[0]) {
            showMessage('Please select an image file', 'error', 'add');
            return;
        }
        formData.append('image', fileInput.files[0]);
        formData.append('type', 'image');
        formData.append('group', group);
    } else if (type === 'file_upload') {
        const fileInput = document.getElementById('inputFile');
        if (!fileInput.files || !fileInput.files[0]) {
            showMessage('Please select a file', 'error', 'add');
            return;
        }
        formData.append('file', fileInput.files[0]);
        formData.append('type', 'file');
        formData.append('group', group);
    } else {
        const content = document.getElementById('inputContent').value;
        if (!content.trim()) {
            showMessage('Please enter content', 'error', 'add');
            return;
        }

        if (type === 'image_url') actualType = 'image';
        if (type === 'file_url') actualType = 'file';

        formData.append('type', actualType);
        formData.append('content', content);
        formData.append('group', group);
    }

    showMessage('Processing...', 'info', 'add');

    const response = await fetch(`${API_BASE}/add`, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();

    if (result.success) {
        showMessage('Added to queue!', 'success', 'add');
        document.getElementById('inputContent').value = '';
        document.getElementById('inputGroup').value = '';
        if (document.getElementById('inputFile')) {
            document.getElementById('inputFile').value = '';
        }
        addPendingTaskId(result.task_id);
        await loadGroups();
        await loadTasks();
        setTimeout(() => {
            switchTab('player');
        }, 1000);
    } else {
        showMessage('Error: ' + (result.error || 'Unknown error'), 'error', 'add');
    }
}

function showMessage(message, type, context = 'player') {
    const containerMap = {
        'add': 'addMessage',
        'settings': 'settingsMessage',
        'player': 'subtitleText',
        'queue': 'queueList'
    };
    const containerId = containerMap[context];
    const container = document.getElementById(containerId);

    if (context === 'add' || context === 'settings') {
        const className = type === 'error' ? 'error' : type === 'success' ? 'success' : 'info';
        container.innerHTML = `<div class="message ${className}">${message}</div>`;
        if (type !== 'info') {
            setTimeout(() => container.innerHTML = '', 3000);
        }
    } else if (context === 'queue') {
        const tempMsg = document.createElement('div');
        tempMsg.className = `message ${type === 'error' ? 'error' : 'success'}`;
        tempMsg.textContent = message;
        tempMsg.style.marginBottom = '10px';
        container.prepend(tempMsg);
        setTimeout(() => tempMsg.remove(), 3000);
    } else {
        const originalText = container.textContent;
        container.textContent = message;
        setTimeout(() => {
            if (currentQueue[currentIndex]) {
                updateCurrentSubtitle();
            }
        }, 2000);
    }
}

function truncate(text, length) {
    return text.length > length ? text.substring(0, length) + '...' : text;
}

function isLoopEnabled() {
    const checkbox = document.getElementById('autoPlayCheckbox');
    if (!checkbox) {
        return true;
    }
    return checkbox.checked;
}

async function advancePlaybackLoop() {
    if (currentQueue.length === 0) {
        return;
    }
    if (currentIndex < currentQueue.length - 1) {
        await nextSubtitle(true);
    } else {
        await jumpToIndex(0, true);
    }
    autoStartPlayback();
}

function autoStartPlayback(delay = 350) {
    setTimeout(async () => {
        if (!currentQueue[currentIndex] || !audioPlayer.src) {
            return;
        }
        try {
            await audioPlayer.play();
            isPlaying = true;
            const playBtn = document.getElementById('playBtn');
            if (playBtn) {
                playBtn.textContent = '⏸️ Pause';
            }
        } catch (error) {
            console.error('Auto play failed:', error);
        }
    }, delay);
}

async function deleteTask(taskId) {
    if (!taskId) return;

    const confirmed = confirm('Delete this task?');
    if (!confirmed) return;

    const response = await fetch(`${API_BASE}/tasks/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: [taskId] })
    });

    const result = await response.json();

    if (result.success) {
        removePendingTaskId(taskId);
        await loadTasks(true);
        showMessage('Task deleted', 'success', 'add');
    } else {
        showMessage('Delete failed: ' + (result.error || 'Unknown error'), 'error', 'add');
    }
}

setInterval(loadQueue, 10000);
