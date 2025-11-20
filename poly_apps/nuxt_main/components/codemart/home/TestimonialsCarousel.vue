<template>
  <section class="testimonials-section">
    <div class="testimonials-container">
      <div class="section-header">
        <h2 class="section-title">What Others Say</h2>
        <p class="section-subtitle">Trusted by thousands of clients worldwide</p>
      </div>

      <div class="carousel-wrapper">
        <button class="carousel-nav-btn prev" @click="prevTestimonial">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>

        <div class="testimonials-track">
          <div
            class="testimonials-slides"
            :style="{ transform: `translateX(-${currentIndex * 100}%)` }"
          >
            <div
              v-for="testimonial in testimonials"
              :key="testimonial.id"
              class="testimonial-card"
            >
              <div class="quote-icon">
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                </svg>
              </div>

              <p class="testimonial-text">{{ testimonial.content }}</p>

              <div class="testimonial-footer">
                <div class="author-info">
                  <img :src="testimonial.avatar" :alt="testimonial.name" class="author-avatar">
                  <div class="author-details">
                    <h4 class="author-name">{{ testimonial.name }}</h4>
                    <p class="author-role">{{ testimonial.role }}</p>
                  </div>
                </div>

                <div class="rating">
                  <svg
                    v-for="star in 5"
                    :key="star"
                    class="star-icon"
                    :class="{ filled: star <= testimonial.rating }"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button class="carousel-nav-btn next" @click="nextTestimonial">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>

      <div class="carousel-dots">
        <button
          v-for="(testimonial, index) in visibleDots"
          :key="testimonial.id"
          class="dot"
          :class="{ active: index === currentIndex }"
          @click="goToTestimonial(index)"
        ></button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const currentIndex = ref(0);

const testimonials = ref([
  {
    id: 1,
    content: 'The development team was incredibly professional and delivered our e-commerce platform ahead of schedule. The quality exceeded our expectations and their communication throughout the project was outstanding.',
    name: 'Sarah Johnson',
    role: 'CEO, TechStart Inc',
    avatar: 'https://placeholder-image.anthropic.com/100x100/person-female-1',
    rating: 5
  },
  {
    id: 2,
    content: 'Working with this platform has been a game-changer for our business. They matched us with talented developers who understood our vision perfectly and brought it to life with exceptional skill.',
    name: 'Michael Chen',
    role: 'Founder, Digital Solutions',
    avatar: 'https://placeholder-image.anthropic.com/100x100/person-male-1',
    rating: 5
  },
  {
    id: 3,
    content: 'Outstanding service from start to finish. The escrow system gave us peace of mind, and the quality assurance process ensured we got exactly what we needed. Highly recommend!',
    name: 'Emily Rodriguez',
    role: 'Product Manager, CloudApps',
    avatar: 'https://placeholder-image.anthropic.com/100x100/person-female-2',
    rating: 5
  },
  {
    id: 4,
    content: 'The agile development approach and regular updates kept us informed every step of the way. The final product was polished, performant, and exactly what we envisioned.',
    name: 'David Kim',
    role: 'CTO, Innovation Labs',
    avatar: 'https://placeholder-image.anthropic.com/100x100/person-male-2',
    rating: 5
  }
]);

const visibleDots = computed(() => testimonials.value.slice(0, 3));

const nextTestimonial = () => {
  currentIndex.value = (currentIndex.value + 1) % visibleDots.value.length;
};

const prevTestimonial = () => {
  currentIndex.value = currentIndex.value === 0
    ? visibleDots.value.length - 1
    : currentIndex.value - 1;
};

const goToTestimonial = (index: number) => {
  currentIndex.value = index;
};
</script>

<style scoped>
.testimonials-section {
  background: linear-gradient(135deg, #f1f5f9 0%, #e0e7ff 100%);
  padding: 6rem 2rem;
}

.testimonials-container {
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

.carousel-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2rem;
  margin-bottom: 3rem;
}

.carousel-nav-btn {
  flex-shrink: 0;
  width: 3rem;
  height: 3rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.carousel-nav-btn:hover {
  background: #6366f1;
  color: white;
  border-color: #6366f1;
  transform: scale(1.1);
}

.carousel-nav-btn svg {
  width: 1.5rem;
  height: 1.5rem;
}

.testimonials-track {
  flex: 1;
  overflow: hidden;
  border-radius: 1.5rem;
}

.testimonials-slides {
  display: flex;
  transition: transform 0.5s ease-in-out;
}

.testimonial-card {
  min-width: 100%;
  background: white;
  border-radius: 1.5rem;
  padding: 3rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
  position: relative;
}

.quote-icon {
  width: 3rem;
  height: 3rem;
  color: #e0e7ff;
  margin-bottom: 1.5rem;
}

.quote-icon svg {
  width: 100%;
  height: 100%;
}

.testimonial-text {
  font-size: 1.125rem;
  line-height: 1.8;
  color: #475569;
  margin: 0 0 2rem 0;
  min-height: 8rem;
}

.testimonial-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e2e8f0;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.author-avatar {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #e0e7ff;
}

.author-details {
  flex: 1;
}

.author-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.25rem 0;
}

.author-role {
  font-size: 0.9375rem;
  color: #64748b;
  margin: 0;
}

.rating {
  display: flex;
  gap: 0.25rem;
}

.star-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #cbd5e1;
  transition: color 0.2s;
}

.star-icon.filled {
  color: #fbbf24;
}

.carousel-dots {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}

.dot {
  width: 0.75rem;
  height: 0.75rem;
  background: rgba(99, 102, 241, 0.3);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s;
}

.dot:hover {
  background: rgba(99, 102, 241, 0.5);
}

.dot.active {
  width: 2rem;
  background: #6366f1;
  border-radius: 0.5rem;
}

@media (max-width: 1024px) {
  .section-title {
    font-size: 2rem;
  }

  .testimonial-card {
    padding: 2rem;
  }

  .testimonial-text {
    font-size: 1rem;
    min-height: 7rem;
  }
}

@media (max-width: 768px) {
  .testimonials-section {
    padding: 4rem 1rem;
  }

  .carousel-wrapper {
    flex-direction: column;
    gap: 1.5rem;
  }

  .carousel-nav-btn {
    width: 2.5rem;
    height: 2.5rem;
  }

  .carousel-nav-btn.prev,
  .carousel-nav-btn.next {
    position: absolute;
    z-index: 10;
  }

  .carousel-nav-btn.prev {
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
  }

  .carousel-nav-btn.next {
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
  }

  .carousel-nav-btn:hover {
    transform: translateY(-50%) scale(1.1);
  }

  .carousel-nav-btn.prev:hover {
    transform: translateY(-50%) scale(1.1);
  }

  .testimonials-track {
    width: 100%;
  }

  .testimonial-card {
    padding: 1.5rem;
  }

  .testimonial-text {
    font-size: 0.9375rem;
    min-height: auto;
    margin-bottom: 1.5rem;
  }

  .testimonial-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding-top: 1.5rem;
  }

  .author-avatar {
    width: 3rem;
    height: 3rem;
  }

  .author-name {
    font-size: 1rem;
  }

  .author-role {
    font-size: 0.875rem;
  }
}
</style>
