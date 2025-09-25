#!/usr/bin/env python3
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

import os
import re
import sys

# Configuration
TARGET_DIR = "../../"  # Relative to current Python file location

# Whitelist: Only these first-level subdirectories will be processed
ALLOWED_SUBDIRS = {
    'poly_apps',
    'scripts', 
    'apps',
    'ncore',
    'config',
    'development-guides',
}

# Skip these directories even within allowed subdirectories
SKIP_DIRS = {
    # Version control and build directories
    '.git', '.svn', '.hg', 'dist', 'build', 'tmp', 'temp', '.output', '.outputs',

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

FILE_EXTENSIONS = {'.py', '.js', '.ts', '.php', '.dart', '.md', '.sh', '.cmd', '.bat', '.ps1'}

# Current script file path
CURRENT_SCRIPT_PATH = os.path.abspath(__file__)

# AI Rules content - will be loaded from this script file
AI_RULES_START = None
AI_RULES_CONTENT = None
AI_RULES_END = None

def load_ai_rules_from_script():
    """Load AI rules from the current script file"""
    global AI_RULES_START, AI_RULES_CONTENT, AI_RULES_END
    
    try:
        with open(CURRENT_SCRIPT_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Find the AI rules block in the script
        start_pattern = r'# ### AI SPECIAL ATTENTION RULES START ###'
        end_pattern = r'# ### AI SPECIAL ATTENTION RULES END ###'
        
        start_match = re.search(start_pattern, content)
        end_match = re.search(end_pattern, content)
        
        # Extract the block content
        start_pos = start_match.start()
        end_pos = end_match.end()
        rules_block = content[start_pos:end_pos]
        
        # Split into lines and process
        lines = rules_block.split('\n')
        
        # Extract start marker (remove # prefix)
        start_line = lines[0]
        AI_RULES_START = start_line.replace('# ', '', 1)
        
        # Extract end marker (remove # prefix)
        end_line = lines[-1]
        AI_RULES_END = end_line.replace('# ', '', 1)
        
        # Extract content lines (remove # prefix from each line)
        content_lines = []
        for line in lines[1:-1]:  # Skip first and last line
            if line.startswith('# '):
                content_lines.append(line[2:])  # Remove '# ' prefix
            elif line.startswith('#'):
                content_lines.append(line[1:])  # Remove '#' prefix
            else:
                content_lines.append(line)  # Keep line as is
        
        AI_RULES_CONTENT = '\n'.join(content_lines)
        
        print(f"Successfully loaded AI rules from script: {CURRENT_SCRIPT_PATH}")
        
    except Exception as e:
        print(f"Error loading AI rules from script: {str(e)}, using default values")
        exit(0)

def get_comment_prefix(file_path):
    """Returns the appropriate comment prefix for the file type"""
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.py':
        return "# "
    elif ext in ['.js', '.ts', '.php', '.dart']:
        return "// "
    elif ext == '.md':
        return ""
    elif ext in ['.sh']:
        return "# "
    elif ext in ['.cmd', '.bat']:
        return "REM "
    elif ext == '.ps1':
        return "# "
    else:
        return "# "

def is_allowed_directory(target_path, current_path):
    """Check if the current path is within allowed first-level subdirectories"""
    try:
        # Get relative path from target directory
        rel_path = os.path.relpath(current_path, target_path)
        
        # Split path into parts
        path_parts = rel_path.split(os.sep)
        
        # Check if it's a direct subdirectory or deeper
        if len(path_parts) >= 1:
            first_level_dir = path_parts[0]
            
            # Skip if it's the current directory (.)
            if first_level_dir == '.':
                return False
                
            # Check if first level directory is in allowed list
            return first_level_dir in ALLOWED_SUBDIRS
        
        return False
        
    except ValueError:
        # Path is not relative to target_path
        return False

def should_skip_subdir(path):
    """Check if a subdirectory should be skipped"""
    path_parts = path.split(os.sep)
    return any(skip_dir in path_parts for skip_dir in SKIP_DIRS)

def add_or_update_rules(file_path):
    """Adds or updates AI rules header in a file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        prefix = get_comment_prefix(file_path)
        
        # Special formatting for MD files
        if os.path.splitext(file_path)[1].lower() == '.md':
            # Format as markdown list items
            rules_lines = AI_RULES_CONTENT.strip().split('\n')
            formatted_rules = []
            for line in rules_lines:
                if line.strip().startswith(('1.', '2.', '3.', '4.')):
                    # Convert numbered list to markdown list
                    formatted_rules.append(f"- {line.strip()[2:].strip()}")
                else:
                    formatted_rules.append(line)
            
            new_header = (
                f"<!-- {AI_RULES_START} -->\n"
                f"<!-- {formatted_rules[0]} -->\n"
                + '\n'.join(f"<!-- {line} -->" for line in formatted_rules[1:]) + "\n"
                f"<!-- {AI_RULES_END} -->\n\n"
            )
        else:
            # Format AI rules content with proper line prefixes
            rules_lines = AI_RULES_CONTENT.strip().split('\n')
            formatted_rules = '\n'.join(f"{prefix}{line}" for line in rules_lines)
            
            new_header = (
                f"{prefix}{AI_RULES_START}\n"
                f"{formatted_rules}\n"
                f"{prefix}{AI_RULES_END}\n\n"
            )
        
        # Special handling for PHP files
        if os.path.splitext(file_path)[1].lower() == '.php':
            return handle_php_file(file_path, content, new_header)
        
        # Special handling for MD files
        if os.path.splitext(file_path)[1].lower() == '.md':
            return handle_md_file(file_path, content, new_header)
        
        # Special handling for shell script files
        if os.path.splitext(file_path)[1].lower() in ['.sh', '.ps1']:
            return handle_shell_file(file_path, content, new_header, prefix)
        
        # Regular handling for other files
        return handle_regular_file(file_path, content, new_header, prefix)
        
    except UnicodeDecodeError:
        # print(f"Skipped binary file: {file_path}")
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {str(e)}")
        return False
        
def handle_php_file(file_path, content, new_header):
    """Special handling for PHP files - insert after <?php tag"""
    # Find <?php tag
    php_tag_pattern = r'<\?php'
    php_match = re.search(php_tag_pattern, content)
    
    if not php_match:
        # print(f"Skipped PHP file (no <?php tag found): {file_path}")
        return False
    
    php_tag_end = php_match.end()
    
    # Check if AI rules already exist
    existing_rules_pattern = re.compile(
        r'//\s*' + re.escape(AI_RULES_START) + r'.*?' + 
        r'//\s*' + re.escape(AI_RULES_END),
        re.DOTALL
    )
    
    existing_rules = existing_rules_pattern.search(content)
    
    if existing_rules:
        # Check if existing rules are different from new rules
        existing_block = existing_rules.group(0)
        new_block = new_header.strip()
        if existing_block.strip() != new_block.strip():
            new_content = existing_rules_pattern.sub(new_block, content)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated AI rules in PHP file: {file_path}")
            return True
        return False
    
    # Insert new rules after <?php tag
    before_php = content[:php_tag_end]
    after_php = content[php_tag_end:]
    
    # Ensure proper spacing
    # Check if there's already a newline after <?php
    if after_php.startswith('\n'):
        # <?php is followed by newline, insert rules with one newline
        new_content = before_php + '\n' + new_header + after_php[1:]
    elif after_php.startswith('\r\n'):
        # Windows line ending
        new_content = before_php + '\r\n' + new_header + after_php[2:]
    else:
        # <?php is not followed by newline, add newline before and after rules
        new_content = before_php + '\n' + new_header + after_php
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Added AI rules to PHP file: {file_path}")
    return True

def handle_md_file(file_path, content, new_header):
    """Special handling for MD files - use HTML comments"""
    # Check if AI rules already exist
    existing_rules_pattern = re.compile(
        r'<!--\s*' + re.escape(AI_RULES_START) + r'.*?' + 
        r'<!--\s*' + re.escape(AI_RULES_END) + r'\s*-->',
        re.DOTALL
    )
    
    existing_rules = existing_rules_pattern.search(content)
    
    if existing_rules:
        # Check if existing rules are different from new rules
        existing_block = existing_rules.group(0)
        new_block = new_header.strip()
        if existing_block.strip() != new_block.strip():
            new_content = existing_rules_pattern.sub(new_block, content)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated AI rules in MD file: {file_path}")
            return True
        return False
    
    # Add new rules at the beginning
    new_content = new_header + content
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Added AI rules to MD file: {file_path}")
    return True

def handle_shell_file(file_path, content, new_header, prefix):
    """Special handling for shell script files - insert after shebang line if present"""
    lines = content.split('\n')
    
    # Check if first line is a shebang
    if lines and lines[0].startswith('#!'):
        # Insert after shebang line
        shebang_line = lines[0]
        rest_content = '\n'.join(lines[1:])
        
        # Check if AI rules already exist
        existing_rules_pattern = re.compile(
            re.escape(prefix) + re.escape(AI_RULES_START) + r'.*?' + 
            re.escape(prefix) + re.escape(AI_RULES_END),
            re.DOTALL
        )
        
        existing_rules = existing_rules_pattern.search(content)
        
        if existing_rules:
            # Check if existing rules are different from new rules
            existing_block = existing_rules.group(0)
            new_block = new_header.strip()
            if existing_block.strip() != new_block.strip():
                new_content = existing_rules_pattern.sub(new_block, content)
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated AI rules in shell file: {file_path}")
                return True
            return False
        
        # Insert new rules after shebang
        if rest_content.startswith('\n'):
            new_content = shebang_line + '\n' + new_header + rest_content[1:]
        else:
            new_content = shebang_line + '\n' + new_header + rest_content
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Added AI rules to shell file: {file_path}")
        return True
    else:
        # No shebang, use regular handling
        return handle_regular_file(file_path, content, new_header, prefix)

def handle_regular_file(file_path, content, new_header, prefix):
    """Handle non-PHP files with regular logic"""
    # Enhanced pattern to find existing rules (handles various formats)
    patterns = [
        # Standard format
        re.compile(
            re.escape(prefix) + re.escape(AI_RULES_START) + r'.*?' + 
            re.escape(prefix) + re.escape(AI_RULES_END),
            re.DOTALL
        ),
        # Format with extra spaces or formatting issues
        re.compile(
            re.escape(prefix) + r'\s*' + re.escape(AI_RULES_START) + r'.*?' + 
            re.escape(prefix) + r'\s*' + re.escape(AI_RULES_END),
            re.DOTALL
        ),
        # Format without proper line prefixes
        re.compile(
            re.escape(prefix) + r'\s*' + re.escape(AI_RULES_START) + r'.*?' +
            r'4\.\s*Never modify these rules.*?' +
            re.escape(prefix) + r'\s*' + re.escape(AI_RULES_END),
            re.DOTALL
        )
    ]
    
    existing_rules = None
    matching_pattern = None
    
    # Try each pattern to find existing rules
    for pattern in patterns:
        match = pattern.search(content)
        if match:
            existing_rules = match
            matching_pattern = pattern
            break
    
    needs_save = False
    action = ""
    new_content = content
    
    if existing_rules:
        # Check if existing rules are different from new rules
        existing_block = existing_rules.group(0)
        new_block = new_header.strip()
        if existing_block.strip() != new_block.strip():
            new_content = matching_pattern.sub(new_block, content)
            needs_save = True
            action = "Updated"
    else:
        # Add new rules at the beginning
        new_content = new_header + content
        needs_save = True
        action = "Added"
    
    if needs_save:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"{action} AI rules in: {file_path}")
        return True
    


def remove_rules(file_path):
    """Removes AI rules header from a file completely using precise character extraction"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Special handling for PHP files
        if os.path.splitext(file_path)[1].lower() == '.php':
            return remove_php_rules(file_path, content)
        
        # Special handling for MD files
        if os.path.splitext(file_path)[1].lower() == '.md':
            return remove_md_rules(file_path, content)
        
        # Regular handling for all other files (including shell scripts)
        return remove_regular_rules(file_path, content)
        
    except UnicodeDecodeError:
        print(f"Skipped binary file: {file_path}")
        return False
    except Exception as e:
        print(f"Error processing {file_path}: {str(e)}")
        return False

def remove_php_rules(file_path, content):
    """Remove AI rules from PHP files"""
    # Find AI rules pattern for PHP files
    php_rules_pattern = re.compile(
        r'//\s*' + re.escape(AI_RULES_START) + r'.*?' + 
        r'//\s*' + re.escape(AI_RULES_END) + r'\n*',
        re.DOTALL
    )
    
    match = php_rules_pattern.search(content)
    if not match:
        print(f"No AI rules found in PHP file: {file_path}")
        return False
    
    # Remove the matched block
    new_content = php_rules_pattern.sub('', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Removed AI rules from PHP file: {file_path}")
    return True

def remove_md_rules(file_path, content):
    """Remove AI rules from MD files"""
    # Find AI rules pattern for MD files
    md_rules_pattern = re.compile(
        r'<!--\s*' + re.escape(AI_RULES_START) + r'.*?' + 
        r'<!--\s*' + re.escape(AI_RULES_END) + r'\s*-->\n*',
        re.DOTALL
    )
    
    match = md_rules_pattern.search(content)
    if not match:
        print(f"No AI rules found in MD file: {file_path}")
        return False
    
    # Remove the matched block
    new_content = md_rules_pattern.sub('', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Removed AI rules from MD file: {file_path}")
    return True

def remove_regular_rules(file_path, content):
    """Remove AI rules from regular (non-PHP) files"""
    prefix = get_comment_prefix(file_path)
    
    # Find AI_RULES_START marker
    start_marker = AI_RULES_START
    end_marker = AI_RULES_END
    
    # Look for start marker with or without comment prefix
    start_patterns = [
        prefix + start_marker,
        start_marker
    ]
    
    start_pos = -1
    end_pos = -1
    
    # Find the start position
    for pattern in start_patterns:
        pos = content.find(pattern)
        if pos != -1:
            start_pos = pos
            break
    
    if start_pos == -1:
        print(f"No AI rules found in: {file_path}")
        return False
    
    # Find the end position
    end_patterns = [
        prefix + end_marker,
        end_marker
    ]
    
    for pattern in end_patterns:
        pos = content.find(pattern, start_pos)
        if pos != -1:
            end_pos = pos + len(pattern)
            break
    
    if end_pos == -1:
        print(f"Incomplete AI rules block found in: {file_path}")
        return False
    
    # Find the actual start of the block (including any preceding comment prefix on the same line)
    block_start = start_pos
    
    # Check if there's a comment prefix right before the start marker on the same line
    if start_pos > 0:
        # Look backwards to find the beginning of the line
        line_start = content.rfind('\n', 0, start_pos)
        if line_start == -1:
            line_start = 0
        else:
            line_start += 1  # Move past the newline
        
        # Check if there's only whitespace and comment prefix before our marker
        line_prefix = content[line_start:start_pos]
        if line_prefix.strip() == prefix.strip():
            block_start = line_start
    
    # Find the actual end of the block (including trailing newlines)
    block_end = end_pos
    
    # Include trailing newlines that are part of the block
    while block_end < len(content) and content[block_end] == '\n':
        block_end += 1
        # Stop after maximum 2 newlines to avoid removing too much
        if content[block_start:block_end].count('\n', end_pos - block_start) >= 2:
            break
    
    # Extract the content before and after the block
    before_block = content[:block_start]
    after_block = content[block_end:]
    
    # Combine the content
    new_content = before_block + after_block
    
    # Clean up any excessive newlines at the junction
    if before_block and after_block:
        # If both parts exist, ensure proper spacing
        if before_block.endswith('\n\n') and after_block.startswith('\n'):
            new_content = before_block + after_block[1:]  # Remove one extra newline
    
    # Clean up leading newlines if the block was at the very beginning
    if block_start == 0:
        new_content = new_content.lstrip('\n')
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Removed AI rules from: {file_path}")
    return True

def show_menu():
    """Display the main menu and get user choice"""
    print("=" * 50)
    print("CodeHeaderEnforcer V2 - Whitelist Approach")
    print("=" * 50)
    print("1. Add/Update AI rules in code files")
    print("2. Remove AI rules from code files")
    print("3. Exit")
    print()
    
    while True:
        choice = input("Please select an option (1-3): ").strip()
        if choice in ['1', '2', '3']:
            return choice
        print("Invalid choice. Please enter 1, 2, or 3.")

def show_operation_details(operation_mode):
    """Show detailed operation rules and string previews"""
    print(f"\n{'='*70}")
    print(f"SELECTED OPERATION: {operation_mode.upper()}")
    print(f"{'='*70}")
    
    print("📋 SCANNING APPROACH:")
    print(f"  �  TARGET_DIR root files: Process one level only (no recursion)")
    print(f"  📁 Allowed subdirectories (with recursion):")
    for subdir in sorted(ALLOWED_SUBDIRS):
        print(f"    - {subdir}/")
    print(f"  ❌ All other first-level directories will be IGNORED")
    print()
    print("📋 SUBDIRECTORY SKIP RULES:")
    print(f"  🚫 Within allowed directories, these subdirectories will be SKIPPED:")
    skip_categories = [
        ("Version control & build", ['.git', '.svn', '.hg', 'dist', 'build', 'tmp', 'temp']),
        ("Node.js related", ['node_modules', '.npm', 'npm', '.node-version', 'nvm', '.nvm']),
        ("Python related", ['__pycache__', 'site-packages', '.venv', 'venv', 'env', '.env']),
        ("Flutter/Dart related", ['.flutter', '.dart_tool', 'flutter_tools', '.pub-cache', '.packages']),
        ("PHP related", ['vendor', 'composer', '.composer', 'pear', 'phpunit']),
        ("IDE & caches", ['.vscode', '.idea', 'cache', '.cache', 'logs', '.logs'])
    ]

    for category, dirs in skip_categories:
        print(f"    {category}: {', '.join(dirs[:5])}{'...' if len(dirs) > 5 else ''}")
    print()
    
    if operation_mode == "add":
        print("📝 STRING PREVIEW FOR DIFFERENT FILE TYPES:")
        
        # Show examples for each file type
        file_types = [(".py", "# "), (".js", "// "), (".php", "// "), (".dart", "// "), (".ts", "// "), (".md", ""), (".sh", "# "), (".cmd", "REM "), (".bat", "REM "), (".ps1", "# ")]
        
        for ext, prefix in file_types:
            print(f"  📄 {ext.upper()} files:")
            
            if ext == ".php":
                rules_lines = AI_RULES_CONTENT.strip().split('\n')
                formatted_rules = '\n'.join(f"{prefix}{line}" for line in rules_lines)
                header = f"{prefix}{AI_RULES_START}\n{formatted_rules}\n{prefix}{AI_RULES_END}\n\n"
                print("    📌 Special PHP handling: Rules inserted after <?php tag")
                print("    " + "─" * 50)
                print("    <?php")
                for line in header.rstrip().split('\n'):
                    print(f"    {line}")
                print("    [rest of PHP code...]")
                print("    " + "─" * 50)
            elif ext == ".md":
                rules_lines = AI_RULES_CONTENT.strip().split('\n')
                formatted_rules = []
                for line in rules_lines:
                    if line.strip().startswith(('1.', '2.', '3.', '4.')):
                        formatted_rules.append(f"- {line.strip()[2:].strip()}")
                    else:
                        formatted_rules.append(line)
                
                header = (
                    f"<!-- {AI_RULES_START} -->\n"
                    f"<!-- {formatted_rules[0]} -->\n"
                    + '\n'.join(f"<!-- {line} -->" for line in formatted_rules[1:]) + "\n"
                    f"<!-- {AI_RULES_END} -->\n\n"
                )
                print("    📌 Special MD handling: Rules as HTML comments with list format")
                print("    " + "─" * 50)
                for line in header.rstrip().split('\n'):
                    print(f"    {line}")
                print("    " + "─" * 50)
            elif ext in [".sh", ".ps1"]:
                rules_lines = AI_RULES_CONTENT.strip().split('\n')
                formatted_rules = '\n'.join(f"{prefix}{line}" for line in rules_lines)
                header = f"{prefix}{AI_RULES_START}\n{formatted_rules}\n{prefix}{AI_RULES_END}\n\n"
                print("    📌 Special shell handling: Rules inserted after shebang line if present")
                print("    " + "─" * 50)
                print("    #!/bin/bash  (or similar shebang)")
                for line in header.rstrip().split('\n'):
                    print(f"    {line}")
                print("    [rest of shell code...]")
                print("    " + "─" * 50)
            else:
                rules_lines = AI_RULES_CONTENT.strip().split('\n')
                formatted_rules = '\n'.join(f"{prefix}{line}" for line in rules_lines)
                header = f"{prefix}{AI_RULES_START}\n{formatted_rules}\n{prefix}{AI_RULES_END}\n\n"
                print("    " + "─" * 50)
                for line in header.rstrip().split('\n'):
                    print(f"    {line}")
                print("    " + "─" * 50)
            print()
    else:
        print("🔍 REMOVAL SEARCH ALGORITHM:")
        print("  1. Find AI_RULES_START marker in file content")
        print("  2. Find AI_RULES_END marker after start position")
        print("  3. Calculate exact character positions for removal")
        print("  4. Include preceding comment prefix and trailing newlines")
        print("  5. Remove entire block without leaving residual characters")
        print()
        print("🔎 SEARCH PATTERNS FOR DIFFERENT FILE TYPES:")
        
        file_types = [(".py", "# "), (".js", "// "), (".php", "// "), (".dart", "// "), (".ts", "// "), (".md", ""), (".sh", "# "), (".cmd", "REM "), (".bat", "REM "), (".ps1", "# ")]
        
        for ext, prefix in file_types:
            print(f"  📄 {ext.upper()} files:")
            start_pattern1 = f"{prefix}{AI_RULES_START}"
            start_pattern2 = AI_RULES_START
            end_pattern1 = f"{prefix}{AI_RULES_END}"
            end_pattern2 = AI_RULES_END
            
            print(f"    🔍 START search patterns:")
            print(f"      1. '{start_pattern1}'")
            print(f"      2. '{start_pattern2}'")
            print(f"    🔍 END search patterns:")
            print(f"      1. '{end_pattern1}'")
            print(f"      2. '{end_pattern2}'")
            print(f"    ➡️  Remove from START position to END position + trailing newlines")
            print()
    
    print(f"{'='*70}")

def preview_operation(operation_mode):
    """Preview the operation effects before execution"""
    print(f"\n=== Operation Preview: {operation_mode.upper()} ===")
    print("Ready to process files.")
    
    if operation_mode == "add":
        print("✅ Will add/update AI rules in eligible files")
    else:
        print("❌ Will remove AI rules from ALL eligible files")
    
    print(f"Target file extensions: {', '.join(FILE_EXTENSIONS)}")
    print("Preview complete.")


def process_files(target_path, operation_mode):
    """Process files based on the selected operation mode"""
    processed_count = 0
    modified_count = 0
    
    # First, process files in TARGET_DIR root (one level only, no recursion)
    print("Processing TARGET_DIR root files (one level only)...")
    try:
        for item in os.listdir(target_path):
            item_path = os.path.join(target_path, item)
            if os.path.isfile(item_path):
                ext = os.path.splitext(item)[1].lower()
                if ext in FILE_EXTENSIONS:
                    processed_count += 1
                    print(f"Processing root file: {item}")
                    
                    if operation_mode == "add":
                        if add_or_update_rules(item_path):
                            modified_count += 1
                    elif operation_mode == "remove":
                        if remove_rules(item_path):
                            modified_count += 1
    except Exception as e:
        print(f"Error processing TARGET_DIR root files: {str(e)}")
    
    # Then, get list of first-level subdirectories
    try:
        first_level_dirs = [d for d in os.listdir(target_path) 
                           if os.path.isdir(os.path.join(target_path, d)) and d in ALLOWED_SUBDIRS]
        
        if first_level_dirs:
            print(f"\nProcessing allowed subdirectories: {', '.join(first_level_dirs)}")
        else:
            print("No allowed subdirectories found in target path.")
        
    except Exception as e:
        print(f"Error accessing target directory: {str(e)}")
        return processed_count, modified_count
    
    # Process only allowed subdirectories (with recursion)
    for subdir in first_level_dirs:
        subdir_path = os.path.join(target_path, subdir)
        print(f"\nProcessing directory: {subdir}/")
        
        for root, dirs, files in os.walk(subdir_path):
            # Skip subdirectories that are in SKIP_DIRS
            if should_skip_subdir(root):
                dirs[:] = []  # Prune directory traversal
                continue

            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in FILE_EXTENSIONS:
                    file_path = os.path.join(root, file)
                    processed_count += 1

                    if operation_mode == "add":
                        if add_or_update_rules(file_path):
                            modified_count += 1
                    elif operation_mode == "remove":
                        if remove_rules(file_path):
                            modified_count += 1
    
    return processed_count, modified_count

def main():
    """Main execution function"""
    print("Starting CodeHeaderEnforcer V2...")
    
    # Load AI rules from current script file
    load_ai_rules_from_script()
    
    # Get absolute path of target directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    target_path = os.path.abspath(os.path.join(current_dir, TARGET_DIR))
    
    print(f"Python script location: {current_dir}")
    print(f"Target directory to scan: {target_path}")
    print()
    
    # Show menu and get user choice
    choice = show_menu()
    
    if choice == '3':
        print("Goodbye!")
        return
    
    # Set operation mode and confirmation message
    if choice == '1':
        operation_mode = "add"
        operation_desc = "add/update AI rules in"
    else:  # choice == '2'
        operation_mode = "remove"
        operation_desc = "remove AI rules from"
    
    # Show detailed operation rules and preview
    show_operation_details(operation_mode)
    
    # Show preview of operation effects
    preview_operation(operation_mode)
    
    # Confirmation prompt
    confirmation = input(f"\nDo you want to proceed to {operation_desc} code files? (Y/n): ").strip()
    if confirmation.lower() not in ['y', 'yes', '']:
        print("Operation cancelled.")
        return
    
    print()
    print(f"Processing files to {operation_desc} code files...")
    
    # Process files
    processed_count, modified_count = process_files(target_path, operation_mode)
    
    print()
    print(f"Operation complete. Processed {processed_count} files, modified {modified_count} files.")

if __name__ == "__main__":
    main()
