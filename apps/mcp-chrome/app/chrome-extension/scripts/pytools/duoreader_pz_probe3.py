import re
import urllib.request
import bz2

CDN = "https://dl-public.xiangyin.mobi/multi_lang_read/"


def load_pz(path: str) -> bytes:
    raw = urllib.request.urlopen(CDN + path, timeout=30).read()
    return bz2.decompress(bytes(b ^ 175 for b in raw))


def extract_len_prefixed_utf8(data: bytes) -> list[str]:
    out = []
    i = 0
    while i < len(data) - 2:
        if data[i] not in (0x0A, 0x12, 0x1A, 0x22, 0x2A, 0x32, 0x3A, 0x42):
            i += 1
            continue
        ln = data[i + 1]
        if ln < 2 or ln > 240 or i + 2 + ln > len(data):
            i += 1
            continue
        chunk = data[i + 2 : i + 2 + ln]
        i += 2 + ln
        try:
            s = chunk.decode("utf-8")
        except Exception:
            continue
        if len(s) >= 4 and "\x00" not in s:
            out.append(s.strip())
    return out


def parse_article_paragraphs(blob: bytes) -> list[dict]:
    strings = extract_len_prefixed_utf8(blob)
    en_parts = []
    zh_parts = []
    for s in strings:
        if re.search(r"[\u4e00-\u9fff]", s):
            if len(s) >= 4 and not s.startswith("part_"):
                zh_parts.append(s)
        elif re.match(r"^[A-Za-z\"']", s) and len(s) >= 8:
            en_parts.append(s)
    # Heuristic: after metadata header, en/zh counts should align for body paragraphs
    # Skip title duplicates at start by finding first long en
    en_body = [s for s in en_parts if len(s) > 30]
    zh_body = [s for s in zh_parts if len(s) > 4 and "傲慢" not in s and "第一章" not in s]
    n = min(len(en_body), len(zh_body))
    paragraphs = []
    for idx in range(n):
        paragraphs.append({"seq": idx, "en": en_body[idx], "zh": zh_body[idx]})
    return paragraphs


book = load_pz("pride_and_prejudice/book.pz")
ids = re.findall(r"part_\d+_art_\d+", book.decode("utf-8", "replace"))
print("articles", len(ids))

for art_id in ids[:3]:
    seg, art = re.match(r"part_(\d+)_art_(\d+)", art_id).groups()
    path = f"pride_and_prejudice/article_part_{seg}_art_{art}__zh_en.pz"
    blob = load_pz(path)
    paras = parse_article_paragraphs(blob)
    print(art_id, "paragraphs", len(paras))
    if paras:
        print("  en:", paras[0]["en"][:90])
        print("  zh:", paras[0]["zh"][:50])
