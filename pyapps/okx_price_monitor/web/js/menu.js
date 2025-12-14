/**
 * Menu Module - Menu system management
 */

window.AppMenu = (function() {
    'use strict';

    const config = window.AppConfig;
    let currentPage = null;

    /**
     * Initialize menu system
     */
    function init() {
        console.log('[Menu] Initializing menu system...');

        renderTopMenu();
        renderLeftMenu();
        renderBottomMenu();

        console.log('[Menu] Menu system initialized');
    }

    /**
     * Render top menu
     */
    function renderTopMenu() {
        const container = document.getElementById('top-nav-items');

        if (!container) {
            console.warn('[Menu] Top menu container not found');
            return;
        }

        const items = config.menus.top || [];

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'nav-item';
            li.innerHTML = `
                <span class="nav-icon">${item.icon}</span>
                <span class="nav-label">${item.label}</span>
            `;

            li.addEventListener('click', () => handleTopMenuClick(item));

            container.appendChild(li);
        });

        console.log(`[Menu] Rendered ${items.length} top menu items`);
    }

    /**
     * Render left menu
     */
    function renderLeftMenu() {
        const container = document.getElementById('left-menu-items');

        if (!container) {
            console.warn('[Menu] Left menu container not found');
            return;
        }

        const items = config.menus.left || [];

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'menu-item';
            li.dataset.page = item.page || item.id;
            li.innerHTML = `
                <span class="menu-icon">${item.icon}</span>
                <span class="menu-label">${item.label}</span>
                ${item.badge ? `<span class="menu-badge">${item.badge}</span>` : ''}
            `;

            li.addEventListener('click', () => handleLeftMenuClick(item, li));

            container.appendChild(li);
        });

        // Auto-select first item
        if (items.length > 0) {
            const firstItem = container.querySelector('.menu-item');
            if (firstItem) {
                setTimeout(() => firstItem.click(), 100);
            }
        }

        console.log(`[Menu] Rendered ${items.length} left menu items`);
    }

    /**
     * Render bottom menu
     */
    function renderBottomMenu() {
        // Bottom menu items are static in HTML
        // This function can be used for dynamic updates
        console.log('[Menu] Bottom menu initialized');
    }

    /**
     * Handle top menu click
     * @param {object} item - Menu item
     */
    function handleTopMenuClick(item) {
        console.log('[Menu] Top menu clicked:', item.id);

        // Handle different top menu actions
        switch (item.id) {
            case 'home':
                // Reload current page or go to dashboard
                if (currentPage) {
                    window.AppLayout.loadPage(currentPage.page, currentPage.label);
                }
                break;

            case 'settings':
                alert('Settings menu not yet implemented');
                break;

            case 'help':
                alert('Help menu not yet implemented');
                break;

            default:
                console.warn('[Menu] Unknown top menu item:', item.id);
        }
    }

    /**
     * Handle left menu click
     * @param {object} item - Menu item
     * @param {HTMLElement} element - Menu element
     */
    function handleLeftMenuClick(item, element) {
        console.log('[Menu] Left menu clicked:', item.id);

        // Remove active class from all items
        document.querySelectorAll('.menu-item').forEach(el => {
            el.classList.remove('active');
        });

        // Add active class to clicked item
        element.classList.add('active');

        // Store current page
        currentPage = item;

        // Load page content
        const pageId = item.page || item.id;
        window.AppLayout.loadPage(pageId, item.label);
    }

    /**
     * Get current page
     * @returns {object|null} Current page item
     */
    function getCurrentPage() {
        return currentPage;
    }

    /**
     * Set active menu item by page ID
     * @param {string} pageId - Page identifier
     */
    function setActivePage(pageId) {
        const menuItem = document.querySelector(`.menu-item[data-page="${pageId}"]`);

        if (menuItem) {
            menuItem.click();
        } else {
            console.warn('[Menu] Menu item not found for page:', pageId);
        }
    }

    // Public API
    return {
        init,
        getCurrentPage,
        setActivePage
    };
})();
