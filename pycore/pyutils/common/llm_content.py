# -*- coding: utf-8 -*-
"""Robust conversion of LLM/free-tier model text output into JSON objects.

Model responses arrive wrapped in markdown fences, prose, duplicated
objects, python literals, smart quotes, trailing commas, or truncated
mid-string. This module owns the full layered recovery pipeline so every
consumer (article generation, translation, future tools) shares ONE
implementation instead of growing per-caller regex patches:

  1. direct parse of the whole stripped text
  2. markdown fenced blocks (```json ... ``` / ``` ... ```)
  3. quote-aware balanced-object scan from every '{' (first complete
     object wins - free-tier models sometimes emit the same object twice)
  4. greedy {.*} span (legacy fallback for objects not starting at the
     first brace)
  5. repair variants per candidate: text normalization (BOM / zero-width /
     smart quotes), python literals (True/False/None), trailing commas,
     single-quoted tokens, truncated-JSON auto-close

Failures raise :class:`LlmContentError` carrying the underlying decoder
error AND a repr excerpt of the actual model text, so logs show exactly
what the model returned instead of a bare "Expecting value".
"""
import json
import re
from typing import Any, Dict, Iterator, List, Optional

_FENCE_RE = re.compile(r"```[ \t]*(?:json)?[ \t]*\r?\n(.*?)```", re.DOTALL | re.IGNORECASE)
_GREEDY_OBJ_RE = re.compile(r"\{.*\}", re.DOTALL)
_EXCERPT_LEN = 300


class LlmContentError(ValueError):
    """Model text could not be converted to a JSON object (full context)."""


def parse_json_object(text: str) -> Dict[str, Any]:
    """Parse the FIRST complete JSON object from model output.

    Raises LlmContentError (ValueError) with the decoder error plus an
    excerpt of the offending model text when nothing yields a dict.
    """
    blob = str(text or "")
    for candidate in _candidates(blob):
        data, _err = _try_loads(candidate)
        if isinstance(data, dict):
            return data
        for repaired in _repair_variants(candidate):
            data, _err = _try_loads(repaired)
            if isinstance(data, dict):
                return data
    data, err = _try_loads(blob)
    if isinstance(data, dict):
        return data
    raise LlmContentError(
        f"model returned non-object JSON ({err}); "
        f"text excerpt: {blob[:_EXCERPT_LEN]!r}"
    )


def _try_loads(candidate: str) -> tuple:
    try:
        return json.loads(candidate), None
    except json.JSONDecodeError as exc:
        return None, str(exc)


def _candidates(blob: str) -> Iterator[str]:
    seen: set = set()

    def offer(value: str) -> bool:
        if value and value not in seen:
            seen.add(value)
            return True
        return False

    for match in _FENCE_RE.finditer(blob):
        if offer(match.group(1).strip()):
            yield match.group(1).strip()
    for span in _balanced_objects(blob):
        if offer(span):
            yield span
    greedy = _GREEDY_OBJ_RE.search(blob)
    if greedy and offer(greedy.group(0)):
        yield greedy.group(0)


def _balanced_objects(blob: str) -> Iterator[str]:
    """Yield quote-aware balanced {...} spans, outermost-first, in order."""
    index = blob.find("{")
    while index >= 0:
        depth = 0
        in_string = False
        escaped = False
        cursor = index
        end = -1
        while cursor < len(blob):
            char = blob[cursor]
            if in_string:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    in_string = False
            elif char == '"':
                in_string = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    end = cursor
                    break
            cursor += 1
        if end >= 0:
            yield blob[index:end + 1]
            index = blob.find("{", end + 1)
        else:
            # Unbalanced (truncated) - offer the remainder once for the
            # auto-close repair, then stop scanning.
            yield blob[index:]
            return


