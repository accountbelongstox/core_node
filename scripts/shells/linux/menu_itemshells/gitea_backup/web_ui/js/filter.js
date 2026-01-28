// Filter and Search Functions

let currentFilters = {
    namespace: '',
    search: '',
    sort: 'date-desc'
};

let allBackups = {};

function initializeFilters() {
    const namespaceFilter = document.getElementById('namespaceFilter');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    
    if (namespaceFilter) {
        namespaceFilter.addEventListener('change', function() {
            currentFilters.namespace = this.value;
            applyFilters();
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function() {
            currentFilters.search = this.value.toLowerCase();
            applyFilters();
        }, 300));
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', function() {
            currentFilters.sort = this.value;
            applyFilters();
        });
    }
}

function updateNamespaceFilter(backups) {
    const namespaceFilter = document.getElementById('namespaceFilter');
    if (!namespaceFilter) return;
    
    const namespaces = Object.keys(backups);
    const currentValue = namespaceFilter.value;
    
    // Clear existing options except "All"
    namespaceFilter.innerHTML = '<option value="">All</option>';
    
    namespaces.forEach(namespace => {
        const option = document.createElement('option');
        option.value = namespace;
        option.textContent = namespace.charAt(0).toUpperCase() + namespace.slice(1);
        namespaceFilter.appendChild(option);
    });
    
    // Restore selection
    if (currentValue) {
        namespaceFilter.value = currentValue;
    }
}

function applyFilters() {
    if (!allBackups || Object.keys(allBackups).length === 0) {
        return;
    }
    
    let filtered = {};
    
    // Filter by namespace
    for (const [namespace, backups] of Object.entries(allBackups)) {
        if (currentFilters.namespace && namespace !== currentFilters.namespace) {
            continue;
        }
        
        // Filter by search
        let filteredBackups = backups;
        if (currentFilters.search) {
            filteredBackups = backups.filter(backup => 
                backup.name.toLowerCase().includes(currentFilters.search)
            );
        }
        
        // Sort
        filteredBackups = sortBackups(filteredBackups, currentFilters.sort);
        
        if (filteredBackups.length > 0) {
            filtered[namespace] = filteredBackups;
        }
    }
    
    // Update display
    if (window.displayBackups) {
        window.displayBackups(filtered);
    }
}

function sortBackups(backups, sortType) {
    const sorted = [...backups];
    
    switch (sortType) {
        case 'date-desc':
            sorted.sort((a, b) => b.modified_timestamp - a.modified_timestamp);
            break;
        case 'date-asc':
            sorted.sort((a, b) => a.modified_timestamp - b.modified_timestamp);
            break;
        case 'size-desc':
            sorted.sort((a, b) => b.size - a.size);
            break;
        case 'size-asc':
            sorted.sort((a, b) => a.size - b.size);
            break;
        case 'name-asc':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            sorted.sort((a, b) => b.name.localeCompare(a.name));
            break;
    }
    
    return sorted;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeFilters);

