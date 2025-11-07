<template>
  <div class="step-kyc-verify">
    <h2>Identity Verification</h2>
    <p class="subtitle">Upload documents to verify your identity</p>

    <form @submit.prevent="handleSubmit">
      <!-- Identity Type Selection -->
      <div class="form-group">
        <label>Document Type *</label>
        <div class="document-types">
          <div
            v-for="type in documentTypes"
            :key="type.value"
            :class="['type-option', { selected: form.identity_type === type.value }]"
            @click="form.identity_type = type.value"
          >
            <div class="type-icon">{{ type.icon }}</div>
            <div class="type-name">{{ type.label }}</div>
          </div>
        </div>
      </div>

      <!-- Identity Number -->
      <div class="form-group">
        <label for="identityNumber">{{ identityNumberLabel }} *</label>
        <input
          id="identityNumber"
          v-model="form.identity_number"
          type="text"
          placeholder="Enter document number"
          required
        />
      </div>

      <!-- Full Name -->
      <div class="form-group">
        <label for="realName">Full Name (as shown on document) *</label>
        <input
          id="realName"
          v-model="form.real_name"
          type="text"
          placeholder="Your full name"
          required
        />
      </div>

      <!-- Date of Birth -->
      <div class="form-group">
        <label for="dateOfBirth">Date of Birth *</label>
        <input
          id="dateOfBirth"
          v-model="form.date_of_birth"
          type="date"
          required
        />
      </div>

      <!-- Front Document Image -->
      <div class="form-group">
        <label>Document Front Photo *</label>
        <div class="image-upload">
          <div
            v-if="!frontImage"
            class="upload-placeholder"
            @click="frontImageInput?.click()"
          >
            <div class="upload-icon">📸</div>
            <p>Click or drag to upload front side</p>
            <p class="hint">JPG, PNG (Max 5MB)</p>
          </div>
          <div v-else class="image-preview">
            <img :src="frontImagePreview" alt="Front document" />
            <button type="button" class="btn-remove" @click="removeImage('front')">
              ✕
            </button>
          </div>
          <input
            ref="frontImageInput"
            type="file"
            accept="image/jpeg,image/png"
            style="display: none"
            @change="handleFrontImageSelect"
          />
        </div>
      </div>

      <!-- Back Document Image (if ID_CARD) -->
      <div v-if="form.identity_type === 'ID_CARD'" class="form-group">
        <label>Document Back Photo *</label>
        <div class="image-upload">
          <div
            v-if="!backImage"
            class="upload-placeholder"
            @click="backImageInput?.click()"
          >
            <div class="upload-icon">📸</div>
            <p>Click or drag to upload back side</p>
            <p class="hint">JPG, PNG (Max 5MB)</p>
          </div>
          <div v-else class="image-preview">
            <img :src="backImagePreview" alt="Back document" />
            <button type="button" class="btn-remove" @click="removeImage('back')">
              ✕
            </button>
          </div>
          <input
            ref="backImageInput"
            type="file"
            accept="image/jpeg,image/png"
            style="display: none"
            @change="handleBackImageSelect"
          />
        </div>
      </div>

      <!-- Selfie Image -->
      <div class="form-group">
        <label>Selfie Photo *</label>
        <div class="image-upload">
          <div
            v-if="!selfieImage"
            class="upload-placeholder"
            @click="selfieImageInput?.click()"
          >
            <div class="upload-icon">🤳</div>
            <p>Click or drag to upload selfie</p>
            <p class="hint">JPG, PNG (Max 5MB)</p>
          </div>
          <div v-else class="image-preview">
            <img :src="selfieImagePreview" alt="Selfie" />
            <button type="button" class="btn-remove" @click="removeImage('selfie')">
              ✕
            </button>
          </div>
          <input
            ref="selfieImageInput"
            type="file"
            accept="image/jpeg,image/png"
            style="display: none"
            @change="handleSelfieImageSelect"
          />
        </div>
      </div>

      <!-- Upload Progress -->
      <div v-if="uploadProgress > 0 && uploadProgress < 100" class="progress">
        <div class="progress-bar" :style="{ width: uploadProgress + '%' }"></div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="error-message">
        {{ error.message }}
      </div>

      <!-- Terms -->
      <div class="form-group checkbox">
        <input
          id="terms"
          v-model="form.agreedToKycTerms"
          type="checkbox"
          required
        />
        <label for="terms">
          I confirm that the documents I'm uploading are genuine and accurate
        </label>
      </div>

      <!-- Submit Button -->
      <button type="submit" class="btn btn-primary btn-block" :disabled="loading || !isFormValid">
        <span v-if="!loading">Upload Documents</span>
        <span v-else>Uploading...</span>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface ErrorType {
  field?: string;
  message: string;
}

