/**
 * Debug Interface Core JavaScript
 * Main framework: Sidebar toggle and iframe section switching.
 * Only API Testing Dashboard and SSO Authentication are available here.
 * All other management features and actual code are developed in poly_apps/pycore_laravel_wordnew_ui/.
 */

const SECTION_IFRAME_ID = 'section-iframe';
let sectionLoadSequence = 0;

/**
 * Section registry: single source of truth for section routing and headers.
 * Route-backed sections (non-/debug-assets paths) are rendered server-side.
 */
const SECTION_FILE_MAP = {
    'api-testing': '/debug-assets/debug-tools/sections/api-testing-section.html',
    'sso': '/sso',
    'sso-docs': '/sso/docs',
    'dashboard-management': '/debug-assets/debug-tools/sections/dashboard-management.html'
};

const SECTION_TITLES = {
    'api-testing': { title: 'API Testing Dashboard', desc: 'Test and debug your Laravel API endpoints' },
    'sso': { title: 'SSO Authentication', desc: 'Single Sign-On authentication with WorkOS AuthKit' },
    'sso-docs': { title: 'SSO Documentation', desc: 'Usage guide, deployment notes and embedding examples' },
    'dashboard-management': { title: 'Account Management', desc: 'Profile, super-code elevation and registered accounts' }
};

document.addEventListener('DOMContentLoaded', function() {
    initializeSidebar();
    initializeNavigation();
    restoreSidebarState();
});

function sectionAssetVersion() {
    return window.DEBUG_ASSET_VERSION || String(Date.now());
}

