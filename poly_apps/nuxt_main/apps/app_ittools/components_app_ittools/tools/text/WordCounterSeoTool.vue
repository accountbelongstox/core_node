<template>
  <div class="word-counter-seo-tool">
    <div class="tool-header">
      <h3>Word Counter (SEO)</h3>
      <p class="tool-description">Analyze text for SEO with word count, keyword density, and readability</p>
    </div>

    <div class="text-input-section">
      <textarea 
        v-model="inputText" 
        placeholder="Paste your content here for SEO analysis..."
        @input="analyze"
      ></textarea>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.words }}</div>
        <div class="stat-label">Words</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.characters }}</div>
        <div class="stat-label">Characters</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.sentences }}</div>
        <div class="stat-label">Sentences</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.paragraphs }}</div>
        <div class="stat-label">Paragraphs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.readingTime }}</div>
        <div class="stat-label">Reading Time</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.avgWordLength }}</div>
        <div class="stat-label">Avg Word Length</div>
      </div>
    </div>

    <div class="keyword-section">
      <h4>Top Keywords</h4>
      <div class="keywords-table">
        <div class="keyword-row header">
          <span>Keyword</span>
          <span>Count</span>
          <span>Density</span>
        </div>
        <div v-for="kw in topKeywords" :key="kw.word" class="keyword-row">
          <span>{{ kw.word }}</span>
          <span>{{ kw.count }}</span>
          <span>{{ kw.density }}%</span>
        </div>
      </div>
    </div>

    <div class="readability-section">
      <h4>Readability Scores</h4>
      <div class="readability-grid">
        <div class="readability-item">
          <div class="score" :class="getReadabilityClass(stats.fleschScore)">
            {{ stats.fleschScore }}
          </div>
          <div class="score-label">Flesch Reading Ease</div>
          <div class="score-desc">{{ getFleschDescription(stats.fleschScore) }}</div>
        </div>
        <div class="readability-item">
          <div class="score">{{ stats.gradeLevel }}</div>
          <div class="score-label">Grade Level</div>
          <div class="score-desc">Flesch-Kincaid Grade</div>
        </div>
      </div>
    </div>

    <div class="seo-tips">
      <h4>SEO Recommendations</h4>
      <ul>
        <li v-for="tip in seoTips" :key="tip" :class="tip.type">
          <span class="tip-icon">{{ tip.type === 'good' ? 'check' : tip.type === 'warning' ? 'exclamation' : 'info' }}</span>
          {{ tip.message }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue';

const inputText = ref('');

interface Stats {
  words: number;
  characters: number;
  sentences: number;
  paragraphs: number;
  readingTime: string;
  avgWordLength: string;
  fleschScore: number;
  gradeLevel: string;
}

const stats = reactive<Stats>({
  words: 0,
  characters: 0,
  sentences: 0,
  paragraphs: 0,
  readingTime: '0 min',
  avgWordLength: '0',
  fleschScore: 0,
  gradeLevel: '0'
});

interface Keyword {
  word: string;
  count: number;
  density: string;
}

const topKeywords = ref<Keyword[]>([]);

const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'it', 'that', 'this', 'with', 'as', 'be', 'are', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'from', 'by', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also']);

const analyze = () => {
  const text = inputText.value;
  
  // Basic stats
  stats.characters = text.length;
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  stats.words = words.length;
  stats.sentences = (text.match(/[.!?]+/g) || []).length || (text.length > 0 ? 1 : 0);
  stats.paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0).length;
  
  // Reading time (200 words per minute)
  const minutes = Math.ceil(stats.words / 200);
  stats.readingTime = `${minutes} min`;
  
  // Average word length
  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  stats.avgWordLength = stats.words > 0 ? (totalChars / stats.words).toFixed(1) : '0';
  
  // Keyword density
  const wordFreq: Record<string, number> = {};
  words.forEach(w => {
    const word = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (word.length > 2 && !stopWords.has(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });
  
  topKeywords.value = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({
      word,
      count,
      density: ((count / stats.words) * 100).toFixed(2)
    }));
  
  // Flesch Reading Ease
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  if (stats.words > 0 && stats.sentences > 0) {
    stats.fleschScore = Math.round(
      206.835 - 1.015 * (stats.words / stats.sentences) - 84.6 * (syllables / stats.words)
    );
    stats.gradeLevel = (
      0.39 * (stats.words / stats.sentences) + 11.8 * (syllables / stats.words) - 15.59
    ).toFixed(1);
  } else {
    stats.fleschScore = 0;
    stats.gradeLevel = '0';
  }
};

const countSyllables = (word: string): number => {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  const syllableCount = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .match(/[aeiouy]{1,2}/g);
  return syllableCount ? syllableCount.length : 1;
};

const getReadabilityClass = (score: number): string => {
  if (score >= 60) return 'good';
  if (score >= 30) return 'average';
  return 'difficult';
};

const getFleschDescription = (score: number): string => {
  if (score >= 90) return 'Very Easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly Easy';
  if (score >= 60) return 'Standard';
  if (score >= 50) return 'Fairly Difficult';
  if (score >= 30) return 'Difficult';
  return 'Very Difficult';
};

const seoTips = computed(() => {
  const tips: { type: string; message: string }[] = [];
  
  if (stats.words < 300) {
    tips.push({ type: 'warning', message: 'Content is short. Aim for at least 300 words for better SEO.' });
  } else if (stats.words >= 1000) {
    tips.push({ type: 'good', message: 'Good content length for SEO.' });
  }
  
  if (stats.fleschScore < 60) {
    tips.push({ type: 'warning', message: 'Content may be difficult to read. Consider simplifying.' });
  } else {
    tips.push({ type: 'good', message: 'Content readability is good.' });
  }
  
  if (topKeywords.value.length > 0) {
    const topDensity = parseFloat(topKeywords.value[0].density);
    if (topDensity > 3) {
      tips.push({ type: 'warning', message: 'Keyword density may be too high. Avoid keyword stuffing.' });
    }
  }
  
  return tips;
});
</script>

<style scoped>
.word-counter-seo-tool {
  padding: 20px;
}
.text-input-section textarea {
  width: 100%;
  height: 200px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  resize: vertical;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  margin: 24px 0;
}
.stat-card {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}
.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #667eea;
}
.stat-label {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}
.keyword-section, .readability-section, .seo-tips {
  margin-top: 24px;
}
.keywords-table {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.keyword-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  padding: 12px 16px;
}
.keyword-row.header {
  background: #f1f5f9;
  font-weight: 600;
}
.keyword-row:not(.header):nth-child(even) {
  background: #fafafa;
}
.readability-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 12px;
}
.readability-item {
  background: #f8fafc;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}
.score {
  font-size: 32px;
  font-weight: bold;
}
.score.good { color: #22c55e; }
.score.average { color: #f59e0b; }
.score.difficult { color: #ef4444; }
.score-label {
  font-weight: 600;
  margin-top: 8px;
}
.score-desc {
  font-size: 12px;
  color: #64748b;
}
.seo-tips ul {
  list-style: none;
  padding: 0;
}
.seo-tips li {
  padding: 12px 16px;
  margin: 8px 0;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.seo-tips li.good { background: #dcfce7; color: #166534; }
.seo-tips li.warning { background: #fef3c7; color: #92400e; }
.seo-tips li.info { background: #dbeafe; color: #1e40af; }
</style>

