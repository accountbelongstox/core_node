const IMAGE_MODULES = import.meta.glob<string>('../../assets/images/*.webp', { eager: true, import: 'default' });
const IMAGE_DIRECTORY = '../../assets/images/';
const IMAGE_EXTENSION = '.webp';

const IMAGE_SIZES = {
  'hero-delivery': [1280, 720],
  'hero-marketplace': [1280, 720],
  'hero-escrow': [1280, 720],
  'about-mission': [960, 720],
  'service-managed': [720, 540],
  'service-marketplace': [720, 540],
  'service-review': [720, 540],
  'service-escrow': [720, 540],
  'process-overview': [1280, 720],
  'estimate-calculator': [720, 540],
  'showcase-projects': [1280, 720],
  'download-devices': [900, 675],
  'contact-support': [720, 540],
  'empty-workspace': [480, 480],
} as const;

export type CmPublicImageName = keyof typeof IMAGE_SIZES;

export interface CmPublicImageAsset {
  src: string;
  width: number;
  height: number;
}

/** Bundled public illustration by name, or null while the file is not generated yet. */
export function cmPublicImage(name: CmPublicImageName): CmPublicImageAsset | null {
  const src = IMAGE_MODULES[`${IMAGE_DIRECTORY}${name}${IMAGE_EXTENSION}`];
  if (!src) return null;
  const [width, height] = IMAGE_SIZES[name];
  return { src, width, height };
}
