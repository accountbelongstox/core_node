import re
import urllib.request
import bz2

CDN = "https://dl-public.xiangyin.mobi/multi_lang_read/"


def load_pz(path: str) -> bytes:
    raw = urllib.request.urlopen(CDN + path, timeout=30).read()
    return bz2.decompress(bytes(b ^ 175 for b in raw))


blob = load_pz("pride_and_prejudice/article_part_0_art_0__zh_en.pz")
# show all length-prefixed strings >= 10 chars
i = 0
found = []
while i < len(blob) - 2:
    tag = blob[i]
    if tag in (0x0A, 0x12, 0x1A, 0x22, 0x2A, 0x32):
        ln = blob[i + 1]
        if 4 <= ln <= 200 and i + 2 + ln <= len(blob):
            chunk = blob[i + 2 : i + 2 + ln]
            try:
                s = chunk.decode("utf-8").strip()
                if len(s) >= 10:
                    found.append((tag, ln, s[:100]))
            except Exception:
                pass
            i += 2 + ln
            continue
    i += 1

print("strings", len(found))
for item in found[:30]:
    print(item)
