#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import threading
from typing import Optional, List, Dict, Any, Tuple

DEFAULT_ENCODINGS = [
    "utf-8", "utf-16", "utf-16le", "utf-16BE", "gbk", "gb2312", "us-ascii", "ascii",
    "IBM037", "IBM437", "IBM500", "ASMO-708", "DOS-720", "ibm737", "ibm775", "ibm850",
    "ibm852", "IBM855", "ibm857", "IBM00858", "IBM860", "ibm861", "DOS-862", "IBM863",
    "IBM864", "IBM865", "cp866", "ibm869", "IBM870", "windows-874", "cp875", "shift_jis",
    "ks_c_5601-1987", "big5", "IBM1026", "IBM01047", "IBM01140", "IBM01141", "IBM01142",
    "IBM01143", "IBM01144", "IBM01145", "IBM01146", "IBM01147", "IBM01148", "IBM01149",
    "windows-1250", "windows-1251", "Windows-1252", "windows-1253", "windows-1254",
    "windows-1255", "windows-1256", "windows-1257", "windows-1258", "Johab", "macintosh",
    "x-mac-japanese", "x-mac-chinesetrad", "x-mac-korean", "x-mac-arabic", "x-mac-hebrew",
    "x-mac-greek", "x-mac-cyrillic", "x-mac-chinesesimp", "x-mac-romanian", "x-mac-ukrainian",
    "x-mac-thai", "x-mac-ce", "x-mac-icelandic", "x-mac-turkish", "x-mac-croatian", "utf-32",
    "utf-32BE", "x-Chinese-CNS", "x-cp20001", "x-Chinese-Eten", "x-cp20003", "x-cp20004",
    "x-cp20005", "x-IA5", "x-IA5-German", "x-IA5-Swedish", "x-IA5-Norwegian", "x-cp20261",
    "x-cp20269", "IBM273", "IBM277", "IBM278", "IBM280", "IBM284", "IBM285", "IBM290",
    "IBM297", "IBM420", "IBM423", "IBM424", "x-EBCDIC-KoreanExtended", "IBM-Thai", "koi8-r",
    "IBM871", "IBM880", "IBM905", "IBM00924", "EUC-JP", "x-cp20936", "x-cp20949", "cp1025",
    "koi8-u", "iso-8859-1", "iso-8859-2", "iso-8859-3", "iso-8859-4", "iso-8859-5",
    "iso-8859-6", "iso-8859-7", "iso-8859-8", "iso-8859-9", "iso-8859-13", "iso-8859-15",
    "x-Europa", "iso-8859-8-i", "iso-2022-jp", "csISO2022JP", "iso-2022-kr", "x-cp50227",
    "euc-jp", "EUC-CN", "euc-kr", "hz-gb-2312", "GB18030", "x-iscii-de", "x-iscii-be",
    "x-iscii-ta", "x-iscii-te", "x-iscii-as", "x-iscii-or", "x-iscii-ka", "x-iscii-ma",
    "x-iscii-gu", "x-iscii-pa", "utf-7"
]

_encoding_cache: Dict[str, str] = {}
_cache_lock = threading.Lock()


def normalize_path(file_path: str) -> str:
    try:
        if not os.path.isabs(file_path):
            file_path = os.path.abspath(file_path)
        normalized = os.path.normpath(file_path)
        if os.name == 'nt':
            normalized = normalized.lower()
        return normalized
    except Exception:
        return file_path


def get_cached_encoding(file_path: str) -> Optional[str]:
    normalized_path = normalize_path(file_path)
    with _cache_lock:
        return _encoding_cache.get(normalized_path)


def set_cached_encoding(file_path: str, encoding: str) -> None:
    normalized_path = normalize_path(file_path)
    with _cache_lock:
        _encoding_cache[normalized_path] = encoding


def detect_encoding(file_path: str) -> str:
    cached_encoding = get_cached_encoding(file_path)
    if cached_encoding:
        return cached_encoding
    
    for encoding in DEFAULT_ENCODINGS:
        try:
            with open(file_path, 'r', encoding=encoding, errors='strict') as f:
                f.read(1024)
            set_cached_encoding(file_path, encoding)
            return encoding
        except (UnicodeDecodeError, LookupError):
            continue
    
    default_encoding = 'utf-8'
    set_cached_encoding(file_path, default_encoding)
    return default_encoding


def read_text(file_path: str) -> str:
    if not os.path.exists(file_path):
        return ''
    encoding = detect_encoding(file_path)
    try:
        with open(file_path, 'r', encoding=encoding, errors='replace') as f:
            return f.read()
    except Exception:
        return ''


