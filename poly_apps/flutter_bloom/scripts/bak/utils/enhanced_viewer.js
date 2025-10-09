// Enhanced Flutter Source Viewer JavaScript Functions
// Handles tree view, file tables, and advanced navigation

function displayFileTables() {
    const platforms = ['android', 'ios', 'web', 'macos', 'linux', 'windows'];

    platforms.forEach(platform => {
        const table = document.getElementById(platform + '-files-table');
        if (!table) return;

        const files = scanResults.platform_files[platform] || [];

        if (files.length === 0) {
            table.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #64748b;">No files found for this platform</td></tr>';
            return;
        }

        table.innerHTML = `
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Extension</th>
                    <th>Size</th>
                    <th>Path</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${files.map(file => `
                    <tr>
                        <td><strong>${file.name}</strong></td>
                        <td><span class="file-type-badge file-type-${file.file_type}">${file.file_type}</span></td>
                        <td><code>${file.extension || 'N/A'}</code></td>
                        <td>${file.size_text}</td>
                        <td><div class="path-display" title="${file.path}">${file.relative_path}</div></td>
                        <td>
                            <div class="action-buttons">
                                ${file.is_image ? `<button class="action-btn" onclick="downloadImage('${file.path}')">Download</button>` : ''}
                                <button class="action-btn" onclick="openDirectory('${file.directory_path}')">Open Dir</button>
                                <button class="action-btn" onclick="copyPath('${file.directory_path}')">Copy Path</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
    });
}

function displayImageTrees() {
    const platforms = ['android', 'ios', 'web', 'macos', 'linux', 'windows'];

    platforms.forEach(platform => {
        const container = document.getElementById(platform + '-images-tree-view');
        if (!container) return;

        const tree = scanResults.platform_images_tree[platform] || {};
        container.innerHTML = buildTreeHTML(tree, platform, 'images');
    });
}

function displayFileTrees() {
    const platforms = ['android', 'ios', 'web', 'macos', 'linux', 'windows'];

    platforms.forEach(platform => {
        const container = document.getElementById(platform + '-files-tree-view');
        if (!container) return;

        const tree = scanResults.platform_files_tree[platform] || {};
        container.innerHTML = buildTreeHTML(tree, platform, 'files');
    });
}

function buildTreeHTML(tree, platform, type) {
    if (!tree || Object.keys(tree).length === 0) {
        return '<div style="text-align: center; color: #64748b; padding: 2rem;">No ' + type + ' found for this platform</div>';
    }

    return '<div class="tree-root">' + buildTreeItems(tree, 0) + '</div>';
}

function buildTreeItems(tree, depth) {
    let html = '';

    // Sort: directories first, then files
    const entries = Object.entries(tree).sort((a, b) => {
        const [nameA, itemA] = a;
        const [nameB, itemB] = b;

        if (itemA.type === 'directory' && itemB.type === 'file') return -1;
        if (itemA.type === 'file' && itemB.type === 'directory') return 1;
        return nameA.localeCompare(nameB);
    });

    entries.forEach(([name, item]) => {
        if (item.type === 'directory') {
            const hasChildren = item.children && Object.keys(item.children).length > 0;
            html += `
                <div class="tree-item" style="margin-left: ${depth * 20}px;">
                    <div class="tree-directory collapsed" onclick="toggleTreeNode(this)">
                        ${name}/
                    </div>
                    <div class="tree-children collapsed">
                        ${hasChildren ? buildTreeItems(item.children, 0) : '<div style="color: #94a3b8; font-style: italic;">Empty directory</div>'}
                    </div>
                </div>
            `;
        } else {
            const file = item.file_info;
            const isImage = file.is_image || file.base64_preview;

            html += `
                <div class="tree-item" style="margin-left: ${depth * 20}px;">
                    <div class="tree-file">
                        <div class="tree-file-info">
                            ${isImage ? '🖼️' : getFileIcon(file.file_type || file.extension)}
                            <span>${name}</span>
                            ${file.size_text ? `<span style="color: #64748b; font-size: 0.8rem;">(${file.size_text})</span>` : ''}
                            ${file.file_type ? `<span class="file-type-badge file-type-${file.file_type}" style="margin-left: 8px;">${file.file_type}</span>` : ''}
                        </div>
                        <div class="tree-file-actions">
                            ${isImage ? `<button class="action-btn" onclick="downloadImage('${file.path}')">⬇️</button>` : ''}
                            <button class="action-btn" onclick="openDirectory('${file.directory_path || file.path}')">📁</button>
                            <button class="action-btn" onclick="copyPath('${file.directory_path || file.path}')">📋</button>
                        </div>
                    </div>
                </div>
            `;
        }
    });

    return html;
}

function getFileIcon(type) {
    const iconMap = {
        'code': '💻',
        'config': '⚙️',
        'markup': '📄',
        'document': '📃',
        'build': '🔧',
        'binary': '⚫',
        'archive': '📦',
        'image': '🖼️'
    };
    return iconMap[type] || '📄';
}

function toggleTreeNode(element) {
    const children = element.nextElementSibling;
    const isExpanded = element.classList.contains('expanded');

    if (isExpanded) {
        element.classList.remove('expanded');
        element.classList.add('collapsed');
        children.classList.add('collapsed');
    } else {
        element.classList.remove('collapsed');
        element.classList.add('expanded');
        children.classList.remove('collapsed');
    }
}

function switchMainTab(tabName) {
    // Hide all main panels
    const panels = document.querySelectorAll('.main-tab-panel');
    panels.forEach(panel => panel.classList.remove('active'));

    // Hide all main buttons
    const buttons = document.querySelectorAll('.main-tab-button');
    buttons.forEach(button => button.classList.remove('active'));

    // Show selected panel and button
    document.getElementById(tabName + '-main-panel').classList.add('active');
    event.target.classList.add('active');
}

function switchTab(tabName, contentType) {
    const suffix = contentType ? '-' + contentType : '';
    const panelId = tabName + suffix + '-panel';

    // Find the parent tab container
    const parentContainer = document.getElementById(panelId).closest('.tabs');

    // Hide all panels in this container
    const panels = parentContainer.querySelectorAll('.tab-panel');
    panels.forEach(panel => panel.classList.remove('active'));

    // Hide all buttons in this container
    const buttons = parentContainer.querySelectorAll('.tab-button');
    buttons.forEach(button => button.classList.remove('active'));

    // Show selected panel and button
    document.getElementById(panelId).classList.add('active');
    event.target.classList.add('active');
}

function toggleView(viewType, contentType) {
    // Find the active tab panel
    const activePanel = document.querySelector(`#${contentType}-main-panel .tab-panel.active`);
    if (!activePanel) return;

    // Hide all view contents in the active panel
    const viewContents = activePanel.querySelectorAll('.view-content');
    viewContents.forEach(content => content.classList.remove('active'));

    // Show selected view
    const targetView = activePanel.querySelector(`[id$="-${viewType}-view"]`);
    if (targetView) {
        targetView.classList.add('active');
    }

    // Update toggle buttons
    const parentContainer = activePanel.closest('.tabs');
    const toggleButtons = parentContainer.querySelectorAll('.view-toggle-button');
    toggleButtons.forEach(button => button.classList.remove('active'));
    event.target.classList.add('active');
}

// Export functions for global use
window.displayFileTables = displayFileTables;
window.displayImageTrees = displayImageTrees;
window.displayFileTrees = displayFileTrees;
window.toggleTreeNode = toggleTreeNode;
window.switchMainTab = switchMainTab;
window.switchTab = switchTab;
window.toggleView = toggleView;