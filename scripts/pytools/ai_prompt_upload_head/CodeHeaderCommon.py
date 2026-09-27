import codecs
import io
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', '..'))
EXCLUDED_DIRS = {os.path.normcase(os.path.realpath(SCRIPT_DIR))}

RULES_START_TEXT = '### AI SPECIAL ATTENTION RULES START ###'
RULES_END_TEXT = '### AI SPECIAL ATTENTION RULES END ###'
RULES_MARKER_TEXT = 'AI SPECIAL ATTENTION RULES START'
PROTECTED_NAME_MARK = '_NO_AI_EDIT'

HEADER_NONE = 'none'
HEADER_VALID = 'valid'
HEADER_INVALID = 'invalid'
HEADER_UNREADABLE = 'unreadable'
HEADER_PROTECTED = 'protected'
REPORTED_STATUSES = (HEADER_VALID, HEADER_INVALID, HEADER_UNREADABLE, HEADER_PROTECTED)

DEFAULT_ENCODING = 'utf-8'
ENCODING_BOMS = (
    (codecs.BOM_UTF32_LE, 'utf-32-le'),
    (codecs.BOM_UTF32_BE, 'utf-32-be'),
    (codecs.BOM_UTF8, 'utf-8'),
    (codecs.BOM_UTF16_LE, 'utf-16-le'),
    (codecs.BOM_UTF16_BE, 'utf-16-be'),
)

SLASH_EXTENSIONS = {
    '.js', '.mjs', '.cjs', '.jsx', '.ts', '.mts', '.cts', '.tsx', '.vue',
    '.php', '.dart', '.go', '.java', '.kt', '.kts', '.swift', '.scala', '.groovy', '.gradle',
    '.c', '.h', '.cc', '.cpp', '.hpp', '.cs', '.rs', '.scss', '.less',
}
HASH_EXTENSIONS = {'.py', '.ps1', '.psm1', '.sh', '.bash', '.ini'}
REM_EXTENSIONS = {'.cmd', '.bat'}
HTML_COMMENT_EXTENSIONS = {'.md'}

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


class HeaderRule:
    def __init__(self, prefix, extensions, suffix=''):
        self.prefix = prefix
        self.extensions = extensions
        self.start_marker = f'{prefix} {RULES_START_TEXT}{suffix}'
        self.end_marker = f'{prefix} {RULES_END_TEXT}{suffix}'

    def is_start(self, line):
        return line.strip() == self.start_marker

    def is_end(self, line):
        return line.strip() == self.end_marker

    def is_comment(self, line):
        return line.lstrip().startswith(self.prefix)


HEADER_RULES = (
    HeaderRule('//', SLASH_EXTENSIONS),
    HeaderRule('#', HASH_EXTENSIONS),
    HeaderRule('REM', REM_EXTENSIONS),
    HeaderRule('<!--', HTML_COMMENT_EXTENSIONS, ' -->'),
)
RULE_BY_EXTENSION = {extension: rule for rule in HEADER_RULES for extension in rule.extensions}


def rule_for(path):
    return RULE_BY_EXTENSION.get(os.path.splitext(path)[1].lower())


def is_excluded_dir(path):
    return os.path.normcase(os.path.realpath(path)) in EXCLUDED_DIRS


def is_skipped_dir(path, name):
    if name in SKIP_DIRS or is_excluded_dir(path) or os.path.islink(path):
        return True
    return hasattr(os.path, 'isjunction') and os.path.isjunction(path)


def iter_code_files(root):
    for current, dirs, files in os.walk(root):
        if is_excluded_dir(current):
            dirs[:] = []
            continue
        dirs[:] = sorted(name for name in dirs if not is_skipped_dir(os.path.join(current, name), name))
        for name in sorted(files):
            path = os.path.join(current, name)
            if rule_for(path) and not os.path.islink(path):
                yield path


def read_bytes(path):
    with open(path, 'rb') as handle:
        return handle.read()


def detect_encoding(data):
    for bom, encoding in ENCODING_BOMS:
        if data.startswith(bom):
            return bom, encoding
    return b'', DEFAULT_ENCODING


def decode_lines(data):
    bom, encoding = detect_encoding(data)
    lines = io.StringIO(data[len(bom):].decode(encoding), newline='').readlines()
    return bom, encoding, lines


def encode_lines(bom, encoding, lines):
    return bom + ''.join(lines).encode(encoding)


def find_block_end(lines, start, rule):
    for end in range(start + 1, len(lines)):
        if rule.is_end(lines[end]):
            return end
        if not rule.is_comment(lines[end]):
            break
    return -1


def find_blocks(lines, rule):
    blocks = []
    malformed = []
    index = 0
    while index < len(lines):
        end = find_block_end(lines, index, rule) if rule.is_start(lines[index]) else None
        if end is None:
            index += 1
        elif end < 0:
            malformed.append(index)
            index += 1
        else:
            blocks.append((index, end))
            index = end + 1
    return blocks, malformed


def block_status(lines, rule):
    blocks, malformed = find_blocks(lines, rule)
    if blocks:
        return HEADER_VALID
    return HEADER_INVALID if malformed else HEADER_NONE


def classify_file(path, include_protected=False):
    try:
        data = read_bytes(path)
    except OSError:
        return HEADER_UNREADABLE
    try:
        lines = decode_lines(data)[2]
    except UnicodeDecodeError:
        encoding = detect_encoding(data)[1]
        markers = {RULES_MARKER_TEXT.encode(DEFAULT_ENCODING), RULES_MARKER_TEXT.encode(encoding)}
        return HEADER_UNREADABLE if any(marker in data for marker in markers) else HEADER_NONE
    status = block_status(lines, rule_for(path))
    if status == HEADER_VALID and not include_protected and PROTECTED_NAME_MARK in os.path.basename(path).upper():
        return HEADER_PROTECTED
    return status


def scan_headers(root, include_protected=False):
    scanned = 0
    results = {status: [] for status in REPORTED_STATUSES}
    for path in iter_code_files(root):
        scanned += 1
        status = classify_file(path, include_protected)
        if status in results:
            results[status].append(path)
    return scanned, results
