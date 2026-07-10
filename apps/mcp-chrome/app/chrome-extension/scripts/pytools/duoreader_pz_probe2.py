import re
import urllib.request
import bz2

CDN = "https://dl-public.xiangyin.mobi/multi_lang_read/"


def load_pz(path: str) -> bytes:
    raw = urllib.request.urlopen(CDN + path, timeout=30).read()
    return bz2.decompress(bytes(b ^ 175 for b in raw))


def read_varint(data, i):
    shift = 0
    result = 0
    while True:
        b = data[i]
        i += 1
        result |= (b & 0x7F) << shift
        if not (b & 0x80):
            break
        shift += 7
    return result, i


def walk_strings(data: bytes, out: list):
    i = 0
    while i < len(data):
        try:
            tag, i = read_varint(data, i)
        except Exception:
            break
        wt = tag & 7
        if wt == 0:
            _, i = read_varint(data, i)
        elif wt == 2:
            ln, i = read_varint(data, i)
            chunk = data[i : i + ln]
            i += ln
            try:
                s = chunk.decode("utf-8")
                if len(s) >= 2:
                    out.append(s)
            except Exception:
                walk_strings(chunk, out)
        elif wt == 1:
            i += 8
        elif wt == 5:
            i += 4
        else:
            break


art = load_pz("pride_and_prejudice/article_part_0_art_0__zh_en.pz")
strings = []
walk_strings(art, strings)
# filter sentence-like
en = [s for s in strings if re.match(r"^[A-Za-z0-9]", s) and len(s) > 15]
zh = [s for s in strings if re.search(r"[\u4e00-\u9fff]", s) and len(s) > 4]
print("walk strings", len(strings))
print("en", len(en), en[:2])
print("zh", len(zh), zh[:2])
# pair by min length
pairs = list(zip(en[: min(len(en), len(zh))], zh[: min(len(en), len(zh))]))
print("pairs", len(pairs))
if pairs:
    print("pair0 en", pairs[0][0][:100])
    print("pair0 zh", pairs[0][1][:60])
