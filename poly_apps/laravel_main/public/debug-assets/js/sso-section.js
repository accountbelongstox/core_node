const apiClient = window.apiClientInstance;

let currentUser = null;


function setupEventListeners() {
    const loginBtn = document.getElementById('sso-login-btn');
    const logoutBtn = document.getElementById('sso-logout-btn');
    const passwordLoginForm = document.getElementById('password-login-form');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const copyUrlBtn = document.getElementById('copy-sso-url-btn');

    if (loginBtn) {
        loginBtn.addEventListener('click', handleSsoLogin);
    }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

        if (passwordLoginForm) {
            passwordLoginForm.addEventListener('submit', handlePasswordLogin);
        }

        tabButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const tab = this.dataset.tab;
                switchTab(tab);
            });
        });

        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', copySsoUrl);
        }

        const orgIdInput = document.getElementById('organization-id');
        const providerSelect = document.getElementById('provider-select');
        
        if (orgIdInput) {
            orgIdInput.addEventListener('input', () => {
                if (currentUser) generateSsoUrlPreview();
            });
        }
        
        if (providerSelect) {
            providerSelect.addEventListener('change', () => {
                if (currentUser) generateSsoUrlPreview();
            });
        }
}

async function checkAuthStatus() {
    // /sso/user always answers 200 with an explicit `authenticated` flag;
    // a missing session is a normal state and must not log an error.
    try {
        const response = await apiClient.get('/sso/user');
        const user = response.data && response.data.user;

        if (user) {
            currentUser = user;
            showUserSection();
            updateStatus('authenticated', 'Authenticated');
        } else {
            currentUser = null;
            showLoginSection();
        }
    } catch (error) {
        currentUser = null;
        showLoginSection();
        if (error && error.status && error.status >= 500) {
            console.error('checkAuthStatus error:', error);
            updateStatus('error', 'Authentication check failed');
        } else {
            updateStatus('unauthenticated', 'Not authenticated');
        }
    }
    checkSsoRedirect();
}

function checkSsoRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    
    if (redirect === 'sso' && !currentUser) {
        switchTab('password');
        showError('Please login with username and password first, then use SSO URL for single sign-on');
    }
}

async function generateSsoUrlPreview() {
    if (!currentUser) {
        updateSsoUrl(null);
        return;
    }

    try {
        const organizationId = document.getElementById('organization-id')?.value.trim() || null;
        const provider = document.getElementById('provider-select')?.value || 'authkit';
        
        const response = await apiClient.post('/sso/authorize', {
            organization_id: organizationId,
            provider: provider,
        });

        if (response.success && response.data && response.data.url) {
            updateSsoUrl(response.data.url);
        }
    } catch (error) {
        console.error('Failed to generate SSO URL preview:', error);
    }
}

function showLoginSection() {
    const loginSection = document.getElementById('sso-login-section');
    const userSection = document.getElementById('sso-user-section');
    
    if (loginSection) loginSection.classList.remove('hidden');
    if (userSection) userSection.classList.add('hidden');
    updateStatus('default', 'Not authenticated');
}

function showUserSection() {
    const loginSection = document.getElementById('sso-login-section');
    const userSection = document.getElementById('sso-user-section');
    
    if (loginSection) loginSection.classList.add('hidden');
    if (userSection) userSection.classList.remove('hidden');
    
    if (currentUser) {
        updateUserDisplay(currentUser);
        updateStatus('authenticated', 'Authenticated');
        generateSsoUrlPreview();
    }
}

function updateUserDisplay(user) {
    const userNameEl = document.getElementById('user-name');
    const userEmailEl = document.getElementById('user-email');
    const userIdEl = document.getElementById('user-id');
    const userAvatarEl = document.getElementById('user-avatar');
    const userAvatarPlaceholderEl = document.getElementById('user-avatar-placeholder');
    const userInitialsEl = document.getElementById('user-initials');

    if (userNameEl) {
        let fullName = 'User';
        if (user.firstName && user.lastName) {
            fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
        } else if (user.nickname) {
            fullName = user.nickname;
        } else if (user.name) {
            fullName = user.name;
        } else if (user.username) {
            fullName = user.username;
        }
        userNameEl.textContent = fullName;
    }

    if (userEmailEl) {
        userEmailEl.textContent = user.email || 'No email';
    }

    if (userIdEl) {
        userIdEl.textContent = `ID: ${user.id || '-'}`;
    }

    let avatarUrl = user.profilePictureUrl || user.avatar;
    
    if (avatarUrl) {
        if (!avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://')) {
            if (avatarUrl.startsWith('avatars/')) {
                const parts = avatarUrl.split('/');
                if (parts.length >= 3) {
                    const app = parts[1];
                    const filename = parts.slice(2).join('/');
                    const baseUrl = window.location.origin;
                    avatarUrl = `${baseUrl}/api/files/avatars/${app}/${filename}`;
                }
            } else if (avatarUrl.startsWith('/')) {
                const baseUrl = window.location.origin;
                avatarUrl = baseUrl + avatarUrl;
            } else {
                const baseUrl = window.location.origin;
                avatarUrl = `${baseUrl}/api/files/${avatarUrl}`;
            }
        }
        
        if (userAvatarEl) {
            userAvatarEl.src = avatarUrl;
            userAvatarEl.classList.remove('hidden');
        }
        if (userAvatarPlaceholderEl) {
            userAvatarPlaceholderEl.classList.add('hidden');
        }
    } else {
        if (userAvatarEl) {
            userAvatarEl.classList.add('hidden');
        }
        if (userAvatarPlaceholderEl) {
            userAvatarPlaceholderEl.classList.remove('hidden');
            let initials = 'U';
            if (user.firstName && user.lastName) {
                initials = [user.firstName, user.lastName]
                    .filter(Boolean)
                    .map(n => n[0])
                    .join('')
                    .toUpperCase();
            } else if (user.nickname) {
                initials = user.nickname.substring(0, 2).toUpperCase();
            } else if (user.name) {
                initials = user.name.substring(0, 2).toUpperCase();
            } else if (user.username) {
                initials = user.username.substring(0, 2).toUpperCase();
            } else if (user.email) {
                initials = user.email[0].toUpperCase();
            }
            if (userInitialsEl) {
                userInitialsEl.textContent = initials;
            }
        }
    }
}

