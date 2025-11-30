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
 * Flutter Icons Visualization System - Web Application Frontend
 * Author: Development Script System
 * Version: 1.0
 */

class FlutterIconsWebApp {
    constructor() {
        this.imagesData = {};
        this.selectedImages = new Set();
        this.settings = {
            auto_refresh: true,
            show_image_details: true,
            show_compliance_scores: true
        };
        this.currentPlatform = 'android';
        
        this.init();
    }
    
    init() {
        console.log('Initializing Flutter Icons Web App...');
        
        // Load initial data
        this.loadImages();
        this.loadSettings();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup drag and drop
        this.setupDragAndDrop();
        
        // Setup button event listeners
        this.setupButtonEventListeners();
        
        console.log('App initialized successfully');
    }
    
    setupEventListeners() {
        // File input change
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });
        
        // Platform tab changes
        document.querySelectorAll('.platform-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.currentPlatform = e.target.id.replace('-tab', '');
                this.updateTargetsList();
            });
        });
        
        // Auto-refresh every 30 seconds if enabled
        setInterval(() => {
            if (this.settings.auto_refresh) {
                this.loadImages(false); // Silent refresh
            }
        }, 30000);
    }
    
    setupDragAndDrop() {
        const uploadArea = document.getElementById('uploadArea');
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFileSelection(e.dataTransfer.files);
        });
    }
    
    setupButtonEventListeners() {
        // Use event delegation for dynamically created buttons
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            
            const action = button.dataset.action;
            const imagePath = button.dataset.imagePath;
            const platform = button.dataset.platform;
            const directory = button.dataset.directory;
            
            console.log(`Button clicked - Action: ${action}, Image: ${imagePath}, Directory: ${directory}`);
            
            switch (action) {
                case 'download':
                    this.downloadImage(imagePath);
                    break;
                case 'select':
                    this.toggleImageSelection(platform, imagePath, button);
                    break;
                case 'compress':
                    this.compressImage(imagePath);
                    break;
                case 'fix-size':
                    this.showFixSizeDialog(imagePath);
                    break;
                case 'open-directory':
                    this.openDirectory(directory);
                    break;
                case 'copy-explorer-cmd':
                    this.copyExplorerCommand(directory);
                    break;
                case 'compress-directory':
                    const relativeDir = button.dataset.directory || directory;
                    this.compressDirectory(platform, relativeDir);
                    break;
                case 'fix-all-sizes':
                    const relativeDirFix = button.dataset.directory || directory;
                    this.fixAllSizes(platform, relativeDirFix);
                    break;
                default:
                    console.warn('Unknown action:', action);
            }
        });
    }
    
    async loadImages(showLoading = true) {
        try {
            if (showLoading) {
                this.showStatus('Loading images...', 'info');
            }
            
            const response = await fetch('/api/scan');
            const result = await response.json();
            
            if (result.status === 'success') {
                this.imagesData = result.data;
                this.updateUI();
                
                if (showLoading) {
                    this.showStatus('Images loaded successfully', 'success');
                }
            } else {
                throw new Error(result.message || 'Failed to load images');
            }
        } catch (error) {
            console.error('Error loading images:', error);
            this.showStatus('Error loading images: ' + error.message, 'error');
        }
    }
    
    async loadSettings() {
        try {
            const response = await fetch('/api/settings');
            const result = await response.json();
            
            if (result.status === 'success') {
                this.settings = result.settings;
                this.updateSettingsUI();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
    
    updateUI() {
        this.updateStats();
        this.updatePlatformTabs();
        this.updateTargetsList();
    }
    
    updateStats() {
        let totalImages = 0;
        const platformCounts = {};
        
        for (const [platform, groups] of Object.entries(this.imagesData)) {
            let platformImageCount = 0;
            
            for (const group of groups) {
                platformImageCount += group.images.length;
            }
            
            platformCounts[platform] = platformImageCount;
            totalImages += platformImageCount;
        }
        
        document.getElementById('totalImagesCount').textContent = totalImages;
        document.getElementById('androidImagesCount').textContent = platformCounts.android || 0;
        document.getElementById('iosImagesCount').textContent = platformCounts.ios || 0;
        document.getElementById('webImagesCount').textContent = platformCounts.web || 0;
        
        // Update tab badges
        for (const [platform, count] of Object.entries(platformCounts)) {
            const badge = document.getElementById(`${platform}-count`);
            if (badge) {
                badge.textContent = count;
            }
        }
    }
    
    updatePlatformTabs() {
        for (const [platform, images] of Object.entries(this.imagesData)) {
            this.renderPlatformImages(platform, images);
        }
    }
    
    renderPlatformImages(platform, imageGroups) {
        const container = document.getElementById(`${platform}-images`);
        const loading = document.getElementById(`${platform}-loading`);
        
        if (!container) return;
        
        // Hide loading, show content
        loading.style.display = 'none';
        container.style.display = 'block';
        
        if (imageGroups.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-images fa-3x text-muted mb-3"></i>
                    <h4>${platform.toUpperCase()}</h4>
                    <h5>No images found in ${platform} directory</h5>
                    <p class="text-muted">Make sure the ${platform} platform directory exists and contains image files.</p>
                </div>
            `;
            return;
        }
        
        // Count total images across all groups
        const totalImages = imageGroups.reduce((count, group) => {
            return count + group.images.length;
        }, 0);
        
        let html = `<div class="platform-header mb-4">
            <h2><i class="fas fa-${this.getPlatformIcon(platform)}"></i> ${platform.toUpperCase()}</h2>
            <p class="text-muted">${totalImages} images found in ${imageGroups.length} groups</p>
        </div>`;
        
        for (const group of imageGroups) {
            html += this.renderDirectoryGroup(platform, group.path, group.images, group);
        }
        
        container.innerHTML = html;
    }
    
    getPlatformIcon(platform) {
        const icons = {
            'android': 'android',
            'ios': 'apple',
            'windows': 'windows',
            'web': 'globe'
        };
        return icons[platform] || 'images';
    }
    
    groupImagesByDirectory(images) {
        const groups = {};
        
        for (const image of images) {
            const dirPath = image.relative_path.split('/').slice(0, -1).join('/');
            if (!groups[dirPath]) {
                groups[dirPath] = [];
            }
            groups[dirPath].push(image);
        }
        
        return groups;
    }
    
    renderAndroidDrawableGroup(platform, group) {
        const imageCount = group.image_count || group.images.length;
        const groupName = group.name;
        const basePath = group.base_path;
        
        return `
            <div class="directory-group">
                <div class="directory-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h5 class="mb-0">
                                <i class="fas fa-android"></i> ${groupName}
                                <span class="badge bg-success ms-2">${imageCount} images</span>
                            </h5>
                            <small class="text-muted d-flex align-items-center mt-1">
                                <i class="fas fa-folder-open me-1"></i>
                                <span class="basedir-path" 
                                      title="Click to copy absolute path" 
                                      style="cursor: pointer; font-family: monospace;"
                                      onclick="navigator.clipboard.writeText('${basePath.replace(/\//g, '\\\\').replace(/'/g, "\\'")}').then(() => this.classList.add('text-success')).catch(() => this.classList.add('text-danger')); setTimeout(() => { this.classList.remove('text-success', 'text-danger'); }, 1000);">
                                    ${basePath.replace(/\//g, '\\\\')}
                                </span>
                                <i class="fas fa-copy ms-1" style="opacity: 0.6;"></i>
                            </small>
                        </div>
                        <div>
                            <button class="btn btn-outline-primary btn-sm action-btn" 
                                    data-action="open-directory"
                                    data-directory="${basePath}">
                                <i class="fas fa-folder-open"></i> Open
                            </button>
                            <button class="btn btn-outline-info btn-sm action-btn" 
                                    data-action="copy-explorer-cmd"
                                    data-directory="${basePath}">
                                <i class="fas fa-copy"></i> Copy Cmd
                            </button>
                            <button class="btn btn-outline-warning btn-sm action-btn" 
                                    data-action="compress-directory"
                                    data-platform="${platform}"
                                    data-directory="${basePath}">
                                <i class="fas fa-compress"></i> Compress All
                            </button>
                            <button class="btn btn-outline-success btn-sm action-btn" 
                                    data-action="fix-all-sizes"
                                    data-platform="${platform}"
                                    data-directory="${basePath}">
                                <i class="fas fa-magic"></i> Fix All Sizes
                            </button>
                        </div>
                    </div>
                </div>
                <div class="row">
                    ${group.images.map(image => `
                        <div class="col-lg-4 col-md-6 col-sm-12 mb-3">
                            ${this.renderImageCard(platform, image)}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderDirectoryGroup(platform, directory, images, group = null) {
        const directoryName = directory || 'Root';
        
        // 获取绝对路径
        let basedir = 'Unknown Path';
        if (group && group.abs_path) {
            basedir = group.abs_path.replace(/\//g, '\\');
        } else if (images.length > 0 && images[0].path) {
            const fullPath = images[0].path;
            // 提取父目录路径（去掉文件名）
            const pathParts = fullPath.replace(/\\/g, '/').split('/');
            pathParts.pop(); // 移除文件名
            basedir = pathParts.join('\\'); // 使用Windows风格的路径分隔符
        }
        
        return `
            <div class="directory-group">
                <div class="directory-header">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h5 class="mb-0">
                                <i class="fas fa-folder"></i> ${directoryName}
                                <span class="badge bg-secondary ms-2">${images.length} images</span>
                            </h5>
                            <small class="text-muted d-flex align-items-center mt-1">
                                <i class="fas fa-folder-open me-1"></i>
                                <span class="basedir-path" 
                                      title="Click to copy absolute path" 
                                      style="cursor: pointer; font-family: monospace;"
                                      onclick="navigator.clipboard.writeText('${basedir.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}').then(() => this.classList.add('text-success')).catch(() => this.classList.add('text-danger')); setTimeout(() => { this.classList.remove('text-success', 'text-danger'); }, 1000);">
                                    ${basedir}
                                </span>
                                <i class="fas fa-copy ms-1" style="opacity: 0.6;"></i>
                            </small>
                        </div>
                        <div>
                            <button class="btn btn-outline-primary btn-sm action-btn" 
                                    data-action="open-directory"
                                    data-directory="${basedir}">
                                <i class="fas fa-folder-open"></i> Open
                            </button>
                            <button class="btn btn-outline-info btn-sm action-btn" 
                                    data-action="copy-explorer-cmd"
                                    data-directory="${basedir}">
                                <i class="fas fa-copy"></i> Copy Cmd
                            </button>
                            <button class="btn btn-outline-warning btn-sm action-btn" 
                                    data-action="compress-directory"
                                    data-platform="${platform}"
                                    data-directory="${directory}"
                                    data-abs-directory="${basedir}">
                                <i class="fas fa-compress"></i> Compress All
                            </button>
                            <button class="btn btn-outline-success btn-sm action-btn" 
                                    data-action="fix-all-sizes"
                                    data-platform="${platform}"
                                    data-directory="${directory}"
                                    data-abs-directory="${basedir}">
                                <i class="fas fa-magic"></i> Fix All Sizes
                            </button>
                        </div>
                    </div>
                </div>
                <div class="row">
                    ${images.map(image => `
                        <div class="col-lg-4 col-md-6 col-sm-12 mb-3">
                            ${this.renderImageCard(platform, image)}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderImageCard(platform, image) {
        const imagePath = `/api/image/${image.relative_path}`;
        const complianceScore = this.getComplianceScore(image);
        const classification = image.classification || {};
        const sizeRecommendations = image.size_recommendations || {};
        const compressionRecommendations = image.compression_recommendations || {};
        const isValidImage = image.is_valid_image !== false;
        
        return `
            <div class="image-card h-100">
                <div class="card h-100">
                    <div class="card-body p-3 d-flex flex-column">
                        <div class="text-center mb-3">
                            ${isValidImage ? `
                                <img src="${imagePath}" 
                                     alt="${image.name}" 
                                     class="image-preview"
                                     onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+'">`
                            : `
                                <div class="image-preview d-flex align-items-center justify-content-center bg-light border rounded">
                                    <i class="fas fa-exclamation-triangle text-warning fa-2x"></i>
                                </div>`
                            }
                        </div>
                        
                        <h6 class="card-title text-center mb-2">${image.name}</h6>
                        
                        ${!isValidImage ? `
                            <div class="alert alert-warning alert-sm mb-2">
                                <i class="fas fa-exclamation-triangle"></i> ${image.error_reason || 'Invalid image file'}
                            </div>
                        ` : ''}
                        
                        ${classification && classification.category ? `
                            <div class="mb-2 text-center">
                                <span class="classification-badge badge-${classification.category.toLowerCase()}">
                                    ${classification.category}
                                </span>
                                ${classification.subcategory ? `
                                    <span class="classification-badge badge-${classification.subcategory.toLowerCase().replace(' ', '-')}">
                                        ${classification.subcategory}
                                    </span>
                                ` : ''}
                            </div>
                        ` : ''}
                        
                        <div class="small text-muted mb-2 text-center">
                            ${isValidImage && image.width && image.height ? `${image.width}×${image.height} • ` : ''}
                            ${Math.round(Math.max(image.size_bytes / 1024, 0.1))}KB • ${image.format}
                        </div>
                        
                        ${complianceScore !== null && isValidImage ? `
                            <div class="mb-2 text-center">
                                <span class="compliance-score ${this.getComplianceClass(complianceScore)}">
                                    ${Math.round(complianceScore * 100)}% Compliance
                                </span>
                            </div>
                        ` : ''}
                        
                        ${sizeRecommendations && sizeRecommendations.recommended_sizes && sizeRecommendations.recommended_sizes.length > 0 ? `
                            <div class="small text-info mb-2 text-center">
                                <i class="fas fa-lightbulb"></i> Recommended: ${sizeRecommendations.recommended_sizes[0][0]}×${sizeRecommendations.recommended_sizes[0][1]}
                            </div>
                        ` : ''}
                        
                        ${compressionRecommendations && compressionRecommendations.should_compress ? `
                            <div class="small text-warning mb-2 text-center">
                                <i class="fas fa-exclamation-triangle"></i> 
                                ${compressionRecommendations.reasons && compressionRecommendations.reasons.length > 0 
                                    ? compressionRecommendations.reasons[0] 
                                    : 'Compression recommended'}
                            </div>
                        ` : ''}
                        
                        <div class="mt-auto">
                            <div class="d-grid gap-2">
                                <div class="btn-group" role="group">
                                    <button class="btn btn-outline-primary btn-sm" 
                                            data-action="download"
                                            data-image-path="${image.relative_path}" 
                                            title="Download">
                                        <i class="fas fa-download"></i>
                                    </button>
                                    <button class="btn btn-outline-success btn-sm" 
                                            data-action="select"
                                            data-platform="${platform}"
                                            data-image-path="${image.relative_path}"
                                            title="Select">
                                        <i class="fas fa-check"></i>
                                    </button>
                                    ${compressionRecommendations && compressionRecommendations.should_compress ? `
                                        <button class="btn btn-outline-warning btn-sm" 
                                                data-action="compress"
                                                data-image-path="${image.relative_path}"
                                                title="Compress">
                                            <i class="fas fa-compress"></i>
                                        </button>
                                    ` : ''}
                                </div>
                                
                                ${isValidImage && sizeRecommendations && sizeRecommendations.recommended_sizes && sizeRecommendations.recommended_sizes.length > 0 ? `
                                    <button class="btn btn-warning btn-sm" 
                                            data-action="fix-size"
                                            data-image-path="${image.relative_path}"
                                            title="Fix to recommended size">
                                        <i class="fas fa-magic"></i> Fix Size
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    getComplianceScore(image) {
        return image.size_recommendations ? image.size_recommendations.compliance_score : null;
    }
    
    getComplianceClass(score) {
        if (score >= 0.9) return 'compliance-excellent';
        if (score >= 0.8) return 'compliance-good';
        if (score >= 0.6) return 'compliance-fair';
        return 'compliance-poor';
    }
    
    updateTargetsList() {
        const targetsList = document.getElementById('targetsList');
        targetsList.innerHTML = '';
        
        const platformGroups = this.imagesData[this.currentPlatform] || [];
        
        if (platformGroups.length === 0) {
            targetsList.innerHTML = '<small class="text-muted">No images available for replacement</small>';
            return;
        }
        
        for (const group of platformGroups) {
            // Add group header
            const groupHeader = document.createElement('div');
            groupHeader.className = 'fw-bold text-primary mb-2 border-bottom';
            groupHeader.textContent = group.name || 'Root';
            targetsList.appendChild(groupHeader);
            
            // Add each image as checkbox
            for (const image of group.images) {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'form-check mb-1';
                
                const checkbox = document.createElement('input');
                checkbox.className = 'form-check-input';
                checkbox.type = 'checkbox';
                checkbox.value = image.relative_path;
                checkbox.id = `target_${image.relative_path.replace(/[^a-zA-Z0-9]/g, '_')}`;
                
                const label = document.createElement('label');
                label.className = 'form-check-label';
                label.htmlFor = checkbox.id;
                label.style.fontSize = '0.85rem';
                
                if (image.drawable_type) {
                    label.textContent = `${image.drawable_type} - ${image.name}`;
                } else {
                    label.textContent = image.name;
                }
                
                checkboxDiv.appendChild(checkbox);
                checkboxDiv.appendChild(label);
                targetsList.appendChild(checkboxDiv);
            }
        }
        
        // Add select all/none buttons
        if (platformGroups.length > 0) {
            const buttonDiv = document.createElement('div');
            buttonDiv.className = 'mt-2 d-flex gap-2';
            
            const selectAllBtn = document.createElement('button');
            selectAllBtn.className = 'btn btn-outline-primary btn-sm';
            selectAllBtn.textContent = 'Select All';
            selectAllBtn.onclick = () => {
                targetsList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
            };
            
            const selectNoneBtn = document.createElement('button');
            selectNoneBtn.className = 'btn btn-outline-secondary btn-sm';
            selectNoneBtn.textContent = 'Select None';
            selectNoneBtn.onclick = () => {
                targetsList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            };
            
            buttonDiv.appendChild(selectAllBtn);
            buttonDiv.appendChild(selectNoneBtn);
            targetsList.appendChild(buttonDiv);
        }
    }
    
    updateSettingsUI() {
        document.getElementById('autoRefreshCheck').checked = this.settings.auto_refresh;
        document.getElementById('showDetailsCheck').checked = this.settings.show_image_details;
        document.getElementById('showComplianceCheck').checked = this.settings.show_compliance_scores;
    }
    
    handleFileSelection(files) {
        if (files.length === 0) return;
        
        const fileList = Array.from(files);
        const validFiles = fileList.filter(file => file.type.startsWith('image/'));
        
        if (validFiles.length === 0) {
            this.showStatus('Please select valid image files', 'error');
            return;
        }
        
        this.showStatus(`Selected ${validFiles.length} image(s) for upload`, 'success');
        
        // Store files for upload
        this.selectedFiles = validFiles;
    }
    
    async uploadAndReplace() {
        if (!this.selectedFiles || this.selectedFiles.length === 0) {
            this.showStatus('Please select files to upload first', 'error');
            return;
        }
        
        const targetsList = document.getElementById('targetsList');
        const selectedTargets = Array.from(targetsList.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
        
        if (selectedTargets.length === 0) {
            this.showStatus('Please select target images to replace', 'error');
            return;
        }
        
        try {
            this.showStatus('Uploading and replacing images...', 'info');
            
            for (const file of this.selectedFiles) {
                const formData = new FormData();
                formData.append('file', file);
                
                for (const target of selectedTargets) {
                    formData.append('targets', target);
                }
                
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.status === 'success') {
                    this.showStatus(result.message, 'success');
                } else {
                    throw new Error(result.message);
                }
            }
            
            // Refresh images if auto-refresh is enabled
            if (this.settings.auto_refresh) {
                setTimeout(() => this.loadImages(), 1000);
            }
            
        } catch (error) {
            console.error('Error uploading images:', error);
            this.showStatus('Error uploading images: ' + error.message, 'error');
        }
    }
    
    toggleImageSelection(platform, imagePath, button) {
        const key = `${platform}:${imagePath}`;
        
        if (this.selectedImages.has(key)) {
            this.selectedImages.delete(key);
            button.classList.remove('btn-success');
            button.classList.add('btn-outline-success');
        } else {
            this.selectedImages.add(key);
            button.classList.remove('btn-outline-success');
            button.classList.add('btn-success');
        }
        
        console.log(`Selected images: ${this.selectedImages.size}`);
    }
    
    selectAllImages() {
        // Select all images in current platform
        const platformGroups = this.imagesData[this.currentPlatform] || [];
        let imageCount = 0;
        
        for (const group of platformGroups) {
            for (const image of group.images) {
                const key = `${this.currentPlatform}:${image.relative_path}`;
                this.selectedImages.add(key);
                imageCount++;
            }
        }
        
        // Update UI
        document.querySelectorAll(`#${this.currentPlatform}-images .btn-outline-success`).forEach(btn => {
            btn.classList.remove('btn-outline-success');
            btn.classList.add('btn-success');
        });
        
        this.showStatus(`Selected ${imageCount} images`, 'success');
    }
    
    async compressSelected() {
        const selectedArray = Array.from(this.selectedImages);
        if (selectedArray.length === 0) {
            this.showStatus('Please select images to compress', 'error');
            return;
        }
        
        this.showStatus(`Compressing ${selectedArray.length} images...`, 'info');
        
        let compressed = 0;
        for (const key of selectedArray) {
            const imagePath = key.split(':')[1];
            
            try {
                const response = await fetch('/api/compress', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image_path: imagePath })
                });
                
                const result = await response.json();
                if (result.status === 'success') {
                    compressed++;
                }
            } catch (error) {
                console.error(`Error compressing ${imagePath}:`, error);
            }
        }
        
        this.showStatus(`Compressed ${compressed} of ${selectedArray.length} images`, 'success');
        
        if (this.settings.auto_refresh) {
            setTimeout(() => this.loadImages(), 1000);
        }
    }
    
    downloadSelected() {
        const selectedArray = Array.from(this.selectedImages);
        if (selectedArray.length === 0) {
            this.showStatus('Please select images to download', 'error');
            return;
        }
        
        for (const key of selectedArray) {
            const imagePath = key.split(':')[1];
            this.downloadImage(imagePath);
        }
        
        this.showStatus(`Downloading ${selectedArray.length} images...`, 'success');
    }
    
    downloadImage(imagePath) {
        const link = document.createElement('a');
        link.href = `/api/download/${imagePath}`;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    async compressImage(imagePath) {
        try {
            console.log('Compressing image:', imagePath);
            this.showStatus('Compressing image...', 'info');
            
            const requestData = { image_path: imagePath };
            console.log('Request data:', requestData);
            
            const response = await fetch('/api/compress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('Response result:', result);
            
            if (result.status === 'success') {
                this.showStatus('Image compressed successfully', 'success');
                
                if (this.settings.auto_refresh) {
                    setTimeout(() => this.loadImages(), 1000);
                }
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error compressing image:', error);
            this.showStatus('Error compressing image: ' + error.message, 'error');
        }
    }
    
    openDirectory(directory) {
        this.showStatus('Directory path copied to clipboard', 'info');
        navigator.clipboard.writeText(directory);
    }
    
    copyExplorerCommand(directory) {
        const command = `explorer "${directory}"`;
        navigator.clipboard.writeText(command).then(() => {
            this.showStatus('Explorer command copied to clipboard', 'success');
        }).catch(() => {
            this.showStatus('Failed to copy to clipboard', 'error');
        });
    }
    
    async compressDirectory(platform, directory) {
        const platformGroups = this.imagesData[platform] || [];
        
        // Find the matching group
        let directoryImages = [];
        for (const group of platformGroups) {
            if (group.path === directory) {
                directoryImages = group.images;
                break;
            }
        }
        
        if (directoryImages.length === 0) {
            this.showStatus('No images found in directory', 'error');
            return;
        }
        
        if (!confirm(`Compress all images in directory "${directory}"?`)) {
            return;
        }
        
        this.showStatus(`Compressing ${directoryImages.length} images in directory...`, 'info');
        
        let compressed = 0;
        for (const image of directoryImages) {
            if (image.compression_recommendations && image.compression_recommendations.should_compress) {
                try {
                    const response = await fetch('/api/compress', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ image_path: image.relative_path })
                    });
                    
                    const result = await response.json();
                    if (result.status === 'success') {
                        compressed++;
                    }
                } catch (error) {
                    console.error(`Error compressing ${image.relative_path}:`, error);
                }
            }
        }
        
        this.showStatus(`Compressed ${compressed} images in directory`, 'success');
        
        if (this.settings.auto_refresh) {
            setTimeout(() => this.loadImages(), 1000);
        }
    }
    
    async fixAllSizes(platform, directory) {
        const platformGroups = this.imagesData[platform] || [];
        
        // Find the matching group
        let directoryImages = [];
        for (const group of platformGroups) {
            if (group.path === directory) {
                directoryImages = group.images;
                break;
            }
        }
        
        if (directoryImages.length === 0) {
            this.showStatus('No images found in directory', 'error');
            return;
        }
        
        // Count images that can be fixed (exclude placeholders)
        const fixableImages = directoryImages.filter(img => {
            const classification = img.classification || {};
            const isValidImage = img.is_valid_image !== false;
            const hasRecommendations = img.size_recommendations && 
                                     img.size_recommendations.recommended_sizes && 
                                     img.size_recommendations.recommended_sizes.length > 0;
            const isNotPlaceholder = classification.category !== 'Placeholder';
            
            return isValidImage && hasRecommendations && isNotPlaceholder;
        });
        
        if (fixableImages.length === 0) {
            this.showStatus('No images need size fixing in this directory', 'info');
            return;
        }
        
        const directoryName = directory || 'root';
        if (!confirm(`Fix ${fixableImages.length} images to recommended sizes in "${directoryName}"?\n\nThis will:\n- Resize images to optimal dimensions\n- Skip placeholder images\n- Create backups of originals`)) {
            return;
        }
        
        try {
            this.showStatus(`Fixing ${fixableImages.length} images to recommended sizes...`, 'info');
            
            const response = await fetch('/api/fix-all-sizes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    platform: platform,
                    directory: directory 
                })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                let message = `Fixed ${result.fixed_count} images`;
                if (result.skipped_count > 0) {
                    message += `, skipped ${result.skipped_count}`;
                }
                if (result.errors && result.errors.length > 0) {
                    message += `\nSome errors occurred: ${result.errors.slice(0, 2).join(', ')}`;
                }
                
                this.showFixAllResultsDialog(result);
                this.showStatus(message, 'success');
                
                if (this.settings.auto_refresh) {
                    setTimeout(() => this.loadImages(), 1000);
                }
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error fixing all sizes:', error);
            this.showStatus('Error fixing sizes: ' + error.message, 'error');
        }
    }
    
    showFixAllResultsDialog(result) {
        const modalHtml = `
            <div class="modal fade" id="fixAllResultsModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-magic"></i> Batch Size Fix Results
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-success">
                                <i class="fas fa-check-circle"></i> 
                                Batch size fix operation completed!
                            </div>
                            
                            <div class="row mb-3">
                                <div class="col-sm-6">
                                    <div class="text-center p-3 bg-success text-white rounded">
                                        <h4>${result.fixed_count}</h4>
                                        <small>Images Fixed</small>
                                    </div>
                                </div>
                                <div class="col-sm-6">
                                    <div class="text-center p-3 bg-secondary text-white rounded">
                                        <h4>${result.skipped_count}</h4>
                                        <small>Images Skipped</small>
                                    </div>
                                </div>
                            </div>
                            
                            <h6><i class="fas fa-info-circle"></i> Operation Details:</h6>
                            <ul class="list-group list-group-flush">
                                <li class="list-group-item">
                                    <i class="fas fa-check text-success"></i> 
                                    Resized ${result.fixed_count} images to recommended dimensions
                                </li>
                                <li class="list-group-item">
                                    <i class="fas fa-shield-alt text-info"></i> 
                                    Created backups for all modified images
                                </li>
                                <li class="list-group-item">
                                    <i class="fas fa-skip-forward text-secondary"></i> 
                                    Skipped ${result.skipped_count} images (placeholders, no recommendations, or invalid)
                                </li>
                            </ul>
                            
                            ${result.errors && result.errors.length > 0 ? `
                                <div class="alert alert-warning mt-3">
                                    <h6><i class="fas fa-exclamation-triangle"></i> Some Errors Occurred:</h6>
                                    <ul class="mb-0">
                                        ${result.errors.map(error => `<li>${error}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            
                            <div class="alert alert-info mt-3">
                                <i class="fas fa-lightbulb"></i> 
                                All original images have been safely backed up. You can restore them using the cleanup feature if needed.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('fixAllResultsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('fixAllResultsModal'));
        modal.show();
        
        // Clean up modal after hide
        document.getElementById('fixAllResultsModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
    
    async saveSettings() {
        const newSettings = {
            auto_refresh: document.getElementById('autoRefreshCheck').checked,
            show_image_details: document.getElementById('showDetailsCheck').checked,
            show_compliance_scores: document.getElementById('showComplianceCheck').checked
        };
        
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.settings = newSettings;
                this.showStatus('Settings saved successfully', 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
                modal.hide();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showStatus('Error saving settings: ' + error.message, 'error');
        }
    }
    
    async showDebugInfo() {
        try {
            const response = await fetch('/api/debug');
            const result = await response.json();
            
            if (result.status === 'success') {
                document.getElementById('debugContent').textContent = JSON.stringify(result.data, null, 2);
                
                const modal = new bootstrap.Modal(document.getElementById('debugModal'));
                modal.show();
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error loading debug info:', error);
            this.showStatus('Error loading debug info: ' + error.message, 'error');
        }
    }
    
    async runCleanup() {
        try {
            this.showStatus('Running cleanup script...', 'info');
            
            const response = await fetch('/api/cleanup', { method: 'POST' });
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showStatus('Cleanup completed successfully', 'success');
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('cleanupModal'));
                modal.hide();
                
                // Refresh images
                if (this.settings.auto_refresh) {
                    setTimeout(() => this.loadImages(), 1000);
                }
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error running cleanup:', error);
            this.showStatus('Error running cleanup: ' + error.message, 'error');
        }
    }
    
    async exportReport() {
        try {
            this.showStatus('Generating report...', 'info');
            
            const link = document.createElement('a');
            link.href = '/api/export';
            link.download = '';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showStatus('Report export started', 'success');
        } catch (error) {
            console.error('Error exporting report:', error);
            this.showStatus('Error exporting report: ' + error.message, 'error');
        }
    }
    
    async showFixSizeDialog(imagePath) {
        try {
            // Get image info for repair plan
            const response = await fetch('/api/fix-size', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_path: imagePath })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                this.showRepairPlanDialog(result.repair_plan, imagePath);
                this.showStatus('Image size fixed successfully', 'success');
                
                if (this.settings.auto_refresh) {
                    setTimeout(() => this.loadImages(), 1000);
                }
            } else {
                this.showStatus('Error: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Error fixing image size:', error);
            this.showStatus('Error fixing image size: ' + error.message, 'error');
        }
    }
    
    showRepairPlanDialog(repairPlan, imagePath) {
        const modalHtml = `
            <div class="modal fade" id="repairPlanModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-magic"></i> Image Size Fixed Successfully
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-success">
                                <i class="fas fa-check-circle"></i> 
                                Image has been successfully fixed to recommended size!
                            </div>
                            
                            <h6><i class="fas fa-info-circle"></i> Repair Summary:</h6>
                            <div class="row mb-3">
                                <div class="col-sm-6">
                                    <strong>Original Size:</strong><br>
                                    <span class="text-muted">${repairPlan.original_size}</span>
                                </div>
                                <div class="col-sm-6">
                                    <strong>New Size:</strong><br>
                                    <span class="text-success">${repairPlan.recommended_size}</span>
                                </div>
                            </div>
                            
                            <div class="row mb-3">
                                <div class="col-sm-6">
                                    <strong>File Size:</strong><br>
                                    <span class="text-muted">${repairPlan.current_file_size}</span>
                                </div>
                                <div class="col-sm-6">
                                    <strong>Compliance:</strong><br>
                                    <span class="text-success">${repairPlan.compliance_score}</span>
                                </div>
                            </div>
                            
                            <h6><i class="fas fa-cogs"></i> Actions Performed:</h6>
                            <ul class="list-group list-group-flush">
                                ${repairPlan.repair_actions.map(action => `
                                    <li class="list-group-item">
                                        <i class="fas fa-check text-success"></i> ${action}
                                    </li>
                                `).join('')}
                            </ul>
                            
                            <div class="alert alert-info mt-3">
                                <i class="fas fa-shield-alt"></i> 
                                A backup of the original image has been created for safety.
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('repairPlanModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('repairPlanModal'));
        modal.show();
        
        // Clean up modal after hide
        document.getElementById('repairPlanModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }
    
    showStatus(message, type) {
        const indicator = document.getElementById('statusIndicator');
        indicator.textContent = message;
        indicator.className = `status-indicator status-${type}`;
        indicator.style.display = 'block';
        
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 3000);
    }
}

// Global functions
function refreshScan() {
    app.loadImages(true);
}

function showSettings() {
    const modal = new bootstrap.Modal(document.getElementById('settingsModal'));
    modal.show();
}

function showDebugInfo() {
    app.showDebugInfo();
}

function showCleanupConfirm() {
    const modal = new bootstrap.Modal(document.getElementById('cleanupModal'));
    modal.show();
}

function runCleanup() {
    app.runCleanup();
}

function saveSettings() {
    app.saveSettings();
}

function selectAllImages() {
    app.selectAllImages();
}

function compressSelected() {
    app.compressSelected();
}

function downloadSelected() {
    app.downloadSelected();
}

function uploadAndReplace() {
    app.uploadAndReplace();
}

function exportReport() {
    app.exportReport();
}

// Initialize app when page loads
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new FlutterIconsWebApp();
});