# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

"""
Web Visualizer for Flutter Bloom Build System
Creates HTML visualization of asset replacements
"""

import os
import base64
from datetime import datetime
from typing import Dict, List

class WebVisualizer:
    """Creates web-based visualization of build process and asset replacements"""
    
    def __init__(self):
        pass
    
    def image_to_base64(self, image_path: str) -> str:
        """Convert image to base64 for embedding in HTML"""
        try:
            with open(image_path, 'rb') as f:
                image_data = f.read()
                base64_data = base64.b64encode(image_data).decode('utf-8')
                
                # Determine MIME type
                ext = os.path.splitext(image_path)[1].lower()
                if ext == '.png':
                    mime_type = 'image/png'
                elif ext in ['.jpg', '.jpeg']:
                    mime_type = 'image/jpeg'
                elif ext == '.gif':
                    mime_type = 'image/gif'
                elif ext == '.webp':
                    mime_type = 'image/webp'
                else:
                    mime_type = 'image/png'
                
                return f"data:{mime_type};base64,{base64_data}"
        except Exception as e:
            print(f"[WARNING] Failed to convert image to base64: {image_path} - {e}")
            return ""
    
    def create_replacement_html(self, working_dir: str, app_name: str, replacement_results: Dict) -> str:
        """Create HTML visualization of asset replacements"""
        html_template = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flutter Bloom Build - Asset Replacements</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
        }
        .stat {
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #495057;
        }
        .stat-label {
            color: #6c757d;
            font-size: 0.9em;
        }
        .content {
            padding: 30px;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #495057;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .replacement-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
        }
        .replacement-item {
            border: 1px solid #dee2e6;
            border-radius: 8px;
            overflow: hidden;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .replacement-header {
            background: #f8f9fa;
            padding: 15px;
            border-bottom: 1px solid #dee2e6;
        }
        .replacement-header h3 {
            margin: 0;
            color: #495057;
            font-size: 1.1em;
        }
        .replacement-path {
            font-family: monospace;
            font-size: 0.8em;
            color: #6c757d;
            margin-top: 5px;
        }
        .image-comparison {
            display: flex;
            height: 200px;
        }
        .image-side {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            position: relative;
        }
        .image-side:first-child {
            border-right: 1px solid #dee2e6;
            background: #f8f9fa;
        }
        .image-side h4 {
            margin: 0 0 10px 0;
            font-size: 0.9em;
            color: #495057;
        }
        .image-side img {
            max-width: 100%;
            max-height: 120px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .image-info {
            margin-top: 10px;
            font-size: 0.8em;
            color: #6c757d;
            text-align: center;
        }
        .error-list, .skip-list {
            background: #f8f9fa;
            border-radius: 4px;
            padding: 15px;
        }
        .error-item, .skip-item {
            padding: 8px 0;
            border-bottom: 1px solid #dee2e6;
            font-family: monospace;
            font-size: 0.9em;
        }
        .error-item:last-child, .skip-item:last-child {
            border-bottom: none;
        }
        .error-item {
            color: #dc3545;
        }
        .skip-item {
            color: #6c757d;
        }
        .success {
            color: #28a745;
        }
        .warning {
            color: #ffc107;
        }
        .error {
            color: #dc3545;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Flutter Bloom Build Report</h1>
            <p>Asset Replacement Visualization for <strong>{app_name}</strong></p>
            <p>Generated on {timestamp}</p>
        </div>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-number success">{replacement_count}</div>
                <div class="stat-label">Replacements</div>
            </div>
            <div class="stat">
                <div class="stat-number error">{error_count}</div>
                <div class="stat-label">Errors</div>
            </div>
            <div class="stat">
                <div class="stat-number warning">{skip_count}</div>
                <div class="stat-label">Skipped</div>
            </div>
        </div>
        
        <div class="content">
            {replacements_section}
            {errors_section}
            {skipped_section}
        </div>
    </div>
</body>
</html>
        """
        
        # Process replacement data
        replacements = replacement_results.get('replacements', [])
        errors = replacement_results.get('errors', [])
        skipped = replacement_results.get('skipped', [])
        
        # Create replacements section
        replacements_html = ""
        if replacements:
            replacements_html = '<div class="section"><h2>Asset Replacements</h2><div class="replacement-grid">'
            
            for replacement in replacements:
                source_path = replacement.get('source', '')
                target_path = replacement.get('target', '')
                backup_path = replacement.get('backup', '')
                size = replacement.get('size', (0, 0))
                
                # Convert images to base64
                source_b64 = self.image_to_base64(source_path) if os.path.exists(source_path) else ""
                backup_b64 = self.image_to_base64(backup_path) if os.path.exists(backup_path) else ""
                
                replacements_html += f"""
                <div class="replacement-item">
                    <div class="replacement-header">
                        <h3>{os.path.basename(target_path)}</h3>
                        <div class="replacement-path">{target_path}</div>
                    </div>
                    <div class="image-comparison">
                        <div class="image-side">
                            <h4>Original</h4>
                            {f'<img src="{backup_b64}" alt="Original">' if backup_b64 else '<div>No preview</div>'}
                            <div class="image-info">Backup: {os.path.basename(backup_path)}</div>
                        </div>
                        <div class="image-side">
                            <h4>Replaced</h4>
                            {f'<img src="{source_b64}" alt="Replacement">' if source_b64 else '<div>No preview</div>'}
                            <div class="image-info">Size: {size[0]}x{size[1]}<br>Source: {os.path.basename(source_path)}</div>
                        </div>
                    </div>
                </div>
                """
            
            replacements_html += '</div></div>'
        
        # Create errors section
        errors_html = ""
        if errors:
            errors_html = '<div class="section"><h2>Errors</h2><div class="error-list">'
            for error in errors:
                errors_html += f'<div class="error-item">{error}</div>'
            errors_html += '</div></div>'
        
        # Create skipped section
        skipped_html = ""
        if skipped:
            skipped_html = '<div class="section"><h2>Skipped Items</h2><div class="skip-list">'
            for skip in skipped:
                skipped_html += f'<div class="skip-item">{skip}</div>'
            skipped_html += '</div></div>'
        
        # Fill template
        html_content = html_template.format(
            app_name=app_name,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            replacement_count=len(replacements),
            error_count=len(errors),
            skip_count=len(skipped),
            replacements_section=replacements_html,
            errors_section=errors_html,
            skipped_section=skipped_html
        )
        
        return html_content
    
    def save_visualization(self, working_dir: str, app_name: str, replacement_results: Dict) -> str:
        """Save HTML visualization to file and return path"""
        html_content = self.create_replacement_html(working_dir, app_name, replacement_results)
        
        # Create visualization directory
        viz_dir = os.path.join(working_dir, "build_visualization")
        os.makedirs(viz_dir, exist_ok=True)
        
        # Save HTML file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        html_filename = f"asset_replacements_{app_name}_{timestamp}.html"
        html_path = os.path.join(viz_dir, html_filename)
        
        try:
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            print(f"[SUCCESS] Visualization saved to: {html_path}")
            return html_path
            
        except Exception as e:
            print(f"[ERROR] Failed to save visualization: {e}")
            return ""
    
    def open_visualization(self, html_path: str) -> bool:
        """Open visualization in default browser"""
        try:
            import webbrowser
            webbrowser.open(f"file://{html_path}")
            return True
        except Exception as e:
            print(f"[ERROR] Failed to open visualization: {e}")
            return False
