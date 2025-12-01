const OctaneTasksManager = {
    currentData: null,
    refreshInterval: null,

    init() {
        this.loadStatus();
        this.startAutoRefresh();
    },

    async loadStatus() {
        try {
            const response = await fetch('/octane-tasks/status');
            const result = await response.json();

            if (!result.success) {
                this.showError('Failed to load task status: ' + result.error);
                return;
            }

            this.currentData = result.data;
            this.renderStatus();
        } catch (error) {
            this.showError('Error loading task status: ' + error.message);
        }
    },

    renderStatus() {
        if (!this.currentData) return;

        const summary = this.currentData.summary;
        const tasks = this.currentData.tasks;
        const heartbeat = this.currentData.heartbeat;

        document.getElementById('timer-status').textContent =
            summary.timer_running ? '✅ Running' : '❌ Stopped';

        document.getElementById('total-tasks').textContent =
            summary.total_discovered;

        document.getElementById('running-tasks').textContent =
            summary.total_running;

        document.getElementById('total-ticks').textContent =
            summary.total_ticks.toLocaleString();

        this.renderHeartbeat(heartbeat);
        this.renderTasksList(tasks);
    },

    renderHeartbeat(heartbeat) {
        const container = document.getElementById('heartbeat-status');
        const details = document.getElementById('heartbeat-details');

        if (!heartbeat.exists) {
            container.style.display = 'block';
            container.style.background = '#f8d7da';
            container.style.borderColor = '#dc3545';
            details.innerHTML = '<strong>❌ Heartbeat file not found</strong>';
            return;
        }

        if (heartbeat.status === 'alive') {
            container.style.display = 'block';
            container.style.background = '#d4edda';
            container.style.borderColor = '#28a745';
            details.style.color = '#155724';
            details.innerHTML = `<strong>✅ Alive</strong> - Last beat: ${heartbeat.last_modified} (${heartbeat.seconds_ago}s ago)`;
        } else {
            container.style.display = 'block';
            container.style.background = '#fff3cd';
            container.style.borderColor = '#ffc107';
            details.style.color = '#856404';
            details.innerHTML = `<strong>⚠️ Stale</strong> - Last beat: ${heartbeat.last_modified} (${heartbeat.seconds_ago}s ago)`;
        }
    },

    renderTasksList(tasks) {
        const container = document.getElementById('tasks-list-container');

        if (!tasks || tasks.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No tasks found</div>';
            return;
        }

        let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';

        tasks.forEach(task => {
            const statusBadge = this.getStatusBadge(task.status);
            const enabledBadge = task.enabled ? '<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">Enabled</span>' : '<span style="background: #6c757d; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">Disabled</span>';

            const registeredBadge = task.registered ? '<span style="background: #17a2b8; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">Registered</span>' : '';

            let runtimeInfo = '';
            if (task.runtime) {
                const lastRun = task.runtime.last_run ? new Date(task.runtime.last_run * 1000).toLocaleString() : 'Never';
                const lastRunAgo = task.runtime.last_run ? `${task.runtime.last_run_ago}s ago` : '';
                runtimeInfo = `
                    <div style="font-size: 12px; color: #666; margin-top: 8px; padding-top: 8px; border-top: 1px solid #dee2e6;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
                            <div><strong>Last Run:</strong> ${lastRun} ${lastRunAgo}</div>
                            <div><strong>Run Count:</strong> ${task.runtime.run_count.toLocaleString()}</div>
                            <div><strong>Error Count:</strong> ${task.runtime.error_count}</div>
                        </div>
                    </div>
                `;
            }

            const errorInfo = task.error ? `<div style="background: #f8d7da; border: 1px solid #dc3545; padding: 8px; border-radius: 4px; margin-top: 8px; font-size: 12px; color: #721c24;"><strong>Error:</strong> ${task.error}</div>` : '';

            html += `
                <div style="background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div>
                            <span style="font-weight: 600; font-size: 15px;">${task.name || 'Unknown'}</span>
                            ${enabledBadge}
                            ${registeredBadge}
                            ${statusBadge}
                        </div>
                        <div style="font-family: monospace; font-size: 13px; color: #666;">
                            ${task.interval}s interval
                        </div>
                    </div>
                    <div style="font-size: 13px; color: #666;">
                        <strong>Class:</strong> <code style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px;">${task.class}</code>
                    </div>
                    ${errorInfo}
                    ${runtimeInfo}
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    getStatusBadge(status) {
        const badges = {
            'running': '<span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">✅ Running</span>',
            'waiting': '<span style="background: #ffc107; color: #333; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">⏳ Waiting</span>',
            'disabled': '<span style="background: #6c757d; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">⏸️ Disabled</span>',
            'error': '<span style="background: #dc3545; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">❌ Error</span>',
            'not_registered': '<span style="background: #ffc107; color: #333; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">⚠️ Not Registered</span>',
            'running_with_errors': '<span style="background: #ff8c00; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">⚠️ Running (Errors)</span>',
            'registered': '<span style="background: #17a2b8; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">📋 Registered</span>',
        };

        return badges[status] || '<span style="background: #6c757d; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">○ Unknown</span>';
    },

    showError(message) {
        const container = document.getElementById('tasks-list-container');
        container.innerHTML = `
            <div style="background: #f8d7da; border: 1px solid #dc3545; border-radius: 6px; padding: 20px; text-align: center;">
                <div style="color: #721c24; font-size: 14px;">
                    <strong>❌ Error</strong><br>
                    ${message}
                </div>
            </div>
        `;
    },

    refresh() {
        this.loadStatus();
    },

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            const section = document.getElementById('octane-tasks-section');
            if (section.classList.contains('active')) {
                this.loadStatus();
            }
        }, 5000);
    },

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const octaneSection = document.getElementById('octane-tasks-section');
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                if (octaneSection.classList.contains('active')) {
                    OctaneTasksManager.init();
                }
            }
        });
    });

    observer.observe(octaneSection, { attributes: true });
});
