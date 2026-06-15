#!/usr/bin/env python3
"""
.env file reader — provides reliable key=value parsing for shell scripts.

Usage from bash/sh:
    DB_TYPE=$(python3 scripts/pytools/env_reader.py /path/to/.env DB_TYPE mysql)

    Arguments:
      1: .env file path
      2: key name
      3: default value (optional, defaults to empty string)

Usage from Python:
    from env_reader import read_env, get_env_value
    env = read_env("/path/to/.env")
    db_type = get_env_value(env, "DB_TYPE", "sqlite")
"""

import os
import sys


def read_env(filepath):
    """Parse a .env file into a dict. Handles comments, quotes, whitespace."""
    result = {}
    if not os.path.isfile(filepath):
        return result
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith("#"):
                continue
            eq = line.find("=")
            if eq <= 0:
                continue
            key = line[:eq].strip()
            val = line[eq + 1:]
            # Remove inline comments (not inside quotes)
            if "#" in val:
                # Simple: if value starts with quote, find closing quote first
                if val.strip().startswith(("'", '"')):
                    quote = val.strip()[0]
                    end = val.find(quote, val.find(quote) + 1)
                    if end > 0:
                        val = val[:end + 1]
                else:
                    val = val.split("#")[0]
            # Strip whitespace and quotes
            val = val.strip().strip("'\"")
            result[key] = val
    return result


def get_env_value(env_dict, key, default=""):
    """Get a value from parsed env dict with fallback."""
    return env_dict.get(key, default) or default


def main():
    """CLI: read a single key from a .env file."""
    if len(sys.argv) < 3:
        print("Usage: env_reader.py <env_file> <key> [default]", file=sys.stderr)
        sys.exit(1)

    env_file = sys.argv[1]
    key = sys.argv[2]
    default = sys.argv[3] if len(sys.argv) > 3 else ""

    env = read_env(env_file)
    value = get_env_value(env, key, default)
    # Output value to stdout (for shell capture)
    print(value)


if __name__ == "__main__":
    main()
