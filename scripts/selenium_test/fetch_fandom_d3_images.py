# -*- coding: utf-8 -*-
"""
Fetch Fandom Diablo III wiki images to pyapps/d3-check/images with category subdirs.
- Recursive category mode: start from Category:Diablo_III_weapon_icons and
  Category:Diablo_III_armor_icons, follow subcategory links until a page with
  .mw-gallery-traditional (Media in category) is found, then scroll and download.
- Single category/gallery: same as above for one URL.
Uses Selenium + pycore third_party and browser_finder.
"""
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from pycore.pyfoundations.third_party.api import get_third_package_selenium, get_third_package_webdriver_manager, get_third_package_requests
from pycore.pyutils.pybrowser.utils.browser_finder import find_browser, find_driver

BASE_IMAGES_DIR = _REPO_ROOT / "pyapps" / "d3-check" / "images"
WIKI_BASE = "https://diablo-archive.fandom.com/wiki/"
WIKI_DOMAIN = "diablo-archive.fandom.com"
SCROLL_PAUSE = 0.4
PAGE_LOAD_WAIT = 15

# Root category pages: recurse into subcategories until we find gallery pages.
CATEGORY_ROOT_URLS = [
    "https://diablo-archive.fandom.com/wiki/Category:Diablo_III_weapon_icons",
    "https://diablo-archive.fandom.com/wiki/Category:Diablo_III_armor_icons",
]


def slug_from_url(url: str) -> str:
    path = urlparse(url).path
    part = path.rstrip("/").split("/")[-1] if path else ""
    return re.sub(r"[^\w\-]", "_", part).strip("_") or "unnamed"


def category_slug_from_url(url: str) -> str:
    """Category:Diablo_III_weapon_icons -> Diablo_III_weapon_icons (safe dir name)."""
    s = slug_from_url(url)
    if s.lower().startswith("category_"):
        s = s[9:]
    return s or "unnamed"


def safe_filename(name: str) -> str:
    for c in ("/", "\\", ":", "*", "?", '"', "<", ">", "|"):
        name = name.replace(c, "_")
    return name or "unnamed"


def extract_filename_from_url(url: str) -> str:
    if not url:
        return "unnamed.png"
    path = url.split("?")[0].rstrip("/")
    if "/revision/" in path:
        path = path.split("/revision/")[0]
    name = path.split("/")[-1] if "/" in path else path
    return name or "unnamed.png"


def is_fandom_image_url(url: str) -> bool:
    if not url or not isinstance(url, str):
        return False
    return "static.wikia" in url or "wikia.nocookie" in url


def has_gallery(driver, By) -> bool:
    """True if page has .mw-gallery-traditional (Media in category)."""
    try:
        els = driver.find_elements(By.CSS_SELECTOR, ".gallery.mw-gallery-traditional")
        return len(els) > 0
    except Exception:
        return False


def get_subcategory_links(driver, By) -> list:
    """From a category page, return [(full_url, category_slug)] for each subcategory link."""
    out = []
    seen = set()
    try:
        content = driver.find_element(By.ID, "mw-content-text")
    except Exception:
        return []
    for a in content.find_elements(By.CSS_SELECTOR, "a[href*='Category:']"):
        try:
            href = a.get_attribute("href")
            if not href or WIKI_DOMAIN not in href or "Category:" not in href:
                continue
            raw = href.split("?")[0].rstrip("/")
            if raw in seen:
                continue
            seen.add(raw)
            slug = category_slug_from_url(raw)
            out.append((href, slug))
        except Exception:
            pass
    return out


