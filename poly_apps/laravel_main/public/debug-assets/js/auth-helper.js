const AuthHelper = {
    currentUser: null,
    authModalId: 'auth-modal',
    maskedInvitationCode: '',

    init() {
        this.loadInvitationCode();
        this.checkAuthStatus();
        this.createAuthModal();
    },
    
    async loadInvitationCode() {
        try {
            const response = await APIClient.get('/api/app_qy_v1/invitation-code', { includeAuth: false });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.masked_code) {
                    this.maskedInvitationCode = data.masked_code;
                }
            }
        } catch (error) {
            console.error('Failed to load invitation code:', error);
        }
    },
    
    async checkAuthStatus() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                return false;
            }

            const response = await APIClient.get('/api/user');

            if (response.ok) {
                this.currentUser = await response.json();
                return true;
            } else {
                localStorage.removeItem('auth_token');
                return false;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('auth_token');
            return false;
        }
    },
    
    async createAuthModal() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/debug-assets/debug-tools/templates/auth-modal.css';
        document.head.appendChild(link);
        
        const response = await fetch('/debug-assets/debug-tools/templates/auth-modal.html');
        const modalHTML = await response.text();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        setTimeout(() => {
            const hintEl = document.getElementById('invitation-hint');
            if (this.maskedInvitationCode) {
                hintEl.textContent = `Fixed Invitation Code: ${this.maskedInvitationCode}`;
            }
        }, 100);
    },
    
    showAuthModal() {
        const modal = document.getElementById(this.authModalId);
        modal.style.display = 'flex';
        this.switchTab('login');
        
        const hintEl = document.getElementById('invitation-hint');
        if (this.maskedInvitationCode) {
            hintEl.textContent = `固定邀请码: ${this.maskedInvitationCode}`;
        }
    },
    
    closeAuthModal() {
        const modal = document.getElementById(this.authModalId);
        modal.style.display = 'none';
    },
    
    switchTab(tab) {
        const tabs = document.querySelectorAll('.auth-tab');
        tabs.forEach(t => {
            if (t.dataset.tab === tab) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
        
        const loginPanel = document.getElementById('auth-login-panel');
        const registerPanel = document.getElementById('auth-register-panel');
        
        if (tab === 'login') {
            loginPanel.style.display = 'block';
            registerPanel.style.display = 'none';
        } else {
            loginPanel.style.display = 'none';
            registerPanel.style.display = 'block';
        }
    },
    
    async handleLogin(event) {
        event.preventDefault();

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');

        errorDiv.style.display = 'none';

        try {
            const response = await APIClient.post('/api/dict/v1/login', { username, password }, { includeAuth: false });

            const data = await response.json();

            if (response.ok && data.success) {
                this.currentUser = data.data.user;
                const loginToken = data.data.login_token;

                localStorage.setItem('auth_token', loginToken);

                alert(`Login successful! Welcome, ${this.currentUser.username}!`);
                this.closeAuthModal();
                window.location.reload();
            } else {
                const errorMessage = data.message;
                alert(`Login failed: ${errorMessage}`);
                errorDiv.textContent = errorMessage;
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            const errorMessage = 'Network error. Please try again.';
            alert(`Login error: ${errorMessage}`);
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
        }
    },
    
    async handleRegister(event) {
        event.preventDefault();

        const username = document.getElementById('register-username').value;
        const name = document.getElementById('register-name').value;
        const password = document.getElementById('register-password').value;
        const passwordConfirm = document.getElementById('register-password-confirm').value;
        const invitationCode = document.getElementById('register-invitation').value;
        const errorDiv = document.getElementById('register-error');

        errorDiv.style.display = 'none';

        if (password !== passwordConfirm) {
            const errorMessage = 'Passwords do not match';
            alert(`Registration failed: ${errorMessage}`);
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
            return;
        }

        if (invitationCode !== 'APPQY2025') {
            const errorMessage = 'Invalid invitation code';
            alert(`Registration failed: ${errorMessage}`);
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
            return;
        }

        try {
            const response = await APIClient.post('/api/dict/v1/register', {
                username,
                name,
                password,
                password_confirmation: passwordConfirm,
                invitation_code: invitationCode
            }, { includeAuth: false });

            const data = await response.json();

            if (response.ok && data.success) {
                this.currentUser = data.data.user;
                const loginToken = data.data.login_token;

                localStorage.setItem('auth_token', loginToken);

                alert(`Registration successful! Welcome, ${this.currentUser.username}!`);
                this.closeAuthModal();
                window.location.reload();
            } else {
                const errors = data.errors;
                const errorMessages = Object.values(errors).flat();
                const errorMessage = errorMessages.join(', ');
                alert(`Registration failed: ${errorMessage}`);
                errorDiv.textContent = errorMessage;
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Register error:', error);
            const errorMessage = 'Network error. Please try again.';
            alert(`Registration error: ${errorMessage}`);
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
        }
    },
    
    async makeAuthenticatedRequest(url, options = {}) {
        const method = options.method;
        const body = JSON.parse(options.body);
        const customHeaders = options.headers;

        let response;
        try {
            if (method === 'GET') {
                response = await APIClient.get(url, { headers: customHeaders });
            } else if (method === 'POST') {
                response = await APIClient.post(url, body, { headers: customHeaders });
            } else if (method === 'PUT') {
                response = await APIClient.put(url, body, { headers: customHeaders });
            } else if (method === 'DELETE') {
                response = await APIClient.delete(url, { headers: customHeaders });
            } else if (method === 'PATCH') {
                response = await APIClient.patch(url, body, { headers: customHeaders });
            } else {
                response = await APIClient.request(url, options);
            }

            if (response.status === 401) {
                localStorage.removeItem('auth_token');
                this.currentUser = null;
                this.showAuthModal();
                throw new Error('Authentication required');
            }

            return response;
        } catch (error) {
            if (error.message === 'Authentication required') {
                throw error;
            }
            throw error;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AuthHelper.init();
});
