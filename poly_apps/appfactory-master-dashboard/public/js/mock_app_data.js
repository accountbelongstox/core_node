/**
 * Mock App Data with Encrypted Assets
 *
 * 5 mock applications, each with:
 * - app_icon{N}.en.js (encrypted icon)
 * - app_splash{N}.en.js (encrypted splash screen)
 *
 * Usage:
 *   import { MOCK_APPS, loadAppAssets } from './mock_app_data.js';
 *   const app1 = MOCK_APPS[0];
 *   const assets = await loadAppAssets(1);
 */

const MOCK_APPS = [
    {
        id: 'app1',
        name: 'Photo Gallery Pro',
        description: 'Professional photo management and editing suite',
        version: '2.5.1',
        category: 'Photography',
        size: '145 MB',
        rating: 4.8,
        downloads: '1M+',
        developer: 'Creative Studios Inc.',
        icon: '/app_icon1.en.js',
        splash: '/app_splash1.en.js',
        features: [
            'AI-powered photo enhancement',
            'Cloud storage integration',
            'Advanced editing tools',
            'Social media sharing'
        ],
        screenshots: 5,
        lastUpdated: '2025-01-03'
    },
    {
        id: 'app2',
        name: 'Task Master',
        description: 'Complete task management and productivity tool',
        version: '1.8.0',
        category: 'Productivity',
        size: '52 MB',
        rating: 4.6,
        downloads: '500K+',
        developer: 'Productivity Labs',
        icon: '/app_icon2.en.js',
        splash: '/app_splash2.en.js',
        features: [
            'Smart task prioritization',
            'Team collaboration',
            'Calendar integration',
            'Offline mode support'
        ],
        screenshots: 4,
        lastUpdated: '2025-01-01'
    },
    {
        id: 'app3',
        name: 'Fitness Tracker Plus',
        description: 'Track your fitness journey with AI coaching',
        version: '3.2.1',
        category: 'Health & Fitness',
        size: '89 MB',
        rating: 4.7,
        downloads: '2M+',
        developer: 'HealthTech Solutions',
        icon: '/app_icon3.en.js',
        splash: '/app_splash3.en.js',
        features: [
            'AI personal trainer',
            'Nutrition tracking',
            'Workout plans',
            'Progress analytics'
        ],
        screenshots: 6,
        lastUpdated: '2024-12-28'
    },
    {
        id: 'app4',
        name: 'Music Studio',
        description: 'Professional music production on mobile',
        version: '4.0.2',
        category: 'Music',
        size: '213 MB',
        rating: 4.9,
        downloads: '750K+',
        developer: 'AudioPro Technologies',
        icon: '/app_icon4.en.js',
        splash: '/app_splash4.en.js',
        features: [
            'Multi-track recording',
            '100+ virtual instruments',
            'Professional effects',
            'Export to all formats'
        ],
        screenshots: 8,
        lastUpdated: '2025-01-02'
    },
    {
        id: 'app5',
        name: 'Travel Planner',
        description: 'Plan perfect trips with AI recommendations',
        version: '2.1.3',
        category: 'Travel',
        size: '67 MB',
        rating: 4.5,
        downloads: '300K+',
        developer: 'WanderTech Ltd.',
        icon: '/app_icon5.en.js',
        splash: '/app_splash5.en.js',
        features: [
            'AI itinerary planning',
            'Offline maps',
            'Hotel & flight booking',
            'Local recommendations'
        ],
        screenshots: 5,
        lastUpdated: '2024-12-30'
    }
];

const ENCRYPTED_ASSET_MAPPINGS = {
    1: { icon: '/app_icon1.en.js', splash: '/app_splash1.en.js' },
    2: { icon: '/app_icon2.en.js', splash: '/app_splash2.en.js' },
    3: { icon: '/app_icon3.en.js', splash: '/app_splash3.en.js' },
    4: { icon: '/app_icon4.en.js', splash: '/app_splash4.en.js' },
    5: { icon: '/app_icon5.en.js', splash: '/app_splash5.en.js' }
};

async function loadAppAssets(appIndex, assetsManager) {
    if (appIndex < 1 || appIndex > 5) {
        throw new Error('App index must be between 1 and 5');
    }

    if (!assetsManager) {
        assetsManager = new EncryptedAppAssetsManager();
    }

    const mapping = ENCRYPTED_ASSET_MAPPINGS[appIndex];

    const [icon, splash] = await Promise.all([
        assetsManager.loadEncryptedFile(mapping.icon),
        assetsManager.loadEncryptedFile(mapping.splash)
    ]);

    return {
        appIndex,
        app: MOCK_APPS[appIndex - 1],
        icon: icon.blobUrl,
        splash: splash.blobUrl
    };
}

async function loadAllAppAssets(assetsManager) {
    if (!assetsManager) {
        assetsManager = new EncryptedAppAssetsManager();
    }

    const promises = MOCK_APPS.map((_, index) =>
        loadAppAssets(index + 1, assetsManager)
    );

    return await Promise.all(promises);
}

function getAppByIndex(index) {
    if (index < 1 || index > 5) {
        throw new Error('App index must be between 1 and 5');
    }
    return MOCK_APPS[index - 1];
}

function getAppById(id) {
    return MOCK_APPS.find(app => app.id === id);
}

if (typeof window !== 'undefined') {
    window.MOCK_APPS = MOCK_APPS;
    window.ENCRYPTED_ASSET_MAPPINGS = ENCRYPTED_ASSET_MAPPINGS;
    window.loadAppAssets = loadAppAssets;
    window.loadAllAppAssets = loadAllAppAssets;
    window.getAppByIndex = getAppByIndex;
    window.getAppById = getAppById;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MOCK_APPS,
        ENCRYPTED_ASSET_MAPPINGS,
        loadAppAssets,
        loadAllAppAssets,
        getAppByIndex,
        getAppById
    };
}
