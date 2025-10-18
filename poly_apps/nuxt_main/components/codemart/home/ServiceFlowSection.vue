<template>
  <section class="service-flow-section">
    <div class="section-container">
      <div class="section-header">
        <h2 class="section-title">Code Market Trading Service Process</h2>
        <p class="section-subtitle">Simple and efficient collaboration process</p>
      </div>

      <div class="service-grid">
        <div
          v-for="service in services"
          :key="service.id"
          class="service-card"
        >
          <div class="service-icon" :style="{ background: service.iconBg }">
            <img :src="service.icon" :alt="service.title">
          </div>
          <h3 class="service-title">{{ service.title }}</h3>
          <p class="service-description">{{ service.description }}</p>
          <button class="service-link">
            Learn More
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="process-steps">
        <h3 class="steps-title">How It Works</h3>
        <div class="steps-grid">
          <div
            v-for="(step, index) in processSteps"
            :key="step.id"
            class="step-item"
          >
            <div class="step-number">{{ index + 1 }}</div>
            <div class="step-content">
              <h4 class="step-title">{{ step.title }}</h4>
              <p class="step-description">{{ step.description }}</p>
            </div>
            <div v-if="index < processSteps.length - 1" class="step-connector"></div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const services = ref([
  {
    id: 1,
    title: 'Post Requirements',
    description: 'Describe your project requirements and specifications',
    icon: 'https://placeholder-image.anthropic.com/80x80/computer-icon',
    iconBg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
  },
  {
    id: 2,
    title: 'Confirm Cooperation',
    description: 'Review proposals and select the best developer',
    icon: 'https://placeholder-image.anthropic.com/80x80/handshake-icon',
    iconBg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)'
  },
  {
    id: 3,
    title: 'Fund Management',
    description: 'Secure payment through our escrow system',
    icon: 'https://placeholder-image.anthropic.com/80x80/piggy-bank-icon',
    iconBg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
  },
  {
    id: 4,
    title: 'No Worry Payment',
    description: 'Pay only when you are satisfied with the work',
    icon: 'https://placeholder-image.anthropic.com/80x80/shield-icon',
    iconBg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
  },
  {
    id: 5,
    title: 'Quality Assurance',
    description: 'Complete testing and quality guarantee',
    icon: 'https://placeholder-image.anthropic.com/80x80/check-icon',
    iconBg: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)'
  }
]);

const processSteps = ref([
  {
    id: 1,
    title: 'Requirements Analysis',
    description: 'Submit your project details and requirements'
  },
  {
    id: 2,
    title: 'Team Assignment',
    description: 'We match you with the perfect development team'
  },
  {
    id: 3,
    title: 'Development',
    description: 'Agile development with regular updates'
  },
  {
    id: 4,
    title: 'Delivery',
    description: 'Quality assurance and final delivery'
  }
]);
</script>

<style scoped>
.service-flow-section {
  background: white;
  padding: 6rem 2rem;
}

.section-container {
  max-width: 1400px;
  margin: 0 auto;
}

.section-header {
  text-align: center;
  margin-bottom: 4rem;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 800;
  color: #1e293b;
  margin: 0 0 1rem 0;
  line-height: 1.2;
}

.section-subtitle {
  font-size: 1.125rem;
  color: #64748b;
  margin: 0;
}

.service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  margin-bottom: 6rem;
}

.service-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 1.5rem;
  padding: 2rem;
  text-align: center;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.service-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 0;
}

.service-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  border-color: transparent;
}

.service-card:hover::before {
  opacity: 0.05;
}

.service-card > * {
  position: relative;
  z-index: 1;
}

.service-icon {
  width: 5rem;
  height: 5rem;
  margin: 0 auto 1.5rem;
  border-radius: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.service-icon img {
  width: 3rem;
  height: 3rem;
  object-fit: contain;
}

.service-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 1rem 0;
}

.service-description {
  font-size: 0.9375rem;
  color: #64748b;
  line-height: 1.6;
  margin: 0 0 1.5rem 0;
  min-height: 3rem;
}

.service-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  color: #6366f1;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.service-link:hover {
  gap: 0.75rem;
}

.service-link svg {
  width: 1rem;
  height: 1rem;
  transition: transform 0.2s;
}

.service-link:hover svg {
  transform: translateX(4px);
}

.process-steps {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-radius: 2rem;
  padding: 4rem 3rem;
}

.steps-title {
  font-size: 2rem;
  font-weight: 800;
  color: #1e293b;
  text-align: center;
  margin: 0 0 3rem 0;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  position: relative;
}

.step-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.step-number {
  width: 4rem;
  height: 4rem;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 800;
  margin-bottom: 1.5rem;
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
  position: relative;
  z-index: 2;
}

.step-content {
  flex: 1;
}

.step-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.75rem 0;
}

.step-description {
  font-size: 0.9375rem;
  color: #64748b;
  margin: 0;
  line-height: 1.6;
}

.step-connector {
  display: none;
}

@media (min-width: 1024px) {
  .steps-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .step-connector {
    display: block;
    position: absolute;
    top: 2rem;
    left: calc(50% + 2rem);
    width: calc(100% - 4rem);
    height: 2px;
    background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
    opacity: 0.3;
    z-index: 1;
  }

  .step-item:last-child .step-connector {
    display: none;
  }
}

@media (max-width: 768px) {
  .service-flow-section {
    padding: 4rem 1rem;
  }

  .section-title {
    font-size: 2rem;
  }

  .section-subtitle {
    font-size: 1rem;
  }

  .service-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-bottom: 4rem;
  }

  .process-steps {
    padding: 3rem 1.5rem;
  }

  .steps-title {
    font-size: 1.5rem;
  }

  .steps-grid {
    gap: 2.5rem;
  }
}
</style>
