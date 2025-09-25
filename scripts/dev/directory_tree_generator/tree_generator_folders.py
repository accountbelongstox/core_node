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

#!/usr/bin/env python3
"""
Directory Tree Generator - Folders Only Version
Generates a markdown tree structure showing only directories and file statistics
Follows project auxiliary script development standards
"""

import os
import sys
import argparse
import subprocess
import platform
from pathlib import Path
from collections import defaultdict

# Skip these directories according to project standards
SKIP_DIRS = {
    # Version control and build directories
    '.git', '.svn', '.hg', 'dist', 'build', 'tmp', 'temp',
    
    # Python related directories
    '__pycache__', 'site-packages', '.venv', 'venv', 'env', '.env',
    'python', 'python3', 'python2', 'Python', 'Python3', 'Python2',
    '.python-version', 'pyenv', '.pyenv', 'conda', 'anaconda', 'miniconda',
    
    # Node.js related directories
    'node_modules', '.npm', 'npm', 'node', 'Node', 'nodejs', 'Node.js',
    '.node-version', 'nvm', '.nvm',
    
    # Flutter/Dart related directories
    'flutter', 'Flutter', '.flutter', 'dart', 'Dart', '.dart_tool',
    'flutter_tools', '.pub-cache', '.packages',
    
    # PHP related directories
    'vendor', 'php', 'PHP', 'composer', '.composer', 'pear', 'PEAR',
    'phpunit', 'PHPUnit',
    
    # Other language installations and tools
    'go', 'Go', 'golang', 'rust', 'Rust', 'cargo', '.cargo',
    'java', 'Java', 'jdk', 'JDK', 'jre', 'JRE', 'maven', 'gradle',
    'ruby', 'Ruby', 'gems', '.gem', 'rbenv', '.rbenv',
    
    # IDE and editor directories
    '.vscode', '.idea', '.eclipse', '.netbeans',
    
    # Package managers and caches
    'cache', '.cache', 'logs', '.logs'
}

# Static file extensions that should be grouped and simplified
STATIC_FILE_EXTENSIONS = {
    # Image files
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.ico', '.webp', '.tiff', '.tif',
    
    # Font files
    '.ttf', '.otf', '.woff', '.woff2', '.eot',
    
    # Document files
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    
    # Archive files
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
    
    # Media files
    '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.wav', '.ogg',
    
    # Static web files
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    
    # Data files
    '.json', '.xml', '.yaml', '.yml', '.csv', '.txt'
}

def get_project_root():
    """Get project root directory by finding from current script location"""
    current_dir = Path(__file__).resolve().parent
    
    # Navigate up to find project root (contains main.js or package.json)
    while current_dir != current_dir.parent:
        if (current_dir / 'main.js').exists() or (current_dir / 'package.json').exists():
            return current_dir
        current_dir = current_dir.parent
    
    # Fallback to current directory if not found
    return Path.cwd()

def should_skip_directory(dir_name):
    """Check if directory should be skipped based on project rules"""
    return dir_name in SKIP_DIRS

def should_skip_hidden_item(item_name):
    """Check if hidden item (starting with .) should be skipped"""
    if not item_name.startswith('.'):
        return False
    
    # Allow .env files
    if item_name == '.env':
        return False
    
    # Skip all other hidden files and directories
    return True

def get_default_output_path(root_dir, target_path):
    """Generate default output path in .cache directory"""
    cache_dir = root_dir / '.cache' / 'directory_trees'
    cache_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate filename based on target path
    if target_path.name:
        filename = f"{target_path.name}_folders_tree.md"
    else:
        filename = "root_folders_tree.md"
    
    return cache_dir / filename

def open_file_explorer(path):
    """Open file explorer at the given path"""
    try:
        system = platform.system()
        if system == "Windows":
            # Use os.startfile for Windows
            import os
            os.startfile(str(path.parent))
        elif system == "Darwin":  # macOS
            subprocess.run(['open', '-R', str(path)], check=True)
        else:  # Linux and others
            subprocess.run(['xdg-open', str(path.parent)], check=True)
        return True
    except Exception as e:
        print(f"Failed to open file explorer: {e}")
        return False

def count_files_by_type(files):
    """Count files by type and return statistics"""
    static_groups = defaultdict(int)
    code_files = 0
    total_files = len(files)
    
    for file in files:
        ext = os.path.splitext(file)[1].lower()
        if ext in STATIC_FILE_EXTENSIONS:
            static_groups[ext] += 1
        else:
            code_files += 1
    
    return static_groups, code_files, total_files

