/**
 * Comparison Uploader Component
 * Handles uploading actual images for comparison with expected designs
 */

class ComparisonUploader {
  constructor() {
    this.currentApp = null;
  }

  /**
   * Upload comparison image
   * @param {string} appName - Application name
   * @param {string} pageKey - Page key
   * @param {string} expectedImagePath - Path to expected design image
   * @param {File} actualImageFile - Uploaded actual image file
   * @param {string} description - Description for the comparison (default: "implemented")
   */
  async uploadComparison(appName, pageKey, expectedImagePath, actualImageFile, description = "implemented") {
    try {
      // Read file as base64
      const imageData = await this.readFileAsBase64(actualImageFile);

      // Create request body
      const requestBody = {
        page_key: pageKey,
        expected_image_path: expectedImagePath,
        description: description,
        image_data: imageData
      };

      // Send request
      const response = await fetch(`/api/apps/${appName}/comparison/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create comparison');
      }

      console.log('[ComparisonUploader] Comparison created:', result);

      // Update global comparison URL for prompts
      if (result.download_url) {
        window.latestComparisonUrl = result.download_url;

        // Refresh prompts panel to update comparison analysis prompt
        if (window.promptsPanel) {
          window.promptsPanel.render();
        }
      }

      // Show success message
      alert(`Comparison created successfully!\nFilename: ${result.filename}`);

      return result;

    } catch (error) {
      console.error('[ComparisonUploader] Upload failed:', error);
      throw error;
    }
  }

  /**
   * Read file as base64
   * @param {File} file - File to read
   * @returns {Promise<string>} Base64 encoded file data
   */
  readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * List comparison images for a page
   * @param {string} appName - Application name
   * @param {string} pageKey - Page key
   * @returns {Promise<Array>} List of comparison images
   */
  async listComparisons(appName, pageKey) {
    try {
      const response = await fetch(`/api/apps/${appName}/comparison/list/${pageKey}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to list comparisons');
      }

      return data.comparisons || [];

    } catch (error) {
      console.error('[ComparisonUploader] List failed:', error);
      return [];
    }
  }

  /**
   * Get download URL for comparison image
   * @param {string} appName - Application name
   * @param {string} pageKey - Page key
   * @param {string} filename - Comparison filename
   * @returns {string} Download URL
   */
  getDownloadUrl(appName, pageKey, filename) {
    return `/api/comparison/download/${appName}/${pageKey}/${filename}`;
  }
}

// Make ComparisonUploader available globally
window.ComparisonUploader = ComparisonUploader;
