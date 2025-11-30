<template>
  <section class="hero-carousel">
    <div class="carousel-container">
      <div
        v-for="(slide, index) in slides"
        :key="slide.id"
        class="slide"
        :class="{ active: currentSlide === index }"
      >
        <div class="slide-background">
          <img :src="slide.backgroundImage" :alt="slide.title" class="background-image">
          <div class="overlay"></div>
        </div>

        <div class="slide-content">
          <h1 class="hero-title">{{ slide.title }}</h1>
          <p class="hero-subtitle">{{ slide.subtitle }}</p>

          <div class="hero-actions">
            <button class="primary-action-btn">
              <span>{{ slide.primaryAction }}</span>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
              </svg>
            </button>
            <button class="secondary-action-btn">
              {{ slide.secondaryAction }}
            </button>
          </div>
        </div>
      </div>

      <div class="carousel-nav">
        <button class="nav-arrow prev" @click="prevSlide">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>

        <div class="carousel-dots">
          <button
            v-for="(slide, index) in slides"
            :key="slide.id"
            class="dot"
            :class="{ active: currentSlide === index }"
            @click="goToSlide(index)"
          ></button>
        </div>

        <button class="nav-arrow next" @click="nextSlide">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const currentSlide = ref(0);
let autoplayInterval: ReturnType<typeof setInterval> | null = null;

const slides = ref([
  {
    id: 1,
    title: 'Internet Software Outsourcing Service Platform',
    subtitle: 'Professional team to provide you with high quality software development services',
    primaryAction: 'Start Now',
    secondaryAction: 'View Projects',
    backgroundImage: 'https://placeholder-image.anthropic.com/1920x800/mountain-lake'
  },
  {
    id: 2,
    title: 'Custom Software Development Solutions',
    subtitle: 'Transform your ideas into powerful digital products',
    primaryAction: 'Get Started',
    secondaryAction: 'Learn More',
    backgroundImage: 'https://placeholder-image.anthropic.com/1920x800/tech-office'
  },
  {
    id: 3,
    title: 'Professional Team, Quality Assurance',
    subtitle: 'Years of experience delivering excellence in every project',
    primaryAction: 'Contact Us',
    secondaryAction: 'Our Services',
    backgroundImage: 'https://placeholder-image.anthropic.com/1920x800/team-work'
  }
]);

const nextSlide = () => {
  currentSlide.value = (currentSlide.value + 1) % slides.value.length;
};

const prevSlide = () => {
  currentSlide.value = currentSlide.value === 0 ? slides.value.length - 1 : currentSlide.value - 1;
};

const goToSlide = (index: number) => {
  currentSlide.value = index;
};

const startAutoplay = () => {
  autoplayInterval = setInterval(() => {
    nextSlide();
  }, 5000);
};

const stopAutoplay = () => {
  if (autoplayInterval) {
    clearInterval(autoplayInterval);
    autoplayInterval = null;
  }
};

onMounted(() => {
  startAutoplay();
});

onUnmounted(() => {
  stopAutoplay();
});
</script>

<style scoped>
.hero-carousel {
  position: relative;
  width: 100%;
  height: 600px;
  margin-top: 70px;
  overflow: hidden;
}

.carousel-container {
  position: relative;
  width: 100%;
  height: 100%;
}

.slide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 0.8s ease-in-out;
  pointer-events: none;
}

.slide.active {
  opacity: 1;
  pointer-events: auto;
}

.slide-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.background-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    135deg,
    rgba(30, 41, 59, 0.8) 0%,
    rgba(30, 41, 59, 0.6) 100%
  );
}

.slide-content {
  position: relative;
  height: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  z-index: 10;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 800;
  color: white;
  margin: 0 0 1.5rem 0;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  line-height: 1.2;
  max-width: 900px;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 3rem 0;
  max-width: 700px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.primary-action-btn {
  padding: 1rem 2.5rem;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  border-radius: 0.75rem;
  color: white;
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.primary-action-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(59, 130, 246, 0.5);
}

.primary-action-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

.secondary-action-btn {
  padding: 1rem 2.5rem;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 0.75rem;
  color: white;
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.secondary-action-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.8);
  transform: translateY(-3px);
}

.carousel-nav {
  position: absolute;
  bottom: 3rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2rem;
  z-index: 20;
}

.nav-arrow {
  width: 3rem;
  height: 3rem;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  color: white;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-arrow:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.nav-arrow svg {
  width: 1.5rem;
  height: 1.5rem;
}

.carousel-dots {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.dot {
  width: 0.75rem;
  height: 0.75rem;
  background: rgba(255, 255, 255, 0.4);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s;
}

.dot:hover {
  background: rgba(255, 255, 255, 0.6);
}

.dot.active {
  width: 2rem;
  background: white;
  border-radius: 0.5rem;
}

@media (max-width: 1024px) {
  .hero-carousel {
    height: 500px;
  }

  .hero-title {
    font-size: 2.5rem;
  }

  .hero-subtitle {
    font-size: 1.125rem;
  }
}

@media (max-width: 640px) {
  .hero-carousel {
    height: 400px;
    margin-top: 60px;
  }

  .slide-content {
    padding: 0 1rem;
  }

  .hero-title {
    font-size: 1.75rem;
  }

  .hero-subtitle {
    font-size: 1rem;
    margin-bottom: 2rem;
  }

  .hero-actions {
    flex-direction: column;
    gap: 1rem;
    width: 100%;
  }

  .primary-action-btn,
  .secondary-action-btn {
    width: 100%;
    padding: 0.875rem 2rem;
    font-size: 1rem;
  }

  .carousel-nav {
    bottom: 2rem;
  }

  .nav-arrow {
    width: 2.5rem;
    height: 2.5rem;
  }
}
</style>
