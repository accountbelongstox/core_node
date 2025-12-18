// Custom Dialog System - Replaces browser alerts
// Provides HTML-based dialog with Enter key confirmation

class Dialog {
    constructor() {
        this.overlay = null;
        this.dialog = null;
        this.resolveCallback = null;
        this.initializeDialog();
    }

    initializeDialog() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'dialog-overlay';
        this.overlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            justify-content: center;
            align-items: center;
        `;

        // Create dialog box
        this.dialog = document.createElement('div');
        this.dialog.className = 'dialog-box';
        this.dialog.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 24px;
            min-width: 300px;
            max-width: 500px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            animation: dialogSlideIn 0.2s ease-out;
        `;

        // Create message container
        this.messageContainer = document.createElement('div');
        this.messageContainer.className = 'dialog-message';
        this.messageContainer.style.cssText = `
            margin-bottom: 20px;
            font-size: 16px;
            color: #333;
            line-height: 1.5;
            word-wrap: break-word;
        `;

        // Create button container
        this.buttonContainer = document.createElement('div');
        this.buttonContainer.className = 'dialog-buttons';
        this.buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        `;

        // Create OK button
        this.okButton = document.createElement('button');
        this.okButton.textContent = 'OK';
        this.okButton.className = 'dialog-btn dialog-btn-primary';
        this.okButton.style.cssText = `
            padding: 8px 20px;
            border: none;
            border-radius: 4px;
            background: #007bff;
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
        `;
        this.okButton.onmouseover = () => {
            this.okButton.style.background = '#0056b3';
        };
        this.okButton.onmouseout = () => {
            this.okButton.style.background = '#007bff';
        };

        // Assemble dialog
        this.buttonContainer.appendChild(this.okButton);
        this.dialog.appendChild(this.messageContainer);
        this.dialog.appendChild(this.buttonContainer);
        this.overlay.appendChild(this.dialog);

        // Add to document
        document.body.appendChild(this.overlay);

        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes dialogSlideIn {
                from {
                    transform: translateY(-20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        // Event listeners
        this.okButton.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Enter key listener
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.overlay.style.display === 'flex') {
                this.close();
            }
        });
    }

    show(message, type = 'info') {
        this.messageContainer.textContent = message;

        // Update button color based on type
        if (type === 'error') {
            this.okButton.style.background = '#dc3545';
            this.okButton.onmouseover = () => {
                this.okButton.style.background = '#c82333';
            };
            this.okButton.onmouseout = () => {
                this.okButton.style.background = '#dc3545';
            };
        } else if (type === 'success') {
            this.okButton.style.background = '#28a745';
            this.okButton.onmouseover = () => {
                this.okButton.style.background = '#218838';
            };
            this.okButton.onmouseout = () => {
                this.okButton.style.background = '#28a745';
            };
        } else {
            this.okButton.style.background = '#007bff';
            this.okButton.onmouseover = () => {
                this.okButton.style.background = '#0056b3';
            };
            this.okButton.onmouseout = () => {
                this.okButton.style.background = '#007bff';
            };
        }

        this.overlay.style.display = 'flex';
        this.okButton.focus();

        return new Promise((resolve) => {
            this.resolveCallback = resolve;
        });
    }

    close() {
        this.overlay.style.display = 'none';
        if (this.resolveCallback) {
            this.resolveCallback();
            this.resolveCallback = null;
        }
    }

    // Convenience methods
    info(message) {
        return this.show(message, 'info');
    }

    success(message) {
        return this.show(message, 'success');
    }

    error(message) {
        return this.show(message, 'error');
    }
}

// Global dialog instance
const dialog = new Dialog();

// Export for use in framework.js
window.showDialog = (message, type = 'info') => dialog.show(message, type);
window.dialog = dialog;
