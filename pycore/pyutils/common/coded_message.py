# -*- coding: utf-8 -*-
"""
Stable message codes with parameters, localized by the UI.

A ``CodedMessage`` is the English log rendering of one code. It is a ``str``,
so logs and existing text consumers keep working, and it also carries the code
and its params. ``message_fields`` turns one message into the wire fields
``<name>``, ``<name>_code`` and ``<name>_params``; the UI localizes by code and
falls back to the English text.
"""

from typing import Any, Dict, Mapping, Optional

CODE_FIELD_SUFFIX = "_code"
PARAMS_FIELD_SUFFIX = "_params"


def render_template(code: str, template: Optional[str], params: Mapping[str, Any]) -> str:
    """English rendering of one code (the code itself when it has no template
    or the params do not fit it)."""
    if template is None:
        return code
    try:
        return template.format(**params)
    except (KeyError, IndexError, ValueError):
        return code


class CodedMessage(str):
    """English text that also carries a stable code and its params."""

    code: str
    params: Dict[str, Any]

    def __new__(
        cls,
        code: str,
        params: Optional[Mapping[str, Any]] = None,
        template: Optional[str] = None,
    ) -> "CodedMessage":
        values = dict(params or {})
        instance = super().__new__(cls, render_template(code, template, values))
        instance.code = code
        instance.params = values
        return instance


def message_fields(message: Optional[str], name: str) -> Dict[str, Any]:
    """``{name, name_code, name_params}`` of one message ({} when empty); a plain
    string yields the text field only."""
    if not message:
        return {}
    fields: Dict[str, Any] = {name: str(message)}
    code = getattr(message, "code", "")
    if code:
        fields[f"{name}{CODE_FIELD_SUFFIX}"] = code
        fields[f"{name}{PARAMS_FIELD_SUFFIX}"] = dict(getattr(message, "params", {}) or {})
    return fields


__all__ = ["CodedMessage", "message_fields", "render_template"]
