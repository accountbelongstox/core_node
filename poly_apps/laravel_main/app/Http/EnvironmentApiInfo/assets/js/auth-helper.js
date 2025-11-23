const AuthHelper = {
    currentUser: null,
    authModalId: 'auth-modal',
    
    init() {
        this.checkAuthStatus();
        this.createAuthModal();
    },
    
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/user', {
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (response.ok) {
                this.currentUser = await response.json();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Auth check failed:', error);
            return false;
        }
    },
    
    createAuthModal() {
        if (document.getElementById(this.authModalId)) return;
        
        const modalHTML = `
            <div id="${this.authModalId}" class="auth-modal" style="display: none;">
                <div class="auth-modal-overlay" onclick="AuthHelper.closeAuthModal()"></div>
                <div class="auth-modal-content">
                    <button class="auth-modal-close" onclick="AuthHelper.closeAuthModal()">×</button>
                    
                    <div class="auth-tabs">
                        <button class="auth-tab active" data-tab="login" onclick="AuthHelper.switchTab('login')">Login</button>
                        <button class="auth-tab" data-tab="register" onclick="AuthHelper.switchTab('register')">Register</button>
                    </div>
                    
                    <div id="auth-login-panel" class="auth-panel">
                        <h3>Login to Continue</h3>
                        <form id="login-form" onsubmit="AuthHelper.handleLogin(event)">
                            <div class="auth-form-group">
                                <label>Email:</label>
                                <input type="email" id="login-email" required class="auth-input" placeholder="your@email.com">
                            </div>
                            <div class="auth-form-group">
                                <label>Password:</label>
                                <input type="password" id="login-password" required class="auth-input" placeholder="Your password">
                            </div>
                            <div id="login-error" class="auth-error" style="display: none;"></div>
                            <button type="submit" class="auth-btn auth-btn-primary">Login</button>
                        </form>
                    </div>
                    
                    <div id="auth-register-panel" class="auth-panel" style="display: none;">
                        <h3>Register New Account</h3>
                        <form id="register-form" onsubmit="AuthHelper.handleRegister(event)">
                            <div class="auth-form-group">
                                <label>Name:</label>
                                <input type="text" id="register-name" required class="auth-input" placeholder="Your name">
                            </div>
                            <div class="auth-form-group">
                                <label>Email:</label>
                                <input type="email" id="register-email" required class="auth-input" placeholder="your@email.com">
                            </div>
                            <div class="auth-form-group">
                                <label>Password:</label>
                                <input type="password" id="register-password" required class="auth-input" placeholder="At least 8 characters">
                            </div>
                            <div class="auth-form-group">
                                <label>Confirm Password:</label>
                                <input type="password" id="register-password-confirm" required class="auth-input" placeholder="Confirm password">
                            </div>
                            <div class="auth-form-group">
                                <label>Invitation Code:</label>
                                <input type="text" id="register-invitation" required class="auth-input" placeholder="APPQY2025" value="APPQY2025">
                                <small style="color: #666; font-size: 12px;">固定邀请码: APPQY2025</small>
                            </div>
                            <div id="register-error" class="auth-error" style="display: none;"></div>
                            <button type="submit" class="auth-btn auth-btn-primary">Register</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        const styles = `
            <style>
                .auth-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .auth-modal-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                }
                .auth-modal-content {
                    position: relative;
                    background: white;
                    border-radius: 8px;
                    padding: 30px;
                    max-width: 450px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                }
                .auth-modal-close {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: none;
                    border: none;
                    font-size: 28px;
                    cursor: pointer;
                    color: #999;
                    line-height: 1;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                }
                .auth-modal-close:hover {
                    color: #333;
                }
                .auth-tabs {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #eee;
                }
                .auth-tab {
                    flex: 1;
                    padding: 12px 20px;
                    background: none;
                    border: none;
                    border-bottom: 3px solid transparent;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 500;
                    color: #666;
                    transition: all 0.3s;
                }
                .auth-tab:hover {
                    color: #333;
                }
                .auth-tab.active {
                    color: #007bff;
                    border-bottom-color: #007bff;
                }
                .auth-panel h3 {
                    margin: 0 0 20px 0;
                    color: #333;
                }
                .auth-form-group {
                    margin-bottom: 15px;
                }
                .auth-form-group label {
                    display: block;
                    margin-bottom: 5px;
                    color: #555;
                    font-weight: 500;
                }
                .auth-input {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                }
                .auth-input:focus {
                    outline: none;
                    border-color: #007bff;
                }
                .auth-btn {
                    width: 100%;
                    padding: 12px;
                    border: none;
                    border-radius: 4px;
                    font-size: 16px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .auth-btn-primary {
                    background: #007bff;
                    color: white;
                }
                .auth-btn-primary:hover {
                    background: #0056b3;
                }
                .auth-error {
                    padding: 10px;
                    margin-bottom: 15px;
                    background: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                    border-radius: 4px;
                    font-size: 14px;
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },
    
    showAuthModal() {
        const modal = document.getElementById(this.authModalId);
        if (modal) {
            modal.style.display = 'flex';
            this.switchTab('login');
        }
    },
    
    closeAuthModal() {
        const modal = document.getElementById(this.authModalId);
        if (modal) {
            modal.style.display = 'none';
        }
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
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        
        errorDiv.style.display = 'none';
        
        try {
            await this.getCsrfToken();
            
            const response = await fetch('/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentUser = data.user || { email };
                this.closeAuthModal();
                window.location.reload();
            } else {
                errorDiv.textContent = data.message || 'Login failed';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
        }
    },
    
    async handleRegister(event) {
        event.preventDefault();
        
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const passwordConfirm = document.getElementById('register-password-confirm').value;
        const invitationCode = document.getElementById('register-invitation').value;
        const errorDiv = document.getElementById('register-error');
        
        errorDiv.style.display = 'none';
        
        if (password !== passwordConfirm) {
            errorDiv.textContent = 'Passwords do not match';
            errorDiv.style.display = 'block';
            return;
        }
        
        if (invitationCode !== 'APPQY2025') {
            errorDiv.textContent = 'Invalid invitation code';
            errorDiv.style.display = 'block';
            return;
        }
        
        try {
            await this.getCsrfToken();
            
            const response = await fetch('/register', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    password_confirmation: passwordConfirm,
                    invitation_code: invitationCode
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentUser = data.user || { email };
                this.closeAuthModal();
                window.location.reload();
            } else {
                const errors = data.errors || {};
                const errorMessages = Object.values(errors).flat();
                errorDiv.textContent = errorMessages.join(', ') || data.message || 'Registration failed';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Register error:', error);
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
        }
    },
    
    async getCsrfToken() {
        try {
            await fetch('/sanctum/csrf-cookie', {
                credentials: 'include'
            });
        } catch (error) {
            console.error('CSRF token fetch failed:', error);
        }
    },
    
    async makeAuthenticatedRequest(url, options = {}) {
        const defaultOptions = {
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...options.headers
            }
        };
        
        const response = await fetch(url, { ...options, ...defaultOptions });
        
        if (response.status === 401) {
            this.showAuthModal();
            throw new Error('Authentication required');
        }
        
        return response;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AuthHelper.init();
});
