// Flutter Bloom UI 展示页面交互脚本

document.addEventListener('DOMContentLoaded', function() {
    // 初始化页面
    initializePage();

    // 图片懒加载
    initializeLazyLoading();

    // 平滑滚动
    initializeSmoothScrolling();

    // 图片预览功能
    initializeImagePreview();

    // 性能统计
    initializePerformanceTracking();
});

// 页面初始化
function initializePage() {
    console.log('Flutter Bloom UI 展示页面已加载');

    // 添加页面加载动画
    const elements = document.querySelectorAll('.ui-card, .feature-item');
    elements.forEach((element, index) => {
        element.style.animationDelay = `${index * 0.1}s`;
    });

    // 检查浏览器支持
    checkBrowserSupport();
}

// 检查浏览器支持
function checkBrowserSupport() {
    if (!CSS.supports('backdrop-filter', 'blur(10px)')) {
        console.warn('当前浏览器不支持backdrop-filter，可能影响视觉效果');
        // 为不支持的浏览器添加替代样式
        const style = document.createElement('style');
        style.textContent = `
            .header, .ui-section, .footer {
                background: rgba(255, 255, 255, 0.95) !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// 图片懒加载
function initializeLazyLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.classList.remove('loading');
                    observer.unobserve(img);
                }
            });
        });

        document.querySelectorAll('.ui-image').forEach(img => {
            imageObserver.observe(img);

            // 图片加载完成后移除loading动画
            img.addEventListener('load', function() {
                this.style.animation = 'none';
                this.style.background = 'none';
            });
        });
    }
}

// 平滑滚动
function initializeSmoothScrolling() {
    // 为所有内部链接添加平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// 图片预览功能
function initializeImagePreview() {
    const images = document.querySelectorAll('.ui-image');

    images.forEach(img => {
        img.addEventListener('click', function() {
            createImageModal(this);
        });

        // 添加键盘访问性
        img.setAttribute('tabindex', '0');
        img.setAttribute('role', 'button');
        img.setAttribute('aria-label', '点击查看大图');

        img.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                createImageModal(this);
            }
        });
    });
}

// 创建图片预览模态框
function createImageModal(img) {
    // 检查是否已存在模态框
    if (document.querySelector('.image-modal')) {
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content">
            <img src="${img.src}" alt="${img.alt}" class="modal-image">
            <button class="modal-close" aria-label="关闭预览">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="modal-info">
                <h3>${img.alt}</h3>
                <p>点击图片外区域或按 ESC 键关闭预览</p>
            </div>
        </div>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .image-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        }

        .modal-backdrop {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
        }

        .modal-content {
            position: relative;
            max-width: 90%;
            max-height: 90%;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .modal-image {
            max-width: 100%;
            max-height: 80vh;
            object-fit: contain;
            border-radius: 12px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
        }

        .modal-close {
            position: absolute;
            top: -40px;
            right: 0;
            background: rgba(255, 255, 255, 0.9);
            border: none;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .modal-close:hover {
            background: white;
            transform: scale(1.1);
        }

        .modal-info {
            margin-top: 20px;
            text-align: center;
            color: white;
        }

        .modal-info h3 {
            font-size: 1.2rem;
            margin-bottom: 8px;
        }

        .modal-info p {
            font-size: 0.9rem;
            opacity: 0.8;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(modal);

    // 禁止页面滚动
    document.body.style.overflow = 'hidden';

    // 事件监听
    const closeModal = () => {
        modal.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(modal);
            document.head.removeChild(style);
            document.body.style.overflow = '';
        }, 300);
    };

    // 添加fadeOut动画
    style.textContent += `
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;

    modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    modal.querySelector('.modal-close').addEventListener('click', closeModal);

    // ESC键关闭
    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleKeydown);
        }
    };
    document.addEventListener('keydown', handleKeydown);
}

// 性能统计
function initializePerformanceTracking() {
    // 页面加载性能
    window.addEventListener('load', function() {
        const perfData = performance.getEntriesByType('navigation')[0];
        const loadTime = perfData.loadEventEnd - perfData.loadEventStart;

        console.log(`页面加载时间: ${loadTime}ms`);

        // 如果加载时间过长，显示提示
        if (loadTime > 3000) {
            console.warn('页面加载时间较长，建议优化图片大小');
        }
    });

    // 滚动性能监控
    let scrolling = false;
    window.addEventListener('scroll', function() {
        if (!scrolling) {
            scrolling = true;
            requestAnimationFrame(function() {
                scrolling = false;
            });
        }
    });
}

// 工具函数
const utils = {
    // 节流函数
    throttle: function(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    },

    // 防抖函数
    debounce: function(func, delay) {
        let timeoutId;
        return function() {
            const args = arguments;
            const context = this;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(context, args), delay);
        }
    },

    // 检测移动设备
    isMobile: function() {
        return window.innerWidth <= 768;
    },

    // 获取元素在视口中的位置
    getElementPosition: function(element) {
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
        };
    }
};

// 导出到全局作用域
window.FlutterBloomUI = {
    utils: utils,
    reinitialize: initializePage
};