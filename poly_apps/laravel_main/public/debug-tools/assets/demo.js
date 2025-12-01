function showMessage(message, type = 'info') {
    const messageArea = document.getElementById('message-area');
    messageArea.innerHTML = `<div class="message ${type}">${message}</div>`;
    setTimeout(() => {
        messageArea.innerHTML = '';
    }, 5000);
}

function fillCredentials(username, password) {
    document.getElementById('username').value = username;
    document.getElementById('password').value = password;
    showMessage(`Credentials filled for: ${username}`, 'info');
}

async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    showMessage('Logging in...', 'info');

    try {
        const response = await fetch('/api/dict/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (data.success && (data.token || (data.data && data.data.login_token))) {
            const token = data.token || data.data.login_token;
            localStorage.setItem('auth_token', token);
            showMessage('✓ Login successful! Redirecting...', 'success');
            setTimeout(() => { window.location.href = '/learning'; }, 1000);
        } else {
            showMessage('❌ Login failed: ' + (data.message || 'Invalid credentials'), 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage('❌ Login failed: Network error. Using demo token instead...', 'error');
        setTimeout(useDemoToken, 2000);
    }
}

function useDemoToken() {
    const demoToken = 'demo_token_' + Date.now();
    localStorage.setItem('auth_token', demoToken);
    showMessage('✓ Demo token set! Redirecting to learning app...', 'success');
    setTimeout(() => { window.location.href = '/learning'; }, 1500);
}

window.addEventListener('load', () => {
    const currentToken = localStorage.getItem('auth_token');
    if (currentToken) {
        showMessage('You already have a token. <a href="/learning" style="color: #667eea; font-weight: 600;">Go to Learning App →</a>', 'info');
    }
});
