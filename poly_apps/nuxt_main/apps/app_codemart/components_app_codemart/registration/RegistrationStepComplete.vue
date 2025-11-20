<template>
  <div class="step-complete">
    <div class="success-animation">
      <div class="checkmark">✓</div>
    </div>

    <h2>Welcome to CodeMart!</h2>
    <p class="subtitle">Your registration is complete</p>

    <div class="success-message">
      <p>Congratulations, <strong>{{ username }}</strong>!</p>
      <p>Your account has been successfully created and verified. You're now ready to join the CodeMart platform.</p>
    </div>

    <div class="features">
      <h3>What You Can Do Now</h3>
      <div class="feature-list">
        <div class="feature-item">
          <span class="feature-icon">🚀</span>
          <div>
            <div class="feature-title">Start Working</div>
            <p class="feature-desc">Browse available projects and start earning</p>
          </div>
        </div>
        <div class="feature-item">
          <span class="feature-icon">👥</span>
          <div>
            <div class="feature-title">Build Your Profile</div>
            <p class="feature-desc">Add skills and portfolio to attract clients</p>
          </div>
        </div>
        <div class="feature-item">
          <span class="feature-icon">💰</span>
          <div>
            <div class="feature-title">Manage Deposits</div>
            <p class="feature-desc">View and manage your account balance</p>
          </div>
        </div>
        <div class="feature-item">
          <span class="feature-icon">📊</span>
          <div>
            <div class="feature-title">Track Progress</div>
            <p class="feature-desc">Monitor your projects and earnings</p>
          </div>
        </div>
      </div>
    </div>

    <button class="btn btn-primary btn-block" @click="handleContinue">
      Go to Dashboard
    </button>

    <div class="next-steps">
      <h4>Recommended Next Steps</h4>
      <ul>
        <li>Complete your profile with a profile picture</li>
        <li>Add your skills and expertise</li>
        <li>Review platform guidelines and best practices</li>
        <li>Start browsing available projects</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  username?: string;
}>();

const emit = defineEmits<{
  continue: [];
}>();

const handleContinue = () => {
  emit('continue');
};
</script>

<style scoped lang="css">
.step-complete {
  max-width: 500px;
  text-align: center;
}

.success-animation {
  margin-bottom: 30px;
}

.checkmark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  font-size: 48px;
  font-weight: 600;
  animation: scaleIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes scaleIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.step-complete h2 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #1a1a1a;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin-bottom: 30px;
}

.success-message {
  background: #e8f5e9;
  border: 1px solid #c8e6c9;
  border-radius: 6px;
  padding: 20px;
  margin-bottom: 30px;
  text-align: left;
}

.success-message p {
  font-size: 14px;
  color: #2e7d32;
  margin: 0 0 8px 0;
}

.success-message strong {
  font-weight: 600;
}

.features {
  text-align: left;
  margin-bottom: 30px;
}

.features h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #333;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
}

.feature-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.feature-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.feature-desc {
  font-size: 12px;
  color: #666;
  margin: 0;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
  margin-bottom: 30px;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.next-steps {
  text-align: left;
  background: #f9f9f9;
  padding: 20px;
  border-radius: 6px;
}

.next-steps h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #333;
}

.next-steps ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.next-steps li {
  font-size: 13px;
  color: #666;
  padding-left: 20px;
  margin-bottom: 8px;
  position: relative;
}

.next-steps li:before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #28a745;
  font-weight: 600;
}
</style>
