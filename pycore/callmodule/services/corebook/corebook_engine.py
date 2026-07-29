# -*- coding: utf-8 -*-
"""
CoreBook engine — convert, enrich (translate + TTS), submit, and one-click autoflow.

A CoreBook is one portable on-disk bundle (JSON + per-sentence audio) keyed by
``source_key = sha1(abs_path)``. Convert reuses the same v3 chapter/slot builders
as ``BooksController.submit``; autoflow chains convert → translate → TTS → Laravel
ingest and streams ``corebook_autoflow`` THREAD_BUS events for the Books UI.
"""

import copy
import os
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.text_parsing import normalize_language_codes
from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.callmodule.services.processors.book_processor import extract_text
from pycore.callmodule.services.sync.book_payload import build_book_payload_v3
from pycore.callmodule.services.sync.laravel_media_sync import (
    resolve_laravel_base_url,
    source_key_for,
    _ingest_book_chunked_v3,
)
from pycore.callmodule.services.corebook.corebook_store import (
    delete_bundle,
    list_source_keys,
    load_bundle,
    save_bundle,
)
from pycore.callmodule.services.corebook.corebook_completeness import (
    bundle_summary,
    compute_completeness,
)
from pycore.callmodule.services.corebook.corebook_translate import translate_sentences
from pycore.callmodule.services.corebook.corebook_audio import fill_audio_for_slots

from pycore.database.repositories.user_data_store import get_user_data_store
import pycore.callmodule.controllers.local_processing.books_state as books_state


COREBOOK_AUTOFLOW_EVENT = "corebook_autoflow"
# Synthesizing tens of thousands of sentences inline would exceed the UI RPC
# timeout; above this threshold autoflow submits text and files fill_audio assist
# requests instead of running local TTS for every slot.
_AUTOFLOW_TTS_SLOT_CAP = 500
_AUTOFLOW_TRANSLATE_SLOT_CAP = 500


