// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

const logger = require('#@logger');

class CustomTitleBar {
    constructor(window, config) {
        this.window = window;
        this.config = config || {};
        this.height = this.config.height || 40;
        this.style = this.config.style || 'modern';
        this.showAppName = this.config.showAppName !== false;
        this.showLogo = this.config.showLogo === true;
        this.appName = this.config.appName || 'Application';
        this.logoPath = this.config.logoPath || null;
        this.buttons = this.config.buttons || {
            minimize: true,
            maximize: true,
            close: true
        };
        this.customStyles = this.config.customStyles || {};
    }

    async inject() {
        try {
            logger.info('[CustomTitleBar] Injecting custom title bar...');

            const html = this.generateHTML();
            const css = this.generateCSS();
            const js = this.generateJS();

            await this.window.webContents.executeJavaScript(`
                (function() {
                    // Wait for DOM to be ready
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', injectTitleBar);
                    } else {
                        injectTitleBar();
                    }

                    function injectTitleBar() {
                        // Remove existing title bar if any
                        const existing = document.getElementById('custom-title-bar');
                        if (existing) {
                            existing.remove();
                        }

                        // Create title bar container
                        const titleBar = document.createElement('div');
                        titleBar.id = 'custom-title-bar';
                        titleBar.innerHTML = \`${html}\`;

                        // Inject styles
                        const style = document.createElement('style');
                        style.id = 'custom-title-bar-styles';
                        style.textContent = \`${css}\`;
                        document.head.appendChild(style);

                        // Adjust body margin to make room for title bar
                        document.body.style.marginTop = '${this.height}px';

                        // Prepend to body
                        document.body.insertBefore(titleBar, document.body.firstChild);

                        // Add event listeners
                        ${js}

                        console.log('[CustomTitleBar] Title bar injected successfully');
                    }
                })();
            `);

            logger.info('[CustomTitleBar] Custom title bar injected successfully');
        } catch (error) {
            logger.error(`[CustomTitleBar] Failed to inject title bar: ${error.message}`);
        }
    }

    generateHTML() {
        const logoHTML = this.showLogo && this.logoPath
            ? `<img class="title-bar-logo" src="${this.logoPath}" alt="Logo">`
            : '';

        const titleHTML = this.showAppName
            ? `<span class="title-bar-title">${this.appName}</span>`
            : '';

        const minimizeBtn = this.buttons.minimize
            ? '<button class="title-bar-btn title-bar-minimize" title="Minimize">−</button>'
            : '';

        const maximizeBtn = this.buttons.maximize
            ? '<button class="title-bar-btn title-bar-maximize" title="Maximize">□</button>'
            : '';

        const closeBtn = this.buttons.close
            ? '<button class="title-bar-btn title-bar-close" title="Close">×</button>'
            : '';

        return `
            <div class="title-bar-drag-region">
                ${logoHTML}
                ${titleHTML}
            </div>
            <div class="title-bar-buttons">
                ${minimizeBtn}
                ${maximizeBtn}
                ${closeBtn}
            </div>
        `;
    }

    generateCSS() {
        const styles = this.getStylePreset(this.style);
        const customStyles = this.customStyles;

        const backgroundColor = customStyles.backgroundColor || styles.backgroundColor;
        const textColor = customStyles.textColor || styles.textColor;
        const buttonHoverColor = customStyles.buttonHoverColor || styles.buttonHoverColor;
        const closeHoverColor = customStyles.closeHoverColor || styles.closeHoverColor;
        const borderBottom = customStyles.borderBottom || styles.borderBottom;

        return `
            #custom-title-bar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: ${this.height}px;
                background-color: ${backgroundColor};
                color: ${textColor};
                display: flex;
                align-items: center;
                justify-content: space-between;
                z-index: 9999;
                user-select: none;
                -webkit-user-select: none;
                border-bottom: ${borderBottom};
                box-sizing: border-box;
            }

            .title-bar-drag-region {
                display: flex;
                align-items: center;
                flex: 1;
                height: 100%;
                padding: 0 12px;
                -webkit-app-region: drag;
            }

            .title-bar-logo {
                width: 24px;
                height: 24px;
                margin-right: 8px;
                object-fit: contain;
            }

            .title-bar-title {
                font-size: 14px;
                font-weight: 500;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Microsoft YaHei', sans-serif;
            }

            .title-bar-buttons {
                display: flex;
                height: 100%;
                -webkit-app-region: no-drag;
            }

            .title-bar-btn {
                width: 46px;
                height: 100%;
                border: none;
                background: transparent;
                color: ${textColor};
                font-size: 16px;
                font-family: Arial, sans-serif;
                cursor: pointer;
                transition: background-color 0.15s ease;
                outline: none;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .title-bar-btn:hover {
                background-color: ${buttonHoverColor};
            }

            .title-bar-minimize {
                font-size: 20px;
                line-height: 1;
            }

            .title-bar-maximize {
                font-size: 14px;
            }

            .title-bar-close {
                font-size: 20px;
            }

            .title-bar-close:hover {
                background-color: ${closeHoverColor};
                color: white;
            }
        `;
    }

    generateJS() {
        return `
            (function() {
                const minimizeBtn = document.querySelector('.title-bar-minimize');
                const maximizeBtn = document.querySelector('.title-bar-maximize');
                const closeBtn = document.querySelector('.title-bar-close');

                if (minimizeBtn) {
                    minimizeBtn.addEventListener('click', () => {
                        if (window.electronAPI && window.electronAPI.minimizeWindow) {
                            window.electronAPI.minimizeWindow();
                        }
                    });
                }

                if (maximizeBtn) {
                    maximizeBtn.addEventListener('click', () => {
                        if (window.electronAPI && window.electronAPI.maximizeWindow) {
                            window.electronAPI.maximizeWindow();
                        }
                    });
                }

                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        if (window.electronAPI && window.electronAPI.closeWindow) {
                            window.electronAPI.closeWindow();
                        }
                    });
                }

                console.log('[CustomTitleBar] Event listeners attached');
            })();
        `;
    }

    getStylePreset(styleName) {
        const presets = {
            modern: {
                backgroundColor: '#2c3e50',
                textColor: '#ecf0f1',
                buttonHoverColor: 'rgba(255, 255, 255, 0.1)',
                closeHoverColor: '#e74c3c',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            },
            light: {
                backgroundColor: '#f5f5f5',
                textColor: '#333333',
                buttonHoverColor: 'rgba(0, 0, 0, 0.05)',
                closeHoverColor: '#e74c3c',
                borderBottom: '1px solid #e0e0e0'
            },
            dark: {
                backgroundColor: '#1e1e1e',
                textColor: '#ffffff',
                buttonHoverColor: 'rgba(255, 255, 255, 0.1)',
                closeHoverColor: '#e74c3c',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            },
            minimal: {
                backgroundColor: '#ffffff',
                textColor: '#000000',
                buttonHoverColor: 'rgba(0, 0, 0, 0.05)',
                closeHoverColor: '#ff5252',
                borderBottom: 'none'
            }
        };

        return presets[styleName] || presets.modern;
    }
}

module.exports = CustomTitleBar;
