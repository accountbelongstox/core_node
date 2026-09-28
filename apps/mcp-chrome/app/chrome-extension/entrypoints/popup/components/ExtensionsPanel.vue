<template>
  <section class="feature-workspace">
    <aside class="feature-sidebar">
      <div class="feature-sidebar__heading">
        <div>
          <p class="ui-eyebrow">{{ getMessage('toolboxLabel') }}</p>
          <h2 class="ui-title">{{ getMessage('navExtensions') }}</h2>
        </div>
        <span class="ui-badge">{{ enabledExtensionsCount }}/{{ extensions.length }}</span>
      </div>

      <div class="feature-list no-scrollbar">
        <button
          v-for="extension in extensions"
          :key="extension.id"
          class="feature-list__item"
          :class="{ 'feature-list__item--active': activeExtId === extension.id }"
          @click="activeExtId = extension.id"
        >
          <span class="feature-icon" :data-accent="extension.accent">{{ extension.icon }}</span>
          <span class="feature-list__copy">
            <strong>{{ localizedName(extension.id) }}</strong>
            <small>{{ extension.enabled ? getMessage('extEnabledStatus') : getMessage('extAvailableStatus') }}</small>
          </span>
          <span class="status-dot" :class="extension.enabled ? 'status-dot--success' : ''" />
        </button>
      </div>
    </aside>

    <div v-if="activeExtension" class="feature-detail">
      <header class="feature-detail__header">
        <div class="feature-detail__identity">
          <span class="feature-icon feature-icon--large" :data-accent="activeExtension.accent">
            {{ activeExtension.icon }}
          </span>
          <div>
            <p class="ui-eyebrow">{{ getMessage('browserCapabilityLabel') }}</p>
            <h2 class="ui-title">{{ localizedName(activeExtension.id) }}</h2>
            <p class="ui-description">{{ localizedDesc(activeExtension.id) }}</p>
          </div>
        </div>

        <button
          class="ui-switch"
          :class="{ 'ui-switch--active': activeExtension.enabled }"
          :aria-label="getMessage(activeExtension.enabled ? 'disableNamedFeature' : 'enableNamedFeature', [localizedName(activeExtension.id)])"
          :aria-pressed="activeExtension.enabled"
          @click="toggleExtension(activeExtension.id)"
        >
          <span />
        </button>
      </header>

      <div class="feature-detail__content no-scrollbar">
        <component :is="activeComponent" v-if="activeComponent" />
        <div v-else class="ui-empty-state">
          <span class="feature-icon feature-icon--large">--</span>
          <p>{{ getMessage('extNoConfig') }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, onMounted, type Component } from 'vue';
import { getMessage } from '@/utils/i18n';
import { useExtensionConfig } from '@/composables/useExtensionConfig';
import { getLocalizedFeature } from '@/common/feature-registry';
import type { FeatureId } from '@/common/feature-registry';
import { usePersistedRef } from '@/composables/usePersistedRef';
import BingDictionary from './extensions/BingDictionary.vue';
import NotebookLMPanel from './extensions/NotebookLMPanel.vue';
import GeminiImage from './extensions/GeminiImage.vue';
import ArticleStudyGuide from './extensions/ArticleStudyGuide.vue';
import BookStudyGenerator from './extensions/BookStudyGenerator.vue';
import AiTranslateHub from './extensions/AiTranslateHub.vue';
import WebSearchPanel from './extensions/WebSearchPanel.vue';
import QwenTtsPanel from './extensions/QwenTtsPanel.vue';
import WordValidityPanel from './extensions/WordValidityPanel.vue';

const FEATURE_COMPONENTS: Record<FeatureId, Component> = {
  'bing-dictionary': BingDictionary,
  notebooklm: NotebookLMPanel,
  'gemini-image': GeminiImage,
  'article-study-guide': ArticleStudyGuide,
  'book-study-generator': BookStudyGenerator,
  'ai-translate-hub': AiTranslateHub,
  'web-search': WebSearchPanel,
  'qwen-tts': QwenTtsPanel,
  'word-validity': WordValidityPanel,
};

const { extensions, enabledExtensionsCount, toggleExtension, initialize } = useExtensionConfig();
const localizedName = (id: FeatureId): string => getLocalizedFeature(id, getMessage).name;
const localizedDesc = (id: FeatureId): string => getLocalizedFeature(id, getMessage).description;
const activeExtId = usePersistedRef<FeatureId>('activeExtId', 'bing-dictionary');
const activeExtension = computed(
  () => extensions.value.find((feature) => feature.id === activeExtId.value) ?? extensions.value[0],
);
const activeComponent = computed(
  () => activeExtension.value ? FEATURE_COMPONENTS[activeExtension.value.id] : null,
);

onMounted(async () => {
  await initialize();
  if (!extensions.value.some((feature) => feature.id === activeExtId.value)) {
    activeExtId.value = extensions.value[0]?.id ?? 'bing-dictionary';
  }
});
</script>
