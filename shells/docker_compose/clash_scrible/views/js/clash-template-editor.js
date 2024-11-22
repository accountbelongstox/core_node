document.addEventListener('DOMContentLoaded', function() {
    const editClashTemplateBtn = document.getElementById('editClashTemplateBtn');
    const clashTemplateModal = document.getElementById('clashTemplateModal');
    const clashTemplateContent = document.getElementById('clashTemplateContent');
    const saveClashTemplateBtn = document.getElementById('saveClashTemplateBtn');
    const closeClashTemplateBtn = document.querySelector('#clashTemplateModal button[onclick="closeClashTemplateModal()"]');

    // 打开模态框并加载 Clash 模板内容
    editClashTemplateBtn.addEventListener('click', function() {
        fetch('/clash_template')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    clashTemplateContent.value = data.data;
                    clashTemplateModal.style.display = 'block';
                } else {
                    showNotification('Failed to load Clash template: ' + data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('An error occurred while loading the Clash template.', 'error');
            });
    });

    // 保存 Clash 模板内容
    saveClashTemplateBtn.addEventListener('click', function() {
        const content = clashTemplateContent.value;
        if (content.trim() === '') {
            showNotification('The Clash template cannot be empty.', 'warning');
            return;
        }

        fetch('/clash_template', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: content }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showNotification(data.message, 'success');
                    closeClashTemplateModal();
                    // 如果需要，可以在这里更新页面上的其他元素
                    // 例如：updateClashTemplateDisplay(data.data);
                } else {
                    showNotification('Failed to save Clash template: ' + data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('An error occurred while saving the Clash template.', 'error');
            });
    });

    // 关闭模态框
    closeClashTemplateBtn.addEventListener('click', closeClashTemplateModal);

    // 点击模态框外部时关闭
    window.addEventListener('click', function(event) {
        if (event.target === clashTemplateModal) {
            closeClashTemplateModal();
        }
    });

    // 按下 Esc 键时关闭模态框
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && clashTemplateModal.style.display === 'block') {
            closeClashTemplateModal();
        }
    });
});

function closeClashTemplateModal() {
    document.getElementById('clashTemplateModal').style.display = 'none';
}

function showNotification(message, type) {
    // 这里可以使用您的通知系统
    // 例如，如果您使用 toastr 或类似的库：
    // toastr[type](message);

    // 如果没有特定的通知系统，我们可以创建一个简单的通知元素
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    document.body.appendChild(notification);

    // 3秒后移除通知
    setTimeout(() => {
        notification.remove();
    }, 3000);

    // 同时在控制台输出
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// 如果需要，可以添加一个函数来更新页面上的其他元素
function updateClashTemplateDisplay(newTemplateContent) {
    // 根据需要更新页面上显示模板内容的元素
    // 例如：
    // document.getElementById('clashTemplateDisplay').textContent = newTemplateContent;
}
