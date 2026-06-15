<template>
  <div v-if="result && !isLoading" class="result-container">
    <div class="word-header">
      <h3 class="word-title">{{ result.word }}</h3>
      <button v-if="result.pronunciation" class="play-button" @click="onPlayPronunciation">
        [PLAY]
      </button>
    </div>

    <div v-if="result.phonetic" class="phonetic-section">
      <span class="phonetic-label">Phonetic:</span>
      <span class="phonetic-text">{{ result.phonetic }}</span>
    </div>

    <div v-if="result.translations.length > 0" class="translations-section">
      <h5 class="section-title">Translations</h5>
      <div class="translations-list">
        <div
          v-for="(trans, index) in result.translations"
          :key="index"
          class="translation-item"
        >
          <span class="translation-type">{{ trans.type }}</span>
          <span class="translation-text">{{ trans.text }}</span>
        </div>
      </div>
    </div>

    <div v-if="result.examples.length > 0" class="examples-section">
      <h5 class="section-title">Examples</h5>
      <div class="examples-list">
        <div v-for="(example, index) in result.examples" :key="index" class="example-item">
          <p class="example-text">{{ example.text }}</p>
          <p v-if="example.translation" class="example-translation">{{ example.translation }}</p>
        </div>
      </div>
    </div>

    <div v-if="result.synonyms.length > 0" class="synonyms-section">
      <h5 class="section-title">Synonyms</h5>
      <div class="synonyms-list">
        <span
          v-for="(synonym, index) in result.synonyms"
          :key="index"
          class="synonym-tag"
          @click="onSynonymClick(synonym)"
        >
          {{ synonym }}
        </span>
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
  (e: 'lookup-word', word: string): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

const onPlayPronunciation = () => {
  emit('play-pronunciation');
};

const onSynonymClick = (word: string) => {
  emit('lookup-word', word);
};
</script>