function updateStatus(type, text) {
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');

    if (statusText) {
        statusText.textContent = text;
    }

    if (statusDot) {
        statusDot.className = 'status-dot w-2.5 h-2.5 rounded-full inline-block flex-shrink-0';
        if (type === 'authenticated') {
            statusDot.classList.add('bg-green-500', 'shadow-lg', 'shadow-green-500/50');
        } else if (type === 'error') {
            statusDot.classList.add('bg-red-500', 'shadow-lg', 'shadow-red-500/50');
        } else {
            statusDot.classList.add('bg-white/50', 'animate-pulse-dot');
        }
    }
}

function switchTab(tab) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const passwordTab = document.getElementById('password-login-tab');
    const ssoTab = document.getElementById('sso-login-tab');

    tabButtons.forEach(btn => {
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (tab === 'password') {
        passwordTab.classList.remove('hidden');
        passwordTab.classList.add('active');
        ssoTab.classList.add('hidden');
        ssoTab.classList.remove('active');
    } else {
        ssoTab.classList.remove('hidden');
        ssoTab.classList.add('active');
        passwordTab.classList.add('hidden');
        passwordTab.classList.remove('active');
    }
}

async function handlePasswordLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;

    if (!email || !password) {
        showError('Email and password are required');
        return;
    }

    updateStatus('default', 'Authenticating...');

    try {
        await apiClient.initCsrfToken();
        const response = await apiClient.post('/sso/authenticate', {
            email: email,
            password: password,
        });

        if (response.success && response.data && response.data.user) {
            currentUser = response.data.user;
            
            if (response.data.token) {
                localStorage.setItem('auth_token', response.data.token);
                window.apiClientInstance.authToken = response.data.token;
            }
            
            showUserSection();
            showSuccess('Login successful!');
            updateStatus('authenticated', 'Authenticated');
            document.getElementById('password-login-form').reset();
        } else {
            showError(response.message || 'Authentication failed');
            updateStatus('error', 'Authentication failed');
        }
    } catch (error) {
        showError('Login failed: ' + (error.message || 'Unknown error'));
        updateStatus('error', 'Authentication failed');
    }
}

async function handleSsoLogin() {
    if (!currentUser) {
        switchTab('password');
        showError('Please login with username and password first, then use SSO URL for single sign-on');
        return;
    }

    const organizationId = document.getElementById('organization-id')?.value.trim();
    const provider = document.getElementById('provider-select')?.value || 'authkit';

    try {
        const response = await apiClient.post('/sso/authorize', {
            organization_id: organizationId || null,
            provider: provider,
        });

        if (response.success && response.data && response.data.url) {
            updateSsoUrl(response.data.url);
            window.location.href = response.data.url;
        } else {
            showError(response.message || 'Failed to generate authorization URL');
        }
    } catch (error) {
        showError('Failed to initiate SSO login: ' + (error.message || 'Unknown error'));
    }
}

function updateSsoUrl(url) {
    const urlDisplay = document.getElementById('sso-url-display');
    if (urlDisplay) {
        if (url) {
            urlDisplay.textContent = url;
            window.currentSsoUrl = url;
        } else {
            urlDisplay.textContent = 'Generate SSO URL by clicking "Sign in with SSO"';
        }
    }
}

function copySsoUrl() {
    const url = window.currentSsoUrl || document.getElementById('sso-url-display')?.textContent;
    if (url && url !== '-') {
        navigator.clipboard.writeText(url).then(() => {
            showSuccess('SSO URL copied to clipboard!');
        }).catch(() => {
            showError('Failed to copy URL');
        });
    } else {
        showError('No SSO URL available');
    }
}

