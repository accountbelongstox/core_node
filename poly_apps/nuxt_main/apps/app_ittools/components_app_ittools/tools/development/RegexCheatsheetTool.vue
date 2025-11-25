<template>
  <div class="regex-cheatsheet-tool">
    <div class="tool-header">
      <h3>Regex Cheatsheet</h3>
      <p class="tool-description">Quick reference for regular expressions</p>
    </div>

    <div class="search-section">
      <input 
        type="text" 
        v-model="searchQuery" 
        placeholder="Search patterns..."
        class="search-input"
      />
    </div>

    <div class="categories-section">
      <button 
        v-for="cat in categories" 
        :key="cat.id"
        :class="['category-btn', { active: activeCategory === cat.id }]"
        @click="activeCategory = cat.id"
      >
        {{ cat.name }}
      </button>
    </div>

    <div class="patterns-section">
      <div 
        v-for="pattern in filteredPatterns" 
        :key="pattern.pattern" 
        class="pattern-card"
        @click="copyPattern(pattern.pattern)"
      >
        <div class="pattern-header">
          <code class="pattern-code">{{ pattern.pattern }}</code>
          <span class="pattern-category">{{ pattern.category }}</span>
        </div>
        <div class="pattern-description">{{ pattern.description }}</div>
        <div v-if="pattern.example" class="pattern-example">
          <span class="example-label">Example:</span>
          <code>{{ pattern.example }}</code>
        </div>
      </div>
    </div>

    <div class="common-patterns">
      <h4>Common Use Cases</h4>
      <div class="use-cases-grid">
        <div v-for="useCase in useCases" :key="useCase.name" class="use-case-card">
          <div class="use-case-name">{{ useCase.name }}</div>
          <code class="use-case-pattern" @click="copyPattern(useCase.pattern)">
            {{ useCase.pattern }}
          </code>
          <div class="use-case-desc">{{ useCase.description }}</div>
        </div>
      </div>
    </div>

    <div v-if="copied" class="copy-notification">Pattern copied!</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const searchQuery = ref('');
const activeCategory = ref('all');
const copied = ref(false);

const categories = [
  { id: 'all', name: 'All' },
  { id: 'basic', name: 'Basic' },
  { id: 'anchors', name: 'Anchors' },
  { id: 'quantifiers', name: 'Quantifiers' },
  { id: 'groups', name: 'Groups' },
  { id: 'classes', name: 'Classes' },
  { id: 'lookaround', name: 'Lookaround' },
  { id: 'flags', name: 'Flags' }
];

