#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
XMind Parser Tool
Used to parse XMind files and output in JSON or XML format

Features:
1. Auto-detect and install xmindparser package
2. Parse XMind files (supports XmindZen and XmindPro)
3. Output in JSON or XML format
4. Support command line arguments

Usage:
python xmind_parser.py <xmind_file_path> [--format json|xml] [--output output_file]
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path

# Add project root directory to Python path
current_dir = Path(__file__).parent
project_root = current_dir.parent.parent
sys.path.insert(0, str(project_root))

def install_package(package_name):
    """Auto-install Python package"""
    try:
        import subprocess
        import importlib
        
        # Try to import package
        importlib.import_module(package_name)
        print(f"[OK] {package_name} is already installed")
        return True
    except ImportError:
        print(f"[WARN] {package_name} not installed, auto-installing...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", package_name])
            print(f"[OK] {package_name} installed successfully")
            return True
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] {package_name} installation failed: {e}")
            return False

def test_xmindparser_import():
    """Test xmindparser package import"""
    print("Testing xmindparser package...")
    
    # Try to import xmindparser
    try:
        import xmindparser
        print("[OK] xmindparser imported successfully")
        print(f"  Version info: {getattr(xmindparser, '__version__', 'unknown')}")
        return True
    except ImportError:
        print("[ERROR] xmindparser import failed")
        return False

def parse_xmind_file(file_path, output_format='json', output_file=None, show_topic_id=False, hide_empty_value=True):
    """
    Parse XMind file
    
    Args:
        file_path (str): XMind file path
        output_format (str): Output format ('json' or 'xml')
        output_file (str): Output file path (optional)
        show_topic_id (bool): Whether to show topic ID
        hide_empty_value (bool): Whether to hide empty values
    
    Returns:
        dict: Parsed data
    """
    try:
        from xmindparser import xmind_to_dict, config
        import zipfile
        import tempfile
        import shutil
        
        print(f"Parsing XMind file: {file_path}")
        print(f"File size: {os.path.getsize(file_path)} bytes")
        
        # Debug: Check if file is a valid XMind file
        try:
            with zipfile.ZipFile(file_path, 'r') as zip_file:
                file_list = zip_file.namelist()
                print(f"[DEBUG] XMind file contains {len(file_list)} files:")
                for file_name in file_list[:10]:  # Show first 10 files
                    print(f"  - {file_name}")
                if len(file_list) > 10:
                    print(f"  ... and {len(file_list) - 10} more files")
                
                # Check for required files
                required_files = ['content.xml', 'META-INF/manifest.xml']
                missing_files = [f for f in required_files if f not in file_list]
                if missing_files:
                    print(f"[WARN] Missing required files: {missing_files}")
                else:
                    print("[DEBUG] All required files found")
                    
        except zipfile.BadZipFile:
            print("[ERROR] File is not a valid ZIP archive (XMind files are ZIP archives)")
            return None
        except Exception as e:
            print(f"[WARN] Could not inspect XMind file structure: {e}")
        
        # Configure logging with debug level
        config['logName'] = 'xmind_parser'
        config['logLevel'] = logging.DEBUG
        config['logFormat'] = '%(asctime)s %(levelname)-8s: %(message)s'
        config['showTopicId'] = show_topic_id
        config['hideEmptyValue'] = hide_empty_value
        
        print("[DEBUG] Starting XMind parsing...")
        
        # Parse file
        print("[DEBUG] Calling xmind_to_dict...")
        data = xmind_to_dict(file_path)
        print(f"[DEBUG] Parsing completed, data type: {type(data)}")
        
        if data is None:
            print("[ERROR] xmind_to_dict returned None")
            return None
            
        if output_format.lower() == 'json':
            output_data = json.dumps(data, ensure_ascii=False, indent=2)
        elif output_format.lower() == 'xml':
            try:
                from dicttoxml import dicttoxml
                xml_data = dicttoxml(data, custom_root='xmind_data', attr_type=False)
                output_data = xml_data.decode('utf-8')
            except ImportError:
                print("⚠ dicttoxml package not installed, cannot output XML format")
                print("  Please run: pip install dicttoxml")
                output_format = 'json'
                output_data = json.dumps(data, ensure_ascii=False, indent=2)
        else:
            raise ValueError(f"Unsupported output format: {output_format}")
        
        # Output results
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(output_data)
            print(f"[OK] Parse results saved to: {output_file}")
        else:
            print(f"\n=== XMind Parse Results ({output_format.upper()}) ===")
            print(output_data)
        
        return data
        
    except Exception as e:
        print(f"[ERROR] Failed to parse XMind file: {e}")
        print(f"[DEBUG] Exception type: {type(e).__name__}")
        import traceback
        print(f"[DEBUG] Full traceback:")
        traceback.print_exc()
        return None

