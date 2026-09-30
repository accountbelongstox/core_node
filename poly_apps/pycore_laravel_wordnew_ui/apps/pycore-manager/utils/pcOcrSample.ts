/** Renders sample text into a PNG data URL: the OCR test image when none is uploaded. */

const SAMPLE_WIDTH = 520;
const SAMPLE_HEIGHT = 180;
const SAMPLE_FONT = '30px sans-serif';
const SAMPLE_PADDING_X = 18;
const SAMPLE_PADDING_Y = 16;
const SAMPLE_LINE_HEIGHT = 40;

export function renderTextToPng(text: string): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_WIDTH;
  canvas.height = SAMPLE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  context.fillStyle = '#111111';
  context.font = SAMPLE_FONT;
  context.textBaseline = 'top';
  text.split('\n').forEach((line, index) => {
    context.fillText(line, SAMPLE_PADDING_X, SAMPLE_PADDING_Y + index * SAMPLE_LINE_HEIGHT);
  });
  return canvas.toDataURL('image/png');
}