const patterns = [
  // Basic
  { pattern: '.', description: 'Any character except newline', category: 'basic', example: 'a.c matches abc' },
  { pattern: '\\d', description: 'Digit (0-9)', category: 'basic', example: '\\d{3} matches 123' },
  { pattern: '\\D', description: 'Not a digit', category: 'basic' },
  { pattern: '\\w', description: 'Word character (a-z, A-Z, 0-9, _)', category: 'basic' },
  { pattern: '\\W', description: 'Not a word character', category: 'basic' },
  { pattern: '\\s', description: 'Whitespace (space, tab, newline)', category: 'basic' },
  { pattern: '\\S', description: 'Not whitespace', category: 'basic' },
  { pattern: '\\n', description: 'Newline', category: 'basic' },
  { pattern: '\\t', description: 'Tab', category: 'basic' },
  { pattern: '\\\\', description: 'Literal backslash', category: 'basic' },

  // Anchors
  { pattern: '^', description: 'Start of string/line', category: 'anchors', example: '^Hello matches Hello at start' },
  { pattern: '$', description: 'End of string/line', category: 'anchors', example: 'end$ matches word at end' },
  { pattern: '\\b', description: 'Word boundary', category: 'anchors', example: '\\bword\\b matches whole word' },
  { pattern: '\\B', description: 'Not a word boundary', category: 'anchors' },
  { pattern: '\\A', description: 'Start of string (multi-line)', category: 'anchors' },
  { pattern: '\\Z', description: 'End of string (multi-line)', category: 'anchors' },

  // Quantifiers
  { pattern: '*', description: '0 or more', category: 'quantifiers', example: 'a* matches "", a, aa, aaa...' },
  { pattern: '+', description: '1 or more', category: 'quantifiers', example: 'a+ matches a, aa, aaa...' },
  { pattern: '?', description: '0 or 1 (optional)', category: 'quantifiers', example: 'colou?r matches color or colour' },
  { pattern: '{n}', description: 'Exactly n times', category: 'quantifiers', example: '\\d{4} matches 4 digits' },
  { pattern: '{n,}', description: 'n or more times', category: 'quantifiers' },
  { pattern: '{n,m}', description: 'Between n and m times', category: 'quantifiers', example: '\\d{2,4} matches 2-4 digits' },
  { pattern: '*?', description: 'Non-greedy 0 or more', category: 'quantifiers' },
  { pattern: '+?', description: 'Non-greedy 1 or more', category: 'quantifiers' },

  // Groups
  { pattern: '(abc)', description: 'Capture group', category: 'groups', example: '(\\d{3})-(\\d{4}) captures two groups' },
  { pattern: '(?:abc)', description: 'Non-capturing group', category: 'groups' },
  { pattern: '(?<name>abc)', description: 'Named capture group', category: 'groups' },
  { pattern: '\\1', description: 'Backreference to group 1', category: 'groups' },
  { pattern: '(a|b)', description: 'Alternation (a or b)', category: 'groups', example: '(cat|dog) matches cat or dog' },

  // Character Classes
  { pattern: '[abc]', description: 'Any of a, b, or c', category: 'classes' },
  { pattern: '[^abc]', description: 'Not a, b, or c', category: 'classes' },
  { pattern: '[a-z]', description: 'Lowercase letter', category: 'classes' },
  { pattern: '[A-Z]', description: 'Uppercase letter', category: 'classes' },
  { pattern: '[0-9]', description: 'Digit', category: 'classes' },
  { pattern: '[a-zA-Z0-9]', description: 'Alphanumeric', category: 'classes' },

  // Lookaround
  { pattern: '(?=abc)', description: 'Positive lookahead', category: 'lookaround', example: 'foo(?=bar) matches foo before bar' },
  { pattern: '(?!abc)', description: 'Negative lookahead', category: 'lookaround' },
  { pattern: '(?<=abc)', description: 'Positive lookbehind', category: 'lookaround' },
  { pattern: '(?<!abc)', description: 'Negative lookbehind', category: 'lookaround' },

  // Flags
  { pattern: '/g', description: 'Global (find all matches)', category: 'flags' },
  { pattern: '/i', description: 'Case insensitive', category: 'flags' },
  { pattern: '/m', description: 'Multiline (^ and $ match line boundaries)', category: 'flags' },
  { pattern: '/s', description: 'Dotall (. matches newline)', category: 'flags' },
  { pattern: '/u', description: 'Unicode support', category: 'flags' }
];

const useCases = [
  { name: 'Email', pattern: '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$', description: 'Validate email address' },
  { name: 'URL', pattern: '^https?://[^\\s]+$', description: 'Match HTTP/HTTPS URL' },
  { name: 'Phone (US)', pattern: '^\\d{3}-\\d{3}-\\d{4}$', description: 'Match XXX-XXX-XXXX' },
  { name: 'Hex Color', pattern: '^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$', description: 'Match hex color code' },
  { name: 'IP Address', pattern: '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$', description: 'Match IPv4 address' },
  { name: 'Date (YYYY-MM-DD)', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Match ISO date format' },
  { name: 'Password Strength', pattern: '^(?=.*\\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$', description: 'Min 8 chars with upper, lower, digit' },
  { name: 'HTML Tag', pattern: '<([a-z]+)[^>]*>(.*?)</\\1>', description: 'Match HTML tags with content' }
];

const filteredPatterns = computed(() => {
  let result = patterns;
  
  if (activeCategory.value !== 'all') {
    result = result.filter(p => p.category === activeCategory.value);
  }
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(p => 
      p.pattern.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query)
    );
  }
  
  return result;
});

const copyPattern = async (pattern: string) => {
  await navigator.clipboard.writeText(pattern);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
};
</script>

<style scoped>
.regex-cheatsheet-tool {
  padding: 20px;
}
.search-section {
  margin: 20px 0;
}
.search-input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
}
.categories-section {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.category-btn {
  padding: 8px 16px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
}
.category-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}
.patterns-section {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 40px;
}
.pattern-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}
.pattern-card:hover {
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
}
.pattern-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.pattern-code {
  background: #1e293b;
  color: #f59e0b;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 14px;
}
.pattern-category {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 10px;
}
.pattern-description {
  color: #334155;
  font-size: 14px;
  margin-bottom: 8px;
}
.pattern-example {
  font-size: 12px;
  color: #64748b;
}
.example-label {
  font-weight: 500;
}
.common-patterns {
  margin-top: 40px;
}
.use-cases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.use-case-card {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
}
.use-case-name {
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}
.use-case-pattern {
  display: block;
  background: #1e293b;
  color: #22c55e;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 8px;
  cursor: pointer;
  word-break: break-all;
}
.use-case-pattern:hover {
  background: #334155;
}
.use-case-desc {
  font-size: 12px;
  color: #64748b;
}
.copy-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #22c55e;
  color: white;
  padding: 12px 20px;
  border-radius: 6px;
}
</style>

