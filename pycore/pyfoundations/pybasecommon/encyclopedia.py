#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Encyclopedia Database
A simple key-value dictionary database that can store and query any data
"""

from typing import Any, Dict, List, Optional
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class Encyclopedia:
    """Simple dictionary-based encyclopedia for storing and querying data"""

    def __init__(self):
        """Initialize encyclopedia database"""
        self._data: Dict[str, Any] = {}

    def add(self, key: str, value: Any) -> None:
        """
        Add or update an entry in the encyclopedia

        Args:
            key: Key for the entry
            value: Value to store
        """
        self._data[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get an entry from the encyclopedia

        Args:
            key: Key to look up
            default: Default value if key not found

        Returns:
            Value associated with key, or default if not found
        """
        return self._data.get(key, default)

    def query(self, key: str) -> Any:
        """
        Query an entry (alias for get)

        Args:
            key: Key to look up

        Returns:
            Value associated with key, or None if not found
        """
        return self._data.get(key)

    def has(self, key: str) -> bool:
        """
        Check if key exists in encyclopedia

        Args:
            key: Key to check

        Returns:
            True if key exists, False otherwise
        """
        return key in self._data

    def remove(self, key: str) -> bool:
        """
        Remove an entry from the encyclopedia

        Args:
            key: Key to remove

        Returns:
            True if key was removed, False if key didn't exist
        """
        if key in self._data:
            del self._data[key]
            return True
        return False

    def clear(self) -> None:
        """Clear all entries from the encyclopedia"""
        self._data.clear()

    def keys(self) -> List[str]:
        """
        Get all keys in the encyclopedia

        Returns:
            List of all keys
        """
        return list(self._data.keys())

    def values(self) -> List[Any]:
        """
        Get all values in the encyclopedia

        Returns:
            List of all values
        """
        return list(self._data.values())

    def items(self) -> List[tuple]:
        """
        Get all key-value pairs

        Returns:
            List of (key, value) tuples
        """
        return list(self._data.items())

    def export(self) -> Dict[str, Any]:
        """
        Export the entire encyclopedia as a dictionary

        Returns:
            Dictionary containing all data
        """
        return self._data.copy()

    def export_list(self) -> List[Dict[str, Any]]:
        """
        Export the encyclopedia as a list of dictionaries
        Each entry is converted to {"key": key, "value": value}

        Returns:
            List of dictionaries
        """
        return [{"key": k, "value": v} for k, v in self._data.items()]

    def import_dict(self, data: Dict[str, Any], merge: bool = False) -> None:
        """
        Import data from a dictionary

        Args:
            data: Dictionary to import
            merge: If True, merge with existing data. If False, replace all data
        """
        if merge:
            self._data.update(data)
        else:
            self._data = data.copy()

    def import_list(self, data: List[Dict[str, Any]], merge: bool = False) -> None:
        """
        Import data from a list of dictionaries
        Each entry should have "key" and "value" fields

        Args:
            data: List of dictionaries to import
            merge: If True, merge with existing data. If False, replace all data
        """
        if not merge:
            self._data.clear()

        for item in data:
            if isinstance(item, dict) and "key" in item and "value" in item:
                self._data[item["key"]] = item["value"]

    def search(self, keyword: str, case_sensitive: bool = False) -> List[str]:
        """
        Search for keys containing the keyword

        Args:
            keyword: Keyword to search for
            case_sensitive: Whether to perform case-sensitive search

        Returns:
            List of matching keys
        """
        if case_sensitive:
            return [k for k in self._data.keys() if keyword in k]
        else:
            keyword_lower = keyword.lower()
            return [k for k in self._data.keys() if keyword_lower in k.lower()]

    def filter_by_value(self, value: Any) -> List[str]:
        """
        Find all keys that have the specified value

        Args:
            value: Value to search for

        Returns:
            List of keys with matching value
        """
        return [k for k, v in self._data.items() if v == value]

    def count(self) -> int:
        """
        Get the number of entries in the encyclopedia

        Returns:
            Number of entries
        """
        return len(self._data)

    def __len__(self) -> int:
        """Return the number of entries"""
        return len(self._data)

    def __contains__(self, key: str) -> bool:
        """Check if key exists using 'in' operator"""
        return key in self._data

    def __getitem__(self, key: str) -> Any:
        """Get item using [] operator"""
        return self._data[key]

    def __setitem__(self, key: str, value: Any) -> None:
        """Set item using [] operator"""
        self._data[key] = value

    def __repr__(self) -> str:
        """String representation of the encyclopedia"""
        return f"Encyclopedia({len(self._data)} entries)"


# Global instance for convenient access
ENCYCLOPEDIA = Encyclopedia()


def main():
    """Test function for Encyclopedia"""
    # Test basic operations
    enc = Encyclopedia()

    # Add entries
    enc.add("python", "A programming language")
    enc.add("java", "Another programming language")
    enc["javascript"] = "A scripting language"

    # Query entries
    ColorPrint.plain(f"Python: {enc.get('python')}")
    ColorPrint.plain(f"Java: {enc.query('java')}")
    ColorPrint.plain(f"JavaScript: {enc['javascript']}")

    # Check existence
    ColorPrint.plain(f"Has Python: {enc.has('python')}")
    ColorPrint.plain(f"Has C++: {enc.has('c++')}")

    # Search
    ColorPrint.plain(f"Keys with 'java': {enc.search('java')}")

    # Export
    ColorPrint.plain(f"Export dict: {enc.export()}")
    ColorPrint.plain(f"Export list: {enc.export_list()}")

    # Statistics
    ColorPrint.plain(f"Total entries: {enc.count()}")
    ColorPrint.plain(f"Length: {len(enc)}")

    ColorPrint.plain(f"\nEncyclopedia: {enc}")


if __name__ == "__main__":
    main()

def get_gpu_info():
    """Return cached GPU information without initializing unrelated features."""
    return ENCYCLOPEDIA.get("pycore_gpu_info")