def collect_from_gallery(driver, By, wait) -> list:
    """Collect (url, filename) from .mw-gallery-traditional with scroll."""
    try:
        wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, ".mw-gallery-traditional"))
    except Exception:
        return []
    gallery = driver.find_elements(By.CSS_SELECTOR, ".gallery.mw-gallery-traditional")
    if not gallery:
        return []
    gallery = gallery[0]
    boxes = gallery.find_elements(By.CSS_SELECTOR, "li.gallerybox")
    for box in boxes:
        try:
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", box)
        except Exception:
            pass
        time.sleep(SCROLL_PAUSE)
    time.sleep(0.8)
    seen = set()
    out = []
    for a in gallery.find_elements(By.CSS_SELECTOR, ".thumb a.mw-file-description.image, .thumb a.image"):
        try:
            href = a.get_attribute("href")
            if href and is_fandom_image_url(href) and href not in seen:
                seen.add(href)
                out.append((href, extract_filename_from_url(href)))
        except Exception:
            pass
    if not out:
        for img in gallery.find_elements(By.CSS_SELECTOR, ".thumb img"):
            try:
                src = img.get_attribute("src") or img.get_attribute("data-src")
                if src and is_fandom_image_url(src) and src not in seen:
                    seen.add(src)
                    out.append((src, extract_filename_from_url(src)))
            except Exception:
                pass
    return out


