// Voice Subtitle Player - Client Side
// Handles HTML5 audio playback, queue management, and UI controls

// ========== State ==========
let currentQueue = [];
let currentIndex = 0;
let isPlaying = false;

// ========== DOM Elements ==========
const audioPlayer = document.getElementById('audioPlayer');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const speedSelect = document.getElementById('speedSelect');
const volumeSlider = document.getElementById('volumeSlider');
const subtitleText = document.getElementById('subtitleText');

// ========== Initialization ==========
async function init() {
    try {
        await fetchQueue();
        console.log('[HTTP] Pycore is reachable');
        updateStatus(true);

        // Start auto-refresh every 3 seconds
        setInterval(fetchQueue, 3000);
    } catch (error) {
        console.error('[HTTP] Connection failed:', error);
        updateStatus(false);
    }
}

// ========== Queue Management ==========
async function fetchQueue() {
    try {
        const response = await fetch('http://localhost:59000/voice-subtitle/queue');
        const data = await response.json();

        console.log('[Queue] Fetched:', data);

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
            const indexChanged = oldIndex !== currentIndex;

            if (currentQueue.length > 0 && !isPlaying && audioPlayer.paused && queueChanged) {
                console.log('[Queue] Queue changed, starting playback');
                playCurrentItem();
            }
        }
    } catch (error) {
        console.error('[Queue] Fetch error:', error);
    }
}

async function updateServerIndex(index) {
    try {
        const response = await fetch('http://localhost:59000/voice-subtitle/set-index', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({index: index})
        });
        const data = await response.json();
        if (data.success) {
            updateQueueInfo();
        }
    } catch (error) {
        console.error('[Queue] Set index error:', error);
    }
}

async function incrementPlayCount(index) {
    try {
        const body = index !== undefined ? {index: index} : {};
        await fetch('http://localhost:59000/voice-subtitle/increment-play-count', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
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

    // Load and play audio
    const audioUrl = `/voice-subtitle/audio?path=${encodeURIComponent(item.audio_path)}`;
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

// ========== Event Handlers ==========
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

// Speed control - select change
speedSelect.addEventListener('change', (e) => {
    const speed = parseFloat(e.target.value);
    audioPlayer.playbackRate = speed;
    console.log('[Player] Speed changed to', speed);
});

// Volume control
volumeSlider.addEventListener('input', (e) => {
    audioPlayer.volume = e.target.value / 100;
});

// Audio events
audioPlayer.addEventListener('ended', async () => {
    console.log('[Player] Audio ended');

    // Increment play count on server
    await incrementPlayCount(currentIndex);

    // Move to next (循环)
    if (currentQueue.length > 0) {
        currentIndex = (currentIndex + 1) % currentQueue.length;
        await updateServerIndex(currentIndex);

        // Wait a bit before playing next
        setTimeout(() => {
            if (currentQueue.length > 0) {
                playCurrentItem();
            }
        }, 300);
    }
});

audioPlayer.addEventListener('error', (e) => {
    console.error('[Player] Audio error:', e);
    // Try next on error
    if (currentQueue.length > 0) {
        currentIndex = (currentIndex + 1) % currentQueue.length;
        updateServerIndex(currentIndex);
        setTimeout(() => playCurrentItem(), 500);
    }
});

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
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    if (connected) {
        statusDot.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = 'Disconnected';
    }
}

// ========== Start ==========
init();