def debug_xmind_file(file_path):
    """Debug XMind file structure and content"""
    try:
        import zipfile
        import xml.etree.ElementTree as ET
        
        print(f"[DEBUG] Analyzing XMind file: {file_path}")
        
        with zipfile.ZipFile(file_path, 'r') as zip_file:
            file_list = zip_file.namelist()
            print(f"[DEBUG] Total files in XMind: {len(file_list)}")
            
            # Check for content.xml
            if 'content.xml' in file_list:
                print("[DEBUG] Found content.xml, reading content...")
                try:
                    content_xml = zip_file.read('content.xml').decode('utf-8')
                    print(f"[DEBUG] content.xml size: {len(content_xml)} characters")
                    
                    # Try to parse XML
                    try:
                        root = ET.fromstring(content_xml)
                        print(f"[DEBUG] XML root tag: {root.tag}")
                        print(f"[DEBUG] XML root attributes: {root.attrib}")
                        print(f"[DEBUG] Number of child elements: {len(list(root))}")
                    except ET.ParseError as e:
                        print(f"[ERROR] content.xml is not valid XML: {e}")
                        return False
                        
                except Exception as e:
                    print(f"[ERROR] Failed to read content.xml: {e}")
                    return False
            else:
                print("[ERROR] content.xml not found in XMind file")
                return False
                
            # Check for manifest
            if 'META-INF/manifest.xml' in file_list:
                print("[DEBUG] Found META-INF/manifest.xml")
                try:
                    manifest_xml = zip_file.read('META-INF/manifest.xml').decode('utf-8')
                    print(f"[DEBUG] manifest.xml size: {len(manifest_xml)} characters")
                except Exception as e:
                    print(f"[WARN] Failed to read manifest.xml: {e}")
            else:
                print("[WARN] META-INF/manifest.xml not found")
                
            return True
            
    except zipfile.BadZipFile:
        print("[ERROR] File is not a valid ZIP archive")
        return False
    except Exception as e:
        print(f"[ERROR] Failed to analyze XMind file: {e}")
        return False

def get_xmind_zen_json(file_path):
    """Get raw JSON content of XMindZen file"""
    try:
        from xmindparser import get_xmind_zen_builtin_json
        return get_xmind_zen_builtin_json(file_path)
    except Exception as e:
        print(f"[ERROR] Failed to get XMindZen JSON: {e}")
        return None

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='XMind file parser tool')
    parser.add_argument('file_path', nargs='?', help='XMind file path')
    parser.add_argument('--format', '-f', choices=['json', 'xml'], default='json', 
                       help='Output format (default: json)')
    parser.add_argument('--output', '-o', help='Output file path')
    parser.add_argument('--show-topic-id', action='store_true', 
                       help='Show topic ID')
    parser.add_argument('--show-empty', action='store_true', 
                       help='Show empty values')
    parser.add_argument('--zen-json', action='store_true', 
                       help='Only show XMindZen raw JSON (if applicable)')
    parser.add_argument('--test-only', action='store_true', 
                       help='Only test package import, do not parse file')
    parser.add_argument('--debug', action='store_true', 
                       help='Enable debug mode with detailed output')
    
    args = parser.parse_args()
    
    print("=== XMind Parser Tool ===")
    print(f"Python version: {sys.version}")
    print(f"Working directory: {os.getcwd()}")
    print()
    
    # Test package import
    if not test_xmindparser_import():
        print("Trying to install xmindparser...")
        if not install_package('xmindparser'):
            print("[ERROR] Cannot install xmindparser, please install manually: pip install xmindparser")
            return 1
    
    # Test-only mode
    if args.test_only:
        print("[OK] Package import test completed")
        return 0
    
    # Check if file path is provided
    if not args.file_path:
        print("[ERROR] XMind file path is required")
        return 1
    
    # Check if file exists
    if not os.path.exists(args.file_path):
        print(f"[ERROR] File does not exist: {args.file_path}")
        return 1
    
    print(f"[OK] File exists: {args.file_path}")
    print(f"  File size: {os.path.getsize(args.file_path)} bytes")
    print()
    
    # Debug mode: analyze file structure
    if args.debug:
        print("=== DEBUG MODE ===")
        if not debug_xmind_file(args.file_path):
            print("[ERROR] XMind file analysis failed")
            return 1
        print("=== END DEBUG MODE ===\n")
    
    # If XMindZen and requesting raw JSON
    if args.zen_json:
        print("Getting XMindZen raw JSON...")
        zen_data = get_xmind_zen_json(args.file_path)
        if zen_data:
            if args.output:
                with open(args.output, 'w', encoding='utf-8') as f:
                    json.dump(zen_data, f, ensure_ascii=False, indent=2)
                print(f"[OK] XMindZen JSON saved to: {args.output}")
            else:
                print("\n=== XMindZen Raw JSON ===")
                print(json.dumps(zen_data, ensure_ascii=False, indent=2))
        return 0
    
    # Parse file
    data = parse_xmind_file(
        args.file_path, 
        args.format, 
        args.output,
        args.show_topic_id,
        not args.show_empty
    )
    
    if data:
        print("[OK] Parsing completed")
        return 0
    else:
        print("[ERROR] Parsing failed")
        return 1

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nUser interrupted operation")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Program execution error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
