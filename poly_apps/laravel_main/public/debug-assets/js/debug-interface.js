/**
 * Debug Interface Core JavaScript
 * Main framework: Sidebar toggle and iframe section switching.
 * Only API Testing Dashboard and SSO Authentication are available here.
 * All other management features and actual code are developed in poly_apps/pycore_laravel_wordnew_ui/.
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeSidebar();
    initializeNavigation();
    restoreSidebarState();
});

function initializeSidebar() {
    const sidebarHeader = document.getElementById('sidebar-header');
    const mobileNavToggle = document.getElementById('mobile-nav-toggle');
    const mobileOverlay = document.getElementById('mobile-overlay');

    sidebarHeader.addEventListener('click', toggleSidebar);
    mobileNavToggle.addEventListener('click', toggleMobileSidebar);
    mobileOverlay.addEventListener('click', closeMobileSidebar);

    window.addEventListener('resize', handleWindowResize);
}

function initializeNavigation() {
    const menuItems = document.querySelectorAll('.menu-item a');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionType = this.dataset.section;
            showSection(sectionType);
        });
    });

    // Load default section from localStorage or use 'api-testing' as default
    const savedSection = localStorage.getItem('active_section');
    const defaultSection = savedSection || 'api-testing';
    
    // If saved section is different from default, switch to it
    if (defaultSection !== 'api-testing') {
        showSection(defaultSection);
    } else {
        // Ensure default section is active
        const defaultLink = document.querySelector('[data-section="api-testing"]');
        if (defaultLink) {
            defaultLink.classList.add('active');
        }
    }
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
    if (window.innerWidth <= 768) {
        closeMobileSidebar();
    }

    document.querySelectorAll('.menu-item a').forEach(link => {
        link.classList.remove('active');
    });

    const targetLink = document.querySelector(`[data-section="${sectionType}"]`);
    if (targetLink) targetLink.classList.add('active');

    const sectionFileMap = {
        'api-testing': '/debug-assets/debug-tools/sections/api-testing-section.html',
        'sso': '/sso'
    };

    const sectionTitles = {
        'api-testing': { title: 'API Testing Dashboard', desc: 'Test and debug your Laravel API endpoints' },
        'sso': { title: 'SSO Authentication', desc: 'Single Sign-On authentication with WorkOS AuthKit' }
    };

    const filePath = sectionFileMap[sectionType];

    if (!filePath) {
        sectionType = 'api-testing';
        const fallbackLink = document.querySelector(`[data-section="api-testing"]`);
        if (fallbackLink) {
            fallbackLink.classList.add('active');
            if (targetLink) targetLink.classList.remove('active');
        }
    }

    const iframe = document.getElementById('section-iframe');
    const finalPath = sectionFileMap[sectionType];

    if (finalPath) {
        iframe.src = finalPath;
        iframe.style.display = 'block';
    } else {
        iframe.style.display = 'none';
    }

    const pageTitle = document.getElementById('page-title');
    const pageDescription = document.getElementById('page-description');
    const mobileNavTitle = document.getElementById('mobile-nav-title');

    if (sectionTitles[sectionType]) {
        pageTitle.textContent = sectionTitles[sectionType].title;
        pageDescription.textContent = sectionTitles[sectionType].desc;
        mobileNavTitle.textContent = sectionTitles[sectionType].title;
    }

    localStorage.setItem('active_section', sectionType);
}