def generate_tree_structure(root_path, prefix="", max_depth=None, current_depth=0):
    """Generate tree structure for given directory - folders only version"""
    if max_depth is not None and current_depth > max_depth:
        return []
    
    items = []
    try:
        # Get all items in directory
        all_items = sorted(os.listdir(root_path))
        
        # Separate directories and files
        directories = []
        files = []
        
        for item in all_items:
            # Skip hidden files and directories (except .env)
            if should_skip_hidden_item(item):
                continue
                
            item_path = os.path.join(root_path, item)
            if os.path.isdir(item_path):
                if not should_skip_directory(item):
                    directories.append(item)
            else:
                files.append(item)
        
        # Count files by type for statistics
        static_groups, code_files, total_files = count_files_by_type(files)
        
        # Process directories
        for i, directory in enumerate(directories):
            is_last_dir = i == len(directories) - 1
            
            # Determine current item prefix
            current_prefix = "└── " if is_last_dir else "├── "
            
            # Add directory entry
            items.append(f"{prefix}{current_prefix}{directory}/")
            
            # Recursively process subdirectory if within depth limit
            if max_depth is None or current_depth < max_depth:
                item_path = os.path.join(root_path, directory)
                next_prefix = prefix + ("    " if is_last_dir else "│   ")
                sub_items = generate_tree_structure(item_path, next_prefix, max_depth, current_depth + 1)
                items.extend(sub_items)
        
        # Add file statistics at the end if there are files
        if total_files > 0:
            stats_items = []
            
            if code_files > 0:
                stats_items.append(f"Code files: {code_files}")
            
            for ext, count in sorted(static_groups.items()):
                stats_items.append(f"{ext}: {count}")
            
            if stats_items:
                stats_prefix = "└── " if len(directories) == 0 else "└── "
                stats_text = f"Files: {total_files} ({', '.join(stats_items)})"
                items.append(f"{prefix}{stats_prefix}[{stats_text}]")
            
    except PermissionError:
        items.append(f"{prefix}├── [Permission Denied]")
    except Exception as e:
        items.append(f"{prefix}├── [Error: {str(e)}]")
    
    return items

def resolve_target_path(input_path, root_dir):
    """Resolve target path - handle both absolute and relative paths"""
    if os.path.isabs(input_path):
        return Path(input_path)
    else:
        return root_dir / input_path

def generate_markdown_output(target_path, tree_items):
    """Generate markdown formatted output"""
    markdown_lines = []
    
    # Add header
    markdown_lines.append(f"# Directory Structure: {target_path.name}")
    markdown_lines.append("")
    markdown_lines.append(f"**Path:** `{target_path}`")
    markdown_lines.append("")
    markdown_lines.append("```")
    markdown_lines.append(f"{target_path.name}/")
    
    # Add tree items
    for item in tree_items:
        markdown_lines.append(item)
    
    markdown_lines.append("```")
    markdown_lines.append("")
    markdown_lines.append("---")
    markdown_lines.append(f"*Generated by Directory Tree Generator (Folders Only)*")
    
    return "\n".join(markdown_lines)

def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(
        description="Generate directory structure in markdown format (folders only)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tree_generator_folders.py ./apps
  python tree_generator_folders.py ./scripts --depth 2
  python tree_generator_folders.py ./ncore --output ./custom/tree.md
  python tree_generator_folders.py ./apps --stdout
        """
    )
    
    parser.add_argument('path', help='Target directory path (absolute or relative to project root)')
    parser.add_argument('--depth', '-d', type=int, help='Maximum depth to traverse')
    parser.add_argument('--output', '-o', help='Output markdown file path (default: .cache/directory_trees/)')
    parser.add_argument('--stdout', action='store_true', help='Output to stdout instead of file')
    
    args = parser.parse_args()
    
    # Get project root directory
    root_dir = get_project_root()
    print(f"Project root: {root_dir}")
    
    # Resolve target path
    target_path = resolve_target_path(args.path, root_dir)
    
    if not target_path.exists():
        print(f"Error: Path does not exist: {target_path}")
        sys.exit(1)
    
    if not target_path.is_dir():
        print(f"Error: Path is not a directory: {target_path}")
        sys.exit(1)
    
    print(f"Generating folder structure for: {target_path}")
    if args.depth:
        print(f"Maximum depth: {args.depth}")
    
    # Generate tree structure
    tree_items = generate_tree_structure(str(target_path), "", args.depth)
    
    # Generate markdown output
    markdown_content = generate_markdown_output(target_path, tree_items)
    
    # Determine output path
    if args.stdout:
        # Output to stdout
        print("\n" + "="*50)
        print(markdown_content)
    else:
        # Output to file
        if args.output:
            output_path = Path(args.output)
        else:
            output_path = get_default_output_path(root_dir, target_path)
        
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        print(f"Folder structure saved to: {output_path}")
        
        # Ask user if they want to open the output directory
        try:
            response = input("\nOpen output directory in file explorer? (Y/n): ").strip().lower()
            if response in ['y', 'yes', '']:
                if open_file_explorer(output_path):
                    print("File explorer opened successfully.")
                else:
                    print("Failed to open file explorer.")
        except KeyboardInterrupt:
            print("\nOperation cancelled.")

if __name__ == "__main__":
    main()
