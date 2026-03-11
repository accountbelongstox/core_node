# -*- coding: utf-8 -*-
"""
Fetch all images listed in "Media in category" on a Fandom (MediaWiki) category page.
Uses MediaWiki API when available; if API returns HTML (e.g. archive wikis), falls back
to embedded file list + scraping each File page for image URL (og:image).
Example: https://diablo-archive.fandom.com/wiki/Category:Diablo_III_gem_icons

Note: Some Fandom archive wikis return HTML instead of JSON from the API in certain networks.
If no image URLs are resolved, try running from a different network or use --list-only to get
the file list and fetch images via browser/other tool.
"""
import hashlib
import re
import time
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

import requests

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "out_fandom_images"
BATCH_IMAGEINFO = 50

# Fallback when categorymembers API returns HTML (e.g. diablo-archive). Full list from category.
DIABLO_III_GEM_ICONS_FILES = [
    "File:Amethyst.png", "File:Bane of the Powerful.png", "File:Bane of the Stricken.png",
    "File:Bane of the Trapped.png", "File:Boon of the Hoarder.png", "File:Boyarsky's Chip.png",
    "File:Chipped Amethyst.png", "File:Chipped Diamond.png", "File:Chipped Emerald.png",
    "File:Chipped Ruby.png", "File:Chipped Topaz.png", "File:D3 Gem Chart.png",
    "File:Diamond.png", "File:Emerald.png", "File:Enforcer.png", "File:Esoteric Alteration.png",
    "File:Flawed Amethyst.png", "File:Flawed Diamond.png", "File:Flawed Emerald.png",
    "File:Flawed Ruby.png", "File:Flawed Topaz.png", "File:Flawless Amethyst.png",
    "File:Flawless Diamond.png", "File:Flawless Emerald.png", "File:Flawless Imperial Amethyst.png",
    "File:Flawless Imperial Diamond.png", "File:Flawless Imperial Emerald.png",
    "File:Flawless Imperial Ruby.png", "File:Flawless Imperial Topaz.png",
    "File:Flawless Round Diamond.png", "File:Flawless Round Sapphire.png",
    "File:Flawless Royal Amethyst.png", "File:Flawless Royal Diamond.png",
    "File:Flawless Royal Emerald.png", "File:Flawless Royal Ruby.png", "File:Flawless Royal Topaz.png",
    "File:Flawless Ruby.png", "File:Flawless Square Amethyst.png", "File:Flawless Square Diamond.png",
    "File:Flawless Square Emerald.png", "File:Flawless Square Ruby.png", "File:Flawless Square Sapphire.png",
    "File:Flawless Square Topaz.png", "File:Flawless Star Amethyst.png", "File:Flawless Star Diamond.png",
    "File:Flawless Star Emerald.png", "File:Flawless Star Ruby.png", "File:Flawless Star Sapphire.png",
    "File:Flawless Star Topaz.png", "File:Flawless Topaz.png", "File:Gem of Ease.png",
    "File:Gem of Efficacious Toxin.png", "File:Gogok of Swiftness.png", "File:Iceblink.png",
    "File:Imperial Amethyst.png", "File:Imperial Diamond.png", "File:Imperial Emerald.png",
    "File:Imperial Ruby.png", "File:Imperial Topaz.png", "File:Invigorating Gemstone.png",
    "File:Marquise Amethyst.png", "File:Marquise Diamond.png", "File:Marquise Emerald.png",
    "File:Marquise Ruby.png", "File:Marquise Topaz.png", "File:Mirinae, Teardrop of the Starweaver.png",
    "File:Molten Wildebeest's Gizzard.png", "File:Moratorium.png", "File:Mutilation Guard.png",
    "File:Pain Enhancer.png", "File:Perfect Amethyst.png", "File:Perfect Emerald.png",
    "File:Perfect Ruby.png", "File:Perfect Square Amethyst.png", "File:Perfect Square Emerald.png",
    "File:Perfect Square Ruby.png", "File:Perfect Square Topaz.png", "File:Perfect Star Amethyst.png",
    "File:Perfect Star Emerald.png", "File:Perfect Star Ruby.png", "File:Perfect Star Topaz.png",
    "File:Perfect Topaz.png", "File:Radiant Amethyst.png", "File:Radiant Diamond.png",
    "File:Radiant Emerald.png", "File:Radiant Round Diamond.png", "File:Radiant Round Sapphire.png",
    "File:Radiant Ruby.png", "File:Radiant Sapphire.png", "File:Radiant Square Amethyst.png",
    "File:Radiant Square Diamond.png", "File:Radiant Square Emerald.png", "File:Radiant Square Ruby.png",
    "File:Radiant Square Sapphire.png", "File:Radiant Square Topaz.png", "File:Radiant Star Amethyst.png",
    "File:Radiant Star Diamond.png", "File:Radiant Star Emerald.png", "File:Radiant Star Ruby.png",
    "File:Radiant Star Sapphire.png", "File:Radiant Star Topaz.png", "File:Radiant Topaz.png",
    "File:Round Diamond.png", "File:Round Sapphire.png", "File:Royal Amethyst.png",
    "File:Royal Diamond.png", "File:Royal Emerald.png", "File:Royal Ruby.png", "File:Royal Topaz.png",
    "File:Ruby.png", "File:Simplicity's Strength.png", "File:Square Amethyst.png", "File:Square Diamond.png",
    "File:Square Emerald.png", "File:Square Ruby.png", "File:Square Sapphire.png", "File:Square Topaz.png",
    "File:Star Amethyst.png", "File:Star Diamond.png", "File:Star Emerald.png", "File:Star Ruby.png",
    "File:Star Sapphire.png", "File:Star Topaz.png", "File:Taeguk.png", "File:Topaz.png",
    "File:Wreath of Lightning.png", "File:Zei's Stone of Vengeance.png",
]


