// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/**
 * Flutter Bloom Build Monitor - Web Application Frontend
 * Real-time monitoring of build process and asset replacements
 */

class BuildMonitor {
    constructor() {
        this.buildStatus = 'building';
        this.buildSteps = [
            { id: 'params', name: 'Loading Parameters', status: 'pending' },
            { id: 'config', name: 'Loading Configuration', status: 'pending' },
            { id: 'copy', name: 'Copying Project', status: 'pending' },
            { id: 'pubspec', name: 'Modifying Pubspec', status: 'pending' },
            { id: 'package', name: 'Package Replacement', status: 'pending' },
            { id: 'assets', name: 'Asset Replacement', status: 'pending' },
            { id: 'ready', name: 'Ready for Compilation', status: 'pending' }
        ];
        this.buildData = {};
        this.resultsData = {};
        
        this.init();
    }
    
    init() {
        console.log('Initializing Build Monitor...');
        
        // Start status polling
        this.startStatusPolling();
        
        // Initialize progress steps
        this.renderProgressSteps();
        
        console.log('Build Monitor initialized');
    }
    
    startStatusPolling() {
        // Poll status every 2 seconds
        setInterval(() => {
            this.updateStatus();
        }, 2000);
        
        // Initial status update
        this.updateStatus();
    }
    
    async updateStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            
            this.buildData = data;
            this.updateStatusDisplay(data);
            this.updateBuildInfo(data);
            this.updateProgressSteps(data);
            
