# -*- coding: utf-8 -*-
"""Compatibility facade for the foundation-level isolated venv manager."""

from pycore.pyfoundations.isolated_venv import ensure_venv, resolve_python, venv_dir, venv_ready


__all__ = ["ensure_venv", "resolve_python", "venv_dir", "venv_ready"]