def get_api_base(category_url: str) -> str:
    parsed = urlparse(category_url)
    return f"{parsed.scheme}://{parsed.netloc}"


def get_category_title_from_url(category_url: str) -> str:
    """From .../wiki/Category:Diablo_III_gem_icons return 'Category:Diablo_III_gem_icons'."""
    path = urlparse(category_url).path or ""
    if "/wiki/" in path:
        title = path.split("/wiki/")[-1]
        return unquote(title.replace("+", " ").strip("/"))
    return ""


def fetch_category_files(api_base: str, cmtitle: str, session: requests.Session) -> list[str]:
    """List all files in category via API (categorymembers, cmtype=file). Returns list of File: titles."""
    url = f"{api_base}/api.php"
    out = []
    cmcontinue = None
    while True:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": cmtitle,
            "cmtype": "file",
            "cmlimit": 500,
            "format": "json",
        }
        if cmcontinue:
            params["cmcontinue"] = cmcontinue
        r = session.get(url, params=params, timeout=15)
        r.raise_for_status()
        if not r.text.strip():
            raise RuntimeError(
                f"Empty response from API (status {r.status_code}). "
                "Try in browser: " + r.url
            )
        try:
            data = r.json()
        except ValueError:
            return []  # API returned HTML; caller can use fallback list
        for m in data.get("query", {}).get("categorymembers", []):
            out.append(m["title"])
        cmcontinue = data.get("continue", {}).get("cmcontinue")
        if not cmcontinue:
            break
    return out


def get_image_urls_batch(api_base: str, file_titles: list[str], session: requests.Session) -> dict[str, str]:
    """Batch query imageinfo; returns dict file_title -> url. Returns {} if API returns HTML."""
    if not file_titles:
        return {}
    url = f"{api_base}/api.php"
    params = {
        "action": "query",
        "titles": "|".join(file_titles),
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json",
    }
    r = session.get(url, params=params, timeout=30)
    r.raise_for_status()
    if not r.text.strip() or not r.text.strip().startswith("{"):
        return {}
    try:
        data = r.json()
    except ValueError:
        return {}
    result = {}
    for _pid, page in data.get("query", {}).get("pages", {}).items():
        title = page.get("title", "")
        info = page.get("imageinfo")
        if info and len(info) > 0:
            result[title] = info[0].get("url", "")
    return result


def get_image_url_from_file_page(wiki_base: str, file_title: str, session: requests.Session) -> str | None:
    """Scrape File page HTML for image URL (og:image or full-size link). Used when API returns HTML."""
    path = "wiki/" + quote(file_title.replace(" ", "_"))
    url = f"{wiki_base.rstrip('/')}/{path}"
    r = session.get(url, timeout=15)
    r.raise_for_status()
    html = r.text
    m = re.search(r'<meta\s+property="og:image"\s+content="([^"]+)"', html, re.I)
    if m:
        return m.group(1)
    m = re.search(r'<a[^>]+class="[^"]*internal[^"]*"[^>]+href="(https?://[^"]+)"', html, re.I)
    if m:
        return m.group(1)
    m = re.search(r'<img[^>]+src="(https?://[^"]+)"[^>]+alt="[^"]*' + re.escape(file_title) + r'[^"]*"', html, re.I)
    if m:
        return m.group(1)
    return None


