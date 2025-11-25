<template>
  <div class="h-full flex flex-col bg-white">
    <div class="px-6 py-4 border-b bg-gradient-to-r from-orange-500 to-red-500">
      <div class="flex items-center justify-between">
        <div class="space-y-1">
          <div class="flex items-center space-x-2">
            <i class="fab fa-git-alt text-white text-2xl"></i>
            <h2 class="text-2xl font-semibold text-white">Git Cheatsheet</h2>
          </div>
          <p class="text-sm text-orange-100">Quick reference for Git commands</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-orange-200 hover:text-white rounded-lg hover:bg-white/10 transition">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
      <!-- Search -->
      <div class="relative">
        <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
        <input v-model="search" type="text" placeholder="Search commands..."
          class="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500" />
      </div>

      <!-- Category Tabs -->
      <div class="flex space-x-2 overflow-x-auto pb-2">
        <button v-for="cat in categories" :key="cat.id" @click="activeCategory = cat.id"
          :class="activeCategory === cat.id ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'"
          class="px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition">
          {{ cat.name }}
        </button>
      </div>

      <!-- Commands List -->
      <div class="space-y-3">
        <div v-for="cmd in filteredCommands" :key="cmd.command"
          class="bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="font-mono text-sm bg-slate-900 text-orange-400 px-3 py-2 rounded inline-block">
                {{ cmd.command }}
              </div>
              <p class="text-sm text-slate-600 mt-2">{{ cmd.description }}</p>
              <p v-if="cmd.example" class="text-xs text-slate-400 mt-1 font-mono">
                Example: {{ cmd.example }}
              </p>
            </div>
            <button @click="copy(cmd.command)" class="p-2 text-slate-400 hover:text-orange-500 transition">
              <i :class="copied === cmd.command ? 'fas fa-check text-green-500' : 'fas fa-copy'"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Tool } from '../../../types_app_ittools';

defineProps<{ tool: Tool }>();
defineEmits<{ close: []; executed: [result: any] }>();

const search = ref('');
const activeCategory = ref('basic');
const copied = ref<string | null>(null);

const categories = [
  { id: 'basic', name: 'Basic' },
  { id: 'branch', name: 'Branching' },
  { id: 'remote', name: 'Remote' },
  { id: 'stash', name: 'Stash' },
  { id: 'history', name: 'History' },
  { id: 'undo', name: 'Undo' }
];

const commands = [
  // Basic
  { category: 'basic', command: 'git init', description: 'Initialize a new Git repository' },
  { category: 'basic', command: 'git clone <url>', description: 'Clone a repository', example: 'git clone https://github.com/user/repo.git' },
  { category: 'basic', command: 'git status', description: 'Show working tree status' },
  { category: 'basic', command: 'git add <file>', description: 'Add file to staging area', example: 'git add . (add all)' },
  { category: 'basic', command: 'git commit -m "<message>"', description: 'Commit staged changes', example: 'git commit -m "Initial commit"' },
  { category: 'basic', command: 'git diff', description: 'Show changes between commits' },
  
  // Branching
  { category: 'branch', command: 'git branch', description: 'List all local branches' },
  { category: 'branch', command: 'git branch <name>', description: 'Create a new branch', example: 'git branch feature/login' },
  { category: 'branch', command: 'git checkout <branch>', description: 'Switch to a branch', example: 'git checkout main' },
  { category: 'branch', command: 'git checkout -b <name>', description: 'Create and switch to new branch' },
  { category: 'branch', command: 'git merge <branch>', description: 'Merge branch into current', example: 'git merge feature/login' },
  { category: 'branch', command: 'git branch -d <name>', description: 'Delete a branch' },
  
  // Remote
  { category: 'remote', command: 'git remote -v', description: 'List remote repositories' },
  { category: 'remote', command: 'git remote add <name> <url>', description: 'Add a remote repository' },
  { category: 'remote', command: 'git fetch', description: 'Download objects from remote' },
  { category: 'remote', command: 'git pull', description: 'Fetch and merge from remote' },
  { category: 'remote', command: 'git push', description: 'Push commits to remote' },
  { category: 'remote', command: 'git push -u origin <branch>', description: 'Push and set upstream' },
  
  // Stash
  { category: 'stash', command: 'git stash', description: 'Stash current changes' },
  { category: 'stash', command: 'git stash list', description: 'List all stashes' },
  { category: 'stash', command: 'git stash pop', description: 'Apply and remove latest stash' },
  { category: 'stash', command: 'git stash apply', description: 'Apply stash without removing' },
  { category: 'stash', command: 'git stash drop', description: 'Delete latest stash' },
  
  // History
  { category: 'history', command: 'git log', description: 'Show commit history' },
  { category: 'history', command: 'git log --oneline', description: 'Compact commit history' },
  { category: 'history', command: 'git log --graph', description: 'Show branch graph' },
  { category: 'history', command: 'git show <commit>', description: 'Show commit details' },
  { category: 'history', command: 'git blame <file>', description: 'Show who changed each line' },
  
  // Undo
  { category: 'undo', command: 'git reset <file>', description: 'Unstage a file' },
  { category: 'undo', command: 'git reset --soft HEAD~1', description: 'Undo last commit, keep changes staged' },
  { category: 'undo', command: 'git reset --hard HEAD~1', description: 'Undo last commit and changes' },
  { category: 'undo', command: 'git revert <commit>', description: 'Create new commit undoing changes' },
  { category: 'undo', command: 'git checkout -- <file>', description: 'Discard file changes' }
];

const filteredCommands = computed(() => {
  let result = commands.filter(c => c.category === activeCategory.value);
  if (search.value) {
    const q = search.value.toLowerCase();
    result = commands.filter(c => 
      c.command.toLowerCase().includes(q) || 
      c.description.toLowerCase().includes(q)
    );
  }
  return result;
});

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = text;
    setTimeout(() => { copied.value = null; }, 1500);
  } catch {}
};
</script>

