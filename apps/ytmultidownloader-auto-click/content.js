/**
 * YT Multi Downloader Auto Click Extension
 * 自动查找并点击 "Load Options" 按钮
 */

(function() {
  'use strict';

  // 查找包含 "Load Options" 文本的按钮
  function findLoadOptionsButton() {
    // 方法1: 通过文本内容查找（最宽泛的方式）
    const allButtons = document.querySelectorAll('button');
    for (const button of allButtons) {
      const text = button.textContent || button.innerText || '';
      if (text.includes('Load Options') || text.trim() === 'Load Options') {
        // 检查按钮是否可用
        if (!button.disabled && !button.hasAttribute('aria-disabled') || 
            button.getAttribute('aria-disabled') === 'false') {
          return button;
        }
      }
    }

    // 方法2: 通过 SVG 路径查找（如果按钮包含下载图标）
    const downloadIcons = document.querySelectorAll('svg path[d*="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"]');
    for (const icon of downloadIcons) {
      let element = icon;
      // 向上查找 button 元素
      while (element && element.tagName !== 'BUTTON') {
        element = element.parentElement;
      }
      if (element && element.tagName === 'BUTTON') {
        const text = element.textContent || element.innerText || '';
        if (text.includes('Load Options') || text.includes('Options')) {
          if (!element.disabled && 
              (!element.hasAttribute('aria-disabled') || element.getAttribute('aria-disabled') === 'false')) {
            return element;
          }
        }
      }
    }

    // 方法3: 通过类名查找（基于用户提供的类名）
    const buttonsByClass = document.querySelectorAll('button.inline-flex.items-center');
    for (const button of buttonsByClass) {
      const text = button.textContent || button.innerText || '';
      if (text.includes('Load Options')) {
        if (!button.disabled && 
            (!button.hasAttribute('aria-disabled') || button.getAttribute('aria-disabled') === 'false')) {
          return button;
        }
      }
    }

    return null;
  }

  // 点击按钮
  function clickLoadOptionsButton() {
    const button = findLoadOptionsButton();
    if (button) {
      console.log('[YT Multi Downloader Auto Click] 找到 Load Options 按钮，准备点击');
      
      // 确保按钮可见
      button.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // 等待一小段时间确保滚动完成
      setTimeout(() => {
        // 触发点击事件
        button.click();
        console.log('[YT Multi Downloader Auto Click] 已点击 Load Options 按钮');
      }, 300);
      
      return true;
    }
    return false;
  }

  // 使用 MutationObserver 监听 DOM 变化
  function observeAndClick() {
    // 先尝试立即查找并点击
    if (clickLoadOptionsButton()) {
      return;
    }

    // 如果没找到，设置观察者监听 DOM 变化
    const observer = new MutationObserver((mutations) => {
      if (clickLoadOptionsButton()) {
        // 点击成功后，可以选择停止观察或继续观察
        // observer.disconnect();
      }
    });

    // 开始观察
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled', 'class']
    });

    // 设置超时，避免无限观察
    setTimeout(() => {
      observer.disconnect();
    }, 60000); // 60秒后停止观察
  }

  // 页面加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeAndClick);
  } else {
    observeAndClick();
  }

  // 也监听页面导航（SPA 应用可能需要）
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(observeAndClick, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

})();

