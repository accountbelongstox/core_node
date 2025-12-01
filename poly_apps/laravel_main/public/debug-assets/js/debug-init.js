/**
 * Debug Interface Initialization
 * Handles CSRF token initialization and dynamic menu rendering
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize CSRF Token first
    await APIClient.initCsrfToken();

    // Initialize ITTools dynamic menu
    const menuContainer = document.getElementById('ittools-dynamic-menu');
    menuContainer.innerHTML = ITToolsMenuConfig.renderMenu();
    console.log('Dynamic menu rendered with', ITToolsMenuConfig.categories.length, 'categories');
    
    // Restore ITTools UniversalMenu state
    setTimeout(() => {
        ITTools.UniversalMenu.restoreState();
    }, 200);
});

