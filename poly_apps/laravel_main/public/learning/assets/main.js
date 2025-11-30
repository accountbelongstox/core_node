let currentWords = [];
let currentIndex = 0;
let token = localStorage.getItem('auth_token') || 'demo_token';
let currentLearningLanguages = [];

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');

    if (tabName === 'languages') loadUserLanguages();
    if (tabName === 'stats') loadStats();
    if (tabName === 'libraries') loadLibraries();
}

// Load user languages
async function loadUserLanguages() {
    try {
        const response = await fetch('/api/dict/v1/learning/languages', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const learningLangs = data.data.learning_languages || [];
            const nativeLang = data.data.native_language || 'zh';

            document.getElementById('native-language').value = nativeLang;

            document.querySelectorAll('.language-tag').forEach(tag => {
                const lang = tag.getAttribute('data-lang');
                if (learningLangs.includes(lang)) {
                    tag.classList.add('selected');
                } else {
                    tag.classList.remove('selected');
                }
            });

            currentLearningLanguages = learningLangs;
        }
    } catch (error) {
        console.error('Error loading languages:', error);
    }
}

// Toggle learning language
function toggleLearningLanguage(lang) {
    const tag = document.querySelector(`.language-tag[data-lang="${lang}"]`);
    tag.classList.toggle('selected');
}

// Save language settings
async function saveLanguages() {
    const nativeLang = document.getElementById('native-language').value;
    const selectedTags = document.querySelectorAll('.language-tag.selected');
    const learningLangs = Array.from(selectedTags).map(tag => tag.getAttribute('data-lang'));

    if (learningLangs.length === 0) {
        document.getElementById('language-result').innerHTML = '<div class="error">Please select at least one learning language</div>';
        return;
    }

    try {
        const response = await fetch('/api/dict/v1/learning/languages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                learning_languages: learningLangs,
                native_language: nativeLang
            })
        });

        const data = await response.json();
        if (data.success) {
            document.getElementById('language-result').innerHTML = '<div class="success">✓ Language settings saved successfully!</div>';
            currentLearningLanguages = learningLangs;
        } else {
            document.getElementById('language-result').innerHTML = `<div class="error">Error: ${data.error || 'Failed to save'}</div>`;
        }
    } catch (error) {
        document.getElementById('language-result').innerHTML = '<div class="error">Failed to save language settings</div>';
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/dict/v1/learning/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            const stats = data.data.stats;
            document.getElementById('stats-content').innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number">${stats.total_words || 0}</div>
                        <div class="stat-label">Total Words</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.new_words || 0}</div>
                        <div class="stat-label">New Words</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.learning_words || 0}</div>
                        <div class="stat-label">Learning</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.mastered_words || 0}</div>
                        <div class="stat-label">Mastered</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${stats.needs_review || 0}</div>
                        <div class="stat-label">Need Review</div>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${stats.total_words > 0 ? (stats.mastered_words / stats.total_words * 100) : 0}%"></div>
                </div>
                <p style="text-align: center; color: #666;">Mastery Progress: ${stats.total_words > 0 ? Math.round(stats.mastered_words / stats.total_words * 100) : 0}%</p>
                <p style="text-align: center; color: #999; margin-top: 10px;">Learning ${data.data.learning_languages?.length || 0} language(s)</p>
            `;
        }
    } catch (error) {
        document.getElementById('stats-content').innerHTML = '<p style="color:red">Error loading stats</p>';
    }
}

// Load libraries
async function loadLibraries() {
    const langCode = document.getElementById('library-lang-selector').value;

    try {
        const response = await fetch(`/api/dict/v1/learning/libraries?lang_code=${langCode}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            // Public libraries
            const publicHtml = data.data.public_libraries.map(lib => `
                <div class="library-card ${lib.is_selected ? 'selected' : ''}" onclick="toggleLibrary(${lib.id}, '${langCode}')">
                    <h3>${lib.name}</h3>
                    <div class="meta">${lib.total_words} words</div>
                    <div class="meta"><span class="badge ${lib.source_type || 'system'}">${lib.source_type || 'system'}</span></div>
                    <div class="meta" style="margin-top: 8px; font-weight: 500; color: ${lib.is_selected ? '#667eea' : '#999'};">
                        ${lib.is_selected ? '✓ Selected' : 'Click to select'}
                    </div>
                </div>
            `).join('');
            document.getElementById('public-libraries').innerHTML = publicHtml || '<p>No public libraries</p>';

            // Private libraries
            const privateHtml = data.data.user_libraries.map(lib => `
                <div class="library-card ${lib.is_selected ? 'selected' : ''}" onclick="toggleLibrary(${lib.id}, '${langCode}')">
                    <h3>${lib.name} 🔒</h3>
                    <div class="meta">${lib.total_words} words</div>
                    <div class="meta"><span class="badge user_upload">private</span></div>
                    <div class="meta" style="margin-top: 8px; font-weight: 500; color: ${lib.is_selected ? '#667eea' : '#999'};">
                        ${lib.is_selected ? '✓ Selected' : 'Click to select'}
                    </div>
                </div>
            `).join('');
            document.getElementById('private-libraries').innerHTML = privateHtml || '<p>No private libraries. Create one by uploading a document!</p>';
        }
    } catch (error) {
        document.getElementById('public-libraries').innerHTML = '<p style="color:red">Error loading libraries</p>';
    }
}

// Toggle library selection
async function toggleLibrary(collectionId, langCode) {
    try {
        const response = await fetch('/api/dict/v1/learning/libraries/select', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                collection_id: collectionId,
                lang_code: langCode,
                action: 'select'
            })
        });

        const data = await response.json();
        if (data.success) {
            loadLibraries();
        } else {
            alert(data.error || 'Failed to update library');
        }
    } catch (error) {
        alert('Failed to update library selection');
    }
}

