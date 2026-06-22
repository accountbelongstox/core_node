/**
 * Layout Module - Layout management and responsiveness
 */

window.AppLayout = (function() {
    'use strict';

    let leftMenuCollapsed = false;
    let rightMenuCollapsed = false;

    /**
     * Initialize layout
     */
    function init() {
        console.log('[Layout] Initializing layout system...');

        setupToggleButtons();
        setupResponsive();
        setupRefreshButton();

        console.log('[Layout] Layout initialized');
    }

    /**
     * Setup menu toggle buttons
     */
    function setupToggleButtons() {
        const leftToggle = document.getElementById('left-menu-toggle');
        const rightToggle = document.getElementById('right-menu-toggle');

        if (leftToggle) {
            leftToggle.addEventListener('click', toggleLeftMenu);
        }

        if (rightToggle) {
            rightToggle.addEventListener('click', toggleRightMenu);
        }
    }

    /**
     * Toggle left menu
     */
    function toggleLeftMenu() {
        const leftMenu = document.getElementById('left-menu');
        leftMenuCollapsed = !leftMenuCollapsed;

        if (leftMenuCollapsed) {
            leftMenu.classList.add('collapsed');
        } else {
            leftMenu.classList.remove('collapsed');
        }

        console.log('[Layout] Left menu toggled:', leftMenuCollapsed ? 'collapsed' : 'expanded');
    }

    /**
     * Toggle right menu
     */
    function toggleRightMenu() {
        const rightMenu = document.getElementById('right-menu');
        rightMenuCollapsed = !rightMenuCollapsed;

        if (rightMenuCollapsed) {
            rightMenu.classList.add('collapsed');
        } else {
            rightMenu.classList.remove('collapsed');
        }

        console.log('[Layout] Right menu toggled:', rightMenuCollapsed ? 'collapsed' : 'expanded');
    }

    /**
     * Setup responsive behavior
     */
    function setupResponsive() {
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial check
    }

    /**
     * Handle window resize
     */
    function handleResize() {
        const width = window.innerWidth;

        // Auto-collapse menus on small screens
        if (width <= 768) {
            const leftMenu = document.getElementById('left-menu');
            const rightMenu = document.getElementById('right-menu');

            if (leftMenu) leftMenu.classList.add('collapsed');
            if (rightMenu) rightMenu.style.display = 'none';

            leftMenuCollapsed = true;
        }
    }

    /**
     * Setup refresh button
     */
    function setupRefreshButton() {
        const refreshBtn = document.getElementById('refresh-btn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', handleRefresh);
        }
    }

    /**
     * Handle refresh action
     */
    function handleRefresh() {
        console.log('[Layout] Refresh triggered');

        // Trigger page-specific refresh if available
        if (window.currentPageRefresh) {
            window.currentPageRefresh();
        } else {
            console.warn('[Layout] No page refresh handler available');
        }
    }

    /**
     * Show loading overlay
     */
    function showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        const text = overlay.querySelector('.loading-text');

        if (text) text.textContent = message;
        overlay.classList.remove('hidden');
    }

    /**
     * Hide loading overlay
     */
    function hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('hidden');
    }

    /**
     * Load page content
     * @param {string} pageId - Page identifier
     * @param {string} title - Page title
     */
    function loadPage(pageId, title) {
        console.log(`[Layout] Loading page: ${pageId}`);

        // Update page title
        const pageTitleElement = document.getElementById('page-title');
        if (pageTitleElement) {
            pageTitleElement.textContent = title;
        }

        // Get content container
        const contentContainer = document.getElementById('page-content');

        if (!contentContainer) {
            console.error('[Layout] Content container not found');
            return;
        }

        // Clear current content
        contentContainer.innerHTML = '';

        // Trigger page-specific load handler
        const loadHandler = window[`load_${pageId}`];

        if (typeof loadHandler === 'function') {
            showLoading(`Loading ${title}...`);

            try {
                loadHandler(contentContainer);
            } catch (error) {
                console.error(`[Layout] Error loading page ${pageId}:`, error);
                contentContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error:</strong> Failed to load page content.
                    </div>
                `;
            } finally {
                hideLoading();
            }
        } else {
            contentContainer.innerHTML = `
                <div class="welcome-message">
                    <h2>${title}</h2>
                    <p>Page content not yet implemented.</p>
                </div>
            `;
        }
    }

    // Public API
    return {
        init,
        toggleLeftMenu,
        toggleRightMenu,
        showLoading,
        hideLoading,
        loadPage
    };
})();
