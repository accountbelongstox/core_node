/**
 * Prompts Panel - Dynamic AI Prompt Generator
 *
 * Generates context-aware prompts based on:
 * - Currently selected app
 * - Project structure
 * - FLUTTER_GUIDE.md specifications
 */

class PromptsPanel {
  constructor(containerSelector = '#prompts-list') {
    this.container = document.querySelector(containerSelector);
    this.currentApp = null;
    this.projectRoot = 'D:\\programing\\core_node';
    this.flutterRoot = `${this.projectRoot}\\poly_apps\\flutter_bloom`;
  }

  /**
   * Update prompts based on selected app
   * @param {string} appName - Current app name (e.g., "app_wuy")
   */
  updatePrompts(appName) {
    if (!appName) {
      this.showPlaceholder();
      return;
    }

    this.currentApp = appName;
    this.render();
  }

  /**
   * Show placeholder when no app selected
   */
  showPlaceholder() {
    this.container.innerHTML = `
      <div class="prompts-placeholder">
        <div class="prompts-placeholder-icon">💡</div>
        <p>Select an app to see context-aware prompts</p>
      </div>
    `;
  }

  /**
   * Generate prompt templates
   * @returns {Array} Array of prompt objects
   */
  generatePrompts() {
    if (!this.currentApp) return [];

    const appPath = `${this.flutterRoot}\\lib\\apps\\${this.currentApp}`;
    const pageviewsPath = `${appPath}\\doc\\pageviews`;
    const designDocsPath = `${appPath}\\design_docs_and_progress`;
    const detailedDesignsPath = `${designDocsPath}\\3_page_designs_detailed`;

    return [
      // Prompt 1: Image Comparison Analysis
      {
        id: 'comparison-analysis',
        title: 'Analyze Design vs Implementation',
        icon: '🔍',
        description: 'Compare expected design with actual implementation and suggest adjustments',
        text: this.getComparisonAnalysisPrompt(designDocsPath),
        expandable: true,
        details: `This prompt analyzes side-by-side comparison images to identify:
- Layout differences
- Color variations
- Text content mismatches
- Spacing and alignment issues

Uses data from pageview_map.json including:
- color_palette: Top 10 colors with ratios
- ocr_text: Extracted text with positions`
      },

      // Prompt 2: Scan pageviews and copy to detailed designs
      {
        id: 'scan-pageviews',
        title: 'Migrate Pageviews to Design Structure',
        icon: '📸',
        description: 'Scan pageview images and migrate to 3-layer design system',
        text: `Scan images in "${pageviewsPath}" directory. Following the specifications in "development-guides\\FLUTTER_GUIDE.md", copy these images to the appropriate subdirectories under "${detailedDesignsPath}" based on page names. Then update the "pageview_map.json" file for each page with proper UI element mappings according to the Flutter 2025 architecture guidelines.

Steps:
1. List all images in pageviews directory
2. Identify page names from image filenames
3. Create corresponding page directories in 3_page_designs_detailed/
4. Copy images to [page_name]/images/ subdirectories
5. Generate or update pageview_map.json with UI element mappings
6. Ensure all paths follow the three-layer design system structure`,
        expandable: true,
        details: `Reference: development-guides\\FLUTTER_GUIDE.md
Layer 3 structure: 3_page_designs_detailed/{page_name}/
Required files: README.md, pageview_map.json, design_specs.md
Images location: {page_name}/images/`
      },

      // Prompt 2: Create missing design structure (EXTENSIBLE)
      // UNCOMMENT to enable this prompt
      /*
      {
        id: 'create-structure',
        title: 'Auto-Expand Design Structure',
        icon: '🏗️',
        description: 'Create missing design documentation structure',
        text: `Auto-expand the three-layer design documentation structure for "${this.currentApp}". Create missing directories and template files following the structure defined in "doc\\DESIGN_DOCS_STRUCTURE.md".

Layers to create:
- 1_concept_designs/ (architecture, flows, data models)
- 2_page_designs_rough/ (page wireframes)
- 3_page_designs_detailed/ (detailed specs with pageview_map.json)

Base path: "${designDocsPath}"

Use the design_doc_tool.py utility or manually create the structure following the documented specifications.`,
        expandable: false
      },
      */

      // Prompt 3: Validate pageview_map.json (EXTENSIBLE)
      // UNCOMMENT to enable this prompt
      /*
      {
        id: 'validate-pageview-maps',
        title: 'Validate PageView Maps',
        icon: '✅',
        description: 'Check all pageview_map.json files for correctness',
        text: `Validate all "pageview_map.json" files under "${detailedDesignsPath}".

Validation checks:
1. JSON syntax is valid
2. Required fields present: image_file, page_key, elements
3. Element mappings include: type, bbox, widget_mapping
4. Image files referenced in image_file field exist
5. Follows Flutter 2025 specifications from FLUTTER_GUIDE.md

Generate a validation report listing any errors or warnings found.`,
        expandable: false
      },
      */

      // Prompt 4: Generate design progress report (EXTENSIBLE)
      // UNCOMMENT to enable this prompt
      /*
      {
        id: 'progress-report',
        title: 'Generate Design Progress Report',
        icon: '📊',
        description: 'Create comprehensive design completion report',
        text: `Generate a design progress report for "${this.currentApp}".

Report should include:
- Layer 1 (Concept): Architecture diagrams, flows, data models completion status
- Layer 2 (Rough): Page wireframes completion status
- Layer 3 (Detailed): Detailed specs and pageview_map.json completion status
- Missing items and recommendations
- Overall completion percentage

Output format: Markdown file saved to "${designDocsPath}\\PROGRESS_REPORT.md"`,
        expandable: false
      },
      */

      // ADD MORE PROMPTS HERE
      // Follow the same structure:
      // {
      //   id: 'unique-id',
      //   title: 'Prompt Title',
      //   icon: '🔧',
      //   description: 'Short description',
      //   text: `Full prompt text with dynamic paths`,
      //   expandable: true/false,
      //   details: 'Optional expandable details'
      // }
    ];
  }

