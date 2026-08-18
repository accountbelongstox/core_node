import re
import urllib.request
import bz2

CDN = "https://dl-public.xiangyin.mobi/multi_lang_read/"


def load_pz(path: str) -> bytes:
    url = CDN + path
    raw = urllib.request.urlopen(url, timeout=30).read()
    return bz2.decompress(bytes(b ^ 175 for b in raw))


def article_ids_from_book(book_bytes: bytes) -> list[str]:
    text = book_bytes.decode("utf-8", "replace")
    return re.findall(r"part_\d+_art_\d+", text)


def extract_bilingual_strings(blob: bytes) -> tuple[list[str], list[str]]:
    text = blob.decode("utf-8", "replace")
    en = re.findall(r"[A-Za-z][A-Za-z0-9 ,.;:'\"!?()\-]{20,}", text)
    zh = re.findall(r"[\u4e00-\u9fff，。；：、？！（）—\-\s]{6,}", text)
    return en, zh


book = load_pz("pride_and_prejudice/book.pz")
ids = article_ids_from_book(book)
print(f"book articles: {len(ids)} first={ids[:3]}")

art = load_pz("pride_and_prejudice/article_part_0_art_0__zh_en.pz")
en, zh = extract_bilingual_strings(art)
print(f"ch0 en={len(en)} zh={len(zh)}")
if en:
    print(f"  en[0][:120]={en[0][:120]}")
if zh:
    print(f"  zh[0][:80]={zh[0][:80]}")
