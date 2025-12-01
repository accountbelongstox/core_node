// ============================================
// NAMESPACE: ITTools.Implementations.Images
// FILE: ittools-impl-images.js  
// PURPOSE: Image tool implementations
// ============================================

// ============================================
// Image Compressor
// ============================================
ITTools.Tools.Registry.register('image-compressor', {
    name: 'Image Compressor',
    category: 'image',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Image Compressor</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload Image:</label>
                        <input type="file" id="img-compress-file" class="ittools-input" accept="image/*">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Quality (1-100):</label>
                        <input type="range" id="img-compress-quality" min="1" max="100" value="85" 
                               oninput="document.getElementById('quality-value').textContent=this.value">
                        <span id="quality-value">85</span>
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.ImageCompressor.compress()">
                            🗜️ Compress
                        </button>
                    </div>
                    <div id="img-compress-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ImageCompressor = {
    async compress() {
        const fileInput = document.getElementById('img-compress-file');
        const quality = document.getElementById('img-compress-quality').value;
        
        if (!fileInput.files[0]) {
            ITTools.UI.showResult('img-compress-result', 'Please select an image', false);
            return;
        }
        
        ITTools.UI.showLoading('img-compress-result', 'Compressing...');
        
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        formData.append('quality', quality);
        
        try {
            const response = await fetch('/api/ittools/v1/advanced/image/compress', {
                method: 'POST', body: formData
            });
            const result = await response.json();
            
            if (result.success) {
                const d = result.data;
                ITTools.UI.showResult('img-compress-result', 
                    `Compressed: ${d.original_size_readable} → ${d.compressed_size_readable} (${d.compression_ratio} saved)`, true);
            } else {
                ITTools.UI.showResult('img-compress-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('img-compress-result', 'Error: ' + error.message, false);
        }
    }
};

// ============================================
// Image Cropper
// ============================================
ITTools.Tools.Registry.register('image-cropper', {
    name: 'Image Cropper',
    category: 'image',
    render() {
        return `
            <div class="ittools-card">
                <div class="ittools-card-header">Image Cropper</div>
                <div class="ittools-card-body">
                    <div class="ittools-form-group">
                        <label class="ittools-label">Upload Image:</label>
                        <input type="file" id="img-crop-file" class="ittools-input" accept="image/*">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">X Position:</label>
                        <input type="number" id="img-crop-x" class="ittools-input" value="0">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Y Position:</label>
                        <input type="number" id="img-crop-y" class="ittools-input" value="0">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Width:</label>
                        <input type="number" id="img-crop-width" class="ittools-input" value="200">
                    </div>
                    <div class="ittools-form-group">
                        <label class="ittools-label">Height:</label>
                        <input type="number" id="img-crop-height" class="ittools-input" value="200">
                    </div>
                    <div class="ittools-btn-group">
                        <button class="ittools-btn ittools-btn-primary" onclick="ITTools.Implementations.ImageCropper.crop()">
                            ✂️ Crop
                        </button>
                    </div>
                    <div id="img-crop-result" class="ittools-result" style="display: none;"></div>
                </div>
            </div>
        `;
    }
});

ITTools.Implementations.ImageCropper = {
    async crop() {
        const fileInput = document.getElementById('img-crop-file');
        const x = document.getElementById('img-crop-x').value;
        const y = document.getElementById('img-crop-y').value;
        const width = document.getElementById('img-crop-width').value;
        const height = document.getElementById('img-crop-height').value;
        
        if (!fileInput.files[0]) {
            ITTools.UI.showResult('img-crop-result', 'Please select an image', false);
            return;
        }
        
        ITTools.UI.showLoading('img-crop-result', 'Cropping...');
        
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        formData.append('x', x);
        formData.append('y', y);
        formData.append('width', width);
        formData.append('height', height);
        
        try {
            const response = await fetch('/api/ittools/v1/advanced/image/crop', {
                method: 'POST', body: formData
            });
            const result = await response.json();
            
            if (result.success) {
                ITTools.UI.showResult('img-crop-result', `Cropped successfully (${width}x${height})`, true);
            } else {
                ITTools.UI.showResult('img-crop-result', 'Error: ' + result.message, false);
            }
        } catch (error) {
            ITTools.UI.showResult('img-crop-result', 'Error: ' + error.message, false);
        }
    }
};

console.log('ITTools Image Implementations loaded');
