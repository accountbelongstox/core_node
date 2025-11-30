"""
Utility script to populate missing dictionary entries in pycore_db_cache/dict/*.json.

This script fetches Lao/Japanese/Vietnamese translations plus English pronunciations
and bilingual meanings using Google Translate's public endpoint, NLTK WordNet,
and the eng_to_ipa / pykakasi libraries.

Usage:
    python scripts/fill_dicts.py [dict_numbers...]

If no dict numbers supplied, the script scans for files with missing fields.
"""

import json
import pathlib
import sys
import time
from math import ceil
from typing import Iterable, List, Sequence, Tuple
from concurrent.futures import ThreadPoolExecutor

import requests
from eng_to_ipa import convert as ipa_convert
from nltk.corpus import wordnet as wn
from pykakasi import kakasi
from unidecode import unidecode

BASE_PATH = pathlib.Path(__file__).resolve().parents[1] / "pycore_db_cache" / "dict"
TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
)

HEADERS = {"User-Agent": USER_AGENT}
japanese_converter = kakasi()


def chunked(seq: Sequence[str], size: int) -> Iterable[Sequence[str]]:
    """Yield fixed-size chunks from the provided sequence."""
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def get_definition(word: str) -> str:
    """Return a concise English definition for the word using WordNet."""
    variants = [
        word,
        word.lower(),
        word.replace("-", " "),
        word.replace("-", ""),
        word.lower().replace("-", " "),
        word.lower().replace(" ", "_"),
    ]
    synsets = []
    for variant in variants:
        synsets = wn.synsets(variant)
        if synsets:
            break
    if not synsets:
        lemma = wn.morphy(word.lower())
        if lemma:
            synsets = wn.synsets(lemma)
    if synsets:
        definition = synsets[0].definition()
        if definition:
            return definition[0].upper() + definition[1:]
    return f"{word.capitalize()} is an English word referring to '{word}'."


def get_en_pron(word: str) -> str:
    ipa = ipa_convert(word)
    if not ipa:
        return ""
    ipa = ipa.replace("*", "").strip()
    if not ipa:
        return ""
    return ipa if ipa.startswith("/") and ipa.endswith("/") else f"/{ipa}/"


