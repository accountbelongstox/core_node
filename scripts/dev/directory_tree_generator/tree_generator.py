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
Directory Tree Generator
Generates a markdown tree structure for a given directory path
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
        filename = f"{target_path.name}_tree.md"
    else:
        filename = "root_tree.md"

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

def group_static_files(files):
    """Group static files by extension and return summary"""
    static_groups = defaultdict(list)
    code_files = []

    for file in files:
        ext = os.path.splitext(file)[1].lower()
        if ext in STATIC_FILE_EXTENSIONS:
            static_groups[ext].append(file)
        else:
            code_files.append(file)

    return static_groups, code_files

def generate_tree_structure(root_path, prefix="", max_depth=None, current_depth=0):
    """Generate tree structure for given directory"""
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

        # Group static files
        static_groups, code_files = group_static_files(files)

        # Combine items for processing: directories first, then code files, then static file summaries
        all_valid_items = [(d, True, False) for d in directories] + [(f, False, False) for f in code_files]

        # Add static file group summaries
        for ext, file_list in static_groups.items():
            if len(file_list) > 3:  # Group if more than 3 files
                summary = f"{len(file_list)} {ext} files"
                all_valid_items.append((summary, False, True))
            else:  # Show individual files if 3 or fewer
                for f in file_list:
                    all_valid_items.append((f, False, False))

        # Process all items
        for i, (item_name, is_directory, is_summary) in enumerate(all_valid_items):
            is_last = i == len(all_valid_items) - 1

            # Determine current item prefix
            current_prefix = "└── " if is_last else "├── "

            if is_summary:
                # Static file summary
                items.append(f"{prefix}{current_prefix}{item_name}")
            elif is_directory:
                # Directory
                items.append(f"{prefix}{current_prefix}{item_name}/")

                # Recursively process subdirectory if within depth limit
                if max_depth is None or current_depth < max_depth:
                    item_path = os.path.join(root_path, item_name)
                    next_prefix = prefix + ("    " if is_last else "│   ")
                    sub_items = generate_tree_structure(item_path, next_prefix, max_depth, current_depth + 1)
                    items.extend(sub_items)
            else:
                # Regular file
                items.append(f"{prefix}{current_prefix}{item_name}")

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
    markdown_lines.append(f"# Directory Tree: {target_path.name}")
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
    markdown_lines.append(f"*Generated by Directory Tree Generator*")
    
    return "\n".join(markdown_lines)

def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(
        description="Generate directory tree structure in markdown format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tree_generator.py ./apps
  python tree_generator.py ./scripts --depth 2
  python tree_generator.py ./ncore --output ./custom/tree.md
  python tree_generator.py ./apps --stdout
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
    
    print(f"Generating tree for: {target_path}")
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

        print(f"Tree structure saved to: {output_path}")

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
