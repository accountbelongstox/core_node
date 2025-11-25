<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-yellow-50 to-amber-50">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <span class="text-2xl">😊</span>
            <h2 class="text-2xl font-semibold text-slate-900">Emoji Picker</h2>
          </div>
          <p class="text-sm text-slate-600">Browse and copy emojis</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <!-- Search and Selected -->
      <div class="flex space-x-4">
        <div class="flex-1 relative">
          <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input v-model="search" type="text" 
            class="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500"
            placeholder="Search emojis..." />
        </div>
        <div v-if="selectedEmoji" 
          class="flex items-center space-x-3 px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
          <span class="text-3xl">{{ selectedEmoji.char }}</span>
          <div class="text-sm">
            <div class="font-medium text-amber-800">{{ selectedEmoji.name }}</div>
            <div class="text-amber-600">Copied!</div>
          </div>
        </div>
      </div>

      <!-- Category Tabs -->
      <div class="flex space-x-2 overflow-x-auto pb-2">
        <button v-for="cat in categories" :key="cat.id" @click="activeCategory = cat.id"
          :class="activeCategory === cat.id ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
          class="px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition flex items-center space-x-2">
          <span>{{ cat.icon }}</span>
          <span>{{ cat.name }}</span>
        </button>
      </div>

      <!-- Emoji Grid -->
      <div class="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-1">
        <button v-for="emoji in filteredEmojis" :key="emoji.char" @click="selectEmoji(emoji)"
          class="p-2 text-2xl hover:bg-amber-100 rounded-lg transition cursor-pointer"
          :title="emoji.name">
          {{ emoji.char }}
        </button>
      </div>

      <!-- Recently Used -->
      <div v-if="recentlyUsed.length" class="pt-4 border-t">
        <h3 class="text-sm font-medium text-slate-700 mb-3">Recently Used</h3>
        <div class="flex flex-wrap gap-1">
          <button v-for="emoji in recentlyUsed" :key="emoji.char" @click="selectEmoji(emoji)"
            class="p-2 text-2xl hover:bg-amber-100 rounded-lg transition cursor-pointer">
            {{ emoji.char }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

interface Emoji {
  char: string;
  name: string;
  category: string;
}

const search = ref('');
const activeCategory = ref('smileys');
const selectedEmoji = ref<Emoji | null>(null);
const recentlyUsed = ref<Emoji[]>([]);

const categories = [
  { id: 'smileys', name: 'Smileys', icon: '😊' },
  { id: 'people', name: 'People', icon: '👋' },
  { id: 'animals', name: 'Animals', icon: '🐱' },
  { id: 'food', name: 'Food', icon: '🍕' },
  { id: 'activities', name: 'Activities', icon: '⚽' },
  { id: 'travel', name: 'Travel', icon: '✈️' },
  { id: 'objects', name: 'Objects', icon: '💡' },
  { id: 'symbols', name: 'Symbols', icon: '❤️' },
  { id: 'flags', name: 'Flags', icon: '🏁' }
];

// Emoji data (simplified subset)
const emojis: Emoji[] = [
  // Smileys
  { char: '😀', name: 'grinning face', category: 'smileys' },
  { char: '😃', name: 'grinning face with big eyes', category: 'smileys' },
  { char: '😄', name: 'grinning face with smiling eyes', category: 'smileys' },
  { char: '😁', name: 'beaming face', category: 'smileys' },
  { char: '😆', name: 'grinning squinting face', category: 'smileys' },
  { char: '😅', name: 'grinning face with sweat', category: 'smileys' },
  { char: '🤣', name: 'rolling on the floor laughing', category: 'smileys' },
  { char: '😂', name: 'face with tears of joy', category: 'smileys' },
  { char: '🙂', name: 'slightly smiling face', category: 'smileys' },
  { char: '😊', name: 'smiling face with smiling eyes', category: 'smileys' },
  { char: '😇', name: 'smiling face with halo', category: 'smileys' },
  { char: '🥰', name: 'smiling face with hearts', category: 'smileys' },
  { char: '😍', name: 'smiling face with heart-eyes', category: 'smileys' },
  { char: '🤩', name: 'star-struck', category: 'smileys' },
  { char: '😘', name: 'face blowing a kiss', category: 'smileys' },
  { char: '😗', name: 'kissing face', category: 'smileys' },
  { char: '😎', name: 'smiling face with sunglasses', category: 'smileys' },
  { char: '🤔', name: 'thinking face', category: 'smileys' },
  { char: '🤨', name: 'face with raised eyebrow', category: 'smileys' },
  { char: '😐', name: 'neutral face', category: 'smileys' },
  { char: '😑', name: 'expressionless face', category: 'smileys' },
  { char: '😶', name: 'face without mouth', category: 'smileys' },
  { char: '😏', name: 'smirking face', category: 'smileys' },
  { char: '😒', name: 'unamused face', category: 'smileys' },
  { char: '🙄', name: 'face with rolling eyes', category: 'smileys' },
  { char: '😬', name: 'grimacing face', category: 'smileys' },
  { char: '😮', name: 'face with open mouth', category: 'smileys' },
  { char: '😱', name: 'face screaming in fear', category: 'smileys' },
  { char: '😴', name: 'sleeping face', category: 'smileys' },
  { char: '🤮', name: 'face vomiting', category: 'smileys' },
  // People
  { char: '👋', name: 'waving hand', category: 'people' },
  { char: '🤚', name: 'raised back of hand', category: 'people' },
  { char: '✋', name: 'raised hand', category: 'people' },
  { char: '🖐️', name: 'hand with fingers splayed', category: 'people' },
  { char: '👌', name: 'OK hand', category: 'people' },
  { char: '🤏', name: 'pinching hand', category: 'people' },
  { char: '✌️', name: 'victory hand', category: 'people' },
  { char: '🤞', name: 'crossed fingers', category: 'people' },
  { char: '👍', name: 'thumbs up', category: 'people' },
  { char: '👎', name: 'thumbs down', category: 'people' },
  { char: '👊', name: 'oncoming fist', category: 'people' },
  { char: '✊', name: 'raised fist', category: 'people' },
  { char: '🤛', name: 'left-facing fist', category: 'people' },
  { char: '🤜', name: 'right-facing fist', category: 'people' },
  { char: '👏', name: 'clapping hands', category: 'people' },
  { char: '🙌', name: 'raising hands', category: 'people' },
  { char: '🤝', name: 'handshake', category: 'people' },
  { char: '🙏', name: 'folded hands', category: 'people' },
  // Animals
  { char: '🐶', name: 'dog face', category: 'animals' },
  { char: '🐱', name: 'cat face', category: 'animals' },
  { char: '🐭', name: 'mouse face', category: 'animals' },
  { char: '🐹', name: 'hamster', category: 'animals' },
  { char: '🐰', name: 'rabbit face', category: 'animals' },
  { char: '🦊', name: 'fox', category: 'animals' },
  { char: '🐻', name: 'bear', category: 'animals' },
  { char: '🐼', name: 'panda', category: 'animals' },
  { char: '🐨', name: 'koala', category: 'animals' },
  { char: '🐯', name: 'tiger face', category: 'animals' },
  { char: '🦁', name: 'lion', category: 'animals' },
  { char: '🐮', name: 'cow face', category: 'animals' },
  // Food
  { char: '🍎', name: 'red apple', category: 'food' },
  { char: '🍊', name: 'tangerine', category: 'food' },
  { char: '🍋', name: 'lemon', category: 'food' },
  { char: '🍌', name: 'banana', category: 'food' },
  { char: '🍉', name: 'watermelon', category: 'food' },
  { char: '🍇', name: 'grapes', category: 'food' },
  { char: '🍓', name: 'strawberry', category: 'food' },
  { char: '🍕', name: 'pizza', category: 'food' },
  { char: '🍔', name: 'hamburger', category: 'food' },
  { char: '🍟', name: 'french fries', category: 'food' },
  { char: '🌭', name: 'hot dog', category: 'food' },
  { char: '🍿', name: 'popcorn', category: 'food' },
  // Symbols
  { char: '❤️', name: 'red heart', category: 'symbols' },
  { char: '🧡', name: 'orange heart', category: 'symbols' },
  { char: '💛', name: 'yellow heart', category: 'symbols' },
  { char: '💚', name: 'green heart', category: 'symbols' },
  { char: '💙', name: 'blue heart', category: 'symbols' },
  { char: '💜', name: 'purple heart', category: 'symbols' },
  { char: '🖤', name: 'black heart', category: 'symbols' },
  { char: '🤍', name: 'white heart', category: 'symbols' },
  { char: '💯', name: 'hundred points', category: 'symbols' },
  { char: '✅', name: 'check mark button', category: 'symbols' },
  { char: '❌', name: 'cross mark', category: 'symbols' },
  { char: '⭐', name: 'star', category: 'symbols' },
  { char: '🔥', name: 'fire', category: 'symbols' },
  { char: '💡', name: 'light bulb', category: 'objects' },
  { char: '📱', name: 'mobile phone', category: 'objects' },
  { char: '💻', name: 'laptop', category: 'objects' },
  { char: '⌨️', name: 'keyboard', category: 'objects' },
  { char: '🖥️', name: 'desktop computer', category: 'objects' },
  { char: '📷', name: 'camera', category: 'objects' },
  // Travel
  { char: '✈️', name: 'airplane', category: 'travel' },
  { char: '🚗', name: 'automobile', category: 'travel' },
  { char: '🚀', name: 'rocket', category: 'travel' },
  { char: '🌍', name: 'globe showing Europe-Africa', category: 'travel' },
  { char: '🏠', name: 'house', category: 'travel' },
  // Activities
  { char: '⚽', name: 'soccer ball', category: 'activities' },
  { char: '🏀', name: 'basketball', category: 'activities' },
  { char: '🎮', name: 'video game', category: 'activities' },
  { char: '🎲', name: 'game die', category: 'activities' },
  { char: '🎯', name: 'direct hit', category: 'activities' },
  // Flags
  { char: '🏁', name: 'chequered flag', category: 'flags' },
  { char: '🚩', name: 'triangular flag', category: 'flags' },
  { char: '🏳️', name: 'white flag', category: 'flags' }
];

const filteredEmojis = computed(() => {
  let result = emojis;
  
  if (search.value) {
    const query = search.value.toLowerCase();
    result = result.filter(e => e.name.toLowerCase().includes(query));
  } else {
    result = result.filter(e => e.category === activeCategory.value);
  }
  
  return result;
});

const selectEmoji = async (emoji: Emoji) => {
  selectedEmoji.value = emoji;
  
  // Add to recently used
  recentlyUsed.value = [emoji, ...recentlyUsed.value.filter(e => e.char !== emoji.char)].slice(0, 20);
  
  // Copy to clipboard
  try {
    await navigator.clipboard.writeText(emoji.char);
  } catch {}
  
  // Clear selection after delay
  setTimeout(() => {
    selectedEmoji.value = null;
  }, 1500);
};

onMounted(() => {
  // Load recently used from localStorage
  try {
    const saved = localStorage.getItem('emoji_recent');
    if (saved) {
      recentlyUsed.value = JSON.parse(saved);
    }
  } catch {}
});
</script>

<style scoped>
.grid-cols-16 {
  grid-template-columns: repeat(16, minmax(0, 1fr));
}
</style>

