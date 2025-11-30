<template>
  <header class="codemart-header">
    <div class="header-container">
      <div class="logo-section">
        <img :src="logoUrl" alt="CodeMart Logo" class="logo">
        <span class="logo-text">CodeMart</span>
      </div>

      <nav class="main-nav">
        <a
          v-for="item in navItems"
          :key="item.id"
          :href="item.link"
          class="nav-item"
          :class="{ active: item.active }"
        >
          {{ item.label }}
        </a>
      </nav>

      <div class="header-actions">
        <button class="login-btn">Login</button>
        <button class="register-btn">Register</button>
      </div>

      <button class="mobile-menu-toggle" @click="toggleMobileMenu">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const logoUrl = ref('https://placeholder-image.anthropic.com/120x40/logo');

const navItems = ref([
  { id: 1, label: 'Home', link: '#', active: true },
  { id: 2, label: 'Services', link: '#services', active: false },
  { id: 3, label: 'Projects', link: '#projects', active: false },
  { id: 4, label: 'About', link: '#about', active: false },
  { id: 5, label: 'Contact', link: '#contact', active: false }
]);

const showMobileMenu = ref(false);

const toggleMobileMenu = () => {
  showMobileMenu.value = !showMobileMenu.value;
};
</script>

<style scoped>
.codemart-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.header-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo {
  height: 2.5rem;
  width: auto;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.main-nav {
  display: flex;
  align-items: center;
  gap: 2rem;
  flex: 1;
  justify-content: center;
}

.nav-item {
  font-size: 0.9375rem;
  font-weight: 500;
  color: #64748b;
  text-decoration: none;
  transition: color 0.2s;
  position: relative;
  padding: 0.5rem 0;
}

.nav-item:hover {
  color: #6366f1;
}

.nav-item.active {
  color: #6366f1;
  font-weight: 600;
}

.nav-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 2px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.login-btn {
  padding: 0.625rem 1.5rem;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  color: #475569;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.login-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.05);
}

.register-btn {
  padding: 0.625rem 1.5rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border: none;
  border-radius: 0.75rem;
  color: white;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.register-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
}

.mobile-menu-toggle {
  display: none;
  width: 2.5rem;
  height: 2.5rem;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: background 0.2s;
}

.mobile-menu-toggle:hover {
  background: #f1f5f9;
}

.mobile-menu-toggle svg {
  width: 1.5rem;
  height: 1.5rem;
}

@media (max-width: 1024px) {
  .main-nav {
    display: none;
  }

  .header-actions {
    display: none;
  }

  .mobile-menu-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
  }
}

@media (max-width: 640px) {
  .header-container {
    padding: 0.75rem 1rem;
  }

  .logo-text {
    font-size: 1.25rem;
  }
}
</style>