  /**
   * Render prompts to DOM
   */
  render() {
    const prompts = this.generatePrompts();

    if (prompts.length === 0) {
      this.showPlaceholder();
      return;
    }

    this.container.innerHTML = prompts.map(prompt =>
      this.renderPromptCard(prompt)
    ).join('');

    // Attach event listeners
    this.attachEventListeners();

    // Show extension hint
    this.showExtensionHint();
  }

  /**
   * Render a single prompt card
   * @param {Object} prompt - Prompt object
   * @returns {string} HTML string
   */
  renderPromptCard(prompt) {
    return `
      <div class="prompt-card" data-prompt-id="${prompt.id}">
        <div class="prompt-header">
          <div class="prompt-title">
            <span class="prompt-icon">${prompt.icon}</span>
            <span>${prompt.title}</span>
          </div>
          <button class="prompt-copy-btn" data-action="copy">
            Copy
          </button>
        </div>
        <div class="prompt-body">
          ${prompt.description ? `<p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">${prompt.description}</p>` : ''}
          <div class="prompt-text">${this.highlightPaths(prompt.text)}</div>
          ${prompt.expandable ? `
            <div class="prompt-expandable">
              <button class="prompt-expand-toggle" data-action="toggle-details">
                ▼ Show Details
              </button>
              <div class="prompt-details" style="display: none;">
                ${prompt.details || 'No additional details'}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Highlight paths in prompt text
   * @param {string} text - Prompt text
   * @returns {string} HTML with highlighted paths
   */
  highlightPaths(text) {
    // Highlight paths in quotes
    return text.replace(/"([^"]*[\\/][^"]*)"/g, (match, path) => {
      return `"<span class="prompt-path">${path}</span>"`;
    });
  }

  /**
   * Attach event listeners to prompt cards
   */
  attachEventListeners() {
    // Copy button handlers
    this.container.querySelectorAll('[data-action="copy"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.prompt-card');
        const promptText = card.querySelector('.prompt-text').textContent;
        this.copyToClipboard(promptText, e.target);
      });
    });

    // Toggle details handlers
    this.container.querySelectorAll('[data-action="toggle-details"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const details = e.target.nextElementSibling;
        const isHidden = details.style.display === 'none';

        details.style.display = isHidden ? 'block' : 'none';
        e.target.textContent = isHidden ? '▲ Hide Details' : '▼ Show Details';
      });
    });
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @param {HTMLElement} button - Button element
   */
  async copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text);

      // Visual feedback
      const originalText = button.textContent;
      button.textContent = '✓ Copied!';
      button.classList.add('copied');

      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  }

  /**
   * Show extension hint at the bottom
   */
  showExtensionHint() {
    const hint = document.createElement('div');
    hint.className = 'prompt-extension-hint';
    hint.innerHTML = `
      💡 <strong>Extensible:</strong> More prompts can be added in <code>prompts-panel.js</code><br>
      Uncomment existing prompts or add new ones following the template structure.
    `;
    this.container.appendChild(hint);
  }

  /**
   * Get comparison analysis prompt with dynamic comparison URL
   * @param {string} designDocsPath - Path to design docs directory
   * @returns {string} Comparison analysis prompt text
   */
  getComparisonAnalysisPrompt(designDocsPath) {
    // Check if there's a latest comparison image selected
    const comparisonUrl = window.latestComparisonUrl || '[Select a comparison image or upload one]';
    const pageviewMapPath = `${designDocsPath}\\pageview_map.json`;

    return `Analyze the side-by-side comparison image available at:
${comparisonUrl}

The image shows:
- **Left side**: Expected design (from rough or detailed design layers)
- **Right side**: Actual implementation (screenshot)

Reference the pageview_map.json file at "${pageviewMapPath}" for additional context:
- color_palette: Top 10 colors with ratios
- ocr_text: Extracted text with bounding boxes and confidence scores

**Analysis Tasks:**
1. **Layout Differences**: Identify spacing, alignment, and positioning discrepancies
2. **Color Variations**: Compare color schemes using palette data
3. **Text Content**: Verify text matches using OCR data
4. **Widget Sizing**: Check if elements maintain proper proportions

**Output Required:**
Provide specific Flutter code adjustments to match the expected design. Include:
- Widget tree modifications
- Style/theme updates
- Layout constraint adjustments
- Color/typography corrections

**Note**: If no comparison image is selected, this prompt will update automatically when you click on a comparison image in the history list or upload a new comparison.`;
  }
}

// Export for use in app.js
window.PromptsPanel = PromptsPanel;
