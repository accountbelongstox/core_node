<template>
  <div class="keyword-density-tool">
    <div class="tool-header">
      <h3>Keyword Density Checker</h3>
      <p class="tool-description">Analyze keyword density and frequency in your text for SEO optimization</p>
    </div>

    <div class="input-section">
      <div class="form-group">
        <label>Target Keyword (optional)</label>
        <input 
          type="text" 
          v-model="targetKeyword" 
          placeholder="Enter target keyword to track"
          class="input-field"
        />
      </div>
      <div class="form-group">
        <label>Content</label>
        <textarea 
          v-model="content" 
          placeholder="Paste your content here for keyword analysis..."
          class="content-textarea"
          @input="analyze"
        ></textarea>
      </div>
    </div>

    <div v-if="content.length > 0" class="results-section">
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">{{ stats.totalWords }}</div>
          <div class="stat-label">Total Words</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.uniqueWords }}</div>
          <div class="stat-label">Unique Words</div>
        </div>
        <div class="stat-card" v-if="targetKeyword">
          <div class="stat-value">{{ targetStats.count }}</div>
          <div class="stat-label">Target Occurrences</div>
        </div>
        <div class="stat-card" v-if="targetKeyword">
          <div class="stat-value" :class="getDensityClass(targetStats.density)">
            {{ targetStats.density }}%
          </div>
          <div class="stat-label">Target Density</div>
        </div>
      </div>

      <div v-if="targetKeyword && targetStats.count > 0" class="target-analysis">
        <h4>Target Keyword Analysis: "{{ targetKeyword }}"</h4>
        <div class="density-bar">
          <div class="bar-fill" :style="{ width: Math.min(targetStats.density * 10, 100) + '%' }"></div>
        </div>
        <div class="density-recommendation">
          <span v-if="targetStats.density < 0.5" class="warning">Low density - consider adding more instances</span>
          <span v-else-if="targetStats.density > 3" class="warning">High density - may be seen as keyword stuffing</span>
          <span v-else class="good">Optimal density range (0.5% - 3%)</span>
        </div>
      </div>

      <div class="keywords-table">
        <h4>Top Keywords</h4>
        <div class="table-header">
          <span>Keyword</span>
          <span>Count</span>
          <span>Density</span>
          <span>Visual</span>
        </div>
        <div v-for="kw in topKeywords" :key="kw.word" class="table-row">
          <span class="keyword">{{ kw.word }}</span>
          <span class="count">{{ kw.count }}</span>
          <span class="density">{{ kw.density }}%</span>
          <span class="visual">
            <div class="mini-bar">
              <div class="mini-fill" :style="{ width: Math.min(kw.density * 20, 100) + '%' }"></div>
            </div>
          </span>
        </div>
      </div>

      <div class="two-word-phrases">
        <h4>Two-Word Phrases</h4>
        <div class="phrases-grid">
          <div v-for="phrase in topPhrases" :key="phrase.text" class="phrase-item">
            <span class="phrase-text">"{{ phrase.text }}"</span>
            <span class="phrase-count">{{ phrase.count }}x</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';

const content = ref('');
const targetKeyword = ref('');

const stats = reactive({
  totalWords: 0,
  uniqueWords: 0
});

const targetStats = reactive({
  count: 0,
  density: 0
});

interface KeywordData {
  word: string;
  count: number;
  density: string;
}

interface PhraseData {
  text: string;
  count: number;
}

const topKeywords = ref<KeywordData[]>([]);
const topPhrases = ref<PhraseData[]>([]);

const stopWords = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 
  'is', 'it', 'that', 'this', 'with', 'as', 'be', 'are', 'was', 'were', 
  'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 
  'could', 'should', 'may', 'might', 'can', 'from', 'by', 'about', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'also', 'i', 'you', 'he', 'she', 'we', 'they',
  'your', 'my', 'his', 'her', 'its', 'our', 'their'
]);

const analyze = () => {
  if (!content.value.trim()) {
    stats.totalWords = 0;
    stats.uniqueWords = 0;
    topKeywords.value = [];
    topPhrases.value = [];
    return;
  }

  const words = content.value.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  stats.totalWords = words.length;

  // Count word frequency (excluding stop words for keywords)
  const wordFreq: Record<string, number> = {};
  const allWordFreq: Record<string, number> = {};
  
  words.forEach(w => {
    allWordFreq[w] = (allWordFreq[w] || 0) + 1;
    if (w.length > 2 && !stopWords.has(w)) {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
  });

  stats.uniqueWords = Object.keys(allWordFreq).length;

  // Target keyword analysis
  if (targetKeyword.value.trim()) {
    const target = targetKeyword.value.toLowerCase().trim();
    const targetWords = target.split(/\s+/);
    
    if (targetWords.length === 1) {
      targetStats.count = allWordFreq[target] || 0;
    } else {
      // Count phrase occurrences
      const contentLower = content.value.toLowerCase();
      const regex = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = contentLower.match(regex);
      targetStats.count = matches ? matches.length : 0;
    }
    
    targetStats.density = stats.totalWords > 0 
      ? Number(((targetStats.count / stats.totalWords) * 100).toFixed(2))
      : 0;
  }

  // Top keywords
  topKeywords.value = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({
      word,
      count,
      density: ((count / stats.totalWords) * 100).toFixed(2)
    }));

  // Two-word phrases
  const phrases: Record<string, number> = {};
  for (let i = 0; i < words.length - 1; i++) {
    if (!stopWords.has(words[i]) || !stopWords.has(words[i + 1])) {
      const phrase = `${words[i]} ${words[i + 1]}`;
      phrases[phrase] = (phrases[phrase] || 0) + 1;
    }
  }

  topPhrases.value = Object.entries(phrases)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([text, count]) => ({ text, count }));
};

const getDensityClass = (density: number): string => {
  if (density < 0.5) return 'low';
  if (density > 3) return 'high';
  return 'optimal';
};
</script>

<style scoped>
.keyword-density-tool {
  padding: 20px;
}
.input-section {
  margin: 20px 0;
}
.form-group {
  margin-bottom: 16px;
}
.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}
.input-field {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.content-textarea {
  width: 100%;
  height: 200px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  resize: vertical;
}
.results-section {
  margin-top: 24px;
}
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  background: #f8fafc;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}
.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #667eea;
}
.stat-value.low { color: #f59e0b; }
.stat-value.high { color: #ef4444; }
.stat-value.optimal { color: #22c55e; }
.stat-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}
.target-analysis {
  background: #f8fafc;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 24px;
}
.density-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  margin: 12px 0;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #f59e0b, #ef4444);
  border-radius: 4px;
}
.density-recommendation {
  font-size: 14px;
}
.density-recommendation .warning { color: #f59e0b; }
.density-recommendation .good { color: #22c55e; }
.keywords-table {
  margin-bottom: 24px;
}
.table-header, .table-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 2fr;
  padding: 12px 16px;
}
.table-header {
  background: #f1f5f9;
  font-weight: 600;
  border-radius: 6px 6px 0 0;
}
.table-row {
  border-bottom: 1px solid #e2e8f0;
}
.table-row:hover {
  background: #f8fafc;
}
.keyword {
  font-weight: 500;
  color: #667eea;
}
.mini-bar {
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}
.mini-fill {
  height: 100%;
  background: #667eea;
}
.two-word-phrases {
  margin-top: 24px;
}
.phrases-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.phrase-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f1f5f9;
  border-radius: 20px;
}
.phrase-text {
  color: #334155;
}
.phrase-count {
  font-size: 12px;
  color: #64748b;
  background: white;
  padding: 2px 6px;
  border-radius: 10px;
}
</style>

