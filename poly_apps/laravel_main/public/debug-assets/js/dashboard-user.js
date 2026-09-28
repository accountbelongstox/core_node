/**
 * Dashboard User Menu
 * Top-right identity widget for the debug dashboard shell.
 *
 * Responsibilities:
 * - Resolve the acting identity via GET /auth/status (always 200) and cache it
 *   in localStorage (dashboard_user_cache) so the header renders instantly on
 *   reload and protected menu gating works before the network resolves.
 * - Render the sign-in button, the signed-in user chip and its dropdown.
 * - Provide the embedded login/register modal (dashboard-auth-modal.html).
 * - Gate protected sections (menu visibility + navigation guard) so they stay
 *   hidden until an identity is present, matching the server-side
 *   dashboard.auth enforcement on the API testing data endpoints.
 * - Bridge iframe sections: they request login via postMessage and get
 *   notified when auth changes so gates re-evaluate.
 *
 * Identity contract (App\Http\EnvironmentApiInfo\DashboardAuthController):
 * status payload = { debug_mode, login_required, authenticated, user,
 * registration_open, elevation_open }.
 */

const AUTH_STATUS_URL = '/auth/status';
const AUTH_LOGIN_URL = '/auth/login';
const AUTH_REGISTER_URL = '/auth/register';
const AUTH_LOGOUT_URL = '/auth/logout';
const AUTH_MODAL_TEMPLATE_URL = '/debug-assets/debug-tools/templates/dashboard-auth-modal.html';
const AUTH_MODAL_CSS_URL = '/debug-assets/debug-tools/templates/auth-modal.css';
const AUTH_TOKEN_STORAGE_KEY = 'auth_token';
const AUTH_USER_CACHE_KEY = 'dashboard_user_cache';

/** Sections that require a signed-in identity (login wall applies). */
const PROTECTED_SECTIONS = ['api-testing', 'dashboard-management'];