function versionedAssetUrl(url) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${sectionAssetVersion()}`;
}

/**
 * Static section HTMLs are served without cache headers, so every
 * /debug-assets URL inside them must carry the current asset version.
 * The token is also injected so section code reuses it for its own fetches.
 */
function stampSectionAssetVersion(html) {
    const stamped = html.replace(
        /(src|href)="(\/debug-assets\/[^"?]+)"/g,
        (match, attribute, url) => `${attribute}="${versionedAssetUrl(url)}"`
    );

    return stamped.replace(
        /<\/head>/i,
        `<script>window.DEBUG_ASSET_VERSION = "${sectionAssetVersion()}";</script></head>`
    );
}

async function loadSectionIntoIframe(filePath) {
    const iframe = document.getElementById(SECTION_IFRAME_ID);
    if (!iframe) {
        return;
    }

    if (!filePath) {
        iframe.removeAttribute('src');
        iframe.removeAttribute('srcdoc');
        iframe.style.display = 'none';
        return;
    }

    // Route-backed sections (e.g. /sso) are rendered server-side on every request.
    if (!filePath.startsWith('/debug-assets/')) {
        iframe.removeAttribute('srcdoc');
        iframe.src = filePath;
        iframe.style.display = 'block';
        return;
    }

    const requestSequence = ++sectionLoadSequence;
    try {
        const response = await fetch(versionedAssetUrl(filePath));
        if (!response.ok) {
            throw new Error(`Failed to load section: ${filePath}`);
        }
        const html = await response.text();
        if (requestSequence !== sectionLoadSequence) {
            return;
        }
        iframe.removeAttribute('src');
        iframe.srcdoc = stampSectionAssetVersion(html);
        iframe.style.display = 'block';
    } catch (error) {
        console.error('Section loading error:', error);
    }
}

function initializeSidebar() {
    const sidebarHeader = document.getElementById('sidebar-header');
    const mobileNavToggle = document.getElementById('mobile-nav-toggle');
    const mobileOverlay = document.getElementById('mobile-overlay');

    sidebarHeader.addEventListener('click', toggleSidebar);
    mobileNavToggle.addEventListener('click', toggleMobileSidebar);
    mobileOverlay.addEventListener('click', closeMobileSidebar);

    window.addEventListener('resize', handleWindowResize);
}

async function initializeNavigation() {
    const menuItems = document.querySelectorAll('.menu-item a');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionType = this.dataset.section;
            showSection(sectionType);
        });
    });

    // Auth status gates protected sections; wait for the first resolution so
    // loopback sessions (login-free) and remote guests are routed correctly.
    if (window.DashboardUser && window.DashboardUser.readyPromise) {
        try {
            await window.DashboardUser.readyPromise;
        } catch (error) {
            // Keep going: the login modal guard handles the signed-out case.
        }
    }

    // Load default section from localStorage or use the first allowed one.
    // Always route through showSection so the initial section is version-loaded.
    const savedSection = localStorage.getItem('active_section');
    showSection(resolveInitialSection(savedSection));
}

/**
 * First allowed section for the initial load: the saved section when still
 * valid, then API Testing when the identity permits it, otherwise the public
 * SSO page (which itself offers the login form).
 */
function resolveInitialSection(savedSection) {
    const dashboardUser = window.DashboardUser;
    if (dashboardUser) {
        if (savedSection && SECTION_FILE_MAP[savedSection] && dashboardUser.isSectionAllowed(savedSection)) {
            return savedSection;
        }
        return dashboardUser.isSectionAllowed('api-testing') ? 'api-testing' : 'sso';
    }
    return (savedSection && SECTION_FILE_MAP[savedSection]) ? savedSection : 'api-testing';
}

function toggleSidebar() {
    const sidebar = document.getElementById('main-sidebar');

    if (window.innerWidth <= 768) {
        toggleMobileSidebar();
    } else {
        const isExpanded = sidebar.classList.toggle('expanded');
        localStorage.setItem('sidebar_expanded', isExpanded);
    }
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (sidebar.classList.contains('expanded')) {
        closeMobileSidebar();
    } else {
        sidebar.classList.add('expanded');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    sidebar.classList.remove('expanded');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function restoreSidebarState() {
    const sidebar = document.getElementById('main-sidebar');

    if (window.innerWidth > 768) {
        const wasExpanded = localStorage.getItem('sidebar_expanded') === 'true';
        if (wasExpanded) {
            sidebar.classList.add('expanded');
        }
    }
}

function handleWindowResize() {
    const sidebar = document.getElementById('main-sidebar');
    const overlay = document.getElementById('mobile-overlay');

    if (window.innerWidth > 768) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        restoreSidebarState();
    } else {
        sidebar.classList.remove('expanded');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function showSection(sectionType) {
    // Protected sections require an authenticated identity; the server
    // enforces the same rule on their data endpoints (dashboard.auth).
    if (window.DashboardUser && !window.DashboardUser.isSectionAllowed(sectionType)) {
        window.DashboardUser.openModal('login');
        return;
    }

    if (window.innerWidth <= 768) {
        closeMobileSidebar();
    }

    document.querySelectorAll('.menu-item a').forEach(link => {
        link.classList.remove('active');
    });

    const targetLink = document.querySelector(`[data-section="${sectionType}"]`);
    if (targetLink) targetLink.classList.add('active');

    const filePath = SECTION_FILE_MAP[sectionType];

    if (!filePath) {
        sectionType = 'api-testing';
        const fallbackLink = document.querySelector(`[data-section="api-testing"]`);
        if (fallbackLink) {
            fallbackLink.classList.add('active');
            if (targetLink) targetLink.classList.remove('active');
        }
    }

    loadSectionIntoIframe(SECTION_FILE_MAP[sectionType]);

    const pageTitle = document.getElementById('page-title');
    const pageDescription = document.getElementById('page-description');
    const mobileNavTitle = document.getElementById('mobile-nav-title');

    if (SECTION_TITLES[sectionType]) {
        pageTitle.textContent = SECTION_TITLES[sectionType].title;
        pageDescription.textContent = SECTION_TITLES[sectionType].desc;
        mobileNavTitle.textContent = SECTION_TITLES[sectionType].title;
    }

    localStorage.setItem('active_section', sectionType);
}