def collect_from_content(driver, By) -> list:
    """Collect (url, filename) from #mw-content-text images (list/recipe pages)."""
    out = []
    seen = set()
    try:
        content = driver.find_element(By.ID, "mw-content-text")
    except Exception:
        return []
    for img in content.find_elements(By.CSS_SELECTOR, "img"):
        try:
            src = img.get_attribute("src") or img.get_attribute("data-src")
            if not src or not is_fandom_image_url(src) or src in seen:
                continue
            alt = (img.get_attribute("alt") or "").strip()
            name = extract_filename_from_url(src)
            if alt and re.search(r"\.(png|jpg|jpeg|gif|webp)$", name, re.I):
                base = name.rsplit(".", 1)[0]
                if not base or base == "unnamed":
                    name = safe_filename(alt) + (".png" if not alt.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")) else "")
            seen.add(src)
            out.append((src, name))
        except Exception:
            pass
    return out


def download_urls(session, urls_with_names: list, out_dir: Path) -> tuple:
    ok, fail = 0, 0
    for url, name in urls_with_names:
        fname = safe_filename(name)
        if not re.search(r"\.(png|jpg|jpeg|gif|webp)$", fname, re.I):
            fname = fname + ".png"
        path = out_dir / fname
        if path.exists():
            ok += 1
            continue
        try:
            r = session.get(url, timeout=30, stream=True)
            r.raise_for_status()
            with open(path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
            ok += 1
        except Exception:
            fail += 1
        time.sleep(0.12)
    return ok, fail


def run_one(driver, session, By, wait, url: str, subdir: str, base_dir: Path) -> int:
    out_dir = base_dir / subdir
    out_dir.mkdir(parents=True, exist_ok=True)
    full_url = url if url.startswith("http") else (WIKI_BASE + url.replace(" ", "_"))
    try:
        driver.get(full_url)
        time.sleep(1.5)
    except Exception as e:
        print(f"  get failed {subdir}: {e}")
        return 0
    urls_with_names = collect_from_gallery(driver, By, wait)
    if not urls_with_names:
        urls_with_names = collect_from_content(driver, By)
    if not urls_with_names:
        print(f"  {subdir}: no images found")
        return 0
    ok, fail = download_urls(session, urls_with_names, out_dir)
    n_files = len(list(out_dir.glob("*.*")))
    print(f"  {subdir}: {len(urls_with_names)} collected, {ok} ok, {fail} fail -> {out_dir} ({n_files} files)")
    return n_files


def crawl_category_recursive(
    driver, session, By, wait,
    url: str,
    base_subdir: str,
    base_dir: Path,
    visited: set,
) -> int:
    """
    Open category url; if it has .mw-gallery-traditional, download to base_dir/base_subdir.
    Else get subcategory links and recurse into each (base_subdir/sub_slug).
    """
    key = url.split("?")[0].rstrip("/")
    if key in visited:
        return 0
    visited.add(key)
    try:
        driver.get(url)
        time.sleep(1.2)
    except Exception as e:
        print(f"  get failed {base_subdir}: {e}")
        return 0
    if has_gallery(driver, By):
        out_dir = base_dir / base_subdir
        out_dir.mkdir(parents=True, exist_ok=True)
        urls_with_names = collect_from_gallery(driver, By, wait)
        if not urls_with_names:
            return 0
        ok, fail = download_urls(session, urls_with_names, out_dir)
        n = len(list(out_dir.glob("*.*")))
        print(f"  [gallery] {base_subdir}: {len(urls_with_names)} images -> {out_dir} ({n} files)")
        return n
    subcats = get_subcategory_links(driver, By)
    total = 0
    for sub_url, sub_slug in subcats:
        subdir = f"{base_subdir}/{sub_slug}" if base_subdir else sub_slug
        total += crawl_category_recursive(driver, session, By, wait, sub_url, subdir, base_dir, visited)
    return total


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Fetch Fandom D3 images: --recursive from weapon/armor category roots, or single URL."
    )
    parser.add_argument("-o", "--out-dir", type=Path, default=BASE_IMAGES_DIR, help="Base images directory")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument(
        "--recursive",
        action="store_true",
        help="Recurse from Category:Diablo_III_weapon_icons and armor_icons until gallery pages.",
    )
    parser.add_argument("url", nargs="?", help="Single category/page URL (optional if --recursive)")
    parser.add_argument("--subdir", default=None, help="Subdir name when using single URL")
    args = parser.parse_args()

    selenium = get_third_package_selenium()
    wdm = get_third_package_webdriver_manager()
    if selenium is None or wdm is None:
        print("Selenium or webdriver-manager not available.")
        return 1

    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options

    base_dir = args.out_dir.resolve()
    base_dir.mkdir(parents=True, exist_ok=True)
    requests_pkg = get_third_package_requests()
    if requests_pkg is None:
        print("requests not available.")
        return 1
    session = requests_pkg.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

    options = Options()
    if args.headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")

    driver = None
    chrome_bin = find_browser("chrome")
    driver_path = find_driver("chrome")
    if chrome_bin:
        options.binary_location = chrome_bin
    if driver_path and chrome_bin:
        try:
            driver = selenium.webdriver.Chrome(service=Service(driver_path), options=options)
        except Exception:
            pass
    if driver is None:
        try:
            ChromeDriverManager = getattr(wdm.chrome, "ChromeDriverManager", None) or __import__("webdriver_manager.chrome", fromlist=["ChromeDriverManager"]).ChromeDriverManager
            driver = selenium.webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
        except Exception:
            try:
                from selenium.webdriver.edge.service import Service as EdgeService
                from selenium.webdriver.edge.options import Options as EdgeOptions
                EdgeDriverManager = getattr(wdm.microsoft, "EdgeChromiumDriverManager", None)
                if EdgeDriverManager is None:
                    from webdriver_manager.microsoft import EdgeChromiumDriverManager as EdgeDriverManager
                driver = selenium.webdriver.Edge(service=EdgeService(EdgeDriverManager().install()), options=EdgeOptions())
            except Exception:
                pass
    if driver is None:
        print("Could not start browser.")
        return 1

    driver.implicitly_wait(5)
    wait = WebDriverWait(driver, PAGE_LOAD_WAIT)

    if args.recursive:
        visited = set()
        for root_url in CATEGORY_ROOT_URLS:
            base_subdir = category_slug_from_url(root_url)
            if base_subdir.lower().startswith("diablo_iii_"):
                base_subdir = base_subdir[11:]
            crawl_category_recursive(
                driver, session, By, wait, root_url, base_subdir, base_dir, visited
            )
        driver.quit()
        print(f"Recursive crawl done. Base output: {base_dir}")
        return 0

    if args.url:
        subdir = args.subdir or category_slug_from_url(args.url)
        run_one(driver, session, By, wait, args.url, subdir, base_dir)
        driver.quit()
        print(f"Base output: {base_dir}")
        return 0

    print("Use --recursive or provide a single URL.")
    driver.quit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