def _repair_variants(candidate: str) -> Iterator[str]:
    """Layered near-JSON repairs, each building on the previous variant."""
    variants: List[str] = []
    current = _normalize_text(candidate)
    if current != candidate:
        variants.append(current)
    trailing = _drop_trailing_commas(current)
    if trailing != current:
        variants.append(trailing)
        current = trailing
    literals = _fix_python_literals(current)
    if literals != current:
        variants.append(literals)
        current = literals
    single = _fix_single_quotes(current)
    if single != current:
        variants.append(single)
        current = single
    autoclosed = _auto_close(current)
    if autoclosed != current:
        variants.append(autoclosed)
        current = autoclosed
        # Repair layers may expose earlier problems again - re-run the
        # cheap textual fixes once on the auto-closed variant.
        combined = _drop_trailing_commas(_fix_python_literals(current))
        if combined != current:
            variants.append(combined)
    yield from variants


def _normalize_text(candidate: str) -> str:
    repaired = candidate.lstrip("\ufeff").replace("\u200b", "").replace("\u200c", "")
    # Smart quotes only occur as model prose artifacts (JSON requires
    # straight ASCII quotes), so a global map is safe.
    return repaired.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")


def _drop_trailing_commas(candidate: str) -> str:
    return re.sub(r",(\s*[}\]])", r"\1", candidate)


def _fix_python_literals(candidate: str) -> str:
    """True/False/None -> true/false/null outside string literals."""
    out: List[str] = []
    in_string = False
    escaped = False
    token_start = -1
    for index, char in enumerate(candidate):
        if in_string:
            out.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
            out.append(char)
            continue
        if char.isalpha():
            if token_start < 0:
                token_start = index
            if index + 1 < len(candidate) and candidate[index + 1].isalpha():
                continue
            token = candidate[token_start:index + 1]
            boundary_before = token_start == 0 or not (candidate[token_start - 1].isalnum() or candidate[token_start - 1] in "_$")
            boundary_after = index + 1 >= len(candidate) or not (candidate[index + 1].isalnum() or candidate[index + 1] in "_$")
            if boundary_before and boundary_after:
                out.append({"True": "true", "False": "false", "None": "null"}.get(token, token))
            else:
                out.append(token)
            token_start = -1
            continue
        out.append(char)
    return "".join(out)


def _fix_single_quotes(candidate: str) -> str:
    """Convert single-quoted tokens to double-quoted JSON strings."""
    if "'" not in candidate:
        return candidate
    out: List[str] = []
    in_double = False
    escaped = False
    index = 0
    while index < len(candidate):
        char = candidate[index]
        if in_double:
            out.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_double = False
            index += 1
            continue
        if char == '"':
            in_double = True
            out.append(char)
            index += 1
            continue
        if char == "'":
            end = index + 1
            while end < len(candidate):
                if candidate[end] == "\\" and end + 1 < len(candidate):
                    end += 2
                    continue
                if candidate[end] == "'":
                    break
                end += 1
            if end < len(candidate):
                inner = candidate[index + 1:end]
                # \' escapes only exist to protect quotes inside
                # single-quoted strings - JSON strings need them unescaped,
                # then double quotes escaped for the double-quoted form.
                inner = inner.replace("\\'", "'")
                inner = inner.replace('"', '\\"')
                out.append(f'"{inner}"')
                index = end + 1
                continue
        out.append(char)
        index += 1
    return "".join(out)


def _auto_close(candidate: str) -> str:
    """Close truncated JSON: terminate an open string, then openers."""
    stack: List[str] = []
    in_string = False
    escaped = False
    for char in candidate:
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
        elif char == '"':
            in_string = True
        elif char in "{[":
            stack.append("}" if char == "{" else "]")
        elif char in "}]" and stack:
            stack.pop()
    suffix_chars: List[str] = []
    if in_string:
        # An odd run of trailing backslashes means the last one opens an
        # incomplete escape - drop it so our closing quote is not escaped.
        trailing_backslashes = len(candidate) - len(candidate.rstrip("\\"))
        if trailing_backslashes % 2 == 1:
            candidate = candidate[:-1]
        suffix_chars.append('"')
    suffix_chars.extend(reversed(stack))
    if not suffix_chars:
        return candidate
    return candidate + "".join(suffix_chars)


def extract_text_field(data: Dict[str, Any], *keys: str, default: str = "") -> str:
    """First non-empty string field among keys (helper for LLM payloads)."""
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return default
