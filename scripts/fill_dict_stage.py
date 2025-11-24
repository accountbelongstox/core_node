"""
Stage-based helper to populate specific fields in dict JSON files.

Usage examples:
  python scripts/fill_dict_stage.py --mode en 41
  python scripts/fill_dict_stage.py --mode laos 41
  python scripts/fill_dict_stage.py --mode zh 41

Optional ranges can be provided as 41:0:50 (start index, count).
"""

import argparse
import json
import pathlib
from typing import List, Sequence, Tuple

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


def call_api(texts: Sequence[str], dest: str, need_pron: bool) -> Tuple[List[str], List[str]]:
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
            translations.append((seg[0] or "").replace("\n", "").strip())
    romanizations: List[str] = []
    if need_pron and roman_block is not None:
        romanizations = [part.strip() for part in roman_block.split("\n")]
    return translations, romanizations


def get_definition(word: str) -> str:
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


def parse_target(target: str) -> Tuple[pathlib.Path, int, int | None]:
    parts = target.split(":")
    file_part = parts[0]
    start = 0
    count = None
    if len(parts) >= 2 and parts[1]:
        start = int(parts[1])
    if len(parts) >= 3 and parts[2]:
        count = int(parts[2])
    path = BASE_PATH / (f"dict{file_part}.json" if file_part.isdigit() else file_part)
    return path, start, count


def load_subset(path: pathlib.Path, start: int, count: int | None):
    obj = json.loads(path.read_text(encoding="utf-8"))
    items = obj.get("items", [])
    end = len(items) if count is None else min(len(items), start + count)
    return obj, items, items[start:end], start, end


def fill_en(path: pathlib.Path, start: int, count: int | None):
    obj, items, subset, s, e = load_subset(path, start, count)
    words = [entry["word"]["en"].strip() for entry in subset]
    definitions = [get_definition(word) for word in words]
    en_prons = [get_en_pron(word) for word in words]
    for idx, item in enumerate(subset):
        item["word"]["en_pronunciation"] = en_prons[idx]
        item["means"]["en"] = definitions[idx]
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{path.name} en fields updated for items {s}-{e - 1}")


def fill_zh(path: pathlib.Path, start: int, count: int | None):
    obj, items, subset, s, e = load_subset(path, start, count)
    english_defs = [item["means"]["en"] for item in subset]
    zh_texts, _ = call_api(english_defs, "zh-CN", False)
    for idx, item in enumerate(subset):
        item["means"]["zh"] = zh_texts[idx] if idx < len(zh_texts) else ""
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{path.name} zh meanings updated for items {s}-{e - 1}")


def fill_laos(path: pathlib.Path, start: int, count: int | None):
    obj, items, subset, s, e = load_subset(path, start, count)
    words = [entry["word"]["en"].strip() for entry in subset]
    translations, prons = call_api(words, "lo", True)
    for idx, item in enumerate(subset):
        item["word"]["laos"] = translations[idx] if idx < len(translations) else ""
        item["word"]["laos_pronunciation"] = prons[idx] if idx < len(prons) else ""
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{path.name} laos fields updated for items {s}-{e - 1}")


def fill_jp(path: pathlib.Path, start: int, count: int | None):
    obj, items, subset, s, e = load_subset(path, start, count)
    words = [entry["word"]["en"].strip() for entry in subset]
    translations, _ = call_api(words, "ja", False)
    for idx, item in enumerate(subset):
        jp_text = translations[idx] if idx < len(translations) else ""
        item["word"]["jp"] = jp_text
        romaji = " ".join(
            part.get("hepburn", "") for part in japanese_converter.convert(jp_text or "") if part.get("hepburn")
        ).strip()
        item["word"]["jp_pronunciation"] = romaji
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{path.name} jp fields updated for items {s}-{e - 1}")


def fill_vie(path: pathlib.Path, start: int, count: int | None):
    obj, items, subset, s, e = load_subset(path, start, count)
    words = [entry["word"]["en"].strip() for entry in subset]
    translations, _ = call_api(words, "vi", False)
    for idx, item in enumerate(subset):
        text = translations[idx] if idx < len(translations) else ""
        item["word"]["vie"] = text
        item["word"]["vie_pronunciation"] = unidecode(text) if text else ""
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{path.name} vie fields updated for items {s}-{e - 1}")


MODE_TO_FUNC = {
    "en": fill_en,
    "zh": fill_zh,
    "laos": fill_laos,
    "jp": fill_jp,
    "vie": fill_vie,
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=MODE_TO_FUNC.keys())
    parser.add_argument("targets", nargs="+", help="dict numbers or dictXX.json optionally with :start:count")
    args = parser.parse_args()

    func = MODE_TO_FUNC[args.mode]
    for target in args.targets:
        path, start, count = parse_target(target)
        func(path, start, count)


if __name__ == "__main__":
    main()
