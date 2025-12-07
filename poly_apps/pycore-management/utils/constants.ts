
export const SUPPORTED_IMAGE_FORMATS = ['image/png', 'image/jpeg', 'image/bmp', 'image/webp'];
export const SUPPORTED_AUDIO_FORMATS = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/flac', 'audio/x-m4a'];
export const SUPPORTED_VIDEO_FORMATS = ['video/mp4', 'video/avi', 'video/mkv', 'video/mov'];
export const SUPPORTED_DOC_FORMATS = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv'];

export const OCR_ENGINES = [
  { value: 'PaddleOCR', label: 'PaddleOCR (Recommended)' },
  { value: 'Tesseract', label: 'Tesseract' },
  { value: 'EasyOCR', label: 'EasyOCR' }
];

export const AUDIO_MODELS = [
  { value: 'tiny', label: 'Tiny (Fastest)' },
  { value: 'base', label: 'Base' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium (Balanced)' },
  { value: 'large', label: 'Large (Most Accurate)' }
];

export const VIDEO_OUTPUT_FORMATS = ['mp4', 'avi', 'mov'];
export const SUBTITLE_FORMATS = ['srt', 'vtt', 'ass'];
