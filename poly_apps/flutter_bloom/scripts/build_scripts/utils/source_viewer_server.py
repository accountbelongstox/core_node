#!/usr/bin/env python3
"""
Source Viewer Server - Web interface for viewing Flutter project resources
"""

import os
import json
import subprocess
import urllib.parse
from pathlib import Path
from typing import Dict, Any
import threading
import webbrowser

try:
    from flask import Flask, render_template_string, jsonify, request, send_file, Response
except ImportError:
    print("[ERROR] Flask is required. Install it with: pip install Flask")
    exit(1)

try:
    from source_scanner import SourceScanner
except ImportError:
    # Try relative import
    try:
        from .source_scanner import SourceScanner
    except ImportError:
        print("[ERROR] SourceScanner module not found")
        exit(1)

class SourceViewerServer:
    """Web server for viewing Flutter project source resources"""

    def __init__(self, port: int = 8081):
        self.port = port
        self.app = Flask(__name__)
        self.scanner = SourceScanner()
        self.scan_results = None
        self.setup_routes()

    def setup_routes(self):
        """Setup Flask routes"""

        @self.app.route('/')
        def index():
            return render_template_string(self.get_html_template())

        @self.app.route('/api/scan')
        def api_scan():
            """Scan project and return results"""
            try:
                # Find project root (go up two levels from script directory)
                script_dir = Path(__file__).parent.parent
                project_root = self.scanner.find_project_root(script_dir)

                self.scan_results = self.scanner.get_comprehensive_scan_results(project_root)
                return jsonify(self.scan_results)

            except Exception as e:
                return jsonify({'error': str(e)}), 500

        @self.app.route('/api/open-directory')
        def api_open_directory():
            """Open directory in Windows Explorer"""
            try:
                file_path = request.args.get('path')
                if not file_path:
                    return jsonify({'error': 'No path provided'}), 400

                # Convert to Path and get parent directory
                path_obj = Path(file_path)
                if path_obj.is_file():
                    directory = path_obj.parent
                else:
                    directory = path_obj

                # Ensure directory exists
                if not directory.exists():
                    return jsonify({'error': f'Directory does not exist: {directory}'}), 404

                # Convert to Windows format - use absolute path
                windows_path = str(directory.resolve()).replace('/', '\\')

                # Use explorer with proper Windows path format
                subprocess.run(['explorer', '/select,', windows_path], shell=False)

                return jsonify({'success': True, 'opened': str(directory)})

            except Exception as e:
                return jsonify({'error': str(e)}), 500

        @self.app.route('/api/copy-path')
        def api_copy_path():
            """Return Windows-formatted path for copying"""
            try:
                file_path = request.args.get('path')
                if not file_path:
                    return jsonify({'error': 'No path provided'}), 400

                # Convert to Windows format
                windows_path = str(Path(file_path)).replace('/', '\\')
                return jsonify({'windows_path': windows_path})

            except Exception as e:
                return jsonify({'error': str(e)}), 500

        @self.app.route('/api/download-image')
        def api_download_image():
            """Download image file"""
            try:
                file_path = request.args.get('path')
                if not file_path:
                    return jsonify({'error': 'No path provided'}), 400

                path_obj = Path(file_path)
                if not path_obj.exists() or not path_obj.is_file():
                    return jsonify({'error': 'File not found'}), 404

                return send_file(str(path_obj), as_attachment=True, download_name=path_obj.name)

            except Exception as e:
                return jsonify({'error': str(e)}), 500

    def get_html_template(self) -> str:
        """Return HTML template for the web interface"""
        return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flutter Source Viewer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            color: #333;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .header h1 {
            font-size: 2rem;
            margin-bottom: 0.5rem;
        }

        .header .subtitle {
            opacity: 0.9;
            font-size: 1rem;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }

        .controls {
            background: white;
            padding: 1.5rem;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }

        .btn {
            background: #667eea;
            color: white;
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1rem;
            transition: background-color 0.3s;
        }

        .btn:hover {
            background: #5a67d8;
        }

        .btn:disabled {
            background: #a0a0a0;
            cursor: not-allowed;
        }

        .stats {
            background: white;
            padding: 1.5rem;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
        }

        .stat-card {
            background: #f8fafc;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }

        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #667eea;
        }

        .stat-label {
            color: #64748b;
            font-size: 0.9rem;
            margin-top: 0.5rem;
        }

        .main-tabs {
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
            margin-bottom: 2rem;
        }

        .main-tab-buttons {
            display: flex;
            background: #667eea;
            border-bottom: 1px solid #5a67d8;
        }

        .main-tab-button {
            padding: 1.5rem 2rem;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1.1rem;
            font-weight: 600;
            color: rgba(255,255,255,0.8);
            transition: all 0.3s;
            flex: 1;
            text-align: center;
        }

        .main-tab-button.active {
            background: white;
            color: #667eea;
            border-bottom: 3px solid #667eea;
        }

        .main-tab-button:hover {
            background: rgba(255,255,255,0.1);
            color: white;
        }

        .main-tab-button.active:hover {
            background: white;
            color: #667eea;
        }

        .tabs {
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .tab-buttons {
            display: flex;
            background: #f1f5f9;
            border-bottom: 1px solid #e2e8f0;
        }

        .tab-button {
            padding: 1rem 1.5rem;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1rem;
            color: #64748b;
            transition: all 0.3s;
            flex: 1;
            text-align: center;
        }

        .tab-button.active {
            background: white;
            color: #667eea;
            border-bottom: 3px solid #667eea;
        }

        .tab-button:hover {
            background: #e2e8f0;
        }

        .tab-content {
            padding: 1.5rem;
        }

        .tab-panel {
            display: none;
        }

        .tab-panel.active {
            display: block;
        }

        .image-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
        }

        .image-table th,
        .image-table td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }

        .image-table th {
            background: #f8fafc;
            font-weight: 600;
            color: #475569;
        }

        .image-table tr:hover {
            background: #f8fafc;
        }

        .image-preview {
            max-width: 50px;
            max-height: 50px;
            width: auto;
            height: auto;
            object-fit: contain;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .image-preview:hover {
            transform: scale(1.05);
        }

        .image-popup {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 1000;
            cursor: pointer;
        }

        .image-popup-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 90%;
            max-height: 90%;
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        .image-popup img {
            max-width: 100%;
            max-height: 80vh;
            object-fit: contain;
            display: block;
            margin: 0 auto;
        }

        .image-popup-close {
            position: absolute;
            top: 10px;
            right: 10px;
            background: #ff4444;
            color: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            cursor: pointer;
            font-size: 16px;
            line-height: 1;
        }

        .image-popup-info {
            text-align: center;
            margin-top: 10px;
            color: #64748b;
            font-size: 0.9rem;
        }

        /* Tree View Styles */
        .tree-root {
            font-family: monospace;
            line-height: 1.4;
            padding: 1rem;
        }

        .tree-item {
            margin: 2px 0;
        }

        .tree-directory {
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
            color: #0066cc;
            transition: background-color 0.2s;
        }

        .tree-directory:hover {
            background-color: #f0f4f8;
        }

        .tree-directory.collapsed:before {
            content: "▶ ";
            color: #666;
        }

        .tree-directory.expanded:before {
            content: "▼ ";
            color: #666;
        }

        .tree-children {
            overflow: hidden;
            transition: max-height 0.3s ease-out;
        }

        .tree-children.collapsed {
            max-height: 0;
        }

        .tree-children:not(.collapsed) {
            max-height: 10000px;
        }

        .tree-file {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 2px 8px;
            border-radius: 4px;
            transition: background-color 0.2s;
        }

        .tree-file:hover {
            background-color: #f8fafc;
        }

        .tree-file-info {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
        }

        .tree-file-actions {
            display: flex;
            gap: 4px;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .tree-file:hover .tree-file-actions {
            opacity: 1;
        }

        .tree-file-actions .action-btn {
            padding: 2px 6px;
            font-size: 0.8rem;
            min-width: auto;
        }

        .file-type-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.7rem;
            font-weight: 500;
            text-transform: uppercase;
        }

        .file-type-code { background: #e3f2fd; color: #1565c0; }
        .file-type-config { background: #fff3e0; color: #ef6c00; }
        .file-type-markup { background: #e8f5e8; color: #2e7d32; }
        .file-type-document { background: #fce4ec; color: #c2185b; }
        .file-type-build { background: #f3e5f5; color: #7b1fa2; }
        .file-type-binary { background: #e0e0e0; color: #424242; }
        .file-type-archive { background: #fff8e1; color: #f57f17; }
        .file-type-image { background: #e1f5fe; color: #0277bd; }

        /* View Toggle Buttons */
        .view-toggle-buttons {
            display: flex;
            gap: 8px;
            margin-bottom: 1rem;
            justify-content: center;
        }

        .view-toggle-button {
            padding: 8px 16px;
            background: #f1f5f9;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s;
        }

        .view-toggle-button.active {
            background: #667eea;
            color: white;
            border-color: #5a67d8;
        }

        .view-toggle-button:hover:not(.active) {
            background: #e2e8f0;
        }

        .view-content {
            display: none;
        }

        .view-content.active {
            display: block;
        }

        .image-type {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: 500;
        }

        .type-icon {
            background: #dbeafe;
            color: #1d4ed8;
        }

        .type-background {
            background: #dcfce7;
            color: #166534;
        }

        .type-placeholder {
            background: #fee2e2;
            color: #991b1b;
        }

        .type-logo {
            background: #fef3c7;
            color: #92400e;
        }

        .type-image {
            background: #e0e7ff;
            color: #3730a3;
        }

        .action-buttons {
            display: flex;
            gap: 0.5rem;
        }

        .action-btn {
            padding: 0.25rem 0.5rem;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
            transition: background-color 0.3s;
        }

        .action-btn:hover {
            background: #e2e8f0;
        }

        .loading {
            text-align: center;
            padding: 2rem;
            color: #64748b;
        }

        .error {
            background: #fee2e2;
            color: #991b1b;
            padding: 1rem;
            border-radius: 5px;
            margin: 1rem 0;
        }

        .path-display {
            font-family: 'Courier New', monospace;
            font-size: 0.8rem;
            color: #64748b;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .identifier-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
        }

        .identifier-table th,
        .identifier-table td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }

        .identifier-table th {
            background: #f8fafc;
            font-weight: 600;
            color: #475569;
        }

        .identifier-code {
            font-family: 'Courier New', monospace;
            background: #f1f5f9;
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            font-size: 0.9rem;
        }

        .tree-view {
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            line-height: 1.4;
        }

        .tree-item {
            margin: 2px 0;
        }

        .tree-directory {
            color: #3730a3;
            font-weight: bold;
            cursor: pointer;
            padding: 2px 4px;
            border-radius: 3px;
            transition: background-color 0.2s;
        }

        .tree-directory:hover {
            background: #e0e7ff;
        }

        .tree-directory.collapsed::before {
            content: "▶ ";
        }

        .tree-directory.expanded::before {
            content: "▼ ";
        }

        .tree-file {
            color: #475569;
            padding: 2px 4px;
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            transition: background-color 0.2s;
        }

        .tree-file:hover {
            background: #f8fafc;
        }

        .tree-file-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .tree-file-icon {
            width: 16px;
            height: 16px;
            display: inline-block;
        }

        .tree-file-actions {
            opacity: 0;
            display: flex;
            gap: 4px;
            transition: opacity 0.2s;
        }

        .tree-file:hover .tree-file-actions {
            opacity: 1;
        }

        .tree-children {
            margin-left: 20px;
            border-left: 1px dotted #cbd5e1;
            padding-left: 8px;
        }

        .tree-children.collapsed {
            display: none;
        }

        .file-type-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 0.7rem;
            font-weight: 500;
            color: white;
        }

        .file-type-code { background: #059669; }
        .file-type-image { background: #7c3aed; }
        .file-type-config { background: #d97706; }
        .file-type-markup { background: #dc2626; }
        .file-type-document { background: #2563eb; }
        .file-type-build { background: #0891b2; }
        .file-type-binary { background: #6b7280; }
        .file-type-archive { background: #7c2d12; }
        .file-type-other { background: #64748b; }

        .view-toggle {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
            padding: 0.5rem;
            background: #f8fafc;
            border-radius: 8px;
        }

        .view-toggle-button {
            padding: 0.5rem 1rem;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.3s;
        }

        .view-toggle-button.active {
            background: #667eea;
            color: white;
            border-color: #5a67d8;
        }

        .main-tab-panel {
            display: none;
        }

        .main-tab-panel.active {
            display: block;
        }

        .view-content {
            display: none;
        }

        .view-content.active {
            display: block;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Flutter Source Viewer</h1>
        <div class="subtitle">Comprehensive resource scanner for Flutter projects</div>
    </div>

    <div class="container">
        <div class="controls">
            <button id="scanBtn" class="btn" onclick="startScan()">Start Scan</button>
            <span id="scanStatus" style="margin-left: 1rem; color: #64748b;"></span>
        </div>

        <div id="statsSection" class="stats" style="display: none;">
            <h2 style="margin-bottom: 1rem;">Scan Statistics</h2>
            <div id="statsGrid" class="stats-grid"></div>
        </div>

        <div id="resultsSection" style="display: none;">
            <!-- Main content type selector -->
            <div class="main-tabs">
                <div class="main-tab-buttons">
                    <button class="main-tab-button active" onclick="switchMainTab('images')">📷 Images</button>
                    <button class="main-tab-button" onclick="switchMainTab('files')">📁 All Files</button>
                    <button class="main-tab-button" onclick="switchMainTab('identifiers')">🔗 Package IDs</button>
                </div>
            </div>

            <!-- Images panel -->
            <div id="images-main-panel" class="main-tab-panel active">
                <div class="tabs">
                    <div class="tab-buttons">
                        <button class="tab-button active" onclick="switchTab('android', 'images')">Android</button>
                        <button class="tab-button" onclick="switchTab('ios', 'images')">iOS</button>
                        <button class="tab-button" onclick="switchTab('web', 'images')">Web</button>
                        <button class="tab-button" onclick="switchTab('macos', 'images')">macOS</button>
                        <button class="tab-button" onclick="switchTab('linux', 'images')">Linux</button>
                        <button class="tab-button" onclick="switchTab('windows', 'images')">Windows</button>
                    </div>

                    <div class="tab-content">
                        <div class="view-toggle">
                            <button class="view-toggle-button active" onclick="toggleView('table', 'images')">Table View</button>
                            <button class="view-toggle-button" onclick="toggleView('tree', 'images')">Tree View</button>
                        </div>

                        <div id="android-images-panel" class="tab-panel active">
                            <div id="android-images-table-view" class="view-content active">
                                <table id="android-images-table" class="image-table"></table>
                            </div>
                            <div id="android-images-tree-view" class="view-content tree-view"></div>
                        </div>
                        <div id="ios-images-panel" class="tab-panel">
                            <div id="ios-images-table-view" class="view-content active">
                                <table id="ios-images-table" class="image-table"></table>
                            </div>
                            <div id="ios-images-tree-view" class="view-content tree-view"></div>
                        </div>
                        <div id="web-images-panel" class="tab-panel">
                            <div id="web-images-table-view" class="view-content active">
                                <table id="web-images-table" class="image-table"></table>
                            </div>
                            <div id="web-images-tree-view" class="view-content tree-view"></div>
                        </div>
                        <div id="macos-images-panel" class="tab-panel">
                            <div id="macos-images-table-view" class="view-content active">
                                <table id="macos-images-table" class="image-table"></table>
                            </div>
                            <div id="macos-images-tree-view" class="view-content tree-view"></div>
                        </div>
                        <div id="linux-images-panel" class="tab-panel">
                            <div id="linux-images-table-view" class="view-content active">
                                <table id="linux-images-table" class="image-table"></table>
                            </div>
                            <div id="linux-images-tree-view" class="view-content tree-view"></div>
                        </div>
                        <div id="windows-images-panel" class="tab-panel">
                            <div id="windows-images-table-view" class="view-content active">
                                <table id="windows-images-table" class="image-table"></table>
                            </div>
                            <div id="windows-images-tree-view" class="view-content tree-view"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Files panel -->
            <div id="files-main-panel" class="main-tab-panel">
                <div class="tabs">
                    <div class="tab-buttons">
                        <button class="tab-button active" onclick="switchTab('android', 'files')">Android</button>
                        <button class="tab-button" onclick="switchTab('ios', 'files')">iOS</button>
                        <button class="tab-button" onclick="switchTab('web', 'files')">Web</button>
                        <button class="tab-button" onclick="switchTab('macos', 'files')">macOS</button>
                        <button class="tab-button" onclick="switchTab('linux', 'files')">Linux</button>
                        <button class="tab-button" onclick="switchTab('windows', 'files')">Windows</button>
                    </div>

                    <div class="tab-content">
                        <div class="view-toggle">
                            <button class="view-toggle-button active" onclick="toggleView('table', 'files')">Table View</button>
                            <button class="view-toggle-button" onclick="toggleView('tree', 'files')">Tree View</button>
                        </div>

                        <div id="android-files-panel" class="tab-panel active">
                            <div id="android-files-table-view" class="view-content active">
                                <table id="android-files-table" class="image-table"></table>
                            </div>
                            <div id="android-files-tree-view" class="view-content tree-view"></div>
                        </div>
                        <div id="ios-files-panel" class="tab-panel">
                            <div id="ios-files-table-view" class="view-content active">
                                <table id="ios-files-table" class="image-table"></table>
                            </div>
                            <div id="ios-files-tree-view" class="view-content tree-view"></div>
                        </div>
                        <div id="web-files-panel" class="tab-panel">
                            <div id="web-files-table-view" class="view-content active">
                                <table id="web-files-table" class="image-table"></table>
                            </div>
                            <div id="web-files-tree-view" class="view-content tree-view"></div>
                        </div>
                        <div id="macos-files-panel" class="tab-panel">
                            <div id="macos-files-table-view" class="view-content active">
                                <table id="macos-files-table" class="image-table"></table>
                            </div>
                            <div id="macos-files-tree-view" class="view-content tree-view"></div>
                        </div>
                        <div id="linux-files-panel" class="tab-panel">
                            <div id="linux-files-table-view" class="view-content active">
                                <table id="linux-files-table" class="image-table"></table>
                            </div>
                            <div id="linux-files-tree-view" class="view-content tree-view"></div>
                        </div>
                        <div id="windows-files-panel" class="tab-panel">
                            <div id="windows-files-table-view" class="view-content active">
                                <table id="windows-files-table" class="image-table"></table>
                            </div>
                            <div id="windows-files-tree-view" class="view-content tree-view"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Package IDs panel -->
            <div id="identifiers-main-panel" class="main-tab-panel">
                <div class="tabs">
                    <div class="tab-content" style="padding: 1.5rem;">
                        <table id="identifiers-table" class="identifier-table"></table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let scanResults = null;

        async function startScan() {
            const scanBtn = document.getElementById('scanBtn');
            const scanStatus = document.getElementById('scanStatus');

            scanBtn.disabled = true;
            scanStatus.textContent = 'Scanning...';

            try {
                const response = await fetch('/api/scan');
                scanResults = await response.json();

                if (scanResults.error) {
                    throw new Error(scanResults.error);
                }

                displayResults();
                scanStatus.textContent = 'Scan completed';

            } catch (error) {
                scanStatus.innerHTML = '<span class="error">Error: ' + error.message + '</span>';
            } finally {
                scanBtn.disabled = false;
            }
        }

        function displayResults() {
            displayStats();
            displayImageTables();
            displayFileTables();
            displayImageTrees();
            displayFileTrees();
            displayIdentifiers();
            document.getElementById('statsSection').style.display = 'block';
            document.getElementById('resultsSection').style.display = 'block';
        }

        function displayStats() {
            const stats = scanResults.statistics;
            const statsGrid = document.getElementById('statsGrid');

            const statItems = [
                { label: 'Total Images', value: stats.total_images },
                { label: 'Total Files', value: stats.total_files },
                { label: 'Images Size', value: stats.total_images_size_text || stats.total_size_text },
                { label: 'Total Size', value: stats.total_size_text },
                { label: 'Package IDs', value: stats.total_identifiers },
                { label: 'Icons', value: stats.images_by_type.icon || 0 },
                { label: 'Code Files', value: stats.files_by_type.code || 0 },
                { label: 'Config Files', value: stats.files_by_type.config || 0 }
            ];

            statsGrid.innerHTML = statItems.map(item => `
                <div class="stat-card">
                    <div class="stat-number">${item.value}</div>
                    <div class="stat-label">${item.label}</div>
                </div>
            `).join('');
        }

        function displayImageTables() {
            const platforms = ['android', 'ios', 'web', 'macos', 'linux', 'windows'];

            platforms.forEach(platform => {
                const table = document.getElementById(platform + '-images-table');
                const images = scanResults.platform_images[platform] || [];

                if (images.length === 0) {
                    table.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #64748b;">No images found for this platform</td></tr>';
                    return;
                }

                table.innerHTML = `
                    <thead>
                        <tr>
                            <th>Preview</th>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Format</th>
                            <th>Dimensions</th>
                            <th>File Size</th>
                            <th>Path</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${images.map(img => `
                            <tr>
                                <td>
                                    ${img.base64_preview ?
                                        `<img class="image-preview" src="data:image/jpeg;base64,${img.base64_preview}" alt="Preview" onclick="showImagePopup('data:image/jpeg;base64,${img.base64_preview}', {name: '${img.name}', width: ${img.width}, height: ${img.height}, size_text: '${img.size_text}'})">` :
                                        '<div class="image-preview" style="background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; color: #64748b;">N/A</div>'
                                    }
                                </td>
                                <td><strong>${img.name}</strong></td>
                                <td><span class="image-type type-${img.type_classification}">${img.type_classification}</span></td>
                                <td>${img.format}</td>
                                <td>${img.width} × ${img.height}</td>
                                <td>${img.size_text}</td>
                                <td><div class="path-display" title="${img.path}">${img.relative_path}</div></td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="action-btn" onclick="downloadImage('${img.path}')">Download</button>
                                        <button class="action-btn" onclick="openDirectory('${img.directory_path}')">Open Dir</button>
                                        <button class="action-btn" onclick="copyDir('${img.directory_path}')">Copy Dir</button>
                                        <button class="action-btn" onclick="copyPath('${img.path}')">Copy Path</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                `;
            });
        }

        function displayIdentifiers() {
            const table = document.getElementById('identifiers-table');
            const identifiers = scanResults.package_identifiers || [];

            if (identifiers.length === 0) {
                table.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #64748b;">No package identifiers found</td></tr>';
                return;
            }

            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Package Identifier</th>
                        <th>Platform</th>
                        <th>File Path</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${identifiers.map(id => `
                        <tr>
                            <td><code class="identifier-code">${id.identifier}</code></td>
                            <td>${id.platform}</td>
                            <td><div class="path-display" title="${id.file_path}">${id.relative_path}</div></td>
                            <td>
                                <div class="action-buttons">
                                    <button class="action-btn" onclick="openDirectory('${id.file_path}')">Open Dir</button>
                                    <button class="action-btn" onclick="copyPath('${id.file_path}')">Copy Path</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
        }

        function switchTab(tabName) {
            // Hide all panels
            const panels = document.querySelectorAll('.tab-panel');
            panels.forEach(panel => panel.classList.remove('active'));

            // Hide all buttons
            const buttons = document.querySelectorAll('.tab-button');
            buttons.forEach(button => button.classList.remove('active'));

            // Show selected panel and button
            document.getElementById(tabName + '-panel').classList.add('active');
            event.target.classList.add('active');
        }

        async function downloadImage(imagePath) {
            try {
                const response = await fetch(`/api/download-image?path=${encodeURIComponent(imagePath)}`);
                const blob = await response.blob();

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = imagePath.split('/').pop();
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

            } catch (error) {
                alert('Download failed: ' + error.message);
            }
        }

        async function openDirectory(filePath) {
            try {
                await fetch(`/api/open-directory?path=${encodeURIComponent(filePath)}`);
            } catch (error) {
                alert('Failed to open directory: ' + error.message);
            }
        }

        async function copyPath(filePath) {
            try {
                const response = await fetch(`/api/copy-path?path=${encodeURIComponent(filePath)}`);
                const result = await response.json();

                await navigator.clipboard.writeText(result.windows_path);

                // Show temporary feedback
                const button = event.target;
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.style.background = '#10b981';

                setTimeout(() => {
                    button.textContent = originalText;
                    button.style.background = '';
                }, 1000);

            } catch (error) {
                alert('Failed to copy path: ' + error.message);
            }
        }

        // Auto-start scan when page loads
        window.addEventListener('load', () => {
            setTimeout(startScan, 500);
        });

        // Image popup functionality
        function showImagePopup(imageSrc, imageInfo) {
            const popup = document.getElementById('imagePopup');
            const popupImg = document.getElementById('popupImage');
            const popupInfo = document.getElementById('popupInfo');

            popupImg.src = imageSrc;
            popupInfo.textContent = `${imageInfo.name} - ${imageInfo.width} × ${imageInfo.height} - ${imageInfo.size_text}`;
            popup.style.display = 'block';
        }

        function closeImagePopup() {
            document.getElementById('imagePopup').style.display = 'none';
        }

        // Frontend copy functionality
        function copyToClipboard(text, type) {
            navigator.clipboard.writeText(text).then(() => {
                // Show temporary feedback
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = type === 'path' ? 'Path Copied!' : 'Dir Copied!';
                btn.style.background = '#10b981';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);

                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = type === 'path' ? 'Path Copied!' : 'Dir Copied!';
                btn.style.background = '#10b981';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                }, 2000);
            });
        }

        function copyPath(path) {
            copyToClipboard(path, 'path');
        }

        function copyDir(dirPath) {
            copyToClipboard(dirPath, 'dir');
        }

        // Enhanced tree view and file table functions
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
                                        <button class="action-btn" onclick="copyDir('${file.directory_path}')">Copy Dir</button>
                                        <button class="action-btn" onclick="copyPath('${file.path}')">Copy Path</button>
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
                                    <button class="action-btn" onclick="copyDir('${file.directory_path || file.path}')">📂</button>
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

        // Close popup when clicking outside
        document.addEventListener('click', function(e) {
            const popup = document.getElementById('imagePopup');
            if (e.target === popup) {
                closeImagePopup();
            }
        });
    </script>

    <!-- Image popup dialog -->
    <div id="imagePopup" class="image-popup" onclick="closeImagePopup()">
        <div class="image-popup-content" onclick="event.stopPropagation()">
            <button class="image-popup-close" onclick="closeImagePopup()">×</button>
            <img id="popupImage" src="" alt="Full size image">
            <div id="popupInfo" class="image-popup-info"></div>
        </div>
    </div>
</body>
</html>
        """

    def start_server(self):
        """Start the web server"""
        def run_server():
            print(f"[SOURCE-VIEWER] Starting Source Viewer Server on port {self.port}")
            self.app.run(host='0.0.0.0', port=self.port, debug=False)

        # Start server in a separate thread
        server_thread = threading.Thread(target=run_server)
        server_thread.daemon = True
        server_thread.start()

        # Open browser
        browser_thread = threading.Thread(target=self._open_browser)
        browser_thread.daemon = True
        browser_thread.start()

        print(f"[SOURCE-VIEWER] Server started at http://localhost:{self.port}")
        print(f"[SOURCE-VIEWER] Press Ctrl+C to stop the server")

        return server_thread

    def _open_browser(self):
        """Open browser to the web interface"""
        import time
        time.sleep(1)  # Wait a bit for server to start
        webbrowser.open(f'http://localhost:{self.port}')

    def run_standalone(self):
        """Run server in standalone mode (blocking)"""
        try:
            server_thread = self.start_server()
            # Keep main thread alive
            server_thread.join()
        except KeyboardInterrupt:
            print("\n[SOURCE-VIEWER] Server stopped by user")