// Load words for learning
async function loadWords() {
    const langCode = document.getElementById('learn-lang').value;
    document.getElementById('word-card-container').innerHTML = '<div class="loading">Loading words</div>';

    try {
        const response = await fetch(`/api/dict/v1/learning/words?lang_code=${langCode}&limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && data.data.words.length > 0) {
            currentWords = data.data.words;
            currentIndex = 0;
            showWordCard();
        } else {
            document.getElementById('word-card-container').innerHTML = '<p style="text-align:center">No words to learn. Please select some libraries first!</p>';
        }
    } catch (error) {
        document.getElementById('word-card-container').innerHTML = '<p style="color:red">Error loading words</p>';
    }
}

// Show word card
function showWordCard() {
    if (!currentWords.length) return;

    const word = currentWords[currentIndex];
    const nativeTranslation = word.native_translation || word.translations?.zh || 'No translation';
    const phonetic = word.us_phonetic || word.phonetic || '';

    const statusClass = `status-${word.learning_status}`;
    const familiarityPercent = (word.familiarity_level / 5 * 100);

    const ttsUrl = word.tts_files && word.tts_files.length > 0 ? word.tts_files[0].url : null;
    const audioButton = ttsUrl ?
        `<button class="audio-btn" onclick="playAudio('${ttsUrl}')" title="Play pronunciation">🔊</button>` :
        `<button class="audio-btn" style="background: #ccc; cursor: not-allowed;" disabled title="Audio not available">🔇</button>`;

    document.getElementById('word-card-container').innerHTML = `
        <div class="word-card" id="word-card">
            <div class="card-front">
                <span class="word-status ${statusClass}">${word.learning_status.toUpperCase()}</span>
                <div class="word-display">${word.word}</div>
                ${audioButton}
                <div class="phonetic">${phonetic}</div>
                <div class="familiarity-bar">
                    <div class="familiarity-fill" style="width: ${familiarityPercent}%"></div>
                </div>
                <p style="font-size: 12px; color: #999; margin-bottom: 20px;">
                    Familiarity: ${word.familiarity_level}/5 | Reviews: ${word.review_count} |
                    Correct: ${word.correct_count} | Wrong: ${word.wrong_count}
                </p>
                <button class="btn btn-secondary" onclick="flipCard()">Show Translation</button>
            </div>
            <div class="card-back">
                <span class="word-status ${statusClass}">${word.learning_status.toUpperCase()}</span>
                <div class="word-display">${word.word}</div>
                ${audioButton}
                <div class="phonetic">${phonetic}</div>
                <div class="translation">${nativeTranslation}</div>
                <div class="familiarity-bar">
                    <div class="familiarity-fill" style="width: ${familiarityPercent}%"></div>
                </div>
                <button class="btn btn-secondary" onclick="flipCard()">Hide Translation</button>
            </div>
        </div>
        <div style="text-align: center; color: #666; margin: 20px 0;">
            Word ${currentIndex + 1} of ${currentWords.length}
        </div>
        <div class="actions">
            <button class="btn btn-danger" onclick="markWord(${word.id}, false)">❌ Wrong</button>
            <button class="btn btn-success" onclick="markWord(${word.id}, true)">✅ Correct</button>
        </div>
    `;

    if (ttsUrl) {
        playAudio(ttsUrl);
    }
}

// Flip card
function flipCard() {
    document.getElementById('word-card').classList.toggle('flipped');
}

// Mark word
async function markWord(progressId, correct) {
    try {
        await fetch('/api/dict/v1/learning/progress', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ progress_id: progressId, correct: correct })
        });

        currentIndex++;
        if (currentIndex < currentWords.length) {
            showWordCard();
        } else {
            document.getElementById('word-card-container').innerHTML = `
                <div style="text-align: center; padding: 60px;">
                    <h2>🎉 Great job!</h2>
                    <p style="margin: 20px 0;">You've completed this session</p>
                    <button class="btn btn-primary" onclick="loadWords()">Load More Words</button>
                </div>
            `;
        }
    } catch (error) {
        alert('Failed to update progress');
    }
}

// Upload document
async function uploadDocument() {
    const name = document.getElementById('library-name').value;
    const langCode = document.getElementById('upload-language').value;
    const text = document.getElementById('document-text').value;

    if (!name || !text) {
        document.getElementById('upload-result').innerHTML = '<div class="error">Please provide library name and document text</div>';
        return;
    }

    document.getElementById('upload-result').innerHTML = '<div class="loading">Processing document</div>';

    try {
        const response = await fetch('/api/dict/v1/learning/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                collection_name: name,
                lang_code: langCode,
                document: text
            })
        });

        const data = await response.json();
        if (data.success) {
            document.getElementById('upload-result').innerHTML = `
                <div class="success">
                    <strong>Success!</strong> Extracted ${data.data.total_words} words.
                </div>
            `;
            document.getElementById('library-name').value = '';
            document.getElementById('document-text').value = '';
        } else {
            document.getElementById('upload-result').innerHTML = `<div class="error">Error: ${data.error}</div>`;
        }
    } catch (error) {
        document.getElementById('upload-result').innerHTML = '<div class="error">Upload failed</div>';
    }
}

let audioPlayer = null;

function playAudio(url) {
    if (!url) return;

    try {
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
        }

        audioPlayer = new Audio(url);
        audioPlayer.play().catch(err => {
            console.error('Audio playback failed:', err);
        });
    } catch (error) {
        console.error('Failed to play audio:', error);
    }
}

// Initialize
window.addEventListener('load', () => {
    loadUserLanguages();
});
