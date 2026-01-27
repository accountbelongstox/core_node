// Utility Functions

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format file size
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('notification-exit');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Notification styles are now in CSS file, no need for inline styles

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Get relative path from full path
function getRelativePath(fullPath, basePath) {
    if (fullPath.startsWith(basePath)) {
        return fullPath.substring(basePath.length).replace(/^\//, '');
    }
    return fullPath.replace(/^.*\/backups\//, '');
}

// Confirm dialog
function confirmAction(message) {
    return confirm(message);
}

// Loading state management - 使用CSS类，不离组件复用
const LoadingState = {
    show: function(elementId) {
        const el = document.getElementById(elementId);
        if (el) UIControls.show(el);
    },
    hide: function(elementId) {
        const el = document.getElementById(elementId);
        if (el) UIControls.hide(el);
    }
};

// Error state management - 使用CSS类，不离组件复用
const ErrorState = {
    show: function(message, elementId = 'error') {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = message;
            UIControls.show(el);
        }
    },
    hide: function(elementId = 'error') {
        const el = document.getElementById(elementId);
        if (el) UIControls.hide(el);
    }
};

