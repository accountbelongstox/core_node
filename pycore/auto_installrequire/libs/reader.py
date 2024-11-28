import os
import json
from typing import Optional, Dict, List, Any, Tuple
from pathlib import Path
import pysrt  # For subtitle reading
from .printer import Printer as cp
from datetime import datetime

class FileReader:
    """Universal file reader with encoding detection and various formats support"""
    
    # Comprehensive list of encodings to try
    ENCODINGS = [
        "utf-8",
        "utf-16",
        "utf-16le",
        "utf-16BE",
        "gbk",
        "gb2312",
        "us-ascii",
        "ascii",
        "IBM037",
        "IBM437",
        "IBM500",
        "ASMO-708",
        "DOS-720",
        "ibm737",
        "ibm775",
        "ibm850",
        "ibm852",
        "IBM855",
        "ibm857",
        "IBM00858",
        "IBM860",
        "ibm861",
        "DOS-862",
        "IBM863",
        "IBM864",
        "IBM865",
        "cp866",
        "ibm869",
        "IBM870",
        "windows-874",
        "cp875",
        "shift_jis",
        "ks_c_5601-1987",
        "big5",
        "IBM1026",
        "IBM01047",
        "IBM01140",
        "IBM01141",
        "IBM01142",
        "IBM01143",
        "IBM01144",
        "IBM01145",
        "IBM01146",
        "IBM01147",
        "IBM01148",
        "IBM01149",
        "windows-1250",
        "windows-1251",
        "Windows-1252",
        "windows-1253",
        "windows-1254",
        "windows-1255",
        "windows-1256",
        "windows-1257",
        "windows-1258",
        "Johab",
        "macintosh",
        "x-mac-japanese",
        "x-mac-chinesetrad",
        "x-mac-korean",
        "x-mac-arabic",
        "x-mac-hebrew",
        "x-mac-greek",
        "x-mac-cyrillic",
        "x-mac-chinesesimp",
        "x-mac-romanian",
        "x-mac-ukrainian",
        "x-mac-thai",
        "x-mac-ce",
        "x-mac-icelandic",
        "x-mac-turkish",
        "x-mac-croatian",
        "utf-32",
        "utf-32BE",
        "x-Chinese-CNS",
        "x-cp20001",
        "x-Chinese-Eten",
        "x-cp20003",
        "x-cp20004",
        "x-cp20005",
        "x-IA5",
        "x-IA5-German",
        "x-IA5-Swedish",
        "x-IA5-Norwegian",
        "x-cp20261",
        "x-cp20269",
        "IBM273",
        "IBM277",
        "IBM278",
        "IBM280",
        "IBM284",
        "IBM285",
        "IBM290",
        "IBM297",
        "IBM420",
        "IBM423",
        "IBM424",
        "x-EBCDIC-KoreanExtended",
        "IBM-Thai",
        "koi8-r",
        "IBM871",
        "IBM880",
        "IBM905",
        "IBM00924",
        "EUC-JP",
        "x-cp20936",
        "x-cp20949",
        "cp1025",
        "koi8-u",
        "iso-8859-1",
        "iso-8859-2",
        "iso-8859-3",
        "iso-8859-4",
        "iso-8859-5",
        "iso-8859-6",
        "iso-8859-7",
        "iso-8859-8",
        "iso-8859-9",
        "iso-8859-13",
        "iso-8859-15",
        "x-Europa",
        "iso-8859-8-i",
        "iso-2022-jp",
        "csISO2022JP",
        "iso-2022-kr",
        "x-cp50227",
        "euc-jp",
        "EUC-CN",
        "euc-kr",
        "hz-gb-2312",
        "GB18030",
        "x-iscii-de",
        "x-iscii-be",
        "x-iscii-ta",
        "x-iscii-te",
        "x-iscii-as",
        "x-iscii-or",
        "x-iscii-ka",
        "x-iscii-ma",
        "x-iscii-gu",
        "x-iscii-pa",
        "utf-7"
    ]
    
    def __init__(self, preferred_encoding: str = None):
        """Initialize with optional preferred encoding"""
        self.preferred_encoding = preferred_encoding
    
    def read_file(self, file_path: str, encoding: str = None, verbose: bool = False) -> Dict[str, Any]:
        """
        Read file with automatic encoding detection
        Returns dict with encoding, content and filename
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        encodings_to_try = [encoding] if encoding else []
        if self.preferred_encoding:
            encodings_to_try.append(self.preferred_encoding)
        encodings_to_try.extend(self.ENCODINGS)
        
        last_error = None
        for enc in encodings_to_try:
            try:
                with open(file_path, 'r', encoding=enc) as f:
                    content = f.read()
                    if verbose:
                        cp.success(f"Successfully read {file_path} using {enc} encoding")
                    return {
                        "encoding": enc,
                        "content": content,
                        "file_path": file_path
                    }
            except UnicodeDecodeError as e:
                if verbose:
                    cp.warning(f"Failed to read with {enc} encoding: {str(e)}")
                last_error = e
                continue
                
        raise UnicodeDecodeError(f"Failed to read {file_path} with any supported encoding: {str(last_error)}")
    
    def detect_encoding(self, file_path: str, preferred_encoding: str = None) -> Optional[str]:
        """Detect file encoding"""
        try:
            result = self.read_file(file_path, preferred_encoding)
            return result["encoding"]
        except Exception:
            return None
    
    def read_with_encoding(self, file_path: str, encoding: str) -> Optional[str]:
        """Read file with specific encoding"""
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                return f.read()
        except Exception as e:
            cp.error(f"Error reading file with {encoding} encoding: {str(e)}")
            return None
    
    def read_json(self, file_path: str, encoding: str = None) -> Dict:
        """Read and parse JSON file"""
        try:
            result = self.read_file(file_path, encoding)
            return json.loads(result["content"])
        except Exception as e:
            cp.warning(f"Failed to parse {file_path} as JSON: {str(e)}")
            return {}
    
    def read_lines(self, file_path: str, encoding: str = None, 
                  skip_empty: bool = True, trim: bool = True) -> List[str]:
        """Read file lines with options"""
        try:
            result = self.read_file(file_path, encoding)
            lines = result["content"].split('\n')
            
            if trim:
                lines = [line.strip() for line in lines]
            if skip_empty:
                lines = [line for line in lines if line]
                
            return lines
        except Exception as e:
            cp.warning(f"Failed to read lines from {file_path}: {str(e)}")
            return []
    
    def read_key_value(self, file_path: str, encoding: str = None, 
                      delimiter: str = '=', skip_comments: bool = True) -> Dict[str, str]:
        """Read key-value pairs from file"""
        result = {}
        try:
            lines = self.read_lines(file_path, encoding, True, True)
            
            for line in lines:
                if skip_comments and line.startswith('#'):
                    continue
                    
                try:
                    parts = line.split(delimiter, 1)
                    if len(parts) >= 2:
                        key = parts[0].strip()
                        if not key:
                            continue
                        value = parts[1].strip()
                        result[key] = value
                except Exception as e:
                    cp.warning(f"Skipping malformed line: {line}")
                    continue
                    
        except Exception as e:
            cp.warning(f"Failed to read key-value pairs from {file_path}: {str(e)}")
            
        return result
    
    def save_json(self, file_path: str, data: Any, pretty: bool = True, 
                 encoding: str = 'utf-8') -> bool:
        """Save data as JSON file"""
        try:
            content = json.dumps(data, indent=2 if pretty else None, 
                               ensure_ascii=False)
            return self.save_file(file_path, content, encoding)
        except Exception as e:
            cp.error(f"Failed to save JSON to {file_path}: {str(e)}")
            return False
    
    def save_file(self, file_path: str, content: str, encoding: str = 'utf-8') -> bool:
        """Save content to file"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            with open(file_path, 'w', encoding=encoding) as f:
                f.write(content)
            return True
        except Exception as e:
            cp.error(f"Failed to save file {file_path}: {str(e)}")
            return False
    
    def append_file(self, file_path: str, content: str, 
                   add_newline: bool = True, encoding: str = 'utf-8') -> bool:
        """Append content to file"""
        try:
            if not os.path.exists(file_path):
                return self.save_file(file_path, content, encoding)
            
            with open(file_path, 'a', encoding=encoding) as f:
                if add_newline:
                    f.write(f"\n{content}")
                else:
                    f.write(content)
            return True
        except Exception as e:
            cp.error(f"Failed to append to file {file_path}: {str(e)}")
            return False
    

# Create default instance
file_reader = FileReader() 