const DashboardUser = {
    status: null,
    modalReady: false,
    readyPromise: null,

    init() {
        this.loadCachedState();
        this.bindStaticEvents();
        this.listenToSections();
        this.readyPromise = this.refresh();
    },

    /**
     * Synchronous cache restore: renders the cached identity before the
     * network resolves so the header does not flash the signed-out state.
     */
    loadCachedState() {
        try {
            const cached = JSON.parse(localStorage.getItem(AUTH_USER_CACHE_KEY) || 'null');
            const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
            if (cached && token && cached.user && cached.authenticated) {
                this.status = cached;
                this.render();
            }
        } catch (error) {
            // Corrupted cache is ignored; the network refresh is authoritative.
        }
    },

    persistCachedState() {
        try {
            localStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(this.status));
        } catch (error) {
            // Storage full or blocked: cache is best-effort only.
        }
    },

    clearCachedState() {
        localStorage.removeItem(AUTH_USER_CACHE_KEY);
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    },

    bindStaticEvents() {
        const signInBtn = document.getElementById('user-menu-signin-btn');
        const chip = document.getElementById('user-menu-chip');
        const manageBtn = document.getElementById('user-menu-manage-btn');
        const logoutBtn = document.getElementById('user-menu-logout-btn');

        if (signInBtn) {
            signInBtn.addEventListener('click', () => this.openModal('login'));
        }
        if (chip) {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }
        if (manageBtn) {
            manageBtn.addEventListener('click', () => {
                this.closeDropdown();
                if (window.showSection) window.showSection('dashboard-management');
            });
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        document.addEventListener('click', () => this.closeDropdown());
    },

    listenToSections() {
        window.addEventListener('message', (event) => {
            if (!event.data || typeof event.data.type !== 'string') {
                return;
            }
            // Only honor requests raised by the active section iframe.
            const iframe = document.getElementById('section-iframe');
            if (iframe && event.source !== iframe.contentWindow) {
                return;
            }

            if (event.data.type === 'dashboard:open-login') {
                this.openModal(event.data.tab || 'login');
            } else if (event.data.type === 'dashboard:profile-updated' && event.data.user) {
                if (this.status) {
                    this.status.user = event.data.user;
                    this.persistCachedState();
                    this.render();
                }
            }
        });
    },

    async refresh() {
        let status;
        try {
            status = await apiClientInstance.get(AUTH_STATUS_URL);
        } catch (error) {
            // Transient failure: keep the previous state, never log out locally.
            console.error('Failed to resolve dashboard auth status:', error);
            return;
        }

        this.status = status;
        if (status.authenticated) {
            this.persistCachedState();
        } else {
            this.clearCachedState();
        }
        this.render();
    },

    render() {
        const data = this.status || {};
        const user = data.user || null;
        const signInBtn = document.getElementById('user-menu-signin-btn');
        const chip = document.getElementById('user-menu-chip');

        if (signInBtn && chip) {
            if (data.authenticated && user) {
                signInBtn.classList.add('hidden');
                chip.classList.remove('hidden');
                this.renderSignedIn(user);
            } else {
                chip.classList.add('hidden');
                this.closeDropdown();
                signInBtn.classList.remove('hidden');
            }
        }

        this.updateMenuVisibility();
    },

    /**
     * Whether the given section may be shown under the current identity.
     * Protected sections stay hidden until authenticated; the server enforces
     * the same rule on their data endpoints.
     */
    isSectionAllowed(sectionType) {
        if (!PROTECTED_SECTIONS.includes(sectionType)) {
            return true;
        }
        if (!this.status) {
            return false;
        }
        return this.status.authenticated || !this.status.login_required;
    },

    /**
     * Toggle sidebar menu items for protected sections: hidden while signed
     * out on hosts that require login, visible for authenticated users and
     * loopback debug hosts (login-free by design).
     */
    updateMenuVisibility() {
        const requireLogin = !this.isSectionAllowed('api-testing');

        PROTECTED_SECTIONS.forEach((section) => {
            const link = document.querySelector(`[data-section="${section}"]`);
            const item = link ? link.closest('.menu-item') : null;
            if (item) {
                item.classList.toggle('hidden', requireLogin);
            }
        });
    },

    renderSignedIn(user) {
        const name = user.nickname || user.username || user.name || user.email || 'User';
        const initials = String(name).trim().substring(0, 2).toUpperCase();
        const isSuperAdmin = !!user.is_super_admin;
        const roleText = isSuperAdmin ? 'Super Admin' : (user.is_admin ? 'Admin' : 'User');

        const initialsEl = document.getElementById('user-menu-initials');
        const nameEl = document.getElementById('user-menu-name');
        const roleEl = document.getElementById('user-menu-role');
        const dropdownNameEl = document.getElementById('user-menu-dropdown-name');
        const dropdownEmailEl = document.getElementById('user-menu-dropdown-email');
        const dropdownRoleEl = document.getElementById('user-menu-dropdown-role');

        if (initialsEl) initialsEl.textContent = initials;
        if (nameEl) nameEl.textContent = name;
        if (dropdownNameEl) dropdownNameEl.textContent = name;
        if (dropdownEmailEl) dropdownEmailEl.textContent = user.email || 'No email bound';

        [roleEl, dropdownRoleEl].forEach((el) => {
            if (!el) return;
            el.textContent = roleText;
            el.classList.toggle('role-admin', isSuperAdmin || !!user.is_admin);
        });

        const avatarEl = document.getElementById('user-menu-avatar');
        if (avatarEl) {
            const existingImg = avatarEl.querySelector('img');
            if (existingImg) existingImg.remove();
            if (user.avatar) {
                const img = document.createElement('img');
                img.src = user.avatar;
                img.alt = name;
                avatarEl.appendChild(img);
            }
        }
    },

    toggleDropdown() {
        const dropdown = document.getElementById('user-menu-dropdown');
        if (!dropdown) return;
        dropdown.classList.toggle('hidden');
    },

    closeDropdown() {
        const dropdown = document.getElementById('user-menu-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    },

    notifySectionsAuthenticated() {
        const iframe = document.getElementById('section-iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'dashboard:auth-changed' }, window.location.origin);
        }
        window.dispatchEvent(new CustomEvent('dashboard:auth-changed'));
    },

    async ensureModal() {
        if (this.modalReady) return;

        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = AUTH_MODAL_CSS_URL;
        document.head.appendChild(cssLink);

        const response = await fetch(AUTH_MODAL_TEMPLATE_URL);
        if (!response.ok) {
            throw new Error('Failed to load auth modal template');
        }
        const html = await response.text();
        document.body.insertAdjacentHTML('beforeend', html);

        document.getElementById('dashboard-auth-modal-overlay').addEventListener('click', () => this.closeModal());
        document.getElementById('dashboard-auth-modal-close').addEventListener('click', () => this.closeModal());
        document.querySelectorAll('#dashboard-auth-modal .auth-tab').forEach((btn) => {
            btn.addEventListener('click', () => this.switchModalTab(btn.dataset.tab));
        });
        document.getElementById('dashboard-login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('dashboard-register-form').addEventListener('submit', (e) => this.handleRegister(e));

        this.modalReady = true;
    },

    async openModal(tab = 'login') {
        try {
            await this.ensureModal();
        } catch (error) {
            console.error('Failed to open auth modal:', error);
            return;
        }
        this.closeDropdown();
        this.switchModalTab(tab);
        const modal = document.getElementById('dashboard-auth-modal');
        modal.classList.remove('hidden');
        const firstInput = modal.querySelector('#dashboard-login-identifier');
        if (firstInput && tab === 'login') firstInput.focus();
    },

    closeModal() {
        const modal = document.getElementById('dashboard-auth-modal');
        if (modal) modal.classList.add('hidden');
    },

    switchModalTab(tab) {
        document.querySelectorAll('#dashboard-auth-modal .auth-tab').forEach((b) => {
            b.classList.toggle('active', b.dataset.tab === tab);
        });
        document.getElementById('dashboard-login-panel').classList.toggle('hidden', tab !== 'login');
        document.getElementById('dashboard-register-panel').classList.toggle('hidden', tab !== 'register');
        if (this.status) {
            document.getElementById('dashboard-register-hint').textContent = this.status.registration_open
                ? 'Registration requires the server invitation code.'
                : 'Registration is currently closed on this server.';
        }
    },

    showModalError(id, message) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = message;
        el.classList.remove('hidden');
    },

    hideModalError(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    },

    /**
     * Apply a login/register session: persist token + user cache, render the
     * identity immediately, then let refresh() pull the server truth.
     */
    applySession(data) {
        if (data && data.token) {
            localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.token);
        }
        if (data && data.user) {
            this.status = Object.assign({}, this.status || {}, {
                authenticated: true,
                user: data.user,
            });
            this.persistCachedState();
            this.render();
        }
        this.closeModal();
        this.refresh();
        this.notifySectionsAuthenticated();
    },

    async handleLogin(event) {
        event.preventDefault();
        this.hideModalError('dashboard-login-error');

        const identifier = document.getElementById('dashboard-login-identifier').value.trim();
        const password = document.getElementById('dashboard-login-password').value;

        if (!identifier || !password) {
            this.showModalError('dashboard-login-error', 'Account and password are required.');
            return;
        }

        try {
            const response = await apiClientInstance.post(AUTH_LOGIN_URL, { identifier, password });
            this.applySession(response.data);
        } catch (error) {
            this.showModalError('dashboard-login-error', error.message || 'Sign in failed.');
        }
    },

    async handleRegister(event) {
        event.preventDefault();
        this.hideModalError('dashboard-register-error');

        const username = document.getElementById('dashboard-register-username').value.trim();
        const name = document.getElementById('dashboard-register-name').value.trim();
        const password = document.getElementById('dashboard-register-password').value;
        const passwordConfirm = document.getElementById('dashboard-register-password-confirm').value;
        const invitationCode = document.getElementById('dashboard-register-invitation').value.trim();

        if (password !== passwordConfirm) {
            this.showModalError('dashboard-register-error', 'Passwords do not match.');
            return;
        }

        try {
            const response = await apiClientInstance.post(AUTH_REGISTER_URL, {
                username,
                name: name || null,
                password,
                invitation_code: invitationCode,
            });
            this.applySession(response.data);
        } catch (error) {
            this.showModalError('dashboard-register-error', error.message || 'Registration failed.');
        }
    },

    async logout() {
        this.closeDropdown();
        try {
            await apiClientInstance.post(AUTH_LOGOUT_URL, {});
        } catch (error) {
            // Session may already be gone; clearing local identity is what matters.
        }
        this.clearCachedState();
        this.status = { login_required: true, authenticated: false, user: null };
        this.render();
        this.notifySectionsAuthenticated();

        // Leave protected sections when the identity is gone.
        const activeSection = localStorage.getItem('active_section');
        if (PROTECTED_SECTIONS.includes(activeSection) && window.showSection) {
            window.showSection('sso');
        }
        this.refresh();
    }
};

window.DashboardUser = DashboardUser;

document.addEventListener('DOMContentLoaded', () => {
    DashboardUser.init();
});
