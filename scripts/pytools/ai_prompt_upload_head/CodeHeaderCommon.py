import os

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..'))

COMMENT_PREFIX = '//'
RULES_START_MARKER = COMMENT_PREFIX + ' ### AI SPECIAL ATTENTION RULES START ###'
RULES_END_MARKER = COMMENT_PREFIX + ' ### AI SPECIAL ATTENTION RULES END ###'
PREAMBLE_SHEBANG = '#!'
PREAMBLE_PHP = '<?php'
BOM = '﻿'

HEADER_NONE = 'none'
HEADER_VALID = 'valid'
HEADER_INVALID = 'invalid'

SKIP_DIRS = {
    # Version control and build directories
    '.git', '.svn', '.hg', 'dist', 'build', 'tmp', 'temp', '.tmp', '.temp', '.output', '.outputs', 'coverage',

    # Python related directories
    '__pycache__', 'site-packages', '.venv', 'venv', 'env', '.env',
    'python', 'python3', 'python2', 'Python', 'Python3', 'Python2',
    '.python-version', 'pyenv', '.pyenv', 'conda', 'anaconda', 'miniconda',
    '.ruff_cache', '.mypy_cache', '.pytest_cache', '.tox',

    # Node.js related directories
    'node_modules', '.npm', 'npm', 'node', 'Node', 'nodejs', 'Node.js',
    '.node-version', 'nvm', '.nvm', 'bower_components', '.pnpm-store', '.yarn',
    'vite', '.vite', '.next', '.nuxt', '.svelte-kit', '.turbo', '.wxt',

    # Flutter/Dart related directories
    'flutter', 'Flutter', '.flutter', 'dart', 'Dart', '.dart_tool',
    'flutter_tools', '.pub-cache', '.packages', '.pubspec_cache', '.symlinks', 'Pods',

    # PHP related directories
    'vendor', 'php', 'PHP', 'composer', '.composer', 'pear', 'PEAR',
    'phpunit', 'PHPUnit',

    # Other language installations and tools
    'go', 'Go', 'golang', 'rust', 'Rust', 'cargo', '.cargo',
    'java', 'Java', 'jdk', 'JDK', 'jre', 'JRE', 'maven', 'gradle', '.gradle', '.kotlin',
    'ruby', 'Ruby', 'gems', '.gem', 'rbenv', '.rbenv',

    # IDE and editor directories
    '.vscode', '.idea', '.eclipse', '.netbeans',

    # Package managers and caches
    'cache', '.cache', 'logs', '.logs'
}
SKIP_DIRS_LOWER = {name.lower() for name in SKIP_DIRS}

CODE_EXTENSIONS = {
    '.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.vue',
    '.php', '.dart', '.py', '.go', '.java', '.kt', '.kts', '.swift', '.scala', '.groovy', '.gradle',
    '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.rs', '.scss', '.less',
}


def is_skipped_dir(path, name):
    if name.lower() in SKIP_DIRS_LOWER or os.path.islink(path):
        return True
    return hasattr(os.path, 'isjunction') and os.path.isjunction(path)


def iter_code_files(root):
    for current, dirs, files in os.walk(root):
        dirs[:] = sorted(name for name in dirs if not is_skipped_dir(os.path.join(current, name), name))
        for name in sorted(files):
            if os.path.splitext(name)[1].lower() in CODE_EXTENSIONS:
                yield os.path.join(current, name)


def read_lines(path):
    with open(path, 'r', encoding='utf-8', newline='') as handle:
        lines = handle.readlines()
    has_bom = bool(lines) and lines[0].startswith(BOM)
    if has_bom:
        lines[0] = lines[0][len(BOM):]
    return has_bom, lines


def skip_blank_lines(lines, index):
    while index < len(lines) and not lines[index].strip():
        index += 1
    return index


def find_header(lines):
    index = 1 if lines and lines[0].startswith(PREAMBLE_SHEBANG) else 0
    index = skip_blank_lines(lines, index)
    if index < len(lines) and lines[index].lstrip().lower().startswith(PREAMBLE_PHP):
        index = skip_blank_lines(lines, index + 1)
    if index >= len(lines) or lines[index].strip() != RULES_START_MARKER:
        return HEADER_NONE, -1, -1
    start = index
    for index in range(start + 1, len(lines)):
        text = lines[index].strip()
        if text == RULES_END_MARKER:
            return HEADER_VALID, start, index
        if not text.startswith(COMMENT_PREFIX):
            break
    return HEADER_INVALID, start, -1


def scan_headers(root):
    scanned = 0
    results = {HEADER_VALID: [], HEADER_INVALID: []}
    for path in iter_code_files(root):
        scanned += 1
        try:
            status = find_header(read_lines(path)[1])[0]
        except (OSError, UnicodeDecodeError):
            continue
        if status in results:
            results[status].append(path)
    return scanned, results
