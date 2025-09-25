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

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTML Cleaner Module
A modular HTML cleaning utility that can be called from Python and other languages.

This module provides comprehensive HTML cleaning functionality including:
- HTML structure simplification
- Attribute removal
- Tag removal
- Content cleaning
- Encoding detection and conversion
- Minification

Usage:
    from html_cleaner import HTMLCleaner
    
    cleaner = HTMLCleaner()
    cleaned_content = cleaner.clean_html(html_content)
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Optional, Any, Union
import minify_html
from bs4 import BeautifulSoup

class HTMLCleaner:
    """Modular HTML cleaner class"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize HTML cleaner with configuration
        
        Args:
            config: Optional configuration dictionary
        """
        self.config = config or self._get_default_config()
        self._init_rules()
        self._init_file_codings()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default configuration"""
        return {
            'minify': True,
            'remove_comments': True,
            'remove_empty_tags': True,
            'preserve_links': True,
            'convert_to_utf8': True,
            'remove_footers': True,
            'simplify_structure': True
        }
    
    def _init_rules(self):
        """Initialize cleaning rules"""
        self.rules = {
            'rule1': {
                'pattern': re.compile(r'href="javascript[^"]*location=([^"]+)"', re.DOTALL),
                'description': 'JavaScript href with location parameter',
                'replacement': 'href="{0}"',
                'trim': True
            },
            'rule2': {
                'pattern': re.compile(r'tppabs="[^"]*"'),
                'description': 'Remove tppabs attribute',
                'replacement': ''
            }
        }
        
        self.bs4_rules = {
            'remove_tags': [
                'svg', 'style', 'script', 'link', 'meta', 'noscript', 'iframe', 'embed', 'object',
                'applet', 'base', 'basefont', 'bgsound', 'frame', 'frameset', 'noframes',
                'marquee', 'blink', 'isindex', 'listing', 'plaintext', 'xmp', 'nextid',
                'acronym', 'big', 'center', 'dir', 'font', 'strike', 'tt', 'u',
                'select', 'option', 'optgroup', 'input', 'textarea', 'button', 'fieldset', 'legend',
                'form', 'label', 'datalist', 'output', 'progress', 'meter',
                'details', 'summary', 'dialog', 'menu', 'menuitem',
                'canvas', 'audio', 'video', 'track', 'source', 'picture', 'img'
            ],
            'remove_attrs': [
                'style', 'class', 'id', 'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
                'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset', 'onselect', 'onunload',
                'onkeydown', 'onkeyup', 'onkeypress', 'onabort', 'onbeforeunload', 'onerror',
                'onhashchange', 'onmessage', 'onoffline', 'ononline', 'onpagehide', 'onpageshow',
                'onpopstate', 'onresize', 'onstorage', 'oncontextmenu', 'oninput', 'oninvalid',
                'onsearch', 'onbeforeprint', 'onafterprint', 'onbeforeinstallprompt',
                'data-*', 'aria-*', 'role', 'tabindex', 'accesskey', 'title',
                'type', 'value', 'name', 'placeholder', 'required', 'disabled', 'readonly',
                'maxlength', 'minlength', 'pattern', 'autocomplete', 'autofocus', 'form',
                'formaction', 'formenctype', 'formmethod', 'formnovalidate', 'formtarget',
                'list', 'max', 'min', 'step', 'multiple', 'selected', 'checked', 'size'
            ],
            'remove_comments': True,
            'remove_doctype': False,
            'remove_empty_tags': True,
            'preserve_links': True
        }
    
    def _init_file_codings(self):
        """Initialize file encoding list"""
        self.file_codings = [
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
            "x-mac-thai", "x-mac-ce", "x-mac-icelandic", "x-mac-turkish", "x-mac-croatian",
            "utf-32", "utf-32BE", "x-Chinese-CNS", "x-cp20001", "x-Chinese-Eten", "x-cp20003",
            "x-cp20004", "x-cp20005", "x-IA5", "x-IA5-German", "x-IA5-Swedish", "x-IA5-Norwegian",
            "x-cp20261", "x-cp20269", "IBM273", "IBM277", "IBM278", "IBM280", "IBM284", "IBM285",
            "IBM290", "IBM297", "IBM420", "IBM423", "IBM424", "x-EBCDIC-KoreanExtended", "IBM-Thai",
            "koi8-r", "IBM871", "IBM880", "IBM905", "IBM00924", "EUC-JP", "x-cp20936", "x-cp20949",
            "cp1025", "koi8-u", "iso-8859-1", "iso-8859-2", "iso-8859-3", "iso-8859-4", "iso-8859-5",
            "iso-8859-6", "iso-8859-7", "iso-8859-8", "iso-8859-9", "iso-8859-13", "iso-8859-15",
            "x-Europa", "iso-8859-8-i", "iso-2022-jp", "csISO2022JP", "iso-2022-jp", "iso-2022-kr",
            "x-cp50227", "euc-jp", "EUC-CN", "euc-kr", "hz-gb-2312", "GB18030", "x-iscii-de",
            "x-iscii-be", "x-iscii-ta", "x-iscii-te", "x-iscii-as", "x-iscii-or", "x-iscii-ka",
            "x-iscii-ma", "x-iscii-gu", "x-iscii-pa", "utf-7"
        ]
    
    def has_html_markers(self, content: str) -> bool:
        """Check if content contains HTML structure"""
        try:
            soup = BeautifulSoup(content, 'html.parser')
            return soup.find() is not None
        except Exception:
            return False
    
    def clean_html_with_bs4(self, content: str) -> str:
        """Clean HTML using BeautifulSoup"""
        try:
            soup = BeautifulSoup(content, 'html.parser')
            
            # Remove comments
            if self.bs4_rules['remove_comments']:
                for comment in soup.find_all(string=lambda text: isinstance(text, str) and text.strip().startswith('<!--')):
                    comment.extract()
            
            # Remove specified tags
            for tag_name in self.bs4_rules['remove_tags']:
                for tag in soup.find_all(tag_name):
                    tag.decompose()
            
            # Remove specified attributes
            for tag in soup.find_all():
                if tag.attrs:
                    attrs_to_remove = []
                    for attr in tag.attrs:
                        should_remove = False
                        
                        # Check exact match
                        if attr in self.bs4_rules['remove_attrs']:
                            should_remove = True
                        # Check wildcard patterns
                        elif any(attr.startswith(pattern.replace('*', '')) for pattern in self.bs4_rules['remove_attrs'] if '*' in pattern):
                            should_remove = True
                        
                        # Preserve href for navigation if specified
                        if self.bs4_rules['preserve_links'] and attr == 'href':
                            should_remove = False
                        
                        if should_remove:
                            attrs_to_remove.append(attr)
                    
                    for attr in attrs_to_remove:
                        del tag[attr]
            
            # Remove empty tags
            if self.bs4_rules['remove_empty_tags']:
                for tag in soup.find_all():
                    if tag.name and not tag.get_text(strip=True) and not tag.find_all():
                        tag.decompose()
            
            # Apply additional cleaning if enabled
            if self.config.get('remove_footers', True):
                self._remove_smart_footer(soup)
            
            if self.config.get('simplify_structure', True):
                self._simplify_html_structure(soup)
            
            return str(soup)
        except Exception as e:
            print(f"BeautifulSoup cleaning failed: {e}")
            return content
    
    def _remove_smart_footer(self, soup):
        """Intelligently remove footer sections"""
        try:
            copyright_elements = soup.find_all(string=lambda text: text and '©' in text and any(str(year) in text for year in range(2000, 2030)))
            
            for element in copyright_elements:
                parent = element.parent
                if not parent:
                    continue
                
                body = soup.find('body')
                if not body:
                    continue
                
                footer_container = parent
                while footer_container and footer_container.parent != body:
                    footer_container = footer_container.parent
                
                if not footer_container or footer_container.parent != body:
                    continue
                
                body_children = [child for child in body.children if child.name and child.name not in ['script', 'style', 'link', 'meta', 'noscript']]
                
                if len(body_children) > 1 and footer_container == body_children[-1]:
                    footer_container.decompose()
                elif len(body_children) == 1:
                    continue
                else:
                    footer_text = footer_container.get_text().lower()
                    footer_keywords = ['copyright', 'footer', '©', 'all rights reserved', 'privacy policy', 'terms of service']
                    
                    if any(keyword in footer_text for keyword in footer_keywords):
                        footer_position = body_children.index(footer_container)
                        if footer_position > len(body_children) // 2:
                            footer_container.decompose()
        except Exception as e:
            print(f"Smart footer removal failed: {e}")
    
    def _simplify_html_structure(self, soup):
        """Simplify HTML structure"""
        try:
            unwrap_tags = [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'div', 'span', 'section', 'article', 'aside', 'header', 'footer',
                'strong', 'b', 'em', 'i', 'u', 'mark', 'small', 'sub', 'sup',
                'blockquote', 'cite', 'kbd', 'samp', 'var',
                'abbr', 'acronym', 'dfn', 'time', 'address', 'del', 'ins', 's', 'strike', 'big', 'tt', 'pre'
            ]
            
            preserve_tags = ['a', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'code', 'p']
            
            for tag_name in unwrap_tags:
                for tag in soup.find_all(tag_name):
                    if tag.find(preserve_tags):
                        continue
                    tag.unwrap()
            
            body = soup.find('body')
            if body:
                for a_tag in body.find_all('a', recursive=False):
                    href = a_tag.get('href', '')
                    text = a_tag.get_text(strip=True)
                    
                    if (href.startswith('#') or 
                        href.startswith('javascript:') or 
                        text.lower() in ['home', 'back', 'next', 'previous', 'top', 'menu', 'navigation'] or
                        len(text) < 5):
                        a_tag.decompose()
                    else:
                        if not a_tag.find_all():
                            a_tag.unwrap()
        except Exception as e:
            print(f"HTML structure simplification failed: {e}")
    
    def apply_regex_rules(self, content: str) -> tuple[str, Dict[str, int]]:
        """Apply regex-based cleaning rules"""
        stats = defaultdict(int)
        modified_content = content
        
        for rule_name, rule in self.rules.items():
            matches = rule['pattern'].finditer(modified_content)
            replacements = []
            
            for match in matches:
                full_match = match.group(0)
                
                if rule['replacement'] == '':
                    replacement = ''
                elif '{0}' in rule['replacement']:
                    url = match.group(1)
                    if rule.get('trim', False):
                        url = url.strip().strip('"\'')
                    replacement = rule['replacement'].format(url)
                else:
                    replacement = rule['replacement']
                
                replacements.append((full_match, replacement))
            
            if replacements:
                for old, new in replacements:
                    modified_content = modified_content.replace(old, new)
                stats[rule_name] += len(replacements)
        
        return modified_content, stats
    
    def minify_html(self, content: str) -> str:
        """Minify HTML content"""
        try:
            return minify_html.minify(
                content,
                allow_noncompliant_unquoted_attribute_values=True,
                allow_optimal_entities=False,
                allow_removing_spaces_between_attributes=True,
                keep_closing_tags=False,
                keep_comments=False,
                keep_html_and_head_opening_tags=False,
                keep_input_type_text_attr=False,
                keep_ssi_comments=False,
                minify_css=True,
                minify_doctype=True,
                minify_js=True,
                preserve_brace_template_syntax=False,
                preserve_chevron_percent_template_syntax=False,
                remove_bangs=True,
                remove_processing_instructions=True
            )
        except Exception as e:
            print(f"HTML minification failed: {e}")
            return content
    
    def detect_encoding(self, file_path: str) -> Optional[str]:
        """Detect file encoding"""
        for encoding in self.file_codings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    content = f.read()
                if self.has_html_markers(content):
                    return encoding
            except Exception:
                continue
        return None
    
    def read_file(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Read file with automatic encoding detection"""
        if not os.path.isfile(file_path):
            return None
        
        encoding = self.detect_encoding(file_path)
        if not encoding:
            return None
        
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                content = f.read()
            return {
                'content': content,
                'encoding': encoding,
                'file_path': file_path
            }
        except Exception as e:
            print(f"Error reading file {file_path}: {e}")
            return None
    
    def write_file(self, file_path: str, content: str, encoding: str = 'utf-8') -> bool:
        """Write file with specified encoding"""
        try:
            with open(file_path, 'w', encoding=encoding) as f:
                f.write(content)
            return True
        except Exception as e:
            print(f"Error writing file {file_path}: {e}")
            return False
    
    def clean_html(self, content: str) -> Dict[str, Any]:
        """
        Clean HTML content
        
        Args:
            content: HTML content to clean
            
        Returns:
            Dictionary with cleaned content and statistics
        """
        original_size = len(content)
        stats = {
            'original_size': original_size,
            'replacements': defaultdict(int),
            'cleaned_size': 0,
            'minified_size': 0
        }
        
        # Apply regex rules
        content, rule_stats = self.apply_regex_rules(content)
        stats['replacements'].update(rule_stats)
        
        # Apply BeautifulSoup cleaning
        content = self.clean_html_with_bs4(content)
        stats['cleaned_size'] = len(content)
        
        # Minify if enabled
        if self.config.get('minify', True):
            content = self.minify_html(content)
            stats['minified_size'] = len(content)
        else:
            stats['minified_size'] = stats['cleaned_size']
        
        return {
            'content': content,
            'stats': stats
        }
    
    def clean_file(self, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Clean HTML file
        
        Args:
            file_path: Path to HTML file
            
        Returns:
            Dictionary with results and statistics
        """
        # Read file
        file_data = self.read_file(file_path)
        if not file_data:
            return None
        
        # Clean content
        result = self.clean_html(file_data['content'])
        
        # Write back if modified
        if result['stats']['minified_size'] != result['stats']['original_size']:
            success = self.write_file(file_path, result['content'])
            if not success:
                return None
        
        return {
            'file_path': file_path,
            'original_encoding': file_data['encoding'],
            'cleaned_content': result['content'],
            'stats': result['stats']
        }
    
    def clean_directory(self, directory_path: str, file_pattern: str = '*.html') -> Dict[str, Any]:
        """
        Clean all HTML files in a directory
        
        Args:
            directory_path: Directory to process
            file_pattern: File pattern to match
            
        Returns:
            Dictionary with processing results
        """
        results = {
            'files_processed': 0,
            'files_cleaned': 0,
            'total_size_reduction': 0,
            'file_results': []
        }
        
        directory = Path(directory_path)
        if not directory.exists():
            return results
        
        for file_path in directory.rglob(file_pattern):
            result = self.clean_file(str(file_path))
            if result:
                results['files_processed'] += 1
                size_reduction = result['stats']['original_size'] - result['stats']['minified_size']
                if size_reduction > 0:
                    results['files_cleaned'] += 1
                    results['total_size_reduction'] += size_reduction
                results['file_results'].append(result)
        
        return results

def create_cleaner(config: Optional[Dict[str, Any]] = None) -> HTMLCleaner:
    """Factory function to create HTML cleaner instance"""
    return HTMLCleaner(config)

def main():
    """Command line interface with hardcoded parameters"""
    import sys
    import json
    
    # Hardcoded configuration
    config = {
        'minify': True,
        'remove_comments': True,
        'remove_empty_tags': True,
        'preserve_links': True,
        'convert_to_utf8': True,
        'remove_footers': True,
        'simplify_structure': True
    }
    
    # Hardcoded parameters
    mode = 'directory'  # Options: 'content', 'file', 'directory'
    file_path = ''  # For file mode
    directory_path = '.'  # Current directory for directory mode
    file_pattern = '*.html'  # File pattern for directory mode
    
    cleaner = HTMLCleaner(config)
    
    try:
        if mode == 'content':
            # Read content from stdin
            content = sys.stdin.read()
            result = cleaner.clean_html(content)
            print(json.dumps(result))
            
        elif mode == 'file':
            if not file_path:
                print("Error: File path not configured", file=sys.stderr)
                sys.exit(1)
            result = cleaner.clean_file(file_path)
            if result:
                print(json.dumps(result))
            else:
                print("Error: Failed to clean file", file=sys.stderr)
                sys.exit(1)
                
        elif mode == 'directory':
            if not directory_path:
                print("Error: Directory path not configured", file=sys.stderr)
                sys.exit(1)
            result = cleaner.clean_directory(directory_path, file_pattern)
            print(json.dumps(result))
            
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

# Export for use as module
__all__ = ['HTMLCleaner', 'create_cleaner']

if __name__ == '__main__':
    main() 