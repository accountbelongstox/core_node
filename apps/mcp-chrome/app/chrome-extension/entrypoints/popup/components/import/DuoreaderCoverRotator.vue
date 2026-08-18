<template>
  <div class="dr-cover-rotator" :style="{ width: sizeW, height: sizeH }">
    <img
      v-if="activeUrl && !broken"
      :key="activeUrl"
      :src="activeUrl"
      alt=""
      loading="eager"
      referrerpolicy="no-referrer"
      class="dr-cover-rotator-img"
      @error="onImgError"
    />
    <span v-else class="dr-cover-rotator-fallback">{{ fallbackLabel }}</span>
    <span v-if="urls.length > 1" class="dr-cover-rotator-badge">{{ activeIndex + 1 }}/{{ urls.length }}</span>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { COVER_ROTATE_INTERVAL_MS } from '@/utils/cover-playback';

const props = withDefaults(
  defineProps<{
    urls?: string[];
    coverUrl?: string;
    title?: string;
    width?: number;
    height?: number;
  }>(),
  { urls: () => [], coverUrl: '', title: '', width: 28, height: 40 },
);

const activeIndex = ref(0);
const broken = ref(false);
const failedUrls = ref(new Set<string>());
let timer: ReturnType<typeof setInterval> | null = null;

const urls = computed(() => {
  const list = (props.urls?.length ? props.urls : props.coverUrl ? [props.coverUrl] : [])
    .map((u) => String(u || '').trim())
    .filter(Boolean);
  return list;
});

const activeUrl = computed(() => urls.value[activeIndex.value] || '');

const fallbackLabel = computed(() => {
  const t = String(props.title || '').trim();
  return t ? t.charAt(0).toUpperCase() : '?';
});

const sizeW = computed(() => `${props.width}px`);
const sizeH = computed(() => `${props.height}px`);

const advanceToNextUrl = () => {
  if (urls.value.length <= 1) {
    broken.value = true;
    return;
  }
  const start = activeIndex.value;
  for (let step = 1; step <= urls.value.length; step += 1) {
    const next = (start + step) % urls.value.length;
    const candidate = urls.value[next];
    if (!failedUrls.value.has(candidate)) {
      activeIndex.value = next;
      broken.value = false;
      return;
    }
  }
  broken.value = true;
};

const onImgError = () => {
  const url = activeUrl.value;
  if (url) failedUrls.value.add(url);
  advanceToNextUrl();
};

const restart = () => {
  if (timer) clearInterval(timer);
  timer = null;
  activeIndex.value = 0;
  broken.value = false;
  failedUrls.value = new Set();
  if (urls.value.length > 1) {
    timer = setInterval(() => {
      activeIndex.value = (activeIndex.value + 1) % urls.value.length;
      broken.value = false;
    }, COVER_ROTATE_INTERVAL_MS);
  }
};

watch(urls, restart, { immediate: true });

onMounted(restart);
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.dr-cover-rotator {
  position: relative;
  flex-shrink: 0;
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid rgba(51, 65, 85, 0.6);
  background: #0f172a;
}
.dr-cover-rotator-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.dr-cover-rotator-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
}
.dr-cover-rotator-badge {
  position: absolute;
  right: 2px;
  bottom: 2px;
  font-size: 7px;
  font-weight: 700;
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.55);
  color: #e2e8f0;
}
</style>