def get_image_url_wikia_static(wiki_dbname: str, file_title: str) -> str | None:
    """Build Fandom static image URL: static.wikia.nocookie.net/{dbname}/images/{a}/{ab}/{filename}."""
    display = file_title.replace("File:", "", 1).strip() if file_title.startswith("File:") else file_title
    # MD5 of filename (Fandom uses filename as stored)
    raw = display.replace(" ", "_")
    h = hashlib.md5(raw.encode("utf-8")).hexdigest()
    a, ab = h[0], h[:2]
    base = f"https://static.wikia.nocookie.net/{wiki_dbname}/images"
    return f"{base}/{a}/{ab}/{quote(raw)}"


def download_image(url: str, path: Path, session: requests.Session) -> bool:
    r = session.get(url, timeout=30, stream=True)
    r.raise_for_status()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    return True


def safe_filename(name: str) -> str:
    for c in ('/', '\\', ':', '*', '?', '"', '<', '>', '|'):
        name = name.replace(c, "_")
    return name or "unnamed"


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fetch all images from a Fandom category page.")
    parser.add_argument(
        "url",
        nargs="?",
        default="https://diablo-archive.fandom.com/wiki/Category:Diablo_III_gem_icons",
        help="Category page URL",
    )
    parser.add_argument(
        "-o", "--out-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Output directory for images",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.2,
        help="Delay between downloads (seconds)",
    )
    parser.add_argument(
        "--list-only",
        action="store_true",
        help="Only print the list of File: titles (no fetch/download)",
    )
    args = parser.parse_args()

    if args.list_only:
        api_base = get_api_base(args.url)
        cmtitle = get_category_title_from_url(args.url) or "Category:Diablo_III_gem_icons"
        session = requests.Session()
        session.headers["User-Agent"] = USER_AGENT
        session.headers["Accept"] = "application/json"
        file_titles = fetch_category_files(api_base, cmtitle, session)
        if not file_titles and cmtitle == "Category:Diablo_III_gem_icons":
            file_titles = list(DIABLO_III_GEM_ICONS_FILES)
        for t in file_titles:
            print(t)
        return

    api_base = get_api_base(args.url)
    cmtitle = get_category_title_from_url(args.url)
    if not cmtitle or not cmtitle.startswith("Category:"):
        cmtitle = "Category:Diablo_III_gem_icons"
        if api_base.endswith("diablo-archive.fandom.com"):
            pass
        else:
            print("Could not infer category from URL; use e.g. .../wiki/Category:Your_Category")
            return
    out_dir = args.out_dir.resolve()
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    session.headers["Accept"] = "application/json"

    print(f"Listing files in category: {cmtitle}")
    file_titles = fetch_category_files(api_base, cmtitle, session)
    if not file_titles and cmtitle == "Category:Diablo_III_gem_icons":
        print("API returned HTML (e.g. archive wiki); using embedded file list.")
        file_titles = list(DIABLO_III_GEM_ICONS_FILES)
    if not file_titles:
        print("No files found. If API returned HTML, only Category:Diablo_III_gem_icons has a fallback list.")
        return
    print(f"Found {len(file_titles)} files in Media in category.")

    title_to_url = {}
    for i in range(0, len(file_titles), BATCH_IMAGEINFO):
        batch = file_titles[i : i + BATCH_IMAGEINFO]
        title_to_url.update(get_image_urls_batch(api_base, batch, session))
        time.sleep(args.delay)
    if not title_to_url and file_titles:
        print("Imageinfo API returned HTML; scraping each File page for image URL...")
        for ft in file_titles:
            time.sleep(args.delay)
            u = get_image_url_from_file_page(api_base, ft, session)
            if u:
                title_to_url[ft] = u
    if not title_to_url and file_titles and "diablo-archive" in api_base:
        print("Trying Fandom static image URLs (diablo-archive)...")
        wiki_db = "diablo-archive"
        for ft in file_titles:
            time.sleep(args.delay)
            u = get_image_url_wikia_static(wiki_db, ft)
            try:
                head = session.head(u, timeout=10, allow_redirects=True)
                if head.status_code == 200 and (head.headers.get("content-type") or "").startswith("image/"):
                    title_to_url[ft] = head.url or u
            except Exception:
                pass
    print(f"Resolved {len(title_to_url)} image URLs.")

    ok = 0
    fail = 0
    for file_title in file_titles:
        url = title_to_url.get(file_title)
        if not url:
            print(f"  skip (no URL): {file_title}")
            fail += 1
            continue
        display_name = file_title.replace("File:", "", 1) if file_title.startswith("File:") else file_title
        fname = safe_filename(display_name)
        if not fname.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
            fname = fname + ".png"
        path = out_dir / fname
        try:
            download_image(url, path, session)
            print(f"  ok: {path.name}")
            ok += 1
        except Exception as e:
            print(f"  fail {path.name}: {e}")
            fail += 1
        time.sleep(args.delay)

    print(f"Done. {ok} downloaded, {fail} failed. Output: {out_dir}")


if __name__ == "__main__":
    main()
