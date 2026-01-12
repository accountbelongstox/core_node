/**
 * Debug Interface Core JavaScript
 * Main framework: Sidebar toggle and iframe section switching
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

    // Load default section immediately
    const savedSection = localStorage.getItem('active_section');
    const defaultSection = savedSection || 'api-testing';
    
    // Set iframe src immediately to ensure it displays
    const iframe = document.getElementById('section-iframe');
    const sectionFileMap = {
        'api-testing': '/debug-assets/debug-tools/sections/api-testing-section.html',
        'dev-tools': '/debug-assets/debug-tools/sections/dev-tools-section.html',
        'system-info': '/debug-assets/debug-tools/sections/system-info-section.html',
        'code-browser': '/debug-assets/debug-tools/sections/code-browser-section.html',
        'static-resources': '/debug-assets/debug-tools/sections/static-resources-section.html',
        'mcp-manager': '/debug-assets/debug-tools/sections/mcp-manager-section.html',
        'learning': '/debug-assets/debug-tools/sections/learning-section.html',
        'octane-tasks': '/debug-assets/debug-tools/sections/octane-tasks-section.html',
        'sso': '/sso'
    };
    
    if (iframe && sectionFileMap[defaultSection]) {
        iframe.src = sectionFileMap[defaultSection];
        iframe.style.display = 'block';
    }
    
    // Then show the section properly
    showSection(defaultSection);
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
    targetLink.classList.add('active');

    const sectionFileMap = {
        'api-testing': '/debug-assets/debug-tools/sections/api-testing-section.html',
        'dev-tools': '/debug-assets/debug-tools/sections/dev-tools-section.html',
        'system-info': '/debug-assets/debug-tools/sections/system-info-section.html',
        'code-browser': '/debug-assets/debug-tools/sections/code-browser-section.html',
        'static-resources': '/debug-assets/debug-tools/sections/static-resources-section.html',
        'mcp-manager': '/debug-assets/debug-tools/sections/mcp-manager-section.html',
        'learning': '/debug-assets/debug-tools/sections/learning-section.html',
        'octane-tasks': '/debug-assets/debug-tools/sections/octane-tasks-section.html',
        'sso': '/sso'
    };

    const sectionTitles = {
        'system-info': { title: 'System Information', desc: 'View comprehensive system and application information' },
        'dev-tools': { title: 'Development Tools', desc: 'Professional developer utilities and tools' },
        'api-testing': { title: 'API Testing Dashboard', desc: 'Test and debug your Laravel API endpoints' },
        'code-browser': { title: 'Code Browser', desc: 'Browse, edit files, manage tasks and prompt mappings' },
        'static-resources': { title: 'Static Resources', desc: 'Browse and manage static media files' },
        'mcp-manager': { title: 'MCP Manager', desc: 'Manage MCP features including screenshots, task dispatch, and prompt mappings' },
        'learning': { title: 'Vocabulary Learning', desc: 'Learn and practice vocabulary with interactive tools' },
        'octane-tasks': { title: 'Octane Timer Tasks', desc: 'Monitor and manage Octane timer tasks status' },
        'sso': { title: 'SSO Authentication', desc: 'Single Sign-On authentication with WorkOS AuthKit' }
    };

    const iframe = document.getElementById('section-iframe');
    const filePath = sectionFileMap[sectionType];

    if (filePath) {
        iframe.src = filePath;
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