interface KycForm {
  identity_type: 'ID_CARD' | 'PASSPORT' | 'DRIVING_LICENSE';
  identity_number: string;
  real_name: string;
  date_of_birth: string;
  agreedToKycTerms: boolean;
}

const props = defineProps<{
  loading: boolean;
  error: ErrorType | null;
  uploadProgress: number;
}>();

const emit = defineEmits<{
  upload: [data: any];
}>();

const form = ref<KycForm>({
  identity_type: 'ID_CARD',
  identity_number: '',
  real_name: '',
  date_of_birth: '',
  agreedToKycTerms: false,
});

const frontImage = ref<File | null>(null);
const backImage = ref<File | null>(null);
const selfieImage = ref<File | null>(null);
const frontImagePreview = ref('');
const backImagePreview = ref('');
const selfieImagePreview = ref('');

const frontImageInput = ref<HTMLInputElement>();
const backImageInput = ref<HTMLInputElement>();
const selfieImageInput = ref<HTMLInputElement>();

const documentTypes = [
  { value: 'ID_CARD', label: 'ID Card', icon: '🪪' },
  { value: 'PASSPORT', label: 'Passport', icon: '📕' },
  { value: 'DRIVING_LICENSE', label: 'Driving License', icon: '🚗' },
];

const identityNumberLabel = computed(() => {
  const type = documentTypes.find(t => t.value === form.value.identity_type);
  return type?.label || 'Document Number';
});

const isFormValid = computed(() => {
  const hasBasicInfo = form.value.identity_number && form.value.real_name && form.value.date_of_birth;
  const hasFront = frontImage.value !== null;
  const hasBack = form.value.identity_type === 'ID_CARD' ? backImage.value !== null : true;
  const hasSelfie = selfieImage.value !== null;
  const agreedTerms = form.value.agreedToKycTerms;

  return hasBasicInfo && hasFront && hasBack && hasSelfie && agreedTerms;
});

const handleFrontImageSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    frontImage.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      frontImagePreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};

const handleBackImageSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    backImage.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      backImagePreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};

const handleSelfieImageSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    selfieImage.value = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      selfieImagePreview.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};

const removeImage = (type: 'front' | 'back' | 'selfie') => {
  if (type === 'front') {
    frontImage.value = null;
    frontImagePreview.value = '';
  } else if (type === 'back') {
    backImage.value = null;
    backImagePreview.value = '';
  } else if (type === 'selfie') {
    selfieImage.value = null;
    selfieImagePreview.value = '';
  }
};

const handleSubmit = async () => {
  if (!isFormValid.value) {
    alert('Please complete all required fields');
    return;
  }

  emit('upload', {
    identity_type: form.value.identity_type,
    identity_number: form.value.identity_number,
    real_name: form.value.real_name,
    date_of_birth: form.value.date_of_birth,
    id_front_image: frontImage.value,
    id_back_image: backImage.value,
    selfie_image: selfieImage.value,
  });
};
</script>

<style scoped lang="css">
.step-kyc-verify {
  max-width: 600px;
}

.step-kyc-verify h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 10px;
  color: #1a1a1a;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin-bottom: 30px;
}

.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.form-group input[type="text"],
.form-group input[type="date"] {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.document-types {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.type-option {
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.type-option:hover {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.05);
}

.type-option.selected {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.1);
}

.type-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.type-name {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.image-upload {
  border: 2px dashed #ddd;
  border-radius: 6px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.upload-placeholder {
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  background: #f9f9f9;
  transition: all 0.3s ease;
}

.image-upload:hover .upload-placeholder {
  border-color: #007bff;
  background: rgba(0, 123, 255, 0.05);
}

.upload-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.upload-placeholder p {
  font-size: 14px;
  color: #333;
  margin: 0 0 8px 0;
}

.upload-placeholder .hint {
  font-size: 12px;
  color: #999;
  margin: 0;
}

.image-preview {
  position: relative;
  width: 100%;
  height: 200px;
  background: #f5f5f5;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.btn-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-remove:hover {
  background: rgba(0, 0, 0, 0.8);
}

.progress {
  width: 100%;
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 20px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #0056b3);
  transition: width 0.3s ease;
}

.form-group.checkbox {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 24px;
}

.form-group.checkbox input[type="checkbox"] {
  width: auto;
  margin-top: 3px;
}

.form-group.checkbox label {
  margin: 0;
  font-size: 13px;
  color: #666;
  cursor: pointer;
}

.error-message {
  padding: 12px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  color: #c00;
  font-size: 14px;
  margin-bottom: 20px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-block {
  width: 100%;
}
</style>
