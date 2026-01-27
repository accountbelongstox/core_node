// Component Renderer - 不离组件复用，使用HTML模板，不写HTML在JS中
// 所有HTML模板都在HTML文件中，JS只负责克隆和填充数据

const Components = {
    // 获取模板并克隆 - 不离组件复用
    getTemplate(id) {
        const template = document.getElementById(`template-${id}`);
        if (!template) {
            console.error(`Template not found: template-${id}`);
            return null;
        }
        return template.content.cloneNode(true);
    },
    
    // Empty state - 不离组件复用
    emptyState() {
        return this.getTemplate('empty-state');
    },
    
    // Namespace section - 不离组件复用
    namespaceSection(namespace, backupsList) {
        const clone = this.getTemplate('namespace-section');
        if (!clone) return null;
        
        const titleEl = clone.querySelector('.namespace-title');
        const countEl = clone.querySelector('.backup-count');
        
        if (titleEl) titleEl.textContent = namespace;
        if (countEl) countEl.textContent = `(${backupsList.length} backup${backupsList.length !== 1 ? 's' : ''})`;
        
        return clone;
    },
    
    // Backup item - 不离组件复用
    backupItem(backup, namespace) {
        const clone = this.getTemplate('backup-item');
        if (!clone) return null;
        
        const relativePath = getRelativePath(backup.path, '');
        const encodedPath = encodeURIComponent(relativePath);
        const item = clone.querySelector('.backup-item');
        const checkbox = clone.querySelector('.backup-checkbox');
        const nameEl = clone.querySelector('.backup-name');
        const sizeEl = clone.querySelector('.backup-size');
        const modifiedEl = clone.querySelector('.backup-modified');
        const buttons = clone.querySelectorAll('[data-action]');
        
        if (item) item.setAttribute('data-backup-path', encodedPath);
        if (checkbox) checkbox.setAttribute('data-path', encodedPath);
        if (nameEl) nameEl.textContent = backup.name;
        if (sizeEl) sizeEl.textContent = `Size: ${backup.size_formatted}`;
        if (modifiedEl) modifiedEl.textContent = `Modified: ${backup.modified}`;
        
        // 设置按钮事件 - 不离组件复用
        buttons.forEach(btn => {
            const action = btn.getAttribute('data-action');
            if (action === 'download') {
                btn.onclick = () => downloadBackup(encodedPath, backup.name);
            } else if (action === 'info') {
                btn.onclick = () => showBackupInfo(encodedPath);
            } else if (action === 'verify') {
                btn.onclick = () => verifyBackup(encodedPath);
            } else if (action === 'restore') {
                btn.onclick = () => showRestoreDialog(encodedPath, namespace);
            } else if (action === 'delete') {
                btn.onclick = () => deleteBackup(encodedPath, backup.name);
            } else if (action === 'cancel') {
                btn.onclick = () => closeModal('restoreModal');
            } else if (action === 'close') {
                btn.onclick = () => {
                    closeModal('restoreModal');
                    if (typeof loadBackups === 'function') loadBackups();
                };
            }
        });
        
        return clone;
    },
    
    // Detail row - 不离组件复用
    detailRow(label, value) {
        const clone = this.getTemplate('detail-row');
        if (!clone) return null;
        
        const labelEl = clone.querySelector('.detail-label');
        const valueEl = clone.querySelector('.detail-value');
        
        if (labelEl) labelEl.textContent = label + ':';
        if (valueEl) valueEl.textContent = value;
        
        return clone;
    },
    
    // Stat card - 不离组件复用
    statCard(label, value, subValue = '') {
        const clone = this.getTemplate('stat-card');
        if (!clone) return null;
        
        const labelEl = clone.querySelector('.stat-label');
        const valueEl = clone.querySelector('.stat-value');
        const subValueEl = clone.querySelector('.stat-subvalue');
        
        if (labelEl) labelEl.textContent = label;
        if (valueEl) valueEl.textContent = value;
        if (subValueEl) {
            if (subValue) {
                subValueEl.textContent = subValue;
                UIControls.show(subValueEl);
            } else {
                UIControls.hide(subValueEl);
            }
        }
        
        return clone;
    },
    
    // Progress bar - 不离组件复用
    progressBar(percent, text = '') {
        const clone = this.getTemplate('progress-bar');
        if (!clone) return null;
        
        const percentValue = Math.min(100, Math.max(0, percent));
        const fillEl = clone.querySelector('.progress-fill');
        
        if (fillEl) {
            fillEl.setAttribute('data-percent', percentValue);
            UIControls.setProgress(fillEl, percentValue);
            fillEl.textContent = text || percentValue + '%';
        }
        
        return clone;
    },
    
    // Status badge - 不离组件复用
    statusBadge(text, type = 'success') {
        const clone = this.getTemplate('status-badge');
        if (!clone) return null;
        
        const badge = clone.querySelector('.status-badge');
        if (badge) {
            badge.textContent = text;
            badge.classList.add(type);
        }
        
        return clone;
    },
    
    // Warning box - 不离组件复用
    warningBox(message) {
        const clone = this.getTemplate('warning-box');
        if (!clone) return null;
        
        const messageEl = clone.querySelector('.warning-message');
        if (messageEl) messageEl.textContent = message;
        
        return clone;
    },
    
    // Loading - 不离组件复用
    loading(message = 'Loading...') {
        const clone = this.getTemplate('loading');
        if (!clone) return null;
        
        const loadingEl = clone.querySelector('.loading');
        if (loadingEl) loadingEl.textContent = message;
        
        return clone;
    },
    
    // Error message - 不离组件复用
    errorMessage(message) {
        const clone = this.getTemplate('error-message');
        if (!clone) return null;
        
        const errorEl = clone.querySelector('.error');
        if (errorEl) errorEl.textContent = message;
        
        return clone;
    },
    
    // Restore dialog content - 不离组件复用
    restoreDialogContent(namespace, backupPath) {
        const clone = this.getTemplate('restore-dialog');
        if (!clone) return null;
        
        const namespaceEl = clone.querySelector('.restore-namespace');
        const pathEl = clone.querySelector('.restore-backup-path');
        const restoreBtn = clone.querySelector('#restoreBtn');
        const confirmCheckbox = clone.querySelector('#restoreConfirm');
        
        if (namespaceEl) namespaceEl.textContent = namespace;
        if (pathEl) pathEl.textContent = backupPath;
        
        // 设置事件 - 不离组件复用
        if (confirmCheckbox && restoreBtn) {
            const encodedPath = encodeURIComponent(backupPath);
            confirmCheckbox.addEventListener('change', function() {
                restoreBtn.disabled = !this.checked;
            });
            restoreBtn.onclick = () => executeRestore(encodedPath, namespace);
        }
        
        return clone;
    },
    
    // Restore progress - 不离组件复用
    restoreProgress(message = 'Restoring backup...') {
        const clone = this.getTemplate('restore-progress');
        if (!clone) return null;
        
        const loadingEl = clone.querySelector('.loading');
        if (loadingEl) loadingEl.textContent = message;
        
        return clone;
    },
    
    // Restore result - 不离组件复用
    restoreResult(success, message, additionalInfo = '') {
        const clone = this.getTemplate('restore-result');
        if (!clone) return null;
        
        const badgeEl = clone.querySelector('.status-badge');
        const messageEl = clone.querySelector('.result-message');
        const detailRows = clone.querySelector('.detail-rows');
        const closeBtn = clone.querySelector('[data-action="close"]');
        
        if (badgeEl) {
            badgeEl.textContent = success ? '✓ Restore Complete' : '✗ Restore Failed';
            badgeEl.classList.add(success ? 'success' : 'error');
        }
        
        if (messageEl) {
            messageEl.textContent = success ? 'Backup restored successfully.' : 'Backup restore failed.';
        }
        
        if (detailRows) {
            detailRows.appendChild(this.detailRow('Status', success ? 'Success' : 'Failed'));
            if (message) {
                detailRows.appendChild(this.detailRow(success ? 'Message' : 'Error', message));
            }
        }
        
        if (closeBtn) {
            closeBtn.classList.remove('btn-primary', 'btn-secondary');
            closeBtn.classList.add(success ? 'btn-primary' : 'btn-secondary');
            if (success) {
                closeBtn.onclick = () => {
                    closeModal('restoreModal');
                    if (typeof loadBackups === 'function') loadBackups();
                };
            } else {
                closeBtn.onclick = () => closeModal('restoreModal');
            }
        }
        
        return clone;
    },
    
    // Verify result - 不离组件复用
    verifyResult(valid, format, message, fileCount = null) {
        const clone = this.getTemplate('verify-result');
        if (!clone) return null;
        
        const badgeEl = clone.querySelector('.status-badge');
        const messageEl = clone.querySelector('.result-message');
        const detailRows = clone.querySelector('.detail-rows');
        
        if (badgeEl) {
            badgeEl.textContent = valid ? '✓ Valid' : '✗ Invalid';
            badgeEl.classList.add(valid ? 'success' : 'error');
        }
        
        if (messageEl) {
            messageEl.textContent = valid ? 'Backup file integrity verified successfully.' : 'Backup file verification failed.';
        }
        
        if (detailRows) {
            detailRows.appendChild(this.detailRow('Status', valid ? 'Valid' : 'Invalid'));
            detailRows.appendChild(this.detailRow('Format', format || 'Unknown'));
            if (message) {
                detailRows.appendChild(this.detailRow(valid ? 'Message' : 'Error', message));
            }
            if (fileCount !== null) {
                detailRows.appendChild(this.detailRow('Files', fileCount.toString()));
            }
        }
        
        return clone;
    },
    
    // Info text - 不离组件复用
    infoText(content) {
        const p = document.createElement('p');
        p.className = 'info-text';
        p.textContent = content;
        return p;
    },
    
    // Form group - 不离组件复用
    formGroup(content) {
        const div = document.createElement('div');
        div.className = 'form-group';
        if (content instanceof Node) {
            div.appendChild(content);
        } else if (typeof content === 'string') {
            div.innerHTML = content;
        }
        return div;
    },
    
    // Button group - 不离组件复用
    buttonGroup(content) {
        const div = document.createElement('div');
        div.className = 'button-group';
        if (content instanceof Node) {
            div.appendChild(content);
        } else if (typeof content === 'string') {
            div.innerHTML = content;
        }
        return div;
    },
    
    // Checkbox label - 不离组件复用
    checkboxLabel(id, text, checked = false) {
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.className = 'checkbox-input';
        if (checked) input.checked = true;
        
        const span = document.createElement('span');
        span.textContent = text;
        
        label.appendChild(input);
        label.appendChild(span);
        
        return label;
    }
};