            if (data.status === 'ready') {
                this.showConfirmSection();
                await this.loadResults();
            } else if (data.status === 'error') {
                this.showError(data.message || 'Build preparation failed');
            }
            
        } catch (error) {
            console.error('Error fetching status:', error);
            this.showError('Failed to connect to build system');
        }
    }
    
    updateStatusDisplay(data) {
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        const description = document.getElementById('status-description');
        
        // Update status indicator
        indicator.className = 'status-indicator';
        
        if (data.status === 'ready') {
            indicator.classList.add('status-ready');
            text.textContent = 'Build preparation completed';
            description.textContent = 'Ready to start compilation';
        } else if (data.status === 'error') {
            indicator.classList.add('status-error');
            text.textContent = 'Build preparation failed';
            description.textContent = data.message || 'An error occurred during build preparation';
        } else {
            indicator.classList.add('status-building');
            text.textContent = 'Building...';
            description.textContent = data.message || 'Processing build steps...';
        }
    }
    
    updateBuildInfo(data) {
        const buildInfo = document.getElementById('build-info');
        
        const cards = [
            { title: 'App Name', value: data.app_name || 'Unknown', icon: 'fas fa-mobile-alt' },
            { title: 'Platform', value: data.platform || 'Unknown', icon: 'fas fa-cogs' },
            { title: 'Working Directory', value: this.truncatePath(data.working_directory || 'Not set'), icon: 'fas fa-folder' },
            { title: 'Timestamp', value: this.formatTimestamp(data.timestamp), icon: 'fas fa-clock' }
        ];
        
        buildInfo.innerHTML = cards.map(card => `
            <div class="info-card">
                <h5><i class="${card.icon}"></i> ${card.title}</h5>
                <p>${card.value}</p>
            </div>
        `).join('');
    }
    
    renderProgressSteps() {
        const container = document.getElementById('progress-steps');
        
        container.innerHTML = this.buildSteps.map(step => `
            <div class="progress-step" id="step-${step.id}">
                <div class="step-icon pending" id="icon-${step.id}">
                    <i class="fas fa-circle"></i>
                </div>
                <div class="step-content">
                    <strong>${step.name}</strong>
                    <div class="step-status" id="status-${step.id}">Pending</div>
                </div>
            </div>
        `).join('');
    }
    
    updateProgressSteps(data) {
        // Update steps based on build message
        const message = data.message || '';
        
        this.buildSteps.forEach((step, index) => {
            const stepElement = document.getElementById(`step-${step.id}`);
            const iconElement = document.getElementById(`icon-${step.id}`);
            const statusElement = document.getElementById(`status-${step.id}`);
            
            // Determine step status based on message
            let status = 'pending';
            
            if (message.includes(step.name) || message.includes(step.id)) {
                status = 'active';
            } else if (this.isStepCompleted(step.id, message, data.status)) {
                status = 'completed';
            }
            
            // Update visual state
            stepElement.className = `progress-step ${status}`;
            iconElement.className = `step-icon ${status}`;
            
            // Update icon
            if (status === 'completed') {
                iconElement.innerHTML = '<i class="fas fa-check"></i>';
                statusElement.textContent = 'Completed';
            } else if (status === 'active') {
                iconElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                statusElement.textContent = 'In Progress';
            } else {
                iconElement.innerHTML = '<i class="fas fa-circle"></i>';
                statusElement.textContent = 'Pending';
            }
        });
    }
    
    isStepCompleted(stepId, message, status) {
        const stepOrder = ['params', 'config', 'copy', 'pubspec', 'package', 'assets', 'ready'];
        const currentStepIndex = stepOrder.findIndex(id => message.includes(id) || message.toLowerCase().includes(stepId));
        const thisStepIndex = stepOrder.indexOf(stepId);
        
        if (status === 'ready' && thisStepIndex < stepOrder.length - 1) {
            return true;
        }
        
        return currentStepIndex > thisStepIndex;
    }
    
    showConfirmSection() {
        document.getElementById('confirm-section').style.display = 'block';
    }
    
    async loadResults() {
        try {
            const response = await fetch('/api/results');
            const data = await response.json();
            
            this.resultsData = data;
            this.displayResults(data);
            
        } catch (error) {
            console.error('Error loading results:', error);
        }
    }
    
    displayResults(data) {
        if (!data.replacements || data.replacements.length === 0) {
            return;
        }
        
        document.getElementById('results-section').style.display = 'block';
        
        const resultsGrid = document.getElementById('results-grid');
        resultsGrid.innerHTML = data.replacements.map(replacement => `
            <div class="result-card">
                <div class="result-header">
                    <h5>${this.getFileName(replacement.target)}</h5>
                    <div>
                        <span class="badge badge-custom platform-badge">${replacement.platform}</span>
                        <span class="badge badge-custom type-badge">${replacement.resource_type}</span>
                    </div>
                </div>
                <div class="result-content">
                    <p><strong>Source:</strong> ${this.getFileName(replacement.source)}</p>
                    <p><strong>Size:</strong> 
                        <span class="badge badge-custom size-badge">${replacement.size[0]}x${replacement.size[1]}</span>
                    </p>
                    <p><strong>Backup:</strong> ${this.getFileName(replacement.backup)}</p>
                </div>
            </div>
        `).join('');
    }
    
    async confirmBuild() {
        const button = document.getElementById('confirm-button');
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';
        
        try {
            const response = await fetch('/api/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ confirmed: true })
            });
            
            const data = await response.json();
            
            if (data.success) {
                button.innerHTML = '<i class="fas fa-rocket"></i> Compilation Started!';
                button.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
                
                // Show success message
                this.showAlert('Build confirmed! Compilation will start shortly.', 'success');
            } else {
                button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
                button.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
                this.showAlert('Failed to confirm build. Please try again.', 'danger');
            }
            
        } catch (error) {
            console.error('Error confirming build:', error);
            button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
            button.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
            this.showAlert('Network error. Please check your connection.', 'danger');
        }
    }
    
    showError(message) {
        this.showAlert(message, 'danger');
    }
    
    showAlert(message, type) {
        const alertHtml = `
            <div class="alert alert-${type} alert-custom alert-dismissible fade show" role="alert">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        // Insert alert at the top of the container
        const container = document.querySelector('.container');
        container.insertAdjacentHTML('afterbegin', alertHtml);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const alert = container.querySelector('.alert');
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }
    
    truncatePath(path) {
        if (!path || path.length <= 50) return path;
        return '...' + path.slice(-47);
    }
    
    formatTimestamp(timestamp) {
        if (!timestamp) return 'Unknown';
        try {
            return new Date(timestamp).toLocaleString();
        } catch {
            return timestamp;
        }
    }
    
    getFileName(path) {
        if (!path) return 'Unknown';
        return path.split(/[/\\]/).pop();
    }
}

// Global functions for HTML onclick handlers
function refreshStatus() {
    window.buildMonitor.updateStatus();
}

function confirmBuild() {
    window.buildMonitor.confirmBuild();
}

function showLogs() {
    // TODO: Implement logs modal
    alert('Logs feature coming soon!');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.buildMonitor = new BuildMonitor();
});
