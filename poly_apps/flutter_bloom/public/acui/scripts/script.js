// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

document.addEventListener('DOMContentLoaded', () => {
    // 更新时间
    function updateTime() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        document.querySelector('.time').textContent = `${hours}:${minutes}`;
    }
    
    updateTime();
    setInterval(updateTime, 60000);

    // 快捷菜单切换
    const plusButton = document.querySelector('.fa-plus');
    const quickMenu = document.getElementById('quickMenu');
    
    plusButton.addEventListener('click', (e) => {
        e.stopPropagation();
        quickMenu.classList.toggle('active');
    });

    // 点击其他地方关闭快捷菜单
    document.addEventListener('click', () => {
        quickMenu.classList.remove('active');
    });

    // 底部导航切换
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // 聊天列表项点击效果
    const chatItems = document.querySelectorAll('.chat-item');
    
    chatItems.forEach(item => {
        item.addEventListener('click', () => {
            // 这里可以添加跳转到聊天详情的逻辑
            console.log('跳转到聊天详情页面');
        });
    });

    // 搜索框功能
    const searchInput = document.querySelector('.search-bar input');
    
    searchInput.addEventListener('input', (e) => {
        const searchText = e.target.value.toLowerCase();
        
        chatItems.forEach(item => {
            const title = item.querySelector('h3').textContent.toLowerCase();
            const message = item.querySelector('p').textContent.toLowerCase();
            
            if (title.includes(searchText) || message.includes(searchText)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // 模拟新消息通知
    function simulateNewMessage() {
        const randomItem = chatItems[Math.floor(Math.random() * chatItems.length)];
        const messageText = [
            "新产品发布会的时间定了吗？",
            "这个bug已经修复了",
            "收到，我们下午开会讨论",
            "项目进度更新了",
            "好的，我知道了"
        ];
        
        randomItem.querySelector('p').textContent = 
            `${Math.random() > 0.5 ? '张三' : '李四'}: ${messageText[Math.floor(Math.random() * messageText.length)]}`;
        
        // 添加动画效果
        randomItem.style.backgroundColor = '#f0f9ff';
        setTimeout(() => {
            randomItem.style.backgroundColor = '';
        }, 1000);
    }

    // 每30秒模拟一条新消息
    setInterval(simulateNewMessage, 30000);
}); 