async function handleLogout() {
    try {
        const response = await apiClient.post('/sso/logout');
        
        if (response.success) {
            currentUser = null;
            showLoginSection();
            showSuccess('Logged out successfully');
        } else {
            showError(response.message || 'Failed to logout');
        }
    } catch (error) {
        showError('Failed to logout: ' + (error.message || 'Unknown error'));
    }
}

function showError(message) {
    const errorEl = document.getElementById('sso-error');
    const successEl = document.getElementById('sso-success');
    
    if (errorEl) {
        const span = errorEl.querySelector('span');
        if (span) span.textContent = message;
        errorEl.classList.remove('hidden');
        setTimeout(() => {
            errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
    if (successEl) {
        successEl.classList.add('hidden');
    }
}

function showSuccess(message) {
    const errorEl = document.getElementById('sso-error');
    const successEl = document.getElementById('sso-success');
    
    if (successEl) {
        const span = successEl.querySelector('span');
        if (span) span.textContent = message;
        successEl.classList.remove('hidden');
        setTimeout(() => {
            successEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
    if (errorEl) {
        errorEl.classList.add('hidden');
    }
}

if (window.location.search.includes('code=') || window.location.search.includes('error=')) {
    handleCallback();
}

if (window.ssoCallbackData) {
    currentUser = window.ssoCallbackData;
    if (window.ssoCallbackToken) {
        localStorage.setItem('auth_token', window.ssoCallbackToken);
        window.apiClientInstance.authToken = window.ssoCallbackToken;
    }
    showUserSection();
    showSuccess('Authentication successful!');
    window.history.replaceState({}, document.title, window.location.pathname);
}

async function loadConfigInfo() {
    const configSection = document.getElementById('sso-config-section');
    if (!configSection) return;
    
    try {
        const response = await apiClient.get('/api_info');
        if (response && response.public_info) {
            const isDebug = response.public_info.debug !== false;
            
            if (!isDebug) {
                configSection.style.display = 'none';
                return;
            }
            
            const env = response.public_info.env || {};
            const clientId = env.WORKOS_CLIENT_ID || 'Not configured';
            const apiKey = env.WORKOS_API_KEY ? 'Configured' : 'Not configured';
            const redirectUrl = env.WORKOS_REDIRECT_URL || 'Not configured';
            const clientSecret = env.WORKOS_CLIENT_SECRET ? 'Configured' : 'Not configured';

            updateConfigItem('config-client-id', 'badge-client-id', clientId);
            updateConfigItem('config-api-key', 'badge-api-key', apiKey);
            updateConfigItem('config-redirect-url', 'badge-redirect-url', redirectUrl);
            updateConfigItem('config-client-secret', 'badge-client-secret', clientSecret);
        }
    } catch (error) {
        if (error && error.status === 401) {
            // /api_info sits behind the dashboard login wall: hide the debug
            // config panel for guests instead of logging an error.
            if (configSection) {
                configSection.style.display = 'none';
            }
            return;
        }
        console.error('Failed to load config info:', error);
        if (configSection) {
            configSection.style.display = 'none';
        }
    }
}

function updateConfigItem(valueId, badgeId, value) {
    const valueEl = document.getElementById(valueId);
    const badgeEl = document.getElementById(badgeId);
    
    if (valueEl) {
        valueEl.textContent = value;
        if (value !== 'Not configured') {
            valueEl.classList.add('text-green-600', 'font-medium');
            valueEl.classList.remove('text-gray-700');
            if (badgeEl) {
                badgeEl.textContent = 'OK';
                badgeEl.className = 'text-xs px-2 py-1 rounded-md font-semibold uppercase tracking-wide bg-green-100 text-green-800';
            }
        } else {
            valueEl.classList.remove('text-green-600', 'font-medium');
            valueEl.classList.add('text-gray-700');
            if (badgeEl) {
                badgeEl.textContent = 'NO';
                badgeEl.className = 'text-xs px-2 py-1 rounded-md font-semibold uppercase tracking-wide bg-red-100 text-red-800';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupEventListeners();
    loadConfigInfo();
});

async function handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
        showError('Authentication failed: ' + error);
        updateStatus('error', 'Authentication failed');
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }

    if (code && !window.ssoCallbackData) {
        updateStatus('default', 'Processing authentication...');
        try {
            const response = await apiClient.get('/sso/callback' + window.location.search);
            
            if (response.success && response.data && response.data.user) {
                currentUser = response.data.user;
                showUserSection();
                showSuccess('Authentication successful!');
                window.history.replaceState({}, document.title, window.location.pathname);
            } else {
                showError(response.message || 'Authentication failed');
                updateStatus('error', 'Authentication failed');
            }
        } catch (error) {
            showError('Failed to complete authentication: ' + (error.message || 'Unknown error'));
            updateStatus('error', 'Authentication failed');
        }
    }
}

