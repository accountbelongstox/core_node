const IMAGE_MODULES = import.meta.glob<string>('./images/*.webp', { eager: true, import: 'default' });
const ICON_MODULES = import.meta.glob<string>('./icons/*.webp', { eager: true, import: 'default', query: '?no-inline' });
const IMAGE_DIRECTORY = './images/';
const ICON_DIRECTORY = './icons/';
const ASSET_EXTENSION = '.webp';
const ICON_SIZE = 128;

export interface CmImageSpec {
  width: number;
  height: number;
  altKey: string | null;
  lazy: boolean;
}

export interface CmImageAsset extends CmImageSpec {
  src: string;
}

const CM_IMAGE_SPECS = {
  'hero-delivery': { width: 1280, height: 720, altKey: 'publicHome.hero.slide1Alt', lazy: false },
  'hero-marketplace': { width: 1280, height: 720, altKey: 'publicHome.hero.slide2Alt', lazy: false },
  'hero-escrow': { width: 1280, height: 720, altKey: 'publicHome.hero.slide3Alt', lazy: false },
  'about-mission': { width: 960, height: 720, altKey: 'infoPages.about.intro.alt', lazy: false },
  'service-managed': { width: 720, height: 540, altKey: null, lazy: true },
  'service-marketplace': { width: 720, height: 540, altKey: null, lazy: true },
  'service-review': { width: 720, height: 540, altKey: null, lazy: true },
  'service-escrow': { width: 720, height: 540, altKey: null, lazy: true },
  'process-overview': { width: 1280, height: 720, altKey: 'infoPages.delivery.overview.alt', lazy: false },
  'estimate-calculator': { width: 720, height: 540, altKey: 'estimate.imageAlt', lazy: false },
  'showcase-projects': { width: 1280, height: 720, altKey: null, lazy: false },
  'auth-welcome': { width: 720, height: 960, altKey: null, lazy: false },
  'download-devices': { width: 900, height: 675, altKey: 'downloadPage.features.alt', lazy: true },
  'contact-support': { width: 720, height: 540, altKey: 'infoPages.information.contactAlt', lazy: false },
  'empty-workspace': { width: 480, height: 480, altKey: null, lazy: true },
  'admin-console': { width: 1280, height: 720, altKey: null, lazy: false },
} as const satisfies Record<string, CmImageSpec>;

const CM_ICON_SPECS = {
  'nav-dashboard': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.nav.dashboard', lazy: false },
  'nav-marketplace': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.nav.marketplace', lazy: false },
  'nav-projects': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.nav.projects', lazy: false },
  'nav-project-create': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.nav.projectCreate', lazy: false },
  'nav-tasks': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.nav.tasks', lazy: false },
  'nav-reviews': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.nav.reviews', lazy: false },
  'nav-architect': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.nav.architect', lazy: false },
  'nav-wallet': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.nav.wallet', lazy: false },
  'nav-verification': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.nav.verification', lazy: false },
  'nav-profile': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.nav.profile', lazy: false },
  'nav-notifications': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.nav.notifications', lazy: false },
  'nav-settings': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.nav.settings', lazy: false },
  'feature-active-projects': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.feature.activeProjects', lazy: false },
  'feature-escrow-funds': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.feature.escrowFunds', lazy: false },
  'feature-open-tasks': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.feature.openTasks', lazy: false },
  'feature-marketplace-tasks': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.feature.marketplaceTasks', lazy: false },
  'feature-pending-reviews': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.feature.pendingReviews', lazy: false },
  'feature-wallet-balance': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.feature.walletBalance', lazy: false },
  'feature-unread-notifications': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.feature.unreadNotifications', lazy: false },
  'category-simple': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.category.simple', lazy: true },
  'category-medium': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.category.medium', lazy: true },
  'category-complex': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.category.complex', lazy: true },
  'category-very-complex': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.category.veryComplex', lazy: true },
  'empty-projects': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.empty.projects', lazy: true },
  'empty-tasks': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.empty.tasks', lazy: true },
  'empty-reviews': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.empty.reviews', lazy: true },
  'empty-notifications': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.empty.notifications', lazy: true },
  'empty-work': { width: ICON_SIZE, height: ICON_SIZE, altKey: 'icons.empty.work', lazy: true },
} as const satisfies Record<string, CmImageSpec>;

export type CmImageName = keyof typeof CM_IMAGE_SPECS;
export type CmIconName = keyof typeof CM_ICON_SPECS;

function resolveAsset(modules: Record<string, string>, directory: string, name: string, spec: CmImageSpec): CmImageAsset | null {
  const src = modules[`${directory}${name}${ASSET_EXTENSION}`];
  return src ? { ...spec, src } : null;
}

export function cmImage(name: CmImageName): CmImageAsset | null {
  return resolveAsset(IMAGE_MODULES, IMAGE_DIRECTORY, name, CM_IMAGE_SPECS[name]);
}

export function cmIcon(name: CmIconName): CmImageAsset | null {
  return resolveAsset(ICON_MODULES, ICON_DIRECTORY, name, CM_ICON_SPECS[name]);
}
