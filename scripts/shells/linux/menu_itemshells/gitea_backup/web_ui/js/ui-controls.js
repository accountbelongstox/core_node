// UI Controls - 使用CSS类控制显示/隐藏，不离组件复用原则
// 所有样式控制都通过CSS类，不直接操作style属性

const UIControls = {
    // 显示元素（使用CSS类）
    show(element) {
        if (element) {
            element.classList.add('visible');
            element.classList.remove('hidden');
        }
    },
    
    // 隐藏元素（使用CSS类）
    hide(element) {
        if (element) {
            element.classList.add('hidden');
            element.classList.remove('visible');
        }
    },
    
    // 切换显示/隐藏
    toggle(element) {
        if (element) {
            element.classList.toggle('visible');
            element.classList.toggle('hidden');
        }
    },
    
    // 设置进度条进度（使用CSS变量，不离组件复用，CSS在CSS文件中）
    setProgress(progressBarElement, percent) {
        if (progressBarElement) {
            const percentValue = Math.min(100, Math.max(0, percent));
            progressBarElement.setAttribute('data-percent', percentValue);
            // 只设置CSS变量，样式定义在CSS文件中，不离组件复用
            progressBarElement.style.setProperty('--progress-percent', percentValue + '%');
        }
    },
    
    // 显示模态框
    showModal(modalElement) {
        if (modalElement) {
            modalElement.classList.add('modal-visible');
        }
    },
    
    // 隐藏模态框
    hideModal(modalElement) {
        if (modalElement) {
            modalElement.classList.remove('modal-visible');
        }
    },
    
    // 启用/禁用按钮
    enableButton(button) {
        if (button) {
            button.disabled = false;
            button.classList.remove('disabled');
        }
    },
    
    disableButton(button) {
        if (button) {
            button.disabled = true;
            button.classList.add('disabled');
        }
    }
};

