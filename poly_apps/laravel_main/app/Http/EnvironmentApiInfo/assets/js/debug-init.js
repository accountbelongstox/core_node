/**
 * Debug Interface Initialization
 * Handles CSRF token initialization and dynamic menu rendering
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize CSRF Token first
    if (typeof APIClient !== 'undefined') {
        await APIClient.initCsrfToken();
    }

    // Initialize ITTools dynamic menu
    const menuContainer = document.getElementById('ittools-dynamic-menu');
    if (menuContainer && typeof ITToolsMenuConfig !== 'undefined') {
        menuContainer.innerHTML = ITToolsMenuConfig.renderMenu();
        console.log('Dynamic menu rendered with', ITToolsMenuConfig.categories.length, 'categories');
    }
    
    // Restore ITTools UniversalMenu state
    if (typeof ITTools !== 'undefined' && ITTools.UniversalMenu && ITTools.UniversalMenu.restoreState) {
        setTimeout(() => {
            ITTools.UniversalMenu.restoreState();
        }, 200);
    }
});