class CoreBookEngine:
    """Stateless CoreBook operations (disk-backed bundles)."""

    # ----- progress -------------------------------------------------------- #
    @staticmethod
    def _flow_event(stage: str, done: int = 0, total: int = 0, detail: str = "") -> None:
        try:
            THREAD_BUS.trigger_event(COREBOOK_AUTOFLOW_EVENT, {
                "stage": stage, "done": done, "total": total, "detail": detail,
            })
        except Exception:
            pass

    @staticmethod
    def _ingest_progress(stage: str, done: int, total: int, detail: str = "") -> None:
        CoreBookEngine._flow_event(stage, done, total, detail)

    # ----- list / get / delete --------------------------------------------- #
    def list_books(self) -> Dict[str, Any]:
        items = []
        for sk in list_source_keys():
            bundle = load_bundle(sk)
            if bundle:
                items.append(bundle_summary(bundle))
        return {"success": True, "items": items}

    def get(self, source_key: str, start: int = 0, limit: int = 0) -> Dict[str, Any]:
        bundle = load_bundle(source_key)
        if not bundle:
            return {"success": False, "error": f"CoreBook not found: {source_key}"}
        slots = bundle.get("slots") or []
        total = len(slots)
        page = slots
        if limit and limit > 0:
            start = max(0, int(start))
            page = slots[start:start + int(limit)]
        return {
            "success": True,
            "summary": bundle_summary(bundle),
            "source": bundle.get("source") or {},
            "chapters": bundle.get("chapters") or [],
            "slots": page,
            "total_slots": total,
            "start": start,
            "limit": limit or total,
        }

    def delete(self, source_key: str) -> Dict[str, Any]:
        ok = delete_bundle(source_key)
        return {"success": ok, "removed": ok,
                "error": None if ok else f"CoreBook not found: {source_key}"}

    # ----- convert --------------------------------------------------------- #
    def convert(
        self,
        path: str,
        language: Optional[str] = None,
        languages: Optional[List[str]] = None,
        source_type: str = "book",
        text: Optional[str] = None,
    ) -> Dict[str, Any]:
        path = (path or "").strip()
        if not path:
            return {"success": False, "error": "path is required"}
        abs_path = os.path.abspath(path)
        if not os.path.isfile(abs_path):
            return {"success": False, "error": f"file not found: {abs_path}"}

        lang = (language or "en").strip() or "en"
        src_type = source_type if source_type in ("book", "document") else "book"
        full_content = (text or "").strip()
        if not full_content:
            try:
                full_content = extract_text(abs_path)
            except Exception as exc:
                return {"success": False, "error": f"extract failed: {exc}"}
        if not full_content.strip():
            return {"success": False, "error": "no extractable text"}

        sel = normalize_language_codes(languages, lang) or [lang]
        payload = build_book_payload_v3(abs_path, full_content, sel, language=lang,
                                        source_type=src_type)
        source_key = payload["source"]["source_key"]
        bundle = {
            "version": 1,
            "source_type": src_type,
            "source_path": abs_path,
            "source": payload["source"],
            "chapters": payload.get("chapters") or [],
            "slots": payload.get("slots") or [],
        }
        save_bundle(source_key, bundle)
        summary = bundle_summary(bundle)
        ColorPrint.blue(
            f"[CoreBook] converted {os.path.basename(abs_path)} -> {source_key} "
            f"({summary['chapter_count']} chapters, {summary['slot_count']} slots)")
        return {"success": True, "summary": summary}

    # ----- add language ---------------------------------------------------- #
    def add_language(
        self,
        source_key: str,
        target_language: str,
        source_language: Optional[str] = None,
        chunk_size: int = 120,
        grain: str = "sentence",
        on_progress: Optional[Callable[[int, int], None]] = None,
    ) -> Dict[str, Any]:
        bundle = load_bundle(source_key)
        if not bundle:
            return {"success": False, "error": f"CoreBook not found: {source_key}"}

        target = (target_language or "").strip().lower()
        if not target:
            return {"success": False, "error": "target_language is required"}

        source = bundle.get("source") or {}
        primary = (source_language or source.get("language") or "en").strip().lower()
        selected = list(source.get("selected_languages") or [])
        if target not in selected:
            selected.append(target)
        selected = normalize_language_codes(selected, primary)
        source["selected_languages"] = selected
        bundle["source"] = source

        slots = bundle.get("slots") or []
        targets = [s for s in slots if (s.get("grain") or "sentence") == grain]
        lines: List[str] = []
        indices: List[int] = []
        for i, slot in enumerate(targets):
            langs = slot.setdefault("langs", {})
            if langs.get(target) and str(langs.get(target)).strip():
                continue
            src_txt = langs.get(primary) or ""
            if not str(src_txt).strip():
                continue
            lines.append(str(src_txt))
            indices.append(i)

        if not lines:
            for ch in bundle.get("chapters") or []:
                titles = ch.setdefault("titles", {})
                if target not in titles:
                    titles[target] = None
            save_bundle(source_key, bundle)
            return {"success": True, "result": {"translated": 0},
                    "summary": bundle_summary(bundle)}

        def _prog(done: int, total: int) -> None:
            if on_progress:
                on_progress(done, total)

        translations, meta = translate_sentences(
            lines, primary, target, chunk_size=chunk_size, on_progress=_prog)
        applied = 0
        for idx, trans in zip(indices, translations):
            if trans and str(trans).strip():
                targets[idx].setdefault("langs", {})[target] = trans.strip()
                applied += 1

        for ch in bundle.get("chapters") or []:
            titles = ch.setdefault("titles", {})
            if target not in titles:
                titles[target] = None
        bundle["slots"] = slots
        save_bundle(source_key, bundle)
        return {
            "success": applied > 0 or not lines,
            "result": {"translated": applied, "meta": meta},
            "summary": bundle_summary(bundle),
            "error": None if applied > 0 else "no translations produced",
        }

    # ----- fill audio ------------------------------------------------------ #
    def fill_audio(
        self,
        source_key: str,
        languages: List[str],
        rate: str = "+0%",
        grain: str = "sentence",
        on_progress: Optional[Callable[[int, int, str], None]] = None,
    ) -> Dict[str, Any]:
        bundle = load_bundle(source_key)
        if not bundle:
            return {"success": False, "error": f"CoreBook not found: {source_key}"}

        langs = normalize_language_codes(languages)
        if not langs:
            return {"success": False, "error": "languages must include at least one code"}

        slots = bundle.get("slots") or []
        result = fill_audio_for_slots(
            source_key, slots, langs, grain=grain, rate=rate, on_progress=on_progress)
        bundle["slots"] = slots
        save_bundle(source_key, bundle)
        ok = result["filled"] > 0 or result["skipped"] > 0
        return {
            "success": ok,
            "result": result,
            "summary": bundle_summary(bundle),
            "error": None if ok else "; ".join(result.get("errors") or []) or "no audio filled",
        }

    # ----- submit ---------------------------------------------------------- #
    def submit(
        self,
        source_key: str,
        upload_audio: bool = True,
        request_assist: bool = False,
        assist_items: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        bundle = load_bundle(source_key)
        if not bundle:
            return {"success": False, "error": f"CoreBook not found: {source_key}"}

        payload = self._bundle_to_ingest_payload(bundle)
        base = resolve_laravel_base_url()
        errors: List[str] = []

        def _prog(stage: str, done: int, total: int, detail: str = "") -> None:
            self._ingest_progress(stage, done, total, detail)

        _prog("submit", 0, 1, "structuring")
        ok, ingest_errs = _ingest_book_chunked_v3(base, payload, _prog)
        if not ok:
            errors.extend(ingest_errs)
            self._flow_event("error", 0, 0, ingest_errs[0] if ingest_errs else "ingest failed")
            return {"success": False, "result": {"ingest_errors": ingest_errs}, "error": errors[0]}

        if upload_audio:
            self._upload_bundle_audio(base, bundle, _prog, errors)

        if request_assist:
            self._file_assist_requests(bundle, assist_items, errors)

        self._mark_books_state_synced(bundle)
        self._flow_event("done", 1, 1, source_key)
        return {
            "success": True,
            "result": {"source_key": source_key, "warnings": errors},
            "error": None,
        }

    # ----- autoflow (convert → translate → TTS → submit) ------------------- #
    def autoflow(
        self,
        path: str,
        languages: Optional[List[str]] = None,
        source_type: str = "book",
    ) -> Dict[str, Any]:
        path = (path or "").strip()
        langs = normalize_language_codes(languages)
        if not langs:
            return {"success": False, "errors": ["languages must include at least one code"]}
        if not path:
            return {"success": False, "errors": ["path is required"]}

        errors: List[str] = []
        self._flow_event("convert", 0, 1, os.path.basename(path))
        conv = self.convert(path, language=langs[0], languages=langs, source_type=source_type)
        if not conv.get("success"):
            err = conv.get("error") or "convert failed"
            errors.append(err)
            self._flow_event("error", 0, 0, err)
            return {"success": False, "errors": errors}

        summary = conv.get("summary") or {}
        source_key = summary.get("source_key") or ""
        primary = langs[0]
        self._flow_event("convert", 1, 1, source_key)

        extra_langs = [c for c in langs if c != primary]
        bundle = load_bundle(source_key) or {}
        sent_n = sum(
            1 for s in (bundle.get("slots") or [])
            if (s.get("grain") or "sentence") == "sentence")

        if extra_langs and sent_n > _AUTOFLOW_TRANSLATE_SLOT_CAP:
            self._flow_event("translate", 0, 1, f"deferred ({sent_n} sentences)")
            for tgt in extra_langs:
                self._post_assist_requests(
                    source_key, source_type,
                    [{"request_type": "add_language", "language": tgt}],
                    errors,
                )
                errors.append(f"translate {tgt} deferred — filed add_language assist")
            self._flow_event("translate", 1, 1, "assist requests filed")
        else:
            for li, tgt in enumerate(extra_langs):
                self._flow_event("translate", li, len(extra_langs), tgt)

                def _tprog(done: int, total: int) -> None:
                    self._flow_event(
                        "translate", li * total + done,
                        len(extra_langs) * max(1, total), tgt)

                ar = self.add_language(source_key, tgt, primary, on_progress=_tprog)
                if not ar.get("success"):
                    errors.append(f"translate {tgt}: {ar.get('error') or 'failed'}")
                self._flow_event("translate", li + 1, len(extra_langs), tgt)

        self._flow_event("voice", 0, 1, "starting")
        bundle = load_bundle(source_key) or {}
        sent_n = sum(
            1 for s in (bundle.get("slots") or [])
            if (s.get("grain") or "sentence") == "sentence")

        if sent_n > _AUTOFLOW_TTS_SLOT_CAP:
            self._flow_event("voice", 1, 1, f"skipped TTS ({sent_n} sentences > cap)")
            errors.append(
                f"TTS deferred: {sent_n} sentences — filed fill_audio assist request(s)")
            self._post_assist_requests(
                source_key, source_type,
                [{"request_type": "fill_audio", "language": c} for c in langs],
                errors,
            )
        else:
            def _aprog(done: int, total: int, detail: str) -> None:
                self._flow_event("audio", done, max(1, total), detail)

            fr = self.fill_audio(source_key, langs, on_progress=_aprog)
            if not fr.get("success"):
                errors.append(f"audio: {fr.get('error') or 'failed'}")
            self._flow_event("voice", 1, 1, f"filled {fr.get('result', {}).get('filled', 0)}")

        self._flow_event("submit", 0, 1, source_key)
        sr = self.submit(
            source_key,
            upload_audio=sent_n <= _AUTOFLOW_TTS_SLOT_CAP,
            request_assist=True,
        )
        if not sr.get("success"):
            errors.append(f"submit: {sr.get('error') or 'failed'}")
        self._flow_event("submit", 1, 1, source_key)

        title = summary.get("title") or os.path.basename(path)
        success = bool(sr.get("success"))
        if success:
            self._flow_event("done", 1, 1, title)
        else:
            self._flow_event("error", 0, 0, errors[0] if errors else "failed")
        return {
            "success": success,
            "title": title,
            "source_key": source_key,
            "errors": errors,
        }

    # ----- helpers --------------------------------------------------------- #
    @staticmethod
    def _bundle_to_ingest_payload(bundle: Dict[str, Any]) -> Dict[str, Any]:
        slots_out = []
        for slot in bundle.get("slots") or []:
            s = {k: v for k, v in slot.items() if k != "audio"}
            slots_out.append(s)
        return {
            "source_type": bundle.get("source_type") or "book",
            "model_version": 3,
            "source": copy.deepcopy(bundle.get("source") or {}),
            "chapters": copy.deepcopy(bundle.get("chapters") or []),
            "slots": slots_out,
        }

    @staticmethod
    def _upload_bundle_audio(
        base: str,
        bundle: Dict[str, Any],
        progress: Callable[[str, int, int, str], None],
        errors: List[str],
    ) -> None:
        """Best-effort: queue sentence audio via assist fill_audio requests."""
        comp = compute_completeness(bundle)
        missing = [m for m in comp.get("missing") or [] if m.get("kind") == "audio"]
        if not missing:
            progress("audio_upload", 1, 1, "nothing to upload")
            return
        items = [{"request_type": "fill_audio", "language": m.get("language")}
                 for m in missing if m.get("language")]
        if items:
            CoreBookEngine._post_assist_requests(
                bundle.get("source", {}).get("source_key") or "",
                bundle.get("source_type") or "book",
                items,
                errors,
            )
        progress("audio_upload", 1, 1, f"{len(items)} assist request(s)")

    @staticmethod
    def _file_assist_requests(
        bundle: Dict[str, Any],
        assist_items: Optional[List[Dict[str, Any]]],
        errors: List[str],
    ) -> None:
        source_key = bundle.get("source", {}).get("source_key") or ""
        record_type = bundle.get("source_type") or "book"
        items = list(assist_items or [])
        if not items:
            comp = compute_completeness(bundle)
            for m in comp.get("missing") or []:
                kind = m.get("kind")
                if kind == "language":
                    items.append({"request_type": "add_language", "language": m.get("language")})
                elif kind == "audio":
                    items.append({"request_type": "fill_audio", "language": m.get("language")})
        if items:
            CoreBookEngine._post_assist_requests(source_key, record_type, items, errors)

    @staticmethod
    def _post_assist_requests(
        source_key: str,
        record_type: str,
        items: List[Dict[str, Any]],
        errors: List[str],
    ) -> None:
        if not source_key or not items:
            return
        base = resolve_laravel_base_url()
        body = {"record_type": record_type, "source_key": source_key, "items": items}
        try:
            resp = get_laravel_client().post(
                "/api/app_qy_v1/assist/requests",
                base_url=base,
                json=body,
                timeout=30,
            )
            if resp.status_code not in (200, 201):
                errors.append(f"assist requests HTTP {resp.status_code}")
        except Exception as exc:
            errors.append(f"assist requests failed: {exc}")

    @staticmethod
    def _mark_books_state_synced(bundle: Dict[str, Any]) -> None:
        """Mark the originating path synced in Books user-data when present."""
        path = bundle.get("source_path") or ""
        if not path:
            return
        try:
            store = get_user_data_store()
            section = books_state.get_section(store)
            sk = bundle.get("source", {}).get("source_key") or source_key_for(path)
            rec = next((s for s in section.get("sources", []) if s.get("source_key") == sk), None)
            if rec is None:
                rec = books_state.upsert_source(section, path, "file")
            rec["submission_state"] = "synced"
            rec["synced_at"] = time.time()
            sel = bundle.get("source", {}).get("selected_languages")
            if sel:
                rec["selected_languages"] = list(sel)
            books_state.save_section(store, section)
        except Exception as exc:
            ColorPrint.yellow(f"[CoreBook] books state sync mark failed: {exc}")
