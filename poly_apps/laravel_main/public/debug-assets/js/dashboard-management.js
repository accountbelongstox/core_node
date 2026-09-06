/**
 * Dashboard Management Section
 * Profile card, super-code elevation and the super-admin accounts table.
 *
 * Endpoints (App\Http\EnvironmentApiInfo\DashboardAuthController):
 * - GET  /auth/status   combined auth + mode status (always 200)
 * - POST /auth/elevate  super-code elevation (dashboard.auth gate)
 * - GET  /auth/users    registered accounts (super admins only)
 * - POST /auth/logout   sign out
 */

const MANAGEMENT_STATUS_URL = '/auth/status';
const MANAGEMENT_ELEVATE_URL = '/auth/elevate';
const MANAGEMENT_USERS_URL = '/auth/users';
const MANAGEMENT_LOGOUT_URL = '/auth/logout';

let managementStatus = null;

document.addEventListener('DOMContentLoaded', async function() {
    bindManagementEvents();
    const authenticated = await resolveManagementAuth();
    if (authenticated) {
        await renderManagement();
    }
});

function bindManagementEvents() {
    const signInBtn = document.getElementById('management-signin-btn');
    if (signInBtn) {
        signInBtn.addEventListener('click', () => {
            // Wildcard target: about:srcdoc frames have an opaque origin and the
            // payload is a non-sensitive instruction validated by the parent.
            window.parent.postMessage({ type: 'dashboard:open-login', tab: 'login' }, '*');
        });
    }

    const elevateForm = document.getElementById('management-elevate-form');
    if (elevateForm) {
        elevateForm.addEventListener('submit', handleElevate);
    }

    const refreshBtn = document.getElementById('management-users-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadRegisteredUsers);
    }

    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'dashboard:auth-changed') {
            resolveManagementAuth().then((authenticated) => {
                if (authenticated) renderManagement();
            });
        }
    });
}

/**
 * Status answers 200 even when signed out; the flag decides the view.
 * @returns {boolean} True when signed in
 */
async function resolveManagementAuth() {
    const gate = document.getElementById('management-auth-gate');
    const content = document.getElementById('management-content');

    try {
        managementStatus = await apiClientInstance.get(MANAGEMENT_STATUS_URL);
    } catch (error) {
        console.error('Auth status check failed:', error);
        managementStatus = { authenticated: false };
    }

    if (managementStatus.authenticated) {
        if (gate) gate.classList.add('hidden');
        if (content) content.classList.remove('hidden');
        return true;
    }

    if (gate) gate.classList.remove('hidden');
    if (content) content.classList.add('hidden');
    return false;
}

async function renderManagement() {
    const user = (managementStatus && managementStatus.user) || {};

    const name = user.nickname || user.username || user.name || user.email || 'User';
    const initialsEl = document.getElementById('management-initials');
    const nameEl = document.getElementById('management-name');
    const emailEl = document.getElementById('management-email');
    const idEl = document.getElementById('management-id');
    const badgeEl = document.getElementById('management-role-badge');

    if (initialsEl) initialsEl.textContent = String(name).trim().substring(0, 2).toUpperCase();
    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = user.email || 'No email bound';
    if (idEl) idEl.textContent = 'ID: ' + (user.id ?? '-');
    if (badgeEl) {
        badgeEl.textContent = user.is_super_admin ? 'Super Administrator' : (user.is_admin ? 'Administrator' : 'User');
        badgeEl.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ' +
            (user.is_super_admin ? 'bg-orange-100 text-orange-700' : (user.is_admin ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'));
    }

    const elevationCard = document.getElementById('management-elevation-card');
    if (elevationCard) {
        if (user.is_super_admin || (managementStatus && !managementStatus.elevation_open)) {
            elevationCard.classList.add('hidden');
        } else {
            elevationCard.classList.remove('hidden');
        }
    }

    const usersCard = document.getElementById('management-users-card');
    if (usersCard) {
        if (user.is_super_admin) {
            usersCard.classList.remove('hidden');
            await loadRegisteredUsers();
        } else {
            usersCard.classList.add('hidden');
        }
    }
}

async function handleElevate(event) {
    event.preventDefault();
    const messageEl = document.getElementById('management-elevate-message');
    const superCode = document.getElementById('management-super-code')?.value;

    if (!superCode) return;

    hideManagementMessage();
    try {
        const response = await apiClientInstance.post(MANAGEMENT_ELEVATE_URL, { super_code: superCode });
        showManagementMessage(response.message || 'Account elevated to Super Administrator.', 'success');
        const elevateForm = document.getElementById('management-elevate-form');
        if (elevateForm) elevateForm.reset();
        managementStatus = await apiClientInstance.get(MANAGEMENT_STATUS_URL);
        await renderManagement();
    } catch (error) {
        showManagementMessage(error.message || 'Elevation failed.', 'error');
    }
}

async function loadRegisteredUsers() {
    const bodyEl = document.getElementById('management-users-body');
    const emptyEl = document.getElementById('management-users-empty');

    try {
        const response = await apiClientInstance.get(MANAGEMENT_USERS_URL);
        const users = (response.data && response.data.users) || [];

        if (bodyEl) {
            bodyEl.innerHTML = '';
            users.forEach((user) => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50';
                row.innerHTML = [
                    '<td class="px-6 py-3 font-mono text-gray-500">' + escapeManagementHtml(String(user.id ?? '-')) + '</td>',
                    '<td class="px-6 py-3 font-semibold text-gray-900">' + escapeManagementHtml(user.username ?? '-') + '</td>',
                    '<td class="px-6 py-3 text-gray-600">' + escapeManagementHtml(user.email ?? '-') + '</td>',
                    '<td class="px-6 py-3">' + escapeManagementHtml(user.rolename ?? '-') + '</td>',
                    '<td class="px-6 py-3 font-mono">' + escapeManagementHtml(String(user.rolelevel ?? '-')) + '</td>',
                    '<td class="px-6 py-3 text-gray-500">' + escapeManagementHtml((user.created_at || '').substring(0, 10)) + '</td>'
                ].join('');
                bodyEl.appendChild(row);
            });
        }

        if (emptyEl) emptyEl.classList.toggle('hidden', users.length > 0);
    } catch (error) {
        if (bodyEl) bodyEl.innerHTML = '';
        if (emptyEl) {
            emptyEl.textContent = error.message || 'Failed to load accounts.';
            emptyEl.classList.remove('hidden');
        }
    }
}

function showManagementMessage(message, type) {
    const messageEl = document.getElementById('management-elevate-message');
    if (!messageEl) return;
    messageEl.textContent = message;
    messageEl.className = 'mt-4 p-3 rounded-lg text-sm ' +
        (type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200');
}

function hideManagementMessage() {
    const messageEl = document.getElementById('management-elevate-message');
    if (messageEl) messageEl.classList.add('hidden');
}

function escapeManagementHtml(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}
