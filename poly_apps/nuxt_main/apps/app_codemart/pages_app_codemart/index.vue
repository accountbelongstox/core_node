<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <div class="codemart-homepage">
    <!-- Hero Section -->
    <section class="codemart-hero">
      <div class="container">
        <div class="codemart-hero-content">
          <h1 class="codemart-hero-title">{{ t('codemart.home.hero_title') }}</h1>
          <p class="codemart-hero-subtitle">{{ t('codemart.home.hero_subtitle') }}</p>

          <div class="codemart-hero-actions">
            <NuxtLink to="/projects/create" class="codemart-btn codemart-btn-primary codemart-btn-lg">
              {{ t('codemart.home.publish_project') }}
            </NuxtLink>
            <NuxtLink to="/developers" class="codemart-btn codemart-btn-outline codemart-btn-lg">
              {{ t('codemart.home.become_developer') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- Statistics Section -->
    <section class="codemart-stats-section">
      <div class="container">
        <div class="codemart-stats-grid">
          <div class="codemart-stat-item">
            <div class="codemart-stat-value">{{ formatNumber(stats.totalProjects) }}</div>
            <div class="codemart-stat-label">{{ t('codemart.home.total_projects') }}</div>
          </div>
          <div class="codemart-stat-item">
            <div class="codemart-stat-value">{{ formatNumber(stats.totalDevelopers) }}</div>
            <div class="codemart-stat-label">{{ t('codemart.home.total_developers') }}</div>
          </div>
          <div class="codemart-stat-item">
            <div class="codemart-stat-value">¥{{ formatNumber(stats.totalTransactions) }}</div>
            <div class="codemart-stat-label">{{ t('codemart.home.total_transactions') }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works Section -->
    <section class="codemart-section">
      <div class="container">
        <h2 class="codemart-section-title text-center">{{ t('codemart.nav.how_it_works') }}</h2>

        <div class="codemart-workflow-grid">
          <!-- Step 1 -->
          <div class="codemart-workflow-step">
            <div class="codemart-workflow-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M9 12H15M12 9V15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3 class="codemart-workflow-title">{{ t('codemart.workflow.step1_title') }}</h3>
            <p class="codemart-workflow-desc">{{ t('codemart.workflow.step1_desc') }}</p>
          </div>

          <!-- Step 2 -->
          <div class="codemart-workflow-step">
            <div class="codemart-workflow-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M17 20H22V18C22 16.3431 20.6569 15 19 15C18.0444 15 17.1931 15.4468 16.6438 16.1429M17 20H7M17 20V18C17 17.3438 16.8736 16.717 16.6438 16.1429M7 20H2V18C2 16.3431 3.34315 15 5 15C5.95561 15 6.80686 15.4468 7.35625 16.1429M7 20V18C7 17.3438 7.12642 16.717 7.35625 16.1429M7.35625 16.1429C8.0935 14.301 9.89482 13 12 13C14.1052 13 15.9065 14.301 16.6438 16.1429M15 7C15 8.65685 13.6569 10 12 10C10.3431 10 9 8.65685 9 7C9 5.34315 10.3431 4 12 4C13.6569 4 15 5.34315 15 7ZM21 10C21 11.1046 20.1046 12 19 12C17.8954 12 17 11.1046 17 10C17 8.89543 17.8954 8 19 8C20.1046 8 21 8.89543 21 10ZM7 10C7 11.1046 6.10457 12 5 12C3.89543 12 3 11.1046 3 10C3 8.89543 3.89543 8 5 8C6.10457 8 7 8.89543 7 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3 class="codemart-workflow-title">{{ t('codemart.workflow.step2_title') }}</h3>
            <p class="codemart-workflow-desc">{{ t('codemart.workflow.step2_desc') }}</p>
          </div>

          <!-- Step 3 -->
          <div class="codemart-workflow-step">
            <div class="codemart-workflow-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M9 12L11 14L15 10M20.6179 5.98434C20.4132 5.99472 20.2072 5.99997 20 5.99997C16.9265 5.99997 14.123 4.84453 11.9999 2.94434C9.87691 4.84446 7.07339 5.99985 4 5.99985C3.79277 5.99985 3.58678 5.9946 3.38213 5.98422C3.1327 6.94783 3 7.95842 3 9.00001C3 14.5915 6.82432 19.2898 12 20.622C17.1757 19.2898 21 14.5915 21 9.00001C21 7.95847 20.8673 6.94791 20.6179 5.98434Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3 class="codemart-workflow-title">{{ t('codemart.workflow.step3_title') }}</h3>
            <p class="codemart-workflow-desc">{{ t('codemart.workflow.step3_desc') }}</p>
          </div>

          <!-- Step 4 -->
          <div class="codemart-workflow-step">
            <div class="codemart-workflow-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3 class="codemart-workflow-title">{{ t('codemart.workflow.step4_title') }}</h3>
            <p class="codemart-workflow-desc">{{ t('codemart.workflow.step4_desc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Featured Projects Section -->
    <section class="codemart-section codemart-featured-section">
      <div class="container">
        <div class="codemart-section-header">
          <h2 class="codemart-section-title">{{ t('codemart.home.featured_projects') }}</h2>
          <NuxtLink to="/projects" class="codemart-btn codemart-btn-outline">
            {{ t('common.view_all') }}
          </NuxtLink>
        </div>

        <div class="codemart-projects-grid">
          <CodeMartProjectCard
            v-for="project in featuredProjects"
            :key="project.id"
            :project="project"
            @view="handleViewProject"
          />
        </div>
      </div>
    </section>

    <!-- Featured Developers Section -->
    <section class="codemart-section">
      <div class="container">
        <div class="codemart-section-header">
          <h2 class="codemart-section-title">{{ t('codemart.home.top_developers') }}</h2>
          <NuxtLink to="/developers" class="codemart-btn codemart-btn-outline">
            {{ t('common.view_all') }}
          </NuxtLink>
        </div>

        <div class="codemart-developers-grid">
          <CodeMartDeveloperCard
            v-for="developer in topDevelopers"
            :key="developer.id"
            :developer="developer"
          />
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="codemart-cta-section">
      <div class="container">
        <div class="codemart-cta-content">
          <h2 class="codemart-cta-title">{{ t('codemart.home.cta_title') }}</h2>
          <p class="codemart-cta-desc">{{ t('codemart.home.cta_desc') }}</p>
          <NuxtLink to="/register" class="codemart-btn codemart-btn-primary codemart-btn-lg">
            {{ t('codemart.home.get_started') }}
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { CodeMartProjectCard, CodeMartDeveloperCard } from '../components_app_codemart';
import type { Project, Developer } from '../types_app_codemart';

const { t } = useI18n();
const router = useRouter();

// Statistics
const stats = ref({
  totalProjects: 352380935,
  totalDevelopers: 12601,
  totalTransactions: 182086
});

// Featured projects (mock data)
const featuredProjects = ref<Project[]>([
  {
    id: '1',
    title: 'E-commerce Platform Development',
    description: 'Build a modern e-commerce platform with React and Node.js',
    budgetMin: 50000,
    budgetMax: 100000,
    deadline: '2024-03-30',
    status: 'active',
    category: 'Web Development',
    skills: ['React', 'Node.js', 'MongoDB', 'AWS'],
    clientId: 'client-1',
    clientName: 'Tech Startup Inc',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z'
  },
  {
    id: '2',
    title: 'Mobile App for Healthcare',
    description: 'Develop a cross-platform mobile application for patient management',
    budgetMin: 80000,
    budgetMax: 150000,
    deadline: '2024-04-15',
    status: 'active',
    category: 'Mobile Development',
    skills: ['React Native', 'Firebase', 'Healthcare'],
    clientId: 'client-2',
    clientName: 'Health Corp',
    createdAt: '2024-01-14T09:00:00Z',
    updatedAt: '2024-01-14T09:00:00Z'
  },
  {
    id: '3',
    title: 'AI-Powered Analytics Dashboard',
    description: 'Create an intelligent analytics dashboard with machine learning capabilities',
    budgetMin: 120000,
    budgetMax: 200000,
    deadline: '2024-05-01',
    status: 'active',
    category: 'AI/ML',
    skills: ['Python', 'TensorFlow', 'Vue.js', 'FastAPI'],
    clientId: 'client-3',
    clientName: 'Data Analytics Ltd',
    createdAt: '2024-01-13T14:00:00Z',
    updatedAt: '2024-01-13T14:00:00Z'
  }
]);

// Top developers (mock data)
const topDevelopers = ref<Developer[]>([
  {
    id: 'dev-1',
    userId: 'user-1',
    username: 'Zhang Wei',
    email: 'zhangwei@example.com',
    role: 'developer',
    avatar: '/avatars/dev1.jpg',
    title: 'Full Stack Developer',
    bio: 'Experienced full-stack developer specializing in React and Node.js',
    skills: ['React', 'Node.js', 'TypeScript', 'AWS', 'Docker'],
    yearsOfExperience: 5,
    hourlyRateMin: 200,
    hourlyRateMax: 400,
    rating: 4.9,
    completedProjects: 48,
    verified: true,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'dev-2',
    userId: 'user-2',
    username: 'Li Ming',
    email: 'liming@example.com',
    role: 'developer',
    title: 'Mobile Developer',
    bio: 'Expert in cross-platform mobile development',
    skills: ['React Native', 'Flutter', 'iOS', 'Android'],
    yearsOfExperience: 6,
    hourlyRateMin: 250,
    hourlyRateMax: 450,
    rating: 4.8,
    completedProjects: 35,
    verified: true,
    createdAt: '2023-02-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'dev-3',
    userId: 'user-3',
    username: 'Wang Fang',
    email: 'wangfang@example.com',
    role: 'developer',
    title: 'AI/ML Engineer',
    bio: 'Specialized in machine learning and data science',
    skills: ['Python', 'TensorFlow', 'PyTorch', 'Data Science'],
    yearsOfExperience: 7,
    hourlyRateMin: 300,
    hourlyRateMax: 500,
    rating: 5.0,
    completedProjects: 28,
    verified: true,
    createdAt: '2023-03-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
]);

const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN');
};

const handleViewProject = (project: Project) => {
  router.push(`/projects/${project.id}`);
};

onMounted(() => {
  // Load data from API in production
  console.log('Homepage mounted');
});
</script>

<!-- NO <style> tag - All styles defined in theme files -->
