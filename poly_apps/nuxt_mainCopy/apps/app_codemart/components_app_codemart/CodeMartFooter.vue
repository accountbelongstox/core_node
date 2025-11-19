<!--
  【DEVELOPMENT STANDARDS】
  - NO <style> tags allowed in this component
  - All styles must reference theme variables via class names
  - Theme file: common/styles/theme-base.css
  - Extended theme: apps/app_codemart/styles_app_codemart/theme-codemart.css
-->
<template>
  <footer class="codemart-footer">
    <div class="container">
      <div class="codemart-footer-content">
        <!-- Company Info -->
        <div class="codemart-footer-section">
          <div class="codemart-footer-logo">
            <svg class="codemart-logo-icon" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.3"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
            </svg>
            <span class="codemart-footer-logo-text">{{ t('codemart.platform_name') }}</span>
          </div>
          <p class="codemart-footer-desc">
            {{ t('codemart.platform_slogan') }}
          </p>
          <div class="codemart-footer-social">
            <a href="#" class="codemart-social-link" aria-label="GitHub">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </a>
            <a href="#" class="codemart-social-link" aria-label="Twitter">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
            </a>
            <a href="#" class="codemart-social-link" aria-label="LinkedIn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
          </div>
        </div>

        <!-- About Links -->
        <div class="codemart-footer-section">
          <h4 class="codemart-footer-title">{{ t('codemart.footer.about') }}</h4>
          <ul class="codemart-footer-links">
            <li><NuxtLink to="/about">{{ t('codemart.footer.about_us') }}</NuxtLink></li>
            <li><NuxtLink to="/how-it-works">{{ t('codemart.footer.how_it_works') }}</NuxtLink></li>
            <li><NuxtLink to="/pricing">{{ t('codemart.footer.pricing') }}</NuxtLink></li>
            <li><NuxtLink to="/blog">{{ t('codemart.footer.blog') }}</NuxtLink></li>
          </ul>
        </div>

        <!-- For Clients -->
        <div class="codemart-footer-section">
          <h4 class="codemart-footer-title">{{ t('codemart.footer.for_clients') }}</h4>
          <ul class="codemart-footer-links">
            <li><NuxtLink to="/post-project">{{ t('codemart.footer.post_project') }}</NuxtLink></li>
            <li><NuxtLink to="/find-developers">{{ t('codemart.footer.find_developers') }}</NuxtLink></li>
            <li><NuxtLink to="/client-guide">{{ t('codemart.footer.client_guide') }}</NuxtLink></li>
            <li><NuxtLink to="/success-stories">{{ t('codemart.footer.success_stories') }}</NuxtLink></li>
          </ul>
        </div>

        <!-- For Developers -->
        <div class="codemart-footer-section">
          <h4 class="codemart-footer-title">{{ t('codemart.footer.for_developers') }}</h4>
          <ul class="codemart-footer-links">
            <li><NuxtLink to="/browse-projects">{{ t('codemart.footer.browse_projects') }}</NuxtLink></li>
            <li><NuxtLink to="/become-developer">{{ t('codemart.footer.become_developer') }}</NuxtLink></li>
            <li><NuxtLink to="/developer-guide">{{ t('codemart.footer.developer_guide') }}</NuxtLink></li>
            <li><NuxtLink to="/skills">{{ t('codemart.footer.skills') }}</NuxtLink></li>
          </ul>
        </div>

        <!-- Support -->
        <div class="codemart-footer-section">
          <h4 class="codemart-footer-title">{{ t('codemart.footer.support') }}</h4>
          <ul class="codemart-footer-links">
            <li><NuxtLink to="/help">{{ t('codemart.footer.help_center') }}</NuxtLink></li>
            <li><NuxtLink to="/contact">{{ t('codemart.footer.contact') }}</NuxtLink></li>
            <li><NuxtLink to="/faq">{{ t('codemart.footer.faq') }}</NuxtLink></li>
            <li><NuxtLink to="/terms">{{ t('codemart.footer.terms') }}</NuxtLink></li>
            <li><NuxtLink to="/privacy">{{ t('codemart.footer.privacy') }}</NuxtLink></li>
          </ul>
        </div>
      </div>

      <!-- Copyright -->
      <div class="codemart-footer-bottom">
        <p class="codemart-copyright">
          &copy; {{ currentYear }} {{ t('codemart.platform_name') }}. {{ t('common.all_rights_reserved') }}
        </p>
        <div class="codemart-footer-bottom-links">
          <NuxtLink to="/terms">{{ t('common.terms') }}</NuxtLink>
          <NuxtLink to="/privacy">{{ t('common.privacy') }}</NuxtLink>
          <NuxtLink to="/cookies">{{ t('common.cookies') }}</NuxtLink>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const currentYear = computed(() => new Date().getFullYear());
</script>

<!-- NO <style> tag - All styles defined in theme files -->
