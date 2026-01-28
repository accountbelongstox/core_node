#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Server with Web Interface
Supports directory browsing and file downloading with resume capability
"""

import os
import sys
import socket
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from pathlib import Path
import platform
import cgi
import json
import shutil
import threading


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    """Threading HTTP Server to support concurrent requests"""
    daemon_threads = True
    allow_reuse_address = True
    
    def server_bind(self):
        """Override to set socket options for better performance"""
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        # Increase buffer sizes for better performance
        try:
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 65536)
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 65536)
        except:
            pass
        HTTPServer.server_bind(self)


class FileServerHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler for file server"""
    
    def __init__(self, base_path, *args, **kwargs):
        self.base_path = Path(base_path).resolve()
        super().__init__(*args, **kwargs)
    
    def log_message(self, format, *args):
        """Override to customize logging (thread-safe)"""
        thread_id = threading.current_thread().ident
        message = "%s [Thread-%d] - - [%s] %s\n" % (
            self.address_string(),
            thread_id,
            self.log_date_time_string(),
            format % args
        )
        sys.stderr.write(message)
        sys.stderr.flush()
    
    def do_GET(self):
        """Handle GET requests"""
        try:
            # Parse URL
            parsed_path = urllib.parse.urlparse(self.path)
            path = urllib.parse.unquote(parsed_path.path)
            
            # Remove leading slash
            if path.startswith('/'):
                path = path[1:]
            
            # Build full path
            if path:
                full_path = self.base_path / path
            else:
                full_path = self.base_path
            
            # Security: ensure path is within base_path
            try:
                full_path = full_path.resolve()
                if not str(full_path).startswith(str(self.base_path)):
                    self.send_error(403, "Access Denied")
                    return
            except (OSError, ValueError):
                self.send_error(404, "Not Found")
                return
            
            # Check if path exists
            if not full_path.exists():
                self.send_error(404, "Not Found")
                return
            
            # Handle special API endpoints
            if path == '__check_file_exists__':
                self._handle_check_file_exists()
                return
            
            # Handle directory
            if full_path.is_dir():
                self._serve_directory(full_path, path)
            # Handle file
            elif full_path.is_file():
                self._serve_file(full_path)
            else:
                self.send_error(404, "Not Found")
                
        except Exception as e:
            self.send_error(500, f"Internal Server Error: {str(e)}")
    
    def do_POST(self):
        """Handle POST requests for file upload"""
        try:
            # Parse URL to get target directory
            parsed_path = urllib.parse.urlparse(self.path)
            path = urllib.parse.unquote(parsed_path.path)
            
            # Remove leading slash
            if path.startswith('/'):
                path = path[1:]
            
            # Build target directory path
            if path:
                target_dir = self.base_path / path
            else:
                target_dir = self.base_path
            
            # Security: ensure path is within base_path
            try:
                target_dir = target_dir.resolve()
                if not str(target_dir).startswith(str(self.base_path)):
                    self._send_json_response(403, {"error": "Access Denied"})
                    return
            except (OSError, ValueError):
                self._send_json_response(404, {"error": "Not Found"})
                return
            
            # Check if target is a directory
            if not target_dir.exists() or not target_dir.is_dir():
                self._send_json_response(400, {"error": "Target is not a directory"})
                return
            
            # Get content type
            content_type = self.headers.get('Content-Type', '')
            
            # Handle multipart/form-data (file upload)
            if 'multipart/form-data' in content_type:
                result = self._handle_file_upload(target_dir, content_type)
                self._send_json_response(result['status'], result)
            else:
                self._send_json_response(400, {"error": "Unsupported content type"})
                
        except Exception as e:
            self._send_json_response(500, {"error": f"Internal Server Error: {str(e)}"})
    
    def _handle_file_upload(self, target_dir, content_type):
        """Handle file upload with directory support"""
        try:
            # Parse boundary
            boundary = None
            for part in content_type.split(';'):
                part = part.strip()
                if part.startswith('boundary='):
                    boundary = part[9:]
                    break
            
            if not boundary:
                return {"status": 400, "error": "No boundary found"}
            
            # Read content length
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                return {"status": 400, "error": "Empty request"}
            
            # Read request body
            data = self.rfile.read(content_length)
            
            # Parse multipart data
            boundary_bytes = ('--' + boundary).encode('utf-8')
            parts = data.split(boundary_bytes)
            
            uploaded_files = []
            skipped_files = []
            errors = []
            
            # First pass: collect overwrite flags
            overwrite_map = {}  # Map filename to overwrite flag
            file_parts = []  # Store file parts for second pass
            
            for part in parts[1:-1]:  # Skip first empty part and last boundary
                if not part.strip():
                    continue
                
                # Split headers and body
                header_end = part.find(b'\r\n\r\n')
                if header_end == -1:
                    continue
                
                headers_raw = part[:header_end]
                body = part[header_end + 4:]
                
                # Remove trailing \r\n
                if body.endswith(b'\r\n'):
                    body = body[:-2]
                
                # Parse headers
                headers = {}
                for line in headers_raw.split(b'\r\n'):
                    if b':' in line:
                        key, value = line.split(b':', 1)
                        headers[key.strip().lower()] = value.strip()
                
                # Get Content-Disposition
                content_disposition = headers.get(b'content-disposition', b'').decode('utf-8', errors='ignore')
                
                # Check if this is an overwrite flag field
                if 'name=' in content_disposition and 'filename=' not in content_disposition:
                    name_start = content_disposition.find('name=')
                    if name_start != -1:
                        name_part = content_disposition[name_start + 5:]
                        if name_part.startswith('"'):
                            name_end = name_part.find('"', 1)
                            if name_end != -1:
                                field_name = name_part[1:name_end]
                            else:
                                field_name = name_part.split()[0]
                        else:
                            field_name = name_part.split()[0]
                        
                        # Check for overwrite flags
                        if field_name.startswith('overwrite_'):
                            filename_key = field_name.replace('overwrite_', '')
                            overwrite_map[filename_key] = True
                    continue
                
                # Store file parts for second pass
                if 'filename=' in content_disposition:
                    file_parts.append({
                        'headers': headers,
                        'content_disposition': content_disposition,
                        'body': body
                    })
            
            # Second pass: process files
            for file_part in file_parts:
                content_disposition = file_part['content_disposition']
                body = file_part['body']
                
                # Extract filename and directory path
                filename = None
                relative_path = None
                
                if 'filename=' in content_disposition:
                    # Extract filename
                    filename_start = content_disposition.find('filename=')
                    if filename_start != -1:
                        filename_part = content_disposition[filename_start + 9:]
                        if filename_part.startswith('"'):
                            filename_end = filename_part.find('"', 1)
                            if filename_end != -1:
                                filename = filename_part[1:filename_end]
                        else:
                            filename = filename_part.split()[0]
                
                # Check for webkitdirectory path (directory upload)
                if 'webkitrelativepath=' in content_disposition:
                    path_start = content_disposition.find('webkitrelativepath=')
                    if path_start != -1:
                        path_part = content_disposition[path_start + 18:]
                        if path_part.startswith('"'):
                            path_end = path_part.find('"', 1)
                            if path_end != -1:
                                relative_path = path_part[1:path_end]
                        else:
                            relative_path = path_part.split()[0]
                
                if not filename:
                    continue
                
                # Build target path
                if relative_path:
                    # Directory upload - preserve directory structure
                    # relative_path might be like "folder/subfolder/file.txt"
                    target_path = target_dir / relative_path
                    # Security: ensure path is within target_dir
                    try:
                        target_path = target_path.resolve()
                        if not str(target_path).startswith(str(target_dir.resolve())):
                            errors.append(f"Security: {relative_path} outside target directory")
                            continue
                    except:
                        errors.append(f"Invalid path: {relative_path}")
                        continue
                else:
                    # Single file upload
                    target_path = target_dir / filename
                
                # Check if file exists
                file_exists = target_path.exists() and target_path.is_file()
                
                # Check for overwrite flag
                file_key = relative_path if relative_path else filename
                overwrite = overwrite_map.get(file_key, False)
                
                # Skip if file exists and not overwriting
                if file_exists and not overwrite:
                    skipped_files.append({"file": filename, "path": str(target_path.relative_to(self.base_path)), "reason": "File exists"})
                    continue
                
                # Create parent directories if needed
                try:
                    target_path.parent.mkdir(parents=True, exist_ok=True)
                except Exception as e:
                    errors.append(f"Cannot create directory for {filename}: {str(e)}")
                    continue
                
                # Write file (streaming write)
                try:
                    with open(target_path, 'wb') as f:
                        # Write in chunks to avoid loading entire file into memory
                        chunk_size = 65536  # 64KB chunks for better performance
                        remaining = len(body)
                        offset = 0
                        while remaining > 0:
                            chunk = body[offset:offset + min(chunk_size, remaining)]
                            if not chunk:
                                break
                            f.write(chunk)
                            f.flush()  # Ensure data is written immediately
                            offset += len(chunk)
                            remaining -= len(chunk)
                    
                    if file_exists:
                        uploaded_files.append({"file": filename, "path": str(target_path.relative_to(self.base_path)), "action": "overwritten"})
                    else:
                        uploaded_files.append({"file": filename, "path": str(target_path.relative_to(self.base_path)), "action": "created"})
                except Exception as e:
                    errors.append(f"Error writing {filename}: {str(e)}")
            
            result = {
                "status": 200,
                "uploaded": uploaded_files,
                "skipped": skipped_files,
                "errors": errors
            }
            
            return result
            
        except Exception as e:
            return {"status": 500, "error": f"Upload error: {str(e)}"}
    
    def _handle_check_file_exists(self):
        """Handle file existence check API"""
        try:
            query_params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            file_path = query_params.get('path', [None])[0]
            
            if not file_path:
                self._send_json_response(400, {"error": "Missing path parameter"})
                return
            
            # Decode path
            file_path = urllib.parse.unquote(file_path)
            
            # Build full path
            if file_path.startswith('/'):
                file_path = file_path[1:]
            
            full_path = self.base_path / file_path
            
            # Security check
            try:
                full_path = full_path.resolve()
                if not str(full_path).startswith(str(self.base_path)):
                    self._send_json_response(403, {"error": "Access Denied"})
                    return
            except:
                self._send_json_response(400, {"error": "Invalid path"})
                return
            
            exists = full_path.exists() and full_path.is_file()
            self._send_json_response(200, {"exists": exists, "path": file_path})
            
        except Exception as e:
            self._send_json_response(500, {"error": str(e)})
    
    def _send_json_response(self, status_code, data):
        """Send JSON response"""
        json_data = json.dumps(data, ensure_ascii=False)
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(json_data.encode('utf-8'))))
        self.end_headers()
        self.wfile.write(json_data.encode('utf-8'))
    
    def _serve_directory(self, dir_path, relative_path):
        """Serve directory listing page"""
        try:
            # Get parent directory
            if relative_path:
                parent_path = '/'.join(relative_path.split('/')[:-1])
                if parent_path:
                    parent_link = f'<a href="/{parent_path}">.. (Parent Directory)</a>'
                else:
                    parent_link = '<a href="/">.. (Parent Directory)</a>'
            else:
                parent_link = ''
            
            # Build HTML
            html = ['<!DOCTYPE html>']
            html.append('<html><head>')
            html.append('<meta charset="utf-8">')
            html.append('<title>File Server - ' + self._escape_html(str(dir_path)) + '</title>')
            html.append('<style>')
            html.append('body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }')
            html.append('.container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }')
            html.append('h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }')
            html.append('.path { color: #666; margin: 10px 0; font-size: 14px; }')
            html.append('table { width: 100%; border-collapse: collapse; margin-top: 20px; }')
            html.append('th { background: #4CAF50; color: white; padding: 12px; text-align: left; }')
            html.append('td { padding: 10px; border-bottom: 1px solid #ddd; }')
            html.append('tr:hover { background: #f9f9f9; }')
            html.append('a { color: #2196F3; text-decoration: none; }')
            html.append('a:hover { text-decoration: underline; }')
            html.append('.folder { font-weight: bold; }')
            html.append('.file { }')
            html.append('.size { text-align: right; color: #666; }')
            html.append('.upload-area { border: 2px dashed #4CAF50; border-radius: 8px; padding: 40px; text-align: center; margin: 20px 0; background: #f9f9f9; cursor: pointer; transition: all 0.3s; }')
            html.append('.upload-area:hover { background: #f0f0f0; border-color: #45a049; }')
            html.append('.upload-area.dragover { background: #e8f5e9; border-color: #4CAF50; }')
            html.append('.upload-button { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin: 10px; }')
            html.append('.upload-button:hover { background: #45a049; }')
            html.append('.upload-status { margin: 10px 0; padding: 10px; border-radius: 4px; display: none; }')
            html.append('.upload-status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }')
            html.append('.upload-status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }')
            html.append('#fileInput { display: none; }')
            html.append('#dirInput { display: none; }')
            html.append('.batch-controls { margin: 15px 0; padding: 10px; background: #f0f0f0; border-radius: 4px; }')
            html.append('.batch-controls button { margin: 0 5px; padding: 8px 15px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; }')
            html.append('.batch-controls button:hover { background: #1976D2; }')
            html.append('.batch-controls button:disabled { background: #ccc; cursor: not-allowed; }')
            html.append('input[type="checkbox"] { margin-right: 8px; cursor: pointer; }')
            html.append('</style>')
            html.append('</head><body>')
            html.append('<div class="container">')
            html.append('<h1>📁 File Server</h1>')
            html.append(f'<div class="path">Path: {self._escape_html(str(dir_path))}</div>')
            
            # Upload area
            html.append('<div class="upload-area" id="uploadArea" onclick="document.getElementById(\'fileInput\').click()">')
            html.append('<p style="font-size: 18px; margin: 10px 0;">📤 Drag and drop files or folders here</p>')
            html.append('<p style="color: #666; margin: 10px 0;">or click to select files</p>')
            html.append('<div>')
            html.append('<button class="upload-button" onclick="event.stopPropagation(); document.getElementById(\'fileInput\').click();">Select Files</button>')
            html.append('<button class="upload-button" onclick="event.stopPropagation(); document.getElementById(\'dirInput\').click();">Select Folder</button>')
            html.append('</div>')
            html.append('</div>')
            html.append('<div class="upload-status" id="uploadStatus"></div>')
            html.append('<input type="file" id="fileInput" multiple>')
            html.append('<input type="file" id="dirInput" webkitdirectory multiple>')
            
            # Batch download controls
            html.append('<div class="batch-controls" id="batchControls" style="display: none;">')
            html.append('<button onclick="selectAllFiles()">Select All Files</button>')
            html.append('<button onclick="deselectAllFiles()">Deselect All</button>')
            html.append('<button onclick="downloadSelected()" id="downloadBtn">Download Selected (<span id="selectedCount">0</span>)</button>')
            html.append('</div>')
            
            # Upload JavaScript
            html.append('<script>')
            html.append('const uploadArea = document.getElementById("uploadArea");')
            html.append('const fileInput = document.getElementById("fileInput");')
            html.append('const dirInput = document.getElementById("dirInput");')
            html.append('const uploadStatus = document.getElementById("uploadStatus");')
            html.append('const currentPath = "' + (relative_path if relative_path else "") + '";')
            
            html.append('function showStatus(message, isError) {')
            html.append('  uploadStatus.textContent = message;')
            html.append('  uploadStatus.className = "upload-status " + (isError ? "error" : "success");')
            html.append('  uploadStatus.style.display = "block";')
            html.append('  setTimeout(() => { uploadStatus.style.display = "none"; }, 5000);')
            html.append('}')
            
            html.append('async function checkFileExists(filePath) {')
            html.append('  try {')
            html.append('    const response = await fetch("__check_file_exists__?path=" + encodeURIComponent(filePath));')
            html.append('    const data = await response.json();')
            html.append('    return data.exists === true;')
            html.append('  } catch (e) {')
            html.append('    return false;')
            html.append('  }')
            html.append('}')
            
            html.append('async function uploadFiles(files, isDirectory) {')
            html.append('  if (files.length === 0) return;')
            html.append('  const targetPath = currentPath || "";')
            html.append('  const filesToUpload = [];')
            html.append('  const filesToSkip = [];')
            html.append('  showStatus("Checking files...", false);')
            html.append('  for (let i = 0; i < files.length; i++) {')
            html.append('    const file = files[i];')
            html.append('    let filePath = file.webkitRelativePath || file.name;')
            html.append('    if (targetPath) {')
            html.append('      filePath = targetPath + "/" + filePath;')
            html.append('    }')
            html.append('    const exists = await checkFileExists(filePath);')
            html.append('    if (exists) {')
            html.append('      const overwrite = confirm("File \\"" + file.name + "\\" already exists. Do you want to replace it?");')
            html.append('      if (overwrite) {')
            html.append('        filesToUpload.push({file: file, overwrite: true});')
            html.append('      } else {')
            html.append('        filesToSkip.push(file.name);')
            html.append('      }')
            html.append('    } else {')
            html.append('      filesToUpload.push({file: file, overwrite: false});')
            html.append('    }')
            html.append('  }')
            html.append('  if (filesToSkip.length > 0) {')
            html.append('    showStatus("Skipped " + filesToSkip.length + " file(s) (user cancelled).", false);')
            html.append('  }')
            html.append('  if (filesToUpload.length === 0) {')
            html.append('    return;')
            html.append('  }')
            html.append('  const formData = new FormData();')
            html.append('  for (let i = 0; i < filesToUpload.length; i++) {')
            html.append('    const item = filesToUpload[i];')
            html.append('    const file = item.file;')
            html.append('    formData.append("files", file);')
            html.append('    if (item.overwrite) {')
            html.append('      const fileKey = file.webkitRelativePath || file.name;')
            html.append('      formData.append("overwrite_" + fileKey, "1");')
            html.append('    }')
            html.append('  }')
            html.append('  showStatus("Uploading " + filesToUpload.length + " file(s)...", false);')
            html.append('  fetch(window.location.pathname, {')
            html.append('    method: "POST",')
            html.append('    body: formData')
            html.append('  })')
            html.append('  .then(response => response.json())')
            html.append('  .then(data => {')
            html.append('    if (data.error) {')
            html.append('      showStatus("Error: " + data.error, true);')
            html.append('    } else {')
            html.append('      let message = "Upload complete! ";')
            html.append('      if (data.uploaded && data.uploaded.length > 0) {')
            html.append('        message += "Uploaded: " + data.uploaded.length + " file(s). ";')
            html.append('      }')
            html.append('      if (data.skipped && data.skipped.length > 0) {')
            html.append('        message += "Skipped: " + data.skipped.length + " file(s). ";')
            html.append('      }')
            html.append('      if (data.errors && data.errors.length > 0) {')
            html.append('        message += "Errors: " + data.errors.length + ". ";')
            html.append('      }')
            html.append('      showStatus(message, false);')
            html.append('      setTimeout(() => { window.location.reload(); }, 1000);')
            html.append('    }')
            html.append('  })')
            html.append('  .catch(error => {')
            html.append('    showStatus("Upload failed: " + error.message, true);')
            html.append('  });')
            html.append('}')
            
            html.append('uploadArea.addEventListener("dragover", (e) => {')
            html.append('  e.preventDefault();')
            html.append('  uploadArea.classList.add("dragover");')
            html.append('});')
            
            html.append('uploadArea.addEventListener("dragleave", () => {')
            html.append('  uploadArea.classList.remove("dragover");')
            html.append('});')
            
            html.append('uploadArea.addEventListener("drop", (e) => {')
            html.append('  e.preventDefault();')
            html.append('  uploadArea.classList.remove("dragover");')
            html.append('  const files = Array.from(e.dataTransfer.files);')
            html.append('  if (files.length > 0) {')
            html.append('    uploadFiles(files, false);')
            html.append('  }')
            html.append('  const items = Array.from(e.dataTransfer.items);')
            html.append('  if (items.length > 0 && items[0].webkitGetAsEntry) {')
            html.append('    const entries = items.map(item => item.webkitGetAsEntry()).filter(entry => entry);')
            html.append('    if (entries.length > 0) {')
            html.append('      const fileList = [];')
            html.append('      function processEntry(entry, path = "") {')
            html.append('        return new Promise((resolve) => {')
            html.append('          if (entry.isFile) {')
            html.append('            entry.file(file => {')
            html.append('              Object.defineProperty(file, "webkitRelativePath", {')
            html.append('                writable: true,')
            html.append('                value: path + file.name')
            html.append('              });')
            html.append('              fileList.push(file);')
            html.append('              resolve();')
            html.append('            });')
            html.append('          } else if (entry.isDirectory) {')
            html.append('            const dirReader = entry.createReader();')
            html.append('            const promises = [];')
            html.append('            function readDir() {')
            html.append('              dirReader.readEntries(entries => {')
            html.append('                if (entries.length === 0) {')
            html.append('                  Promise.all(promises).then(() => resolve());')
            html.append('                } else {')
            html.append('                  entries.forEach(entry => {')
            html.append('                    promises.push(processEntry(entry, path + entry.name + "/"));')
            html.append('                  });')
            html.append('                  readDir();')
            html.append('                }')
            html.append('              });')
            html.append('            }')
            html.append('            readDir();')
            html.append('          } else {')
            html.append('            resolve();')
            html.append('          }')
            html.append('        });')
            html.append('      }')
            html.append('      Promise.all(entries.map(entry => processEntry(entry))).then(() => {')
            html.append('        if (fileList.length > 0) {')
            html.append('          uploadFiles(fileList, true);')
            html.append('        }')
            html.append('      });')
            html.append('    }')
            html.append('  }')
            html.append('});')
            
            html.append('fileInput.addEventListener("change", (e) => {')
            html.append('  if (e.target.files.length > 0) {')
            html.append('    uploadFiles(Array.from(e.target.files), false);')
            html.append('  }')
            html.append('});')
            
            html.append('dirInput.addEventListener("change", (e) => {')
            html.append('  if (e.target.files.length > 0) {')
            html.append('    uploadFiles(Array.from(e.target.files), true);')
            html.append('  }')
            html.append('});')
            
            # Batch download functions
            html.append('function toggleSelectAll(checkbox) {')
            html.append('  const fileCheckboxes = document.querySelectorAll(".file-checkbox");')
            html.append('  fileCheckboxes.forEach(cb => cb.checked = checkbox.checked);')
            html.append('  updateSelectedCount();')
            html.append('}')
            
            html.append('function selectAllFiles() {')
            html.append('  const fileCheckboxes = document.querySelectorAll(".file-checkbox");')
            html.append('  fileCheckboxes.forEach(cb => cb.checked = true);')
            html.append('  document.getElementById("selectAll").checked = true;')
            html.append('  updateSelectedCount();')
            html.append('}')
            
            html.append('function deselectAllFiles() {')
            html.append('  const fileCheckboxes = document.querySelectorAll(".file-checkbox");')
            html.append('  fileCheckboxes.forEach(cb => cb.checked = false);')
            html.append('  document.getElementById("selectAll").checked = false;')
            html.append('  updateSelectedCount();')
            html.append('}')
            
            html.append('function updateSelectedCount() {')
            html.append('  const selected = document.querySelectorAll(".file-checkbox:checked");')
            html.append('  const count = selected.length;')
            html.append('  document.getElementById("selectedCount").textContent = count;')
            html.append('  document.getElementById("downloadBtn").disabled = count === 0;')
            html.append('  const allCheckboxes = document.querySelectorAll(".file-checkbox");')
            html.append('  document.getElementById("selectAll").checked = allCheckboxes.length > 0 && selected.length === allCheckboxes.length;')
            html.append('}')
            
            html.append('function downloadSelected() {')
            html.append('  const selected = document.querySelectorAll(".file-checkbox:checked");')
            html.append('  if (selected.length === 0) return;')
            html.append('  selected.forEach(checkbox => {')
            html.append('    const path = checkbox.getAttribute("data-path");')
            html.append('    if (path) {')
            html.append('      const link = document.createElement("a");')
            html.append('      link.href = path;')
            html.append('      link.download = "";')
            html.append('      link.target = "_blank";')
            html.append('      document.body.appendChild(link);')
            html.append('      link.click();')
            html.append('      document.body.removeChild(link);')
            html.append('    }')
            html.append('  });')
            html.append('  showStatus("Started downloading " + selected.length + " file(s)...", false);')
            html.append('}')
            
            html.append('// Initialize selected count on page load')
            html.append('updateSelectedCount();')
            html.append('</script>')
            
            # List items
            items = []
            try:
                for item in sorted(dir_path.iterdir()):
                    items.append(item)
            except PermissionError:
                html.append('<p style="color: red;">Permission Denied</p>')
                html.append('</div></body></html>')
                self._send_response(200, 'text/html; charset=utf-8', ''.join(html))
                return
            
            if items or parent_link:
                html.append('<table>')
                html.append('<thead><tr><th style="width: 30px;"><input type="checkbox" id="selectAll" onchange="toggleSelectAll(this)"></th><th>Name</th><th>Type</th><th>Size</th></tr></thead>')
                html.append('<tbody>')
                
                # Parent directory link
                if parent_link:
                    html.append(f'<tr><td colspan="4">{parent_link}</td></tr>')
                
                # Directory items
                file_count = 0
                for item in items:
                    try:
                        name = item.name
                        if item.is_dir():
                            item_path = relative_path + '/' + name if relative_path else name
                            link = f'<a href="/{item_path}" class="folder">📁 {self._escape_html(name)}</a>'
                            item_type = 'Directory'
                            size = '-'
                            size_class = 'size'
                            checkbox = ''
                        else:
                            file_count += 1
                            item_path = relative_path + '/' + name if relative_path else name
                            link = f'<a href="/{item_path}" class="file">📄 {self._escape_html(name)}</a>'
                            checkbox = f'<input type="checkbox" class="file-checkbox" data-path="/{item_path}" onchange="updateSelectedCount()">'
                            item_type = 'File'
                            try:
                                size = self._format_size(item.stat().st_size)
                            except:
                                size = 'Unknown'
                            size_class = 'size'
                        
                        html.append(f'<tr><td>{checkbox}</td><td>{link}</td><td>{item_type}</td><td class="{size_class}">{size}</td></tr>')
                    except Exception as e:
                        html.append(f'<tr><td colspan="4" style="color: red;">Error: {self._escape_html(str(e))}</td></tr>')
                
                html.append('</tbody></table>')
                
                # Show batch controls if there are files
                if file_count > 0:
                    html.append('<script>')
                    html.append('document.getElementById("batchControls").style.display = "block";')
                    html.append('</script>')
            else:
                html.append('<p>Directory is empty</p>')
            
            html.append('</div></body></html>')
            
            self._send_response(200, 'text/html; charset=utf-8', ''.join(html))
            
        except Exception as e:
            self.send_error(500, f"Error serving directory: {str(e)}")
    
    def _serve_file(self, file_path):
        """Serve file with support for Range requests (resume)"""
        try:
            file_size = file_path.stat().st_size
            
            # Check for Range header
            range_header = self.headers.get('Range')
            
            if range_header:
                # Parse range header
                byte_start = 0
                byte_end = file_size - 1
                
                # Range header format: bytes=start-end
                if range_header.startswith('bytes='):
                    ranges = range_header[6:].split(',')
                    if ranges:
                        range_spec = ranges[0]
                        if '-' in range_spec:
                            parts = range_spec.split('-')
                            if parts[0]:
                                byte_start = int(parts[0])
                            if parts[1]:
                                byte_end = int(parts[1])
                
                # Validate range
                if byte_start < 0:
                    byte_start = 0
                if byte_end >= file_size:
                    byte_end = file_size - 1
                if byte_start > byte_end:
                    self.send_error(416, "Range Not Satisfiable")
                    return
                
                content_length = byte_end - byte_start + 1
                
                # Send 206 Partial Content
                self.send_response(206)
                self.send_header('Content-Type', self._get_content_type(file_path))
                self.send_header('Content-Length', str(content_length))
                self.send_header('Content-Range', 
                               f'bytes {byte_start}-{byte_end}/{file_size}')
                self.send_header('Accept-Ranges', 'bytes')
                self.send_header('Content-Disposition', 
                               f'attachment; filename="{file_path.name}"')
                self.end_headers()
                
                # Stream file chunk
                with open(file_path, 'rb') as f:
                    f.seek(byte_start)
                    remaining = content_length
                    chunk_size = 65536  # 64KB chunks for better performance
                    
                    while remaining > 0:
                        chunk = f.read(min(chunk_size, remaining))
                        if not chunk:
                            break
                        try:
                            self.wfile.write(chunk)
                            self.wfile.flush()  # Ensure data is sent immediately
                        except (BrokenPipeError, ConnectionResetError):
                            # Client disconnected, stop sending
                            break
                        remaining -= len(chunk)
            else:
                # Send full file
                self.send_response(200)
                self.send_header('Content-Type', self._get_content_type(file_path))
                self.send_header('Content-Length', str(file_size))
                self.send_header('Accept-Ranges', 'bytes')
                self.send_header('Content-Disposition', 
                               f'attachment; filename="{file_path.name}"')
                self.end_headers()
                
                # Stream file
                with open(file_path, 'rb') as f:
                    chunk_size = 65536  # 64KB chunks for better performance
                    while True:
                        chunk = f.read(chunk_size)
                        if not chunk:
                            break
                        try:
                            self.wfile.write(chunk)
                            self.wfile.flush()  # Ensure data is sent immediately
                        except (BrokenPipeError, ConnectionResetError):
                            # Client disconnected, stop sending
                            break
                        
        except FileNotFoundError:
            self.send_error(404, "File Not Found")
        except PermissionError:
            self.send_error(403, "Permission Denied")
        except Exception as e:
            self.send_error(500, f"Error serving file: {str(e)}")
    
    def _send_response(self, status_code, content_type, content):
        """Send HTTP response"""
        self.send_response(status_code)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(content.encode('utf-8'))))
        self.end_headers()
        self.wfile.write(content.encode('utf-8'))
    
    def _get_content_type(self, file_path):
        """Get MIME type for file"""
        suffix = file_path.suffix.lower()
        mime_types = {
            '.html': 'text/html',
            '.htm': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf',
            '.zip': 'application/zip',
            '.txt': 'text/plain',
            '.py': 'text/plain',
            '.sh': 'text/plain',
            '.ps1': 'text/plain',
        }
        return mime_types.get(suffix, 'application/octet-stream')
    
    def _format_size(self, size):
        """Format file size"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size < 1024.0:
                return f"{size:.2f} {unit}"
            size /= 1024.0
        return f"{size:.2f} PB"
    
    def _escape_html(self, text):
        """Escape HTML special characters"""
        return (text.replace('&', '&amp;')
                   .replace('<', '&lt;')
                   .replace('>', '&gt;')
                   .replace('"', '&quot;')
                   .replace("'", '&#39;'))


def get_local_ips():
    """Get all local IP addresses from all network interfaces"""
    ips = []
    
    # Method 1: Get IPs from hostname resolution
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM):
            ip = info[4][0]
            if ip not in ips:
                ips.append(ip)
    except:
        pass
    
    # Method 2: Connect to external address to get primary local IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
            if local_ip not in ips:
                ips.append(local_ip)
        except:
            pass
        finally:
            s.close()
    except:
        pass
    
    # Method 3: Platform-specific network interface enumeration
    system = platform.system()
    
    if system == 'Windows':
        # Windows: Use ipconfig command output
        try:
            import subprocess
            result = subprocess.run(['ipconfig'], capture_output=True, text=True, timeout=5, encoding='utf-8', errors='ignore')
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for i, line in enumerate(lines):
                    line_lower = line.lower().strip()
                    # Look for IPv4 or IPv6 address lines
                    if 'ipv4' in line_lower or 'ipv6' in line_lower:
                        # The IP is usually on the same line after a colon
                        if ':' in line:
                            parts = line.split(':')
                            if len(parts) > 1:
                                ip_candidate = parts[1].strip().split()[0] if parts[1].strip() else None
                                if ip_candidate:
                                    # Validate and add IPv4
                                    try:
                                        socket.inet_aton(ip_candidate)
                                        if ip_candidate not in ips and ip_candidate != '0.0.0.0':
                                            ips.append(ip_candidate)
                                    except:
                                        # Try IPv6
                                        try:
                                            socket.inet_pton(socket.AF_INET6, ip_candidate)
                                            if ip_candidate not in ips:
                                                ips.append(ip_candidate)
                                        except:
                                            pass
                    # Also check for "Address" lines (alternative format)
                    elif 'address' in line_lower and ':' in line:
                        parts = line.split(':')
                        if len(parts) > 1:
                            ip_candidate = parts[1].strip().split()[0] if parts[1].strip() else None
                            if ip_candidate:
                                try:
                                    socket.inet_aton(ip_candidate)
                                    if ip_candidate not in ips and ip_candidate != '0.0.0.0':
                                        ips.append(ip_candidate)
                                except:
                                    try:
                                        socket.inet_pton(socket.AF_INET6, ip_candidate)
                                        if ip_candidate not in ips:
                                            ips.append(ip_candidate)
                                    except:
                                        pass
        except:
            pass
    
    elif system == 'Linux':
        # Linux: Read /proc/net/if_inet6 for IPv6
        try:
            # Read IPv6 addresses from /proc/net/if_inet6
            with open('/proc/net/if_inet6', 'r') as f:
                for line in f:
                    parts = line.split()
                    if len(parts) >= 1:
                        # IPv6 address is in hex format (32 hex chars = 16 bytes)
                        hex_addr = parts[0]
                        if len(hex_addr) == 32:
                            try:
                                # Convert hex string to bytes
                                addr_bytes = bytes.fromhex(hex_addr)
                                # Convert bytes to IPv6 string
                                ipv6 = socket.inet_ntop(socket.AF_INET6, addr_bytes)
                                # Skip link-local addresses (fe80::/10)
                                if ipv6 not in ips and not ipv6.startswith('fe80:'):
                                    ips.append(ipv6)
                            except:
                                pass
        except (FileNotFoundError, PermissionError, OSError):
            pass
        
        # Linux: Try to get IPv4 addresses from /proc/net/route
        try:
            with open('/proc/net/route', 'r') as f:
                interfaces = set()
                for line in f:
                    parts = line.split()
                    if len(parts) > 0 and parts[0] != 'Iface':
                        interface = parts[0]
                        if interface and not interface.startswith('lo'):
                            interfaces.add(interface)
                
                # For each interface, try to get its IP using getaddrinfo
                for interface in interfaces:
                    try:
                        for info in socket.getaddrinfo(interface, None, socket.AF_INET, socket.SOCK_STREAM):
                            ip = info[4][0]
                            if ip not in ips and ip != '0.0.0.0':
                                ips.append(ip)
                    except:
                        pass
        except (FileNotFoundError, PermissionError, OSError):
            pass
    
    # Method 4: Try to get all addresses by binding to all interfaces
    try:
        # Get all addresses from getaddrinfo with None as hostname
        for info in socket.getaddrinfo(None, 0, socket.AF_UNSPEC, socket.SOCK_STREAM, 0, socket.AI_PASSIVE):
            ip = info[4][0]
            if ip not in ips and ip != '0.0.0.0' and ip != '::':
                ips.append(ip)
    except:
        pass
    
    # Always add localhost
    if '127.0.0.1' not in ips:
        ips.append('127.0.0.1')
    if '::1' not in ips:
        ips.append('::1')
    
    # Remove duplicates while preserving order
    seen = set()
    unique_ips = []
    for ip in ips:
        if ip not in seen:
            seen.add(ip)
            unique_ips.append(ip)
    
    return unique_ips


def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Usage: python file_server.py <directory_path>")
        print("Example: python file_server.py /home/user/documents")
        sys.exit(1)
    
    # Get directory path
    dir_path = sys.argv[1]
    
    # Resolve path
    if platform.system() == 'Windows':
        dir_path = os.path.abspath(dir_path)
    else:
        dir_path = os.path.abspath(dir_path)
    
    # Check if path exists
    if not os.path.exists(dir_path):
        print(f"Error: Path does not exist: {dir_path}")
        sys.exit(1)
    
    if not os.path.isdir(dir_path):
        print(f"Error: Path is not a directory: {dir_path}")
        sys.exit(1)
    
    # Port
    port = 16888
    
    # Create server with threading support
    def handler(*args, **kwargs):
        FileServerHandler(dir_path, *args, **kwargs)
    
    server = ThreadingHTTPServer(('', port), handler)
    
    # Get all local IPs
    ips = get_local_ips()
    
    # Print server info
    print("=" * 70)
    print("File Server Started")
    print("=" * 70)
    print(f"Directory: {dir_path}")
    print(f"Port: {port}")
    print(f"Mode: Multi-threaded (concurrent upload/download supported)")
    print(f"\nTotal network interfaces found: {len(ips)}")
    print("\nAccess URLs (copy any URL below):")
    print("-" * 70)
    
    for i, ip in enumerate(ips, 1):
        if ':' in ip and ip != '::1':
            # IPv6 (except localhost)
            url = f"http://[{ip}]:{port}"
        else:
            # IPv4 or IPv6 localhost
            url = f"http://{ip}:{port}"
        print(f"  [{i}] {url}")
    
    print("-" * 70)
    print("\nAll IP addresses found:")
    for i, ip in enumerate(ips, 1):
        print(f"  [{i}] {ip}")
    
    print("-" * 70)
    print("\nPress Ctrl+C to stop the server.")
    print("=" * 70)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\nServer stopped.")
        server.shutdown()


if __name__ == '__main__':
    main()
