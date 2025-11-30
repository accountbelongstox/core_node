<template>
  <footer class="codemart-footer">
    <div class="footer-top">
      <div class="footer-container">
        <div class="footer-grid">
          <div class="footer-column brand-column">
            <div class="footer-logo">
              <img :src="logoUrl" alt="CodeMart Logo" class="logo">
              <span class="logo-text">CodeMart</span>
            </div>
            <p class="brand-description">
              Professional software outsourcing platform connecting businesses with talented developers worldwide.
            </p>
            <div class="social-links">
              <a
                v-for="social in socialLinks"
                :key="social.id"
                :href="social.url"
                class="social-link"
                :aria-label="social.name"
              >
                <img :src="social.icon" :alt="social.name">
              </a>
            </div>
          </div>

          <div class="footer-column">
            <h3 class="footer-title">About Us</h3>
            <ul class="footer-links">
              <li><a href="#company">Company</a></li>
              <li><a href="#team">Our Team</a></li>
              <li><a href="#careers">Careers</a></li>
              <li><a href="#press">Press</a></li>
            </ul>
          </div>

          <div class="footer-column">
            <h3 class="footer-title">Services</h3>
            <ul class="footer-links">
              <li><a href="#web-dev">Web Development</a></li>
              <li><a href="#mobile-dev">Mobile Apps</a></li>
              <li><a href="#cloud">Cloud Solutions</a></li>
              <li><a href="#consulting">Consulting</a></li>
            </ul>
          </div>

          <div class="footer-column">
            <h3 class="footer-title">Support</h3>
            <ul class="footer-links">
              <li><a href="#help">Help Center</a></li>
              <li><a href="#docs">Documentation</a></li>
              <li><a href="#api">API Reference</a></li>
              <li><a href="#status">System Status</a></li>
            </ul>
          </div>

          <div class="footer-column">
            <h3 class="footer-title">Contact</h3>
            <ul class="footer-contact">
              <li>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <a href="mailto:contact@codemart.com">contact@codemart.com</a>
              </li>
              <li>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
                <a href="tel:+1234567890">+1 (234) 567-890</a>
              </li>
              <li>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span>123 Tech Street, SF, CA 94105</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="footer-cta">
      <div class="footer-container">
        <div class="cta-content">
          <h2 class="cta-title">Ready to Get Started?</h2>
          <p class="cta-subtitle">Join thousands of satisfied clients today</p>
          <button class="cta-button">
            <span>Start Now</span>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="footer-container">
        <div class="footer-bottom-content">
          <p class="copyright">
            &copy; {{ currentYear }} CodeMart. All rights reserved. Powered by
            <a href="#" class="powered-link">CodeMart Technology</a>
          </p>
          <div class="footer-bottom-links">
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
            <a href="#cookies">Cookie Policy</a>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const logoUrl = ref('https://placeholder-image.anthropic.com/120x40/logo');

const currentYear = computed(() => new Date().getFullYear());

const socialLinks = ref([
  {
    id: 1,
    name: 'Facebook',
    url: '#facebook',
    icon: 'https://placeholder-image.anthropic.com/32x32/facebook-icon'
  },
  {
    id: 2,
    name: 'Twitter',
    url: '#twitter',
    icon: 'https://placeholder-image.anthropic.com/32x32/twitter-icon'
  },
  {
    id: 3,
    name: 'LinkedIn',
    url: '#linkedin',
    icon: 'https://placeholder-image.anthropic.com/32x32/linkedin-icon'
  },
  {
    id: 4,
    name: 'GitHub',
    url: '#github',
    icon: 'https://placeholder-image.anthropic.com/32x32/github-icon'
  }
]);
</script>

<style scoped>
.codemart-footer {
  background: #0f172a;
  color: #cbd5e1;
}

.footer-top {
  padding: 4rem 2rem;
  border-bottom: 1px solid rgba(203, 213, 225, 0.1);
}

.footer-container {
  max-width: 1400px;
  margin: 0 auto;
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr repeat(4, 1fr);
  gap: 3rem;
}

.footer-column {
  display: flex;
  flex-direction: column;
}

.brand-column {
  max-width: 350px;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.logo {
  height: 2rem;
  width: auto;
}

.logo-text {
  font-size: 1.5rem;
  font-weight: 700;
  color: white;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-description {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: #94a3b8;
  margin: 0 0 2rem 0;
}

.social-links {
  display: flex;
  gap: 1rem;
}

.social-link {
  width: 2.5rem;
  height: 2.5rem;
  background: rgba(203, 213, 225, 0.1);
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.social-link:hover {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  transform: translateY(-3px);
}

.social-link img {
  width: 1.25rem;
  height: 1.25rem;
}

.footer-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: white;
  margin: 0 0 1.5rem 0;
}

.footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.footer-links li a {
  font-size: 0.9375rem;
  color: #94a3b8;
  text-decoration: none;
  transition: color 0.2s;
  display: inline-block;
}

.footer-links li a:hover {
  color: #6366f1;
}

.footer-contact {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.footer-contact li {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  font-size: 0.9375rem;
}

.footer-contact li svg {
  width: 1.25rem;
  height: 1.25rem;
  color: #6366f1;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.footer-contact li a {
  color: #94a3b8;
  text-decoration: none;
  transition: color 0.2s;
}

.footer-contact li a:hover {
  color: #6366f1;
}

.footer-contact li span {
  color: #94a3b8;
}

.footer-cta {
  padding: 4rem 2rem;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-bottom: 1px solid rgba(203, 213, 225, 0.1);
}

.cta-content {
  text-align: center;
  max-width: 700px;
  margin: 0 auto;
}

.cta-title {
  font-size: 2.5rem;
  font-weight: 800;
  color: white;
  margin: 0 0 1rem 0;
  line-height: 1.2;
}

.cta-subtitle {
  font-size: 1.125rem;
  color: #94a3b8;
  margin: 0 0 2.5rem 0;
}

.cta-button {
  padding: 1rem 3rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border: none;
  border-radius: 0.75rem;
  color: white;
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}

.cta-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(99, 102, 241, 0.5);
}

.cta-button svg {
  width: 1.25rem;
  height: 1.25rem;
}

.footer-bottom {
  padding: 2rem;
  background: #0a0f1a;
}

.footer-bottom-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.copyright {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
}

.powered-link {
  color: #6366f1;
  text-decoration: none;
  transition: color 0.2s;
}

.powered-link:hover {
  color: #8b5cf6;
}

.footer-bottom-links {
  display: flex;
  gap: 2rem;
}

.footer-bottom-links a {
  font-size: 0.875rem;
  color: #64748b;
  text-decoration: none;
  transition: color 0.2s;
}

.footer-bottom-links a:hover {
  color: #6366f1;
}

@media (max-width: 1024px) {
  .footer-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .brand-column {
    grid-column: 1 / -1;
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .footer-top {
    padding: 3rem 1rem;
  }

  .footer-grid {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }

  .footer-cta {
    padding: 3rem 1rem;
  }

  .cta-title {
    font-size: 2rem;
  }

  .cta-subtitle {
    font-size: 1rem;
  }

  .footer-bottom-content {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }

  .footer-bottom-links {
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem;
  }
}
</style>
