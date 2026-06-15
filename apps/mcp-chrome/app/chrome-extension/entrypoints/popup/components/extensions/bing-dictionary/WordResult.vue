<template>
  <div v-if="result && !isLoading" class="result-container">
    <div class="word-header">
      <h3 class="word-title">{{ result.word }}</h3>
      <button v-if="result.pronunciation" class="play-button" @click="onPlayPronunciation">
        [PLAY]
      </button>
    </div>

    <!-- Phonetics (US + UK), each with its own pronunciation audio. -->
    <div v-if="result.usPhonetic || result.ukPhonetic" class="phonetic-row">
      <span v-if="result.usPhonetic" class="phonetic-chip">
        <span class="phonetic-tag">US</span>{{ result.usPhonetic }}
        <button
          v-if="result.usAudioUrl"
          class="phonetic-play"
          title="Play US pronunciation"
          @click="onPlayAudio(result.usAudioUrl)"
        >♪</button>
      </span>
      <span v-if="result.ukPhonetic" class="phonetic-chip">
        <span class="phonetic-tag">UK</span>{{ result.ukPhonetic }}
        <button
          v-if="result.ukAudioUrl"
          class="phonetic-play"
          title="Play UK pronunciation"
          @click="onPlayAudio(result.ukAudioUrl)"
        >♪</button>
      </span>
    </div>

    <!-- Short definitions -->
    <div v-if="result.translations.length > 0" class="wr-section">
      <h5 class="wr-title">Definitions</h5>
      <div class="wr-defs">
        <div v-for="(trans, index) in result.translations" :key="index" class="wr-def">
          <span v-if="trans.type" class="wr-pos">{{ trans.type }}</span>
          <span class="wr-text">{{ trans.text }}</span>
        </div>
      </div>
    </div>

    <!-- Detailed Collins/Oxford definitions -->
    <div v-if="result.detailedDefinitions.length > 0" class="wr-section">
      <h5 class="wr-title">Detailed</h5>
      <ol class="wr-detailed">
        <li v-for="(d, index) in result.detailedDefinitions" :key="index" class="wr-detailed-item">
          <span class="wr-detailed-cn">{{ d.cn }}</span>
          <span v-if="d.en" class="wr-detailed-en">{{ d.en }}</span>
        </li>
      </ol>
    </div>

    <!-- Web definitions -->
    <div v-if="result.webDefinitions.length > 0" class="wr-section">
      <h5 class="wr-title">Web Definitions</h5>
      <div v-for="(w, index) in result.webDefinitions" :key="index" class="wr-web">
        <span v-if="w.type" class="wr-web-type">{{ w.type }}</span>
        <span class="wr-text">{{ w.content }}</span>
      </div>
    </div>

    <!-- Example sentences -->
    <div v-if="result.examples.length > 0" class="wr-section">
      <h5 class="wr-title">Examples</h5>
      <div class="wr-examples">
        <div v-for="(ex, index) in result.examples" :key="index" class="wr-example">
          <p class="wr-ex-en">{{ ex.text }}</p>
          <p v-if="ex.translation" class="wr-ex-cn">{{ ex.translation }}</p>
        </div>
      </div>
    </div>

    <!-- Synonyms / antonyms -->
    <div v-if="result.synonyms.length > 0" class="wr-section">
      <h5 class="wr-title">Synonyms</h5>
      <div v-for="(s, index) in result.synonyms" :key="index" class="wr-syn">
        <span v-if="s.type" class="wr-syn-type">{{ s.type }}</span>
        <span class="wr-text">{{ s.words }}</span>
      </div>
    </div>

    <!-- Sample images -->
    <div v-if="result.images.length > 0" class="wr-section">
      <h5 class="wr-title">Images</h5>
      <div class="wr-images">
        <img
          v-for="(src, index) in result.images.slice(0, 6)"
          :key="index"
          :src="src"
          class="wr-image"
          :alt="result.word"
          loading="lazy"
          referrerpolicy="no-referrer"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { WordResult } from '../../../composables/useBingDictionary';

interface Props {
  result: WordResult | null;
  isLoading: boolean;
}

interface Emits {
  (e: 'play-pronunciation'): void;
  (e: 'play-audio', url: string): void;
  (e: 'lookup-word', word: string): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const onPlayPronunciation = () => {
  emit('play-pronunciation');
};

const onPlayAudio = (url?: string) => {
  if (url) emit('play-audio', url);
};
</script>

<style scoped>
.result-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.word-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.word-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text);
}

.play-button {
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--accent-fg);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.phonetic-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.phonetic-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px 1px 8px;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--accent-fg);
  font-size: 11px;
  font-family: ui-monospace, monospace;
}

.phonetic-tag {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--text-faint);
}

.phonetic-play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: none;
  background: var(--accent-soft);
  color: var(--accent-fg);
  font-size: 10px;
  line-height: 1;
  cursor: pointer;
}

.phonetic-play:hover {
  background: var(--accent);
  color: #fff;
}

.wr-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.wr-title {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-faint);
}

.wr-defs,
.wr-examples {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.wr-def,
.wr-web,
.wr-syn {
  font-size: 11px;
  line-height: 1.4;
  color: var(--text);
}

.wr-pos,
.wr-web-type,
.wr-syn-type {
  display: inline-block;
  margin-right: 5px;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent-fg);
  font-size: 9px;
  font-weight: 700;
}

.wr-text {
  word-break: break-word;
}

.wr-detailed {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.wr-detailed-item {
  font-size: 11px;
  line-height: 1.4;
}

.wr-detailed-cn {
  color: var(--text);
  font-weight: 600;
}

.wr-detailed-en {
  display: block;
  color: var(--text-muted);
  font-size: 10px;
}

.wr-example {
  padding: 4px 6px;
  border-radius: 6px;
  background: var(--surface-2);
  border-left: 2px solid var(--accent);
}

.wr-ex-en {
  font-size: 11px;
  color: var(--text);
  line-height: 1.35;
}

.wr-ex-cn {
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1.35;
}

.wr-images {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.wr-image {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface-2);
}
</style>
