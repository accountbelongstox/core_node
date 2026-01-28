/**
 * Tailwind CSS CDN Loader with China Mainland Fallback
 * Supports multiple CDN sources for better accessibility
 * Priority: jsDelivr (China accessible) -> unpkg -> official CDN
 */
(function() {
    const cdnSources = [
        'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
        'https://unpkg.com/@tailwindcss/browser@4',
        'https://cdn.tailwindcss.com',
        'https://fastly.jsdelivr.net/npm/@tailwindcss/browser@4',
    ];

    function loadTailwindCSS(index = 0) {
        if (index >= cdnSources.length) {
            console.error('Failed to load Tailwind CSS from all CDN sources');
            return;
        }

        const script = document.createElement('script');
        script.src = cdnSources[index];
        script.onload = function() {
            console.log('Tailwind CSS loaded from:', cdnSources[index]);
            if (window.tailwind) {
                document.dispatchEvent(new CustomEvent('tailwindcss:loaded'));
            }
        };
        script.onerror = function() {
            console.warn('Failed to load from:', cdnSources[index], 'trying next...');
            loadTailwindCSS(index + 1);
        };
        document.head.appendChild(script);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            loadTailwindCSS();
        });
    } else {
        loadTailwindCSS();
    }
})();