def call_api_raw(texts: Sequence[str], dest: str, need_pron: bool) -> Tuple[List[str], List[str]]:
    joined = "\n".join(texts)
    params = [("client", "gtx"), ("sl", "en"), ("tl", dest), ("dt", "t")]
    if need_pron:
        params.append(("dt", "rm"))
    params.append(("q", joined))
    resp = requests.get(TRANSLATE_URL, params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    segments = data[0] or []
    roman_block = None
    if need_pron and segments and isinstance(segments[-1], list):
        last = segments[-1]
        if len(last) >= 3 and last[0] is None and last[1] is None:
            roman_block = last[2] or ""
            segments = segments[:-1]
    translations = []
    for seg in segments:
        if isinstance(seg, list):
            text = (seg[0] or "").replace("\n", "").strip()
            translations.append(text)
    romanizations: List[str] = []
    if need_pron and roman_block is not None:
        romanizations = [part.strip() for part in roman_block.split("\n")]
    return translations, romanizations


def normalize_prons(prons: List[str], length: int, need_pron: bool) -> List[str]:
    if not need_pron:
        return [""] * length
    if not prons:
        return [""] * length
    cleaned = [p.strip() for p in prons]
    if len(cleaned) < length:
        cleaned.extend([""] * (length - len(cleaned)))
    elif len(cleaned) > length:
        cleaned = cleaned[:length]
    return cleaned


def translate_chunk(chunk: Sequence[str], dest: str, need_pron: bool) -> Tuple[List[str], List[str]]:
    try:
        texts, roman = call_api_raw(chunk, dest, need_pron)
        if len(texts) == len(chunk):
            return texts, normalize_prons(roman, len(chunk), need_pron)
    except requests.RequestException:
        pass
    except Exception:
        pass

    # Fallback: translate word-by-word when the batched request fails.
    texts: List[str] = []
    prons: List[str] = []
    for word in chunk:
        for attempt in range(4):
            try:
                t_texts, t_prons = call_api_raw([word], dest, need_pron)
                text_value = t_texts[0] if t_texts else ""
                pron_value = t_prons[0] if need_pron and t_prons else ""
                texts.append(text_value)
                prons.append(pron_value)
                break
            except Exception:
                time.sleep(1.0 * (attempt + 1))
        else:
            texts.append("")
            prons.append("")
        time.sleep(0.1)
    return texts, prons


def translate_list(words: Sequence[str], dest: str, chunk_size: int, need_pron: bool, label: str):
    texts: List[str] = []
    prons: List[str] = []
    total = ceil(len(words) / max(1, chunk_size))
    for idx, chunk in enumerate(chunked(words, chunk_size), start=1):
        print(f"[{label}] chunk {idx}/{total}")
        chunk_texts, chunk_prons = translate_chunk(chunk, dest, need_pron)
        texts.extend(chunk_texts)
        prons.extend(chunk_prons)
        time.sleep(0.2)
    return texts, prons


def romaji(text: str) -> str:
    pieces = japanese_converter.convert(text or "")
    return " ".join(part.get("hepburn", "") for part in pieces if part.get("hepburn")).strip()


def update_file(path: pathlib.Path, start: int = 0, count: int | None = None):
    obj = json.loads(path.read_text(encoding="utf-8"))
    items = obj.get("items", [])
    if not items:
        print(f"{path.name}: no items")
        return
    end = len(items) if count is None else min(len(items), start + count)
    subset = items[start:end]
    if not subset:
        print(f"{path.name}: range {start}:{count} has no items")
        return
    words = [item["word"]["en"].strip() for item in subset]
    definitions = [get_definition(word) for word in words]
    en_prons = [get_en_pron(word) for word in words]

    chunk_size = len(words)
    label_suffix = f"{path.name}[{start}-{end - 1}]"
    with ThreadPoolExecutor(max_workers=4) as executor:
        fut_lo = executor.submit(
            translate_list, words, "lo", chunk_size, True, f"{label_suffix}-lo"
        )
        fut_ja = executor.submit(
            translate_list, words, "ja", chunk_size, False, f"{label_suffix}-ja"
        )
        fut_vi = executor.submit(
            translate_list, words, "vi", chunk_size, False, f"{label_suffix}-vi"
        )
        fut_zh = executor.submit(
            translate_list, definitions, "zh-CN", chunk_size, False, f"{label_suffix}-zh"
        )
        laos_texts, laos_prons = fut_lo.result()
        jp_texts, _ = fut_ja.result()
        vi_texts, _ = fut_vi.result()
        zh_texts, _ = fut_zh.result()

    jp_prons = [romaji(text) for text in jp_texts]
    vi_prons = [unidecode(text) if text else "" for text in vi_texts]

    for idx, item in enumerate(subset):
        global_idx = start + idx
        word_section = item["word"]
        word_section["laos"] = laos_texts[idx] if idx < len(laos_texts) else ""
        word_section["laos_pronunciation"] = laos_prons[idx] if idx < len(laos_prons) else ""
        word_section["jp"] = jp_texts[idx] if idx < len(jp_texts) else ""
        word_section["jp_pronunciation"] = jp_prons[idx] if idx < len(jp_prons) else ""
        word_section["vie"] = vi_texts[idx] if idx < len(vi_texts) else ""
        word_section["vie_pronunciation"] = vi_prons[idx] if idx < len(vi_prons) else ""
        word_section["en_pronunciation"] = en_prons[idx]
        item["means"]["en"] = definitions[idx]
        item["means"]["zh"] = zh_texts[idx] if idx < len(zh_texts) else ""

    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {path.name} items {start}-{end - 1}")


def find_missing_files() -> List[pathlib.Path]:
    results = []
    for path in sorted(BASE_PATH.glob("dict*.json"), key=lambda p: int(p.stem[4:])):
        obj = json.loads(path.read_text(encoding="utf-8"))
        if any(
            not all(
                [
                    item["word"].get("laos"),
                    item["word"].get("jp"),
                    item["word"].get("vie"),
                    item["word"].get("en_pronunciation"),
                    item["word"].get("laos_pronunciation"),
                    item["word"].get("jp_pronunciation"),
                    item["word"].get("vie_pronunciation"),
                    item["means"].get("en"),
                    item["means"].get("zh"),
                ]
            )
            for item in obj.get("items", [])
        ):
            results.append(path)
    return results


def parse_target(arg: str) -> Tuple[pathlib.Path, int, int | None]:
    parts = arg.split(":")
    file_part = parts[0]
    start = 0
    count = None
    if len(parts) >= 2 and parts[1]:
        start = int(parts[1])
    if len(parts) >= 3 and parts[2]:
        count = int(parts[2])
    path = BASE_PATH / (f"dict{file_part}.json" if file_part.isdigit() else file_part)
    return path, start, count


def main():
    args = sys.argv[1:]
    if args:
        targets = [parse_target(arg) for arg in args]
    else:
        targets = [(path, 0, None) for path in find_missing_files()]
    for path, start, count in targets:
        update_file(path, start=start, count=count)


if __name__ == "__main__":
    main()