def read_lines(file_path: str) -> List[str]:
    content = read_text(file_path)
    return content.splitlines() if content else []


def read_first_line(file_path: str) -> str:
    lines = read_lines(file_path)
    return lines[0] if lines else ''


def read_json(file_path: str) -> Dict[str, Any]:
    content = read_text(file_path)
    if content:
        try:
            return json.loads(content)
        except Exception:
            pass
    return {}


def read_last_n_lines(file_path: str, n: int) -> List[str]:
    if not os.path.exists(file_path):
        return []
    
    encoding = detect_encoding(file_path)
    try:
        with open(file_path, 'rb') as f:
            f.seek(0, 2)
            file_size = f.tell()
            
            lines = []
            buffer = b''
            position = file_size
            
            while position > 0 and len(lines) < n:
                chunk_size = min(8192, position)
                position -= chunk_size
                f.seek(position)
                chunk = f.read(chunk_size)
                
                buffer = chunk + buffer
                temp_lines = buffer.split(b'\n')
                
                if position > 0:
                    buffer = temp_lines[0]
                    temp_lines = temp_lines[1:]
                else:
                    buffer = b''
                
                for line in reversed(temp_lines):
                    if line.strip():
                        lines.insert(0, line.decode(encoding, errors='ignore').rstrip('\r'))
                    if len(lines) >= n:
                        break
            
            return lines[-n:] if len(lines) > n else lines
    except Exception:
        return []


def read_from_position(file_path: str, start_pos: int, max_lines: int = 1000) -> Tuple[List[str], int]:
    if not os.path.exists(file_path):
        return [], start_pos
    
    encoding = detect_encoding(file_path)
    try:
        with open(file_path, 'r', encoding=encoding, errors='ignore') as f:
            f.seek(start_pos)
            lines = []
            line_count = 0
            
            while line_count < max_lines:
                line = f.readline()
                if not line:
                    break
                lines.append(line.rstrip('\n\r'))
                line_count += 1
            
            return lines, f.tell()
    except Exception:
        return [], start_pos


def write_text(file_path: str, content: str) -> bool:
    if os.path.exists(file_path):
        encoding = detect_encoding(file_path)
    else:
        encoding = 'utf-8'
        set_cached_encoding(file_path, encoding)
    
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding=encoding, errors='replace') as f:
            f.write(content)
        return True
    except Exception:
        return False


def write_lines(file_path: str, lines: List[str]) -> bool:
    content = '\n'.join(lines)
    return write_text(file_path, content)


def write_json(file_path: str, data: Dict[str, Any]) -> bool:
    try:
        content = json.dumps(data, ensure_ascii=False, indent=2)
        return write_text(file_path, content)
    except Exception:
        return False


def append_text(file_path: str, content: str) -> bool:
    if os.path.exists(file_path):
        encoding = detect_encoding(file_path)
    else:
        encoding = 'utf-8'
        set_cached_encoding(file_path, encoding)
    
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'a', encoding=encoding, errors='replace') as f:
            f.write(content)
        return True
    except Exception:
        return False


def append_lines(file_path: str, lines: List[str]) -> bool:
    content = '\n'.join(lines) + '\n'
    return append_text(file_path, content)


def get_last_modified_time(file_path: str) -> Optional[float]:
    try:
        if os.path.exists(file_path):
            return os.path.getmtime(file_path)
        return None
    except Exception:
        return None


def is_file(file_path: str) -> bool:
    try:
        return os.path.exists(file_path) and os.path.isfile(file_path)
    except Exception:
        return False


def is_directory(dir_path: str) -> bool:
    try:
        return os.path.exists(dir_path) and os.path.isdir(dir_path)
    except Exception:
        return False


def get_file_size(file_path: str) -> int:
    try:
        return os.path.getsize(file_path)
    except Exception:
        return 0


def clear_encoding_cache() -> None:
    with _cache_lock:
        _encoding_cache.clear()


def get_encoding_cache_info() -> Dict[str, str]:
    with _cache_lock:
        return _encoding_cache.copy()


__all__ = [
    'read_text', 'read_lines', 'read_first_line', 'read_json', 'read_last_n_lines',
    'read_from_position', 'write_text', 'write_lines', 'write_json', 'append_text',
    'append_lines', 'get_last_modified_time', 'is_file', 'is_directory', 'get_file_size',
    'clear_encoding_cache', 'get_encoding_cache_info'